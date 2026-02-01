import { useMemo } from 'react';

// Minimal interface for what we use
export interface IpcRenderer {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => any;
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => any;
    send: (channel: string, ...args: any[]) => void;
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
            invoke: async (channel: string, ...args: any[]) => {
                console.log(`[MockIPC] invoke: ${channel}`, args);
                if (channel === 'get-settings') {
                    return {
                        configs: [],
                        resolver: '1.1.1.1:53',
                        domain: 'mock.example.com',
                        verbose: true,
                        authoritative: false
                    };
                }
                if (channel === 'get-status') {
                    return {
                        isRunning: false,
                        details: {
                            slipstreamRunning: false,
                            proxyRunning: false,
                            socksForwardRunning: false
                        }
                    };
                }
                if (channel === 'get-version') return '1.0.0-mock';
                return { success: true };
            },
            on: (channel: string, listener: any) => {
                console.log(`[MockIPC] on: ${channel}`, listener);
                // Return a dummy object or just nothing, or simpler:
                return {} as any;
            },
            removeListener: () => { },
            send: (channel: string, ...args: any[]) => {
                console.log(`[MockIPC] send: ${channel}`, args);
            }
        } as unknown as IpcRenderer;
    }, []);
}
