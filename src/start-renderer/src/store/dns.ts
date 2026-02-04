import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import type { DnsCheckResult } from '@/types';
import { splitAtom, atomWithStorage } from 'jotai/utils';

export const dnsResultsAtom = atomWithStorage<DnsCheckResult[]>('dnsTestResults', []) as PrimitiveAtom<DnsCheckResult[]>;

export const dnsResultsAtomsAtom = splitAtom(dnsResultsAtom, (item) => item.server);

export const isDnsScanningAtom = atom(false);
export const dnsProgressAtom = atom(0);
export const dnsScanStatsAtom = atom({ completed: 0, total: 0 });
