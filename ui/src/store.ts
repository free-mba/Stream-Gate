import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import { splitAtom } from 'jotai/utils';
import type { DnsCheckResult } from '@/types';

const getInitialResults = (): DnsCheckResult[] => {
    try {
        const saved = localStorage.getItem('dnsTestResults');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

export const dnsResultsAtom = atom<DnsCheckResult[]>(getInitialResults()) as PrimitiveAtom<DnsCheckResult[]>;
export const dnsResultsAtomsAtom = splitAtom(dnsResultsAtom, (item) => item.server);
export const isDnsScanningAtom = atom(false);
export const dnsProgressAtom = atom(0);
export const dnsScanStatsAtom = atom({ completed: 0, total: 0 });

// App Preferences
const getInitialLang = (): 'en' | 'fa' => (localStorage.getItem('app-language') as 'en' | 'fa') || 'en';
const getInitialTheme = (): 'light' | 'dark' | 'system' => (localStorage.getItem('app-theme') as 'light' | 'dark' | 'system') || 'dark';

export const languageAtom = atom<'en' | 'fa'>(getInitialLang());
export const themeAtom = atom<'light' | 'dark' | 'system'>(getInitialTheme());
