import { ipc } from "@/services/IpcService";
import type { ScanConfig } from "./DnsTesterConstants";
import { dnsResultsAtom, dnsProgressAtom, dnsScanStatsAtom, isDnsScanningAtom } from "@/store/dns";
import { getDefaultStore } from "jotai";
import type { DnsCheckResult } from "@/types";

const store = getDefaultStore();

// Internal raw type mirroring the IPC payload structure
interface RawDnsCheckResult {
    server: string;
    stage?: 'checking' | 'done' | 'failed' | 'queued';
    status: string;
    ping?: { ok: boolean; timeMs: number; error?: string };
    dns?: { ok: boolean; timeMs: number; answers: string[]; error?: string };
    success?: boolean;
    elapsed?: number;
    message?: string;
    data?: {
        score: number;
        maxScore: number;
        isCompatible: boolean;
        details: string;
    };
    error?: string;
}

class DnsScannerService {
    private isListening = false;

    private onProgress = (_: unknown, data: unknown) => {
        const d = data as { completed: number, total: number };
        store.set(dnsProgressAtom, (d.completed / d.total) * 100);
        store.set(dnsScanStatsAtom, d);
    };

    private normalizeResult(raw: RawDnsCheckResult): DnsCheckResult {
        // Default values
        let latency = 0;
        let score = 0;
        let maxScore = 0;
        let details = '';
        let isCompatible = false;

        // Extract from worker data if present
        if (raw.data) {
            score = raw.data.score || 0;
            maxScore = raw.data.maxScore || 0;
            details = raw.data.details || '';
            isCompatible = !!raw.data.isCompatible;
            latency = raw.elapsed || 0;
        } else {
            // Fallback for legacy/ping-only modes if they still exist or occur
            if (raw.ping?.ok) latency = raw.ping.timeMs;
            if (raw.dns?.ok) latency = raw.dns.timeMs; // prefer DNS time if available? usually elapsed is better if worker
        }

        return {
            server: raw.server,
            stage: raw.stage || 'done',
            status: raw.status,
            latency,
            score,
            maxScore,
            details,
            isCompatible,
            error: raw.error
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
        ipc.on('dns-scan-complete', this.onComplete);
        this.isListening = true;
    }

    public stopListeners() {
        if (!this.isListening) return;
        ipc.removeListener('dns-scan-progress', this.onProgress);
        ipc.removeListener('dns-scan-result', this.onResult);
        ipc.removeListener('dns-scan-complete', this.onComplete);
        this.isListening = false;
    }

    public async startScan(config: ScanConfig) {
        this.startListeners();

        // 1. Prepare initial state with default empty values
        const initialResults: DnsCheckResult[] = config.servers.map(s => ({
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
            await ipc.invoke('dns-scan-start', config);
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

    public loadFromRawResults(rawResults: any[]) {
        if (!Array.isArray(rawResults) || rawResults.length === 0) return;

        try {
            const normalized = rawResults.map(r => this.normalizeResult(r));
            store.set(dnsResultsAtom, normalized);

            // Calculate stats
            const completed = normalized.filter(r => r.stage === 'done' || r.stage === 'failed').length;
            store.set(dnsScanStatsAtom, {
                completed,
                total: normalized.length
            });

            // If we loaded results, we can assume progress is 100% if all are done
            if (completed === normalized.length && normalized.length > 0) {
                store.set(dnsProgressAtom, 100);
            }
        } catch (err) {
            console.error("Failed to load saved DNS results:", err);
        }
    }
}

export const dnsScanner = new DnsScannerService();
