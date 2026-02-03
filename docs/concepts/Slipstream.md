# Slipstream

**Slipstream** is the core VPN engine powering Stream Gate. It is a custom protocol designed for high-throughput, low-latency network tunneling, particularly optimized for unstable network environments.

## How it Works

Slipstream operates by creating a [QUIC](./Quic.md) tunnel to a remote server. It encapsulates TCP and UDP traffic and transports it reliably even in the presence of packet loss or heavy congestion.

### Key Features

1.  **Multiple Streams**: Multiplexes connection streams to maximize bandwidth usage unlike standard TCP.
2.  **Obfuscation**: Uses TLS-like handshakes to blend in with normal HTTPS traffic.
3.  **Resilience**: Capable of switching underlying connections without dropping the tunnel.

## Integration in Stream Gate

The Stream Gate GUI does not implement the protocol itself. Instead, it manages the `stream-client` binary:
1.  The GUI generates a config based on user input.
2.  It spawns `stream-client` as a child process.
3.  `stream-client` opens a local [SOCKS5](./SOCKS5.md) port.
4.  The GUI configures the System Proxy to route traffic into that SOCKS5 port.
