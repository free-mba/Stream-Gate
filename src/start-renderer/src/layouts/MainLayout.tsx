import { Outlet, useLocation, Link } from "react-router-dom";
import { Home, Settings, List, Activity, Terminal, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { ipc } from "@/services/IpcService";
import { APP_NAME } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import type { IpcRendererEvent } from "electron";

export default function MainLayout() {
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const location = useLocation();
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        const handleLog = (_: IpcRendererEvent, msg: unknown) => setLogs(prev => [...prev, String(msg)]);
        ipc.on('stream-log', handleLog);
        ipc.on('stream-error', handleLog);
        return () => {
            ipc.removeListener('stream-log', handleLog);
            ipc.removeListener('stream-error', handleLog);
        };
    }, []);

    useEffect(() => {
        if (showLogs && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [logs, showLogs]);

    const navItems = [
        { icon: Home, label: t("Home"), path: "/" },
        { icon: List, label: t("Configs"), path: "/configs" },
        { icon: Activity, label: t("DNS Tester"), path: "/dns" },
        { icon: Settings, label: t("Settings"), path: "/settings" },
    ];

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
            {/* Glass Sidebar */}
            <aside className="w-64 flex flex-col p-4 relative z-20 glass-panel border-r-border border-l-0 border-y-0 transition-colors duration-300">
                <div className="mb-10 flex items-center gap-3 px-2 pt-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center relative overflow-hidden group">
                        <Zap className="w-5 h-5 text-white fill-current relative z-10" />
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl tracking-tight leading-none text-foreground">{APP_NAME}</h1>
                        <span className="text-[10px] text-primary font-bold tracking-[0.2em] uppercase glow-text">Quantum Link</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative overflow-hidden",
                                location.pathname === item.path
                                    ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 transition-colors duration-300",
                                location.pathname === item.path ? "text-primary drop-shadow-[0_0_5px_currentColor]" : "group-hover:text-foreground"
                            )} />
                            <span className="text-sm font-medium">{item.label}</span>
                            {location.pathname === item.path && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-primary rounded-r-full shadow-[0_0_10px_currentColor]" />}
                        </Link>
                    ))}
                </nav>

                <Button
                    variant="ghost"
                    onClick={() => setShowLogs(!showLogs)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 mt-auto border border-transparent shadow-sm w-full justification-start h-auto",
                        showLogs
                            ? "bg-foreground/5 text-foreground border-foreground/10"
                            : "text-muted-foreground"
                    )}
                >
                    <Terminal className={cn("w-5 h-5", showLogs ? "text-foreground" : "")} />
                    <span className="text-sm font-medium">{t("Logs")}</span>
                    <div className="ml-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
                    </div>
                </Button>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-gradient-to-br from-background via-background to-background/50">
                <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50" />

                <div className="flex-1 overflow-auto p-0 scroll-smooth relative z-10">
                    <Outlet />
                </div>

                {/* Logs Overlay */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 glass-panel border-t-white/10 transform transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) z-50 flex flex-col",
                        showLogs ? "h-80 translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0 pointer-events-none"
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3 h-3 text-primary" />
                            <h3 className="text-[10px] font-mono text-primary uppercase tracking-widest leading-none translate-y-[1px]">{t("System Console")}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setLogs([])} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-colors">{t("Clear")}</button>
                            <button onClick={() => setShowLogs(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
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
            </main>
        </div>
    );
}
