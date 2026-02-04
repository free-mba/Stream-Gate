import { atom } from 'jotai';
import { ipc } from '@/services/IpcService';
import type { Status, TrafficData } from '@/types';

// Status & Traffic Atoms
export const statusAtom = atom<Status>({ isRunning: false });
statusAtom.onMount = (set) => {
    ipc.invoke<Status>('get-status').then(set).catch(console.error);
    const handler = (_: unknown, s: unknown) => set(s as Status);
    ipc.on('status-update', handler);
    return () => ipc.removeListener('status-update', handler);
};

export const trafficAtom = atom<TrafficData>({ up: 0, down: 0 });
trafficAtom.onMount = (set) => {
    const handler = (_: unknown, t: unknown) => set(t as TrafficData);
    ipc.on('traffic-update', handler);
    return () => ipc.removeListener('traffic-update', handler);
};
