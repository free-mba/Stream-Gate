import { atomWithStorage } from 'jotai/utils';

// App Preferences
export const languageAtom = atomWithStorage<'en' | 'fa'>('app-language', 'en');
export const themeAtom = atomWithStorage<'light' | 'dark' | 'system'>('app-theme', 'dark');
