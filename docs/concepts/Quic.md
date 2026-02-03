# QUIC Protocol

**QUIC** (Quick UDP Internet Connections) is a general-purpose transport layer network protocol initially designed by Google.

## Why QUIC?

Stream Gate uses QUIC (via [Slipstream](./Slipstream.md)) to overcome limitations of TCP:

-   **Zero-RTT Connection**: Faster connection establishment.
-   **No Head-of-Line Blocking**: Packet loss in one stream does not block others.
-   **Congestion Control**: Pluggable congestion control (BBR, Cubic) handled in userspace.
-   **Connection Migration**: Clients can change IP addresses (wifi <-> lte) without breaking the session.

## Configuration

In `Settings`, users can configure:
-   **Congestion Control**: Choose between 'BBR' (high throughput) or 'Cubic' (standard).
-   **Keep Alive**: Interval to send ping packets to keep NAT mappings alive.
