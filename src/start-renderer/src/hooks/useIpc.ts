import { useMemo } from 'react';
import type { IpcRendererEvent } from 'electron';

// Minimal interface for what we use
export interface IpcRenderer {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
    removeListener: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
    send: (channel: string, ...args: unknown[]) => void;
}

export function useIpc(): IpcRenderer {
    return useMemo(() => {
        if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                return ipcRenderer as IpcRenderer;
            } catch (e) {
                console.error('Failed to require electron', e);
            }
        }

        // Mock IPC for browser development
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
                        authoritative: false
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
    }, []);
}
