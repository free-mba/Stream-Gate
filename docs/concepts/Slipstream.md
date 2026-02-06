# Slipstream Plus

**Slipstream Plus** is the high-performance VPN engine powering Stream Gate. It is an optimized version of the original protocol, designed for maximum throughput in highly restrictive environments.

## How it Works

Slipstream operates by creating a [QUIC](./Quic.md) tunnel to a remote server. It encapsulates TCP and UDP traffic and transports it reliably even in the presence of packet loss or heavy congestion.

### Key Features

1.  **Multiple Streams**: Multiplexes connection streams to maximize bandwidth usage unlike standard TCP.
2.  **Obfuscation**: Uses TLS-like handshakes to blend in with normal HTTPS traffic.
3.  **BBR+ Congestion Control**: Enhanced congestion control for better stability on unstable networks.

## Integration in Stream Gate

**Stream Gate** is the official GUI client for Slipstream Plus. It does not implement the protocol itself but manages the optimized `stream-client` binary:
1.  The GUI generates a config based on user input.
2.  It spawns `stream-client` as a child process.
3.  `stream-client` opens a local [SOCKS5](./SOCKS5.md) port.
4.  The GUI configures the System Proxy to route traffic into that SOCKS5 port.
