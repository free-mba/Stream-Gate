import { ipc } from "@/services/IpcService";
import type { ScanConfig } from "./DnsTesterConstants";
import { dnsResultsAtom, dnsProgressAtom, dnsScanStatsAtom, isDnsScanningAtom } from "@/store/dns";
import { getDefaultStore } from "jotai";
import type { DnsCheckResult } from "@/types";

const store = getDefaultStore();

// Internal raw type mirroring the Rust DnsCheckResult struct
interface RawDnsCheckResult {
    ok: boolean;
    server: string;
    ip: string;
    port: number;
    domain: string;
    ping_time_ms: number;
    dns_time_ms: number;
    answers: string[];
    status: string;
    error: string | null;
}

class DnsScannerService {
    private isListening = false;

    private onProgress = (_: unknown, data: unknown) => {
        const d = data as { completed: number, total: number };
        store.set(dnsProgressAtom, (d.completed / d.total) * 100);
        store.set(dnsScanStatsAtom, d);
    };

    private onItemStart = (_: unknown, server: unknown) => {
        const s = server as string;
        store.set(dnsResultsAtom, (prev) => {
            return prev.map(item => item.server === s ? { ...item, stage: 'checking', status: 'Checking...' } : item);
        });
    };

    private normalizeResult(raw: RawDnsCheckResult): DnsCheckResult {
        // Rust side provides status "OK", "Ping Only", "Unreachable" etc.
        const isOk = raw.ok || raw.status === "OK";

        return {
            server: raw.server,
            stage: isOk ? 'done' : 'failed',
            status: raw.status,
            latency: raw.dns_time_ms || raw.ping_time_ms || 0,
            score: isOk ? 100 : 0, // Mock score for now based on success
            maxScore: 100,
            details: raw.answers.join(', ') || raw.error || '',
            isCompatible: isOk,
            error: raw.error || undefined
        };
    }

    private onResult = (_: unknown, res: unknown) => {
        const raw = res as RawDnsCheckResult;
        const normalized = this.normalizeResult(raw);

        store.set(dnsResultsAtom, (prev) => {
            return prev.map(item => item.server === normalized.server ? normalized : item);
        });
    };

    private onComplete = () => {
        store.set(isDnsScanningAtom, false);
    };

    public startListeners() {
        if (this.isListening) return;
        ipc.on('dns-scan-progress', this.onProgress);
        ipc.on('dns-scan-result', this.onResult);
        ipc.on('dns-scan-item-start', this.onItemStart);
        ipc.on('dns-scan-complete', this.onComplete);
        this.isListening = true;
    }

    public stopListeners() {
        if (!this.isListening) return;
        ipc.removeListener('dns-scan-progress', this.onProgress);
        ipc.removeListener('dns-scan-result', this.onResult);
        ipc.removeListener('dns-scan-item-start', this.onItemStart);
        ipc.removeListener('dns-scan-complete', this.onComplete);
        this.isListening = false;
    }

    public async startScan(config: ScanConfig) {
        this.startListeners();

        // 0. Normalize servers to include port if missing (default :53)
        // This ensures the IDs match what the backend returns
        const normalizedServers = config.servers.map(s =>
            s.includes(':') ? s : `${s}:53`
        );

        // 1. Prepare initial state with default empty values
        const initialResults: DnsCheckResult[] = normalizedServers.map(s => ({
            server: s,
            stage: 'queued',
            status: 'Queued',
            latency: 0,
            score: 0,
            maxScore: 0,
            details: '',
            isCompatible: false
        }));

        store.set(dnsResultsAtom, initialResults);
        store.set(dnsProgressAtom, 0);
        store.set(dnsScanStatsAtom, { completed: 0, total: initialResults.length });
        store.set(isDnsScanningAtom, true);

        // 2. Invoke Main Process
        try {
            await ipc.invoke('dns-scan-start', { ...config, servers: normalizedServers });
        } catch (error) {
            console.error("Failed to start scan:", error);
            store.set(isDnsScanningAtom, false);
        }
    }

    public async stopScan() {
        await ipc.invoke('dns-scan-stop');
        store.set(isDnsScanningAtom, false);
        this.stopListeners();
    }
}

export const dnsScanner = new DnsScannerService();
