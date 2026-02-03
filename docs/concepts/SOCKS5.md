# SOCKS5 Proxy

**SOCKS5** is an internet protocol that exchanges network packets between a client and server through a proxy server.

## Role in Stream Gate

When [Slipstream](./Slipstream.md) connects to a remote server, it exposes a local SOCKS5 interface (default: `127.0.0.1:10809`).

1.  **Application Traffic**: The OS (or browser) sends traffic to `127.0.0.1:10809`.
2.  **Encapsulation**: The Slipstream client receives this traffic, encrypts it, and sends it over the [QUIC](./Quic.md) tunnel.
3.  **Exit**: The remote server decrypts and forwards the traffic to the final destination (e.g., google.com).

## Authentication

Stream Gate supports SOCKS5 authentication (Username/Password) which can be configured per-config. This is useful if the local port is exposed to a LAN.
