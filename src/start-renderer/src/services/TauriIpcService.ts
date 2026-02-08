import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { IpcRenderer } from './IpcService';

export const createTauriIpc = (): IpcRenderer => {
    return {
        invoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
            const commandName = channel.replace(/-/g, '_');

            try {
                // Map Electron-style (positional/object) args to Tauri named args
                let payload: Record<string, unknown> = {};

                // Default: wrap first argument as 'payload' if we don't know the command
                // or if it's a simple object.
                // However, our Rust commands have specific argument names.
                const arg0 = args[0];

                switch (channel) {
                    case 'save-settings':
                        payload = { settings: arg0 };
                        break;
                    case 'import-configs':
                        // Tauri requires camelCase for argument names (import_data -> importData)
                        payload = { importData: arg0 };
                        break;
                    case 'set-resolvers':
                        payload = { payload: arg0 };
                        break;
                    case 'set-socks5-auth':
                        payload = { auth: arg0 };
                        break;
                    case 'set-verbose':
                        payload = { verbose: arg0 };
                        break;
                    case 'set-authoritative':
                        payload = { enable: arg0 };
                        break;

                    // Fixed mappings for Connection & Proxy
                    case 'start-service':
                        // Rust expects: payload: ConnectionConfig
                        payload = { payload: arg0 };
                        break;
                    case 'toggle-system-proxy':
                        // Rust expects: enable: bool
                        payload = { enable: arg0 };
                        break;

                    // Fixed mappings for DNS
                    case 'dns-check-single':
                        // Rust expects: payload: DnsCheckPayload
                        payload = { payload: arg0 };
                        break;
                    case 'dns-scan-start':
                        // Rust expects: payload: DnsScanPayload
                        payload = { payload: arg0 };
                        break;

                    // Fixed mappings for Utility
                    case 'open-external':
                        // Rust expects: url: String
                        payload = { url: arg0 };
                        break;
                    case 'copy-to-clipboard':
                        // Rust expects: text: String
                        payload = { text: arg0 };
                        break;
                    case 'test-proxy':
                        // Rust expects no args
                        payload = {};
                        break;

                    // Commands that take no arguments
                    case 'get-settings':
                    case 'get-status':
                    case 'get-version':
                    case 'get-logs':
                    case 'get-log-path':
                    case 'export-configs':
                    case 'check-system-proxy': // Added check-system-proxy
                    case 'dns-scan-stop':      // Added dns-scan-stop
                        payload = {};
                        break;

                    default:
                        // Fallback
                        if (arg0 && typeof arg0 === 'object') {
                            payload = arg0 as Record<string, unknown>;
                        } else if (arg0 !== undefined) {
                            payload = { payload: arg0 };
                        }
                        break;
                }

                console.info(`[TauriIpc] Invoke: ${commandName}`, payload);
                const response = await invoke<T>(commandName, payload);
                console.info(`[TauriIpc] Response [${commandName}]:`, response);
                return response;
            } catch (error) {
                console.error(`Tauri invoke error [${commandName}]:`, error);
                throw error;
            }
        },
        on: (channel: string, listener: (event: any, ...args: unknown[]) => void) => {
            listen(channel, (event) => {
                listener({ sender: null } as any, event.payload);
            }).then(unlisten => {
                (listener as any)._unlisten = unlisten;
            });
        },
        removeListener: (_channel: string, listener: (event: any, ...args: unknown[]) => void) => {
            if ((listener as any)._unlisten) {
                (listener as any)._unlisten();
            }
        },
        send: (_channel: string, ...args: unknown[]) => {
            const commandName = _channel.replace(/-/g, '_');
            const arg0 = args[0];
            let payload: Record<string, unknown> = {};

            // Simple heuristic for send (mostly used for fire-and-forget)
            // If it's an object, assume it matches the command args.
            if (arg0 && typeof arg0 === 'object') {
                payload = arg0 as Record<string, unknown>;
            } else if (arg0 !== undefined) {
                payload = { payload: arg0 };
            }

            invoke(commandName, payload).catch(err => {
                console.error(`Tauri send error [${commandName}]:`, err);
            });
        }
    };
};
