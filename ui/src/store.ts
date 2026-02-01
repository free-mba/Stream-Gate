
import { atom } from 'jotai';

export interface DnsResult {
    server: string;
    stage?: 'checking' | 'done';
    ok?: boolean;
    status: string;
    ping?: { ok: boolean; timeMs: number };
    dns?: { ok: boolean; timeMs: number; answers: string[]; error?: string };
    error?: string;
}

export const dnsResultsAtom = atom<DnsResult[]>([]);
export const isDnsScanningAtom = atom(false);
export const dnsProgressAtom = atom(0);
