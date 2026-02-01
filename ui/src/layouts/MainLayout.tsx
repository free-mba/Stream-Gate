import { Outlet, useLocation, Link } from "react-router-dom";
import { Home, Settings, List, Activity, Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useIpc } from "@/hooks/useIpc";
import { APP_NAME } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import type { IpcRendererEvent } from "electron";

export default function MainLayout() {
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const location = useLocation();
    const ipc = useIpc();
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (!ipc) return;

        const handleLog = (_: IpcRendererEvent, msg: unknown) => {
            setLogs(prev => [...prev, String(msg)]);
        };

        ipc.on('stream-log', handleLog);
        ipc.on('stream-error', handleLog);

        return () => {
            ipc.removeListener('stream-log', handleLog);
            ipc.removeListener('stream-error', handleLog);
        };
    }, [ipc]);

    useEffect(() => {
        if (showLogs && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, showLogs]);

    const navItems = [
        { icon: Home, label: t("Home"), path: "/" },
        { icon: List, label: t("Configs"), path: "/configs" },
        { icon: Activity, label: t("DNS Tester"), path: "/dns" },
        { icon: Settings, label: t("Settings"), path: "/settings" },
    ];

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
            {/* Sidebar */}
            <aside className="w-64 bg-muted/20 dark:bg-muted/10 border-r border-border flex flex-col p-4 relative z-20">
                <div className="mb-8 flex items-center gap-3 px-2 pt-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                        <div className="w-3.5 h-3.5 bg-white/30 rounded-full" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight leading-none text-foreground">{APP_NAME}</h1>
                        <span className="text-[10px] text-muted-foreground/60 font-semibold tracking-wider uppercase">{t("GUI Client for Stream Gate")}</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                location.pathname === item.path
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 dark:bg-white dark:text-slate-950 dark:shadow-md font-semibold"
                                    : "text-muted-foreground/80 hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 transition-colors duration-300",
                                location.pathname === item.path ? "text-primary-foreground dark:text-slate-950" : "group-hover:text-foreground dark:group-hover:text-white"
                            )} />
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mt-auto border border-transparent shadow-sm",
                        showLogs
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 dark:bg-white dark:text-slate-950 dark:shadow-md font-semibold"
                            : "text-muted-foreground/80 hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                    )}
                >
                    <Terminal className={cn("w-5 h-5 transition-colors", showLogs ? "text-primary-foreground dark:text-slate-950" : "group-hover:text-foreground dark:group-hover:text-white")} />
                    <span className="text-sm">{t("Logs")}</span>
                    <div className="ml-auto flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
                    </div>
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">

                <div className="flex-1 overflow-auto p-6 scroll-smooth">
                    <Outlet />
                </div>

                {/* Logs Panel Overlay */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 bg-muted/95 dark:bg-card/95 backdrop-blur-xl border-t border-border transform transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) z-50",
                        showLogs ? "h-64 translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0"
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3 h-3 text-muted-foreground" />
                            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{t("System Logs")}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setLogs([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t("Clear")}</button>
                            <button onClick={() => setShowLogs(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div dir="ltr" className="h-[calc(100%-36px)] overflow-auto p-4 font-mono system-logs-container text-xs space-y-1 text-left">
                        {logs.length === 0 && <div className="text-muted-foreground/50 italic">No logs yet...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={cn(
                                "break-all leading-relaxed",
                                log.toLowerCase().includes('error') ? "text-red-500 dark:text-red-400 font-medium" : "text-foreground dark:text-slate-200"
                            )}>
                                <span className="text-slate-400 dark:text-slate-400 font-bold opacity-100 mr-3">[{new Date().toLocaleTimeString()}]</span>
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </main >
        </div >
    );
}
