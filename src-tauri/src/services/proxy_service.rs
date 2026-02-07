//! Proxy Service - HTTP proxy server implementation
//!
//! Handles the HTTP proxy server that forwards traffic to SOCKS5.
//! Based on the Electron ProxyService.ts implementation.

use crate::error::AppResult;
use crate::services::SettingsService;
use http_body_util::combinators::BoxBody;
use http_body_util::{BodyExt, Empty, Full};
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use log::{debug, error, info};
use serde::Serialize;
use socks::Socks5Stream;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio::time::Duration;
use std::pin::Pin;

const HTTP_PROXY_PORT: u16 = 8080;
const SOCKS5_PORT: u16 = 5201;

#[derive(Debug, Clone, Serialize)]
pub struct TrafficUpdate {
    pub up: u64,
    pub down: u64,
}

/// Empty body for responses
/// Helper to box bodies for easier return types
fn full<T: Into<Bytes>>(chunk: T) -> BoxedBody {
    Full::new(chunk.into())
        .map_err(|never| match never {})
        .boxed()
}

fn empty() -> BoxedBody {
    Empty::<Bytes>::new()
        .map_err(|never| match never {})
        .boxed()
}

type BoxedBody = BoxBody<Bytes, hyper::Error>;

/// Traffic counter for monitoring bandwidth
#[derive(Clone)]
struct TrafficCounter {
    uplink: Arc<AtomicU64>,
    downlink: Arc<AtomicU64>,
    prev_uplink: Arc<AtomicU64>,
    prev_downlink: Arc<AtomicU64>,
}

impl TrafficCounter {
    fn new() -> Self {
        Self {
            uplink: Arc::new(AtomicU64::new(0)),
            downlink: Arc::new(AtomicU64::new(0)),
            prev_uplink: Arc::new(AtomicU64::new(0)),
            prev_downlink: Arc::new(AtomicU64::new(0)),
        }
    }

    fn add_uplink(&self, bytes: u64) {
        self.uplink.fetch_add(bytes, Ordering::Relaxed);
    }

    fn add_downlink(&self, bytes: u64) {
        self.downlink.fetch_add(bytes, Ordering::Relaxed);
    }

    fn get_and_reset_speed(&self) -> (u64, u64) {
        let now_up = self.uplink.load(Ordering::Relaxed);
        let now_down = self.downlink.load(Ordering::Relaxed);
        let prev_up = self.prev_uplink.swap(now_up, Ordering::Relaxed);
        let prev_down = self.prev_downlink.swap(now_down, Ordering::Relaxed);

        let speed_up = now_up.saturating_sub(prev_up);
        let speed_down = now_down.saturating_sub(prev_down);

        (speed_up, speed_down)
    }
}

pub struct ProxyService {
    _settings: Arc<SettingsService>,
    http_proxy_running: Arc<AtomicBool>,
    socks_forward_running: Arc<AtomicBool>,
    http_proxy_abort: Arc<RwLock<Option<tokio::sync::oneshot::Sender<()>>>>,
    socks_forward_abort: Arc<RwLock<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub traffic_tx: broadcast::Sender<TrafficUpdate>,
    traffic: TrafficCounter,
}

impl ProxyService {
    pub fn new(settings: Arc<SettingsService>) -> Self {
        let (tx, _) = broadcast::channel(100);
        let traffic = TrafficCounter::new();

        Self {
            _settings: settings,
            http_proxy_running: Arc::new(AtomicBool::new(false)),
            socks_forward_running: Arc::new(AtomicBool::new(false)),
            http_proxy_abort: Arc::new(RwLock::new(None)),
            socks_forward_abort: Arc::new(RwLock::new(None)),
            traffic_tx: tx,
            traffic,
        }
    }

