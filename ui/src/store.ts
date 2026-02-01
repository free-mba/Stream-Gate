import { atom } from 'jotai';
import type { DnsCheckResult } from '@/types';

export const dnsResultsAtom = atom<DnsCheckResult[]>([]);
export const isDnsScanningAtom = atom(false);
export const dnsProgressAtom = atom(0);
