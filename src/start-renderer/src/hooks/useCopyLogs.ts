import { useState, useCallback } from 'react';
import { ipc } from '@/services/IpcService';

export const useCopyLogs = () => {
    const [isCopying, setIsCopying] = useState(false);

    const copyLogs = useCallback(async () => {
        console.log('[useCopyLogs] Button clicked');
        try {
            console.log('[useCopyLogs] Invoking get-logs...');
            const logs = await ipc.invoke<any[]>('get-logs');
            console.log(`[useCopyLogs] Received ${logs?.length || 0} logs`);
            if (!logs || logs.length === 0) {
                const path = await ipc.invoke<string>('get-log-path');
                console.warn(`[useCopyLogs] No logs found at path: ${path}`);
                alert(`No logs found. Expected path: ${path}`);
                return;
            }

            console.log('[useCopyLogs] Stringifying logs...');
            const text = JSON.stringify(logs, null, 2);

            console.log('[useCopyLogs] Copying to clipboard via backend...');
            try {
                await ipc.invoke('copy-to-clipboard', text);
                console.log('[useCopyLogs] Copy to clipboard success');
                setIsCopying(true);
                setTimeout(() => setIsCopying(false), 2000);
            } catch (copyErr) {
                console.error('[useCopyLogs] Backend copy failed:', copyErr);
                alert(`Copy failed: ${copyErr}`);
            }
        } catch (err) {
            console.error('[useCopyLogs] Failed to copy logs:', err);
            alert(`Error: ${err}`);
        }
    }, []);

    return { isCopying, copyLogs };
};