    pub async fn start_http_proxy(&self) -> AppResult<()> {
        if self.is_http_proxy_running() {
            return Ok(());
        }

        info!("Starting HTTP Proxy on port {}", HTTP_PROXY_PORT);

        let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
        {
            let mut abort = self.http_proxy_abort.write().map_err(|_| "Lock error")?;
            *abort = Some(tx);
        }

        let running = self.http_proxy_running.clone();
        running.store(true, Ordering::Relaxed);

        let traffic = self.traffic.clone();
        let traffic_tx = self.traffic_tx.clone();
        let _settings = self._settings.clone();

        tokio::spawn(async move {
            let listener = match TcpListener::bind(format!("0.0.0.0:{}", HTTP_PROXY_PORT)).await {
                Ok(l) => {
                    info!("HTTP Proxy listening on port {}", HTTP_PROXY_PORT);
                    l
                }
                Err(e) => {
                    error!("Failed to bind HTTP proxy: {}", e);
                    running.store(false, Ordering::Relaxed);
                    return;
                }
            };

            // Start traffic monitoring task
            let traffic_for_monitor = traffic.clone();
            let traffic_tx_monitor = traffic_tx.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(1));
                loop {
                    interval.tick().await;
                    let (up, down) = traffic_for_monitor.get_and_reset_speed();
                    let _ = traffic_tx_monitor.send(TrafficUpdate { up, down });
                }
            });

            // Accept connections
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, peer_addr)) => {
                                let traffic_clone = traffic.clone();
                                let settings_clone = _settings.clone();

                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(stream, peer_addr, settings_clone, traffic_clone).await {
                                        debug!("Error handling connection: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                error!("Error accepting connection: {}", e);
                            }
                        }
                    }
                    _ = &mut rx => {
                        info!("HTTP Proxy server task stopped via abort");
                        break;
                    }
                }
            }

            running.store(false, Ordering::Relaxed);
        });

        Ok(())
    }

    pub async fn start_socks_forward_proxy(&self) -> AppResult<()> {
        if self.is_socks_forward_running() {
            return Ok(());
        }

        let port = 10809;
        info!("Starting SOCKS-to-HTTP Bridge on port {}", port);

        let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
        {
            let mut abort = self.socks_forward_abort.write().map_err(|_| "Lock error")?;
            *abort = Some(tx);
        }

        let running = self.socks_forward_running.clone();
        running.store(true, Ordering::Relaxed);

        let traffic = self.traffic.clone();
        let _settings = self._settings.clone();

        tokio::spawn(async move {
            let listener = match TcpListener::bind(format!("0.0.0.0:{}", port)).await {
                Ok(l) => {
                    info!("SOCKS-to-HTTP Bridge listening on port {}", port);
                    l
                }
                Err(e) => {
                    error!("Failed to bind SOCKS-to-HTTP Bridge: {}", e);
                    running.store(false, Ordering::Relaxed);
                    return;
                }
            };

            info!("SOCKS-to-HTTP Bridge task started");
            
            // Accept connections
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _peer_addr)) => {
                                let traffic_clone = traffic.clone();
                                let settings_clone = _settings.clone();

                                tokio::spawn(async move {
                                    if let Err(e) = handle_socks_bridge_connection(stream, traffic_clone, settings_clone).await {
                                        debug!("Error handling SOCKS bridge connection: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                error!("Error accepting SOCKS bridge connection: {}", e);
                            }
                        }
                    }
                    _ = &mut rx => {
                        info!("SOCKS-to-HTTP Bridge task stopped via abort");
                        break;
                    }
                }
            }

            running.store(false, Ordering::Relaxed);
        });

        Ok(())
    }

    pub fn stop_http_proxy(&self) {
        if let Ok(mut abort) = self.http_proxy_abort.write() {
            if let Some(tx) = abort.take() {
                let _ = tx.send(());
            }
        }
        self.http_proxy_running.store(false, Ordering::Relaxed);
    }

    pub fn stop_socks_forward_proxy(&self) {
        if let Ok(mut abort) = self.socks_forward_abort.write() {
            if let Some(tx) = abort.take() {
                let _ = tx.send(());
            }
        }
        self.socks_forward_running.store(false, Ordering::Relaxed);
    }

    pub fn stop_all(&self) {
        self.stop_http_proxy();
        self.stop_socks_forward_proxy();
    }

    pub fn is_http_proxy_running(&self) -> bool {
        self.http_proxy_running.load(Ordering::Relaxed)
    }

    pub fn is_socks_forward_running(&self) -> bool {
        self.socks_forward_running.load(Ordering::Relaxed)
    }

    #[allow(dead_code)]
    pub fn get_status(&self) -> serde_json::Value {
        serde_json::json!({
            "httpProxyRunning": self.is_http_proxy_running(),
            "httpProxyPort": HTTP_PROXY_PORT,
            "socksForwardRunning": self.is_socks_forward_running(),
            "socksForwardPort": 10809,
            "socks5Port": SOCKS5_PORT
        })
    }
}

