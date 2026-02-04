import { atomWithStorage } from 'jotai/utils';
import { DEFAULT_SERVERS, type DnsMode } from './DnsTesterConstants';

export interface DnsTesterSettings {
    mode: DnsMode;
    domain: string;
    workers: number;
    timeout: number;
    showWorkingOnly: boolean;
    serversText: string;
}

const defaultSettings: DnsTesterSettings = {
    mode: 'stream',
    domain: 'google.com',
    workers: 5,
    timeout: 3,
    showWorkingOnly: false,
    serversText: DEFAULT_SERVERS,
};

// Single Persisted Source of Truth
export const dnsConfigAtom = atomWithStorage<DnsTesterSettings>('dnsTesterConfig', defaultSettings);