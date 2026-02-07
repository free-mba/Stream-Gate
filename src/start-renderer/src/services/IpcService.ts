import type { IpcRendererEvent } from 'electron';
import { createTauriIpc } from './TauriIpcService';

export interface IpcRenderer {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
    removeListener: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
    send: (channel: string, ...args: unknown[]) => void;
}

const createIpc = (): IpcRenderer => {
    // 1. Check for Tauri
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        console.log('Tauri environment detected');
        return createTauriIpc();
    }

    // 2. Check for Electron
    if (typeof window !== 'undefined' && window.require) {
        try {
            const { ipcRenderer } = window.require('electron');
            console.log('Electron environment detected');
            return ipcRenderer as IpcRenderer;
        } catch (e) {
            console.error('Failed to require electron', e);
        }
    }

    // 3. Mock IPC for browser development
    console.warn('IPC not available, using mock');
    return {
        invoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
            console.log(`[MockIPC] invoke: ${channel}`, args);
            if (channel === 'get-settings') {
                return {
                    configs: [],
                    resolver: '1.1.1.1:53',
                    domain: 'mock.example.com',
                    verbose: true,
                    authoritative: false,
                    customDnsEnabled: false,
                    primaryDns: '',
                    secondaryDns: ''
                } as unknown as T;
            }
            if (channel === 'get-status') {
                return {
                    isRunning: false,
                    details: {
                        streamRunning: false,
                        proxyRunning: false,
                        socksForwardRunning: false
                    }
                } as unknown as T;
            }
            if (channel === 'get-version') return '1.0.0-mock' as unknown as T;
            return { success: true } as unknown as T;
        },
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
            console.log(`[MockIPC] on: ${channel}`, listener);
        },
        removeListener: () => { },
        send: (channel: string, ...args: unknown[]) => {
            console.log(`[MockIPC] send: ${channel}`, args);
        }
    } as IpcRenderer;
};

export const ipc = createIpc();