async fn handle_connection(
    stream: TcpStream,
    _peer_addr: SocketAddr,
    _settings: Arc<SettingsService>,
    _traffic: TrafficCounter,
) -> AppResult<()> {
    let io = TokioIo::new(stream);
    let service = service_fn(move |req| handle_request(req, _settings.clone(), _traffic.clone()));

    let conn = http1::Builder::new()
        .serve_connection(io, service);
    
    // Crucial for Hyper 1.x: explicitly enable upgrades on the connection
    let mut conn = conn.with_upgrades();

    if let Err(err) = Pin::new(&mut conn).await {
        debug!("Error serving connection: {}", err);
    }

    Ok(())
}

async fn handle_socks_bridge_connection(
    mut stream: TcpStream,
    traffic: TrafficCounter,
    _settings: Arc<SettingsService>,
) -> AppResult<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut buf = [0u8; 1024];

    // 1. SOCKS5 Handshake - Greeting
    let n = stream.read(&mut buf).await.map_err(|e| format!("Failed to read SOCKS5 greeting: {}", e))?;
    if n < 2 || buf[0] != 0x05 {
        return Err("Invalid SOCKS5 greeting".into());
    }

    // 2. Respond with No Auth (0x00)
    stream.write_all(&[0x05, 0x00]).await.map_err(|e| format!("Failed to send SOCKS5 response: {}", e))?;

    // 3. Read Connection Request
    let n = stream.read(&mut buf).await.map_err(|e| format!("Failed to read SOCKS5 request: {}", e))?;
    if n < 7 || buf[0] != 0x05 || buf[1] != 0x01 {
        return Err("Invalid SOCKS5 connection request".into());
    }

    // Parse target host/port
    let atyp = buf[3];
    let host;
    let port_offset;

    match atyp {
        0x01 => { // IPv4
            host = format!("{}.{}.{}.{}", buf[4], buf[5], buf[6], buf[7]);
            port_offset = 8;
        }
        0x03 => { // Domain name
            let len = buf[4] as usize;
            host = String::from_utf8_lossy(&buf[5..5 + len]).to_string();
            port_offset = 5 + len;
        }
        _ => return Err("Unsupported address type".into()),
    }

    let port = u16::from_be_bytes([buf[port_offset], buf[port_offset + 1]]);
    
    debug!("[Bridge] Requesting connection to {}:{}", host, port);

    // 4. Connect to local HTTP proxy (Hyper server listening on 8080)
    let mut http_proxy_stream = TcpStream::connect(format!("127.0.0.1:{}", HTTP_PROXY_PORT)).await
        .map_err(|e| format!("Failed to connect to local HTTP proxy: {}", e))?;

    // 5. Send HTTP CONNECT request
    let connect_req = format!("CONNECT {}:{} HTTP/1.1\r\nHost: {}:{}\r\nProxy-Connection: Keep-Alive\r\n\r\n", host, port, host, port);
    http_proxy_stream.write_all(connect_req.as_bytes()).await?;

    // 6. Read HTTP Proxy response
    let mut res_buf = [0u8; 1024];
    let n = http_proxy_stream.read(&mut res_buf).await?;
    let response = String::from_utf8_lossy(&res_buf[..n]);

    if response.contains("200 Connection established") || response.contains("HTTP/1.1 200") {
        debug!("[Bridge] HTTP Tunnel established for {}:{}", host, port);
        // Respond success to SOCKS client
        stream.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await?;
        
        // 7. Tunnel bidirectionally
        let (mut c_r, mut c_w) = stream.split();
        let (mut s_r, mut s_w) = http_proxy_stream.split();
        
        let traffic_up = traffic.clone();
        let traffic_down = traffic.clone();

        let client_to_server = async move {
            let mut buf = [0u8; 8192];
            while let Ok(n) = c_r.read(&mut buf).await {
                if n == 0 { break; }
                traffic_up.add_uplink(n as u64);
                if s_w.write_all(&buf[..n]).await.is_err() { break; }
            }
            let _ = s_w.shutdown().await;
        };

        let server_to_client = async move {
            let mut buf = [0u8; 8192];
            while let Ok(n) = s_r.read(&mut buf).await {
                if n == 0 { break; }
                traffic_down.add_downlink(n as u64);
                if c_w.write_all(&buf[..n]).await.is_err() { break; }
            }
            let _ = c_w.shutdown().await;
        };

        tokio::join!(client_to_server, server_to_client);
    } else {
        error!("[Bridge] HTTP Proxy rejected connection for {}:{}: {}", host, port, response.lines().next().unwrap_or(""));
        let _ = stream.write_all(&[0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await;
    }

    Ok(())
}

async fn handle_request(
    req: Request<Incoming>,
    _settings: Arc<SettingsService>,
    _traffic: TrafficCounter,
) -> Result<Response<BoxedBody>, hyper::Error> {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let host = req.uri().host().unwrap_or("localhost").to_string();
    let port = req.uri().port_u16().unwrap_or(if req.uri().scheme_str() == Some("https") { 443 } else { 80 });

    debug!("Request: {} {}", method, uri);

    if method == Method::CONNECT {
        // Handle HTTPS CONNECT
        handle_connect(req, host, port, _settings, _traffic).await
    } else {
        // Handle HTTP request
        handle_http_request(req, host, port, _settings, _traffic).await
    }
}

async fn handle_connect(
    req: Request<Incoming>,
    host: String,
    port: u16,
    _settings: Arc<SettingsService>,
    traffic: TrafficCounter,
) -> Result<Response<BoxedBody>, hyper::Error> {
    debug!("CONNECT to {}:{}", host, port);
    
    if req.extensions().get::<hyper::upgrade::OnUpgrade>().is_none() {
        error!("OnUpgrade extension missing for {}:{}!", host, port);
    }

    // Spawn task to handle the tunnel upgrade
    tokio::task::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => {
                debug!("Connection upgraded for {}:{}", host, port);
                
                // Connect to SOCKS5 proxy (blocking op in thread)
                let socks_addr = format!("127.0.0.1:{}", SOCKS5_PORT);
                let target_addr = format!("{}:{}", host, port);
                
                debug!("Connecting to SOCKS5 proxy at {} for target {}", socks_addr, target_addr);
                
                let _settings_internal = _settings.clone();
                let connect_result = tokio::task::spawn_blocking(move || {
                    let settings = _settings_internal.get_all().unwrap_or_default();
                    let (u, p) = if settings.socks5_auth_enabled && !settings.socks5_auth_username.is_empty() {
                        (settings.socks5_auth_username.clone(), settings.socks5_auth_password.clone())
                    } else {
                        ("anonymous".to_string(), "anonymous".to_string())
                    };

                    debug!("Connecting to SOCKS5 proxy at {} for target {} with user {}", socks_addr, target_addr, u);
                    Socks5Stream::connect_with_password(socks_addr.as_str(), target_addr.as_str(), &u, &p)
                }).await;

                match connect_result {
                    Ok(Ok(socks_stream)) => {
                        debug!("Successfully connected to SOCKS5 proxy for {}:{}", host, port);
                        // Convert to non-blocking std stream -> tokio stream
                        match socks_stream.into_inner().try_clone() {
                            Ok(tcp) => {
                                if let Err(e) = tcp.set_nonblocking(true) {
                                     error!("Failed to set nonblocking for {}: {}: {}", host, port, e);
                                     return;
                                }
                                match TcpStream::from_std(tcp) {
                                    Ok(tokio_stream) => {
                                        // Tunnel data
                                        let upgraded = TokioIo::new(upgraded);
                                        debug!("Starting tunnel for {}:{}", host, port);
                                        tunnel(upgraded, tokio_stream, traffic).await;
                                        debug!("Tunnel finished for {}:{}", host, port);
                                    }
                                    Err(e) => error!("Failed to create tokio stream for {}: {}: {}", host, port, e),
                                }
                            }
                            Err(e) => error!("Failed to access inner stream for {}: {}: {}", host, port, e),
                        }
                    }
                    Ok(Err(e)) => error!("SOCKS5 connection failed for {}: {}: {}", host, port, e),
                    Err(e) => error!("Join error while connecting for {}: {}: {}", host, port, e),
                }
            }
            Err(e) => error!("Upgrade error: {}", e),
        }
    });

    // Return OK to signal client to start tunneling
    Ok(Response::builder()
        .status(StatusCode::OK)
        .body(empty())
        .unwrap())
}

