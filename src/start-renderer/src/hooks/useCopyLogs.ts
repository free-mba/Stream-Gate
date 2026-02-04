import { useState, useCallback } from 'react';
import { ipc } from '@/services/IpcService';
import { copyToClipboard } from '@/lib/utils';

export const useCopyLogs = () => {
    const [isCopying, setIsCopying] = useState(false);

    const copyLogs = useCallback(async () => {
        try {
            const logs = await ipc.invoke('get-logs');
            const text = JSON.stringify(logs, null, 2);
            const success = await copyToClipboard(text);

            if (success) {
                setIsCopying(true);
                setTimeout(() => setIsCopying(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy logs', err);
        }
    }, []);

    return { isCopying, copyLogs };
};
