import React, { useState, useEffect, useRef } from "react";
import { Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ipc } from "@/services/IpcService";
import { useTranslation } from "@/lib/i18n";
import type { IpcRendererEvent } from "electron";

import { useAtom } from "jotai";
import { logsOpenAtom } from "@/store";

const MAX_LOGS = 500;

export const SystemLogs = React.memo(() => {
    const [show, setShow] = useAtom(logsOpenAtom);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        const handleLog = (_: IpcRendererEvent, msg: unknown) => {
            setLogs(prev => {
                const newLogs = [...prev, String(msg)];
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
                {logs.map((log, i) => (
                    <div key={i} className={cn("break-all border-l-2 pl-2", log.toLowerCase().includes('error') ? "border-red-500 text-red-500" : "border-transparent text-foreground/80")}>
                        <span className="text-muted-foreground mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
});