async fn handle_http_request(
    req: Request<Incoming>,
    host: String,
    port: u16,
    _settings: Arc<SettingsService>,
    traffic: TrafficCounter,
) -> Result<Response<BoxedBody>, hyper::Error> {
    debug!("HTTP proxying requested for {}:{}", host, port);

    let socks_addr = format!("127.0.0.1:{}", SOCKS5_PORT);
    let target_addr = format!("{}:{}", host, port);
    
    let _settings_internal = _settings.clone();
    let connect_result = tokio::task::spawn_blocking(move || {
        let settings = _settings_internal.get_all().unwrap_or_default();
        let (u, p) = if settings.socks5_auth_enabled && !settings.socks5_auth_username.is_empty() {
            (settings.socks5_auth_username.clone(), settings.socks5_auth_password.clone())
        } else {
            ("anonymous".to_string(), "anonymous".to_string())
        };
        Socks5Stream::connect_with_password(socks_addr.as_str(), target_addr.as_str(), &u, &p)
    }).await;

    match connect_result {
        Ok(Ok(socks_stream)) => {
            if let Ok(tcp) = socks_stream.into_inner().try_clone() {
                let _ = tcp.set_nonblocking(true);
                if let Ok(tokio_stream) = TcpStream::from_std(tcp) {
                    let io = TokioIo::new(tokio_stream);
                    
                    match hyper::client::conn::http1::handshake(io).await {
                        Ok((mut sender, conn)) => {
                            tokio::spawn(async move {
                                if let Err(err) = conn.await {
                                    debug!("Connection failed: {:?}", err);
                                }
                            });

                            match sender.send_request(req).await {
                                Ok(res) => {
                                    let (parts, body) = res.into_parts();
                                    
                                    // Wrap body for traffic counting
                                    let traffic_down = traffic.clone();
                                    let body = body.map_frame(move |frame| {
                                        if let Some(data) = frame.data_ref() {
                                            traffic_down.add_downlink(data.len() as u64);
                                        }
                                        frame
                                    });
                                    
                                    return Ok(Response::from_parts(parts, body.boxed()));
                                }
                                Err(e) => {
                                    error!("HTTP proxy request failed: {}", e);
                                    return Ok(Response::builder().status(StatusCode::BAD_GATEWAY).body(full(format!("Bad Gateway: {}", e))).unwrap());
                                }
                            }
                        }
                        Err(e) => {
                            error!("HTTP proxy handshake failed: {}", e);
                            return Ok(Response::builder().status(StatusCode::BAD_GATEWAY).body(full(format!("Handshake failed: {}", e))).unwrap());
                        }
                    }
                }
            }
            Ok(Response::builder().status(StatusCode::BAD_GATEWAY).body(full("Failed to establish tunnel")).unwrap())
        }
        _ => Ok(Response::builder().status(StatusCode::SERVICE_UNAVAILABLE).body(full("SOCKS5 Proxy error")).unwrap())
    }
}

async fn tunnel(
    upgraded: TokioIo<hyper::upgrade::Upgraded>,
    mut target: TcpStream,
    traffic: TrafficCounter,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    
    let (mut c_r, mut c_w) = tokio::io::split(upgraded);
    let (mut s_r, mut s_w) = target.split();
    
    let traffic_up = traffic.clone();
    let traffic_down = traffic.clone();

    let client_to_server = async move {
        let mut buf = [0u8; 8192];
        loop {
            match c_r.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    traffic_up.add_uplink(n as u64);
                    if s_w.write_all(&buf[..n]).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = s_w.shutdown().await;
    };

    let server_to_client = async move {
        let mut buf = [0u8; 8192];
        loop {
            match s_r.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    traffic_down.add_downlink(n as u64);
                    if c_w.write_all(&buf[..n]).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = c_w.shutdown().await;
    };

    let _ = tokio::join!(client_to_server, server_to_client);
    debug!("Tunnel closed");
}
