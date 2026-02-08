import React, { useState, useEffect, useRef } from "react";
import { Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ipc } from "@/services/IpcService";
import { useTranslation } from "@/lib/i18n";
import type { IpcRendererEvent } from "electron";

import { useAtom } from "jotai";
import { logsOpenAtom } from "@/store";

const MAX_LOGS = 500;

/**
 * Strips ANSI escape codes and common emojis from a string.
 */
const stripUnsupported = (s: string): string => {
    return s
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Strip ANSI escape codes
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, ''); // Strip common emojis
};

export const SystemLogs = React.memo(() => {
    const [show, setShow] = useAtom(logsOpenAtom);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        const handleLog = (_: IpcRendererEvent, msg: unknown) => {
            const rawMsg = String(msg || '');
            const filteredMsg = stripUnsupported(rawMsg);

            if (!filteredMsg.trim()) return; // Skip empty messages after filtering

            setLogs(prev => {
                const newLogs = [...prev, filteredMsg];
                if (newLogs.length > MAX_LOGS) {
                    return newLogs.slice(newLogs.length - MAX_LOGS);
                }
                return newLogs;
            });
        };

        ipc.on('stream-log', handleLog);
        ipc.on('stream-error', handleLog);

        return () => {
            ipc.removeListener('stream-log', handleLog);
            ipc.removeListener('stream-error', handleLog);
        };
    }, []);

    useEffect(() => {
        if (show && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, show]);

    return (
        <div
            className={cn(
                "absolute bottom-0 left-0 right-0 glass-panel border-t-white/10 transform transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) z-50 flex flex-col",
                show ? "h-80 translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0 pointer-events-none"
            )}
        >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-primary" />
                    <h3 className="text-[10px] font-mono text-primary uppercase tracking-widest leading-none translate-y-[1px]">{t("System Console")}</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setLogs([])}
                        className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {t("Clear")}
                    </button>
                    <button
                        onClick={() => setShow(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div dir="ltr" className="flex-1 overflow-auto p-4 font-mono text-[10px] space-y-1 text-left bg-background/90">
                {logs.length === 0 && <div className="text-muted-foreground/30 italic">System ready. Waiting for events...</div>}
                {logs.map((log, i) => {
                    const l = log.toLowerCase();
                    const isError = l.includes('error') || l.includes('failed');
                    const isWarn = l.includes('warn');
                    const isInfo = l.includes('info');

                    let colorClass = "border-transparent text-foreground/80";
                    if (isError) colorClass = "border-red-500/50 text-red-500";
                    else if (isWarn) colorClass = "border-amber-500/50 text-amber-500";
                    else if (isInfo) colorClass = "border-blue-500/50 text-blue-400";

                    return (
                        <div key={i} className={cn("break-all border-l-2 pl-2 py-0.5 transition-colors", colorClass)}>
                            <span className="text-muted-foreground/50 mr-2 tabular-nums">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <span className="font-medium">{log}</span>
                        </div>
                    );
                })}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
});
