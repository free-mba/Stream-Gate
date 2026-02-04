import { atom } from 'jotai';
import { ipc } from '@/services/IpcService';
import type { Settings } from '@/types';

// Settings Atoms
const connectionSettingsAtom = atom<Settings | null>(null);

connectionSettingsAtom.onMount = (set) => {
    ipc.invoke<Settings>('get-settings').then((settings) => {
        if (settings) set(settings);
    }).catch(err => console.error('Failed to fetch settings', err));
};

export const fetchSettingsAtom = atom(
    null,
    async (_get, set) => {
        try {
            const s = await ipc.invoke<Settings>('get-settings');
            if (s) set(connectionSettingsAtom, s);
        } catch (e) {
            console.error('Failed to refetch settings', e);
        }
    }
);

export const settingsAtom = atom(
    (get) => get(connectionSettingsAtom),
    async (get, set, update: Partial<Settings>) => {
        const current = get(connectionSettingsAtom);
        if (!current) return;

        const newSettings = { ...current, ...update };
        set(connectionSettingsAtom, newSettings); // Optimistic update

        try {
            if ('authoritative' in update) {
                await ipc.invoke('set-authoritative', update.authoritative);
            }
            // Always save full settings to ensure consistency
            await ipc.invoke('save-settings', newSettings);
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    }
);
