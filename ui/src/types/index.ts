export interface SocksAuth {
    username?: string;
    password?: string;
}

export interface Config {
    id: string;
    remark: string;
    domain: string;
    country?: string;
    socks?: SocksAuth;
}

export interface Settings {
    resolver: string;
    domain: string;
    mode: 'proxy' | 'tun';
    authoritative: boolean;
    verbose: boolean;
    socks5AuthEnabled: boolean;
    socks5AuthUsername: string;
    socks5AuthPassword: string;
    systemProxyEnabledByApp: boolean;
    systemProxyServiceName: string;
    configs: Config[];
    selectedConfigId: string | null;
    savedDns: string[];
    language?: 'en' | 'fa';
    theme?: 'light' | 'dark' | 'system';
}

export interface Status {
    isRunning: boolean;
    details?: {
        uptime?: number;
        bytesRead?: number;
        bytesWritten?: number;
        [key: string]: unknown;
    };
}

export interface TrafficData {
    up: number;
    down: number;
}

export interface DnsCheckResult {
    server: string;
    stage?: 'checking' | 'done' | 'failed' | 'queued';
    status: string;

    // Legacy properties
    ping?: { ok: boolean; timeMs: number; error?: string };
    dns?: { ok: boolean; timeMs: number; answers: string[]; error?: string };

    // Worker scan properties
    success?: boolean;
    elapsed?: number;
    message?: string;
    data?: {
        score: number;
        maxScore: number;
        isCompatible: boolean;
        details: string;
        stats?: {
            avgTime: number;
            maxTime: number;
            stdDev: number;
        }
    };

    error?: string;
    ok?: boolean;
}
