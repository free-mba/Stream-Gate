import { cva } from "class-variance-authority";
import type { DnsCheckResult } from "@/types";


export const DEFAULT_SERVERS = `1.1.1.1
1.0.0.1
8.8.8.8
8.8.4.4
9.9.9.9
149.112.112.112
76.76.2.0
76.76.10.0
208.67.222.222
208.67.220.220`;

// Regex for validating IPv4 addresses/DNS servers (simple validation)
export const IP_REGEX = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
export const COMMENT_PREFIX = '#';
export const DEFAULT_DNS_PORT = '53';

export type DnsMode = 'dnstt' | 'stream';

export interface ScanConfig {
    mode: DnsMode;
    domain: string;
    workers: number;
    timeout: number;
    servers: string[];
}

export const statusVariants = cva("text-muted-foreground", {
    variants: {
        status: {
            success: "text-green-400",
            failed: "text-red-400",
            default: "text-muted-foreground",
        },
    },
    defaultVariants: {
        status: "default",
    },
});

export const getDnsStatus = (result: DnsCheckResult): "success" | "failed" | "default" => {
    const isSuccess = result.isCompatible || result.status === 'OK';
    if (isSuccess) return "success";

    const isFailed = result.stage === 'failed' || (result.stage === 'done' && !isSuccess);
    if (isFailed) return "failed";

    return "default";
};