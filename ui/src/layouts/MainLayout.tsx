import { Outlet, useLocation, Link } from "react-router-dom";
import { Home, Settings, List, Activity, Terminal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useIpc } from "@/hooks/useIpc";
import { APP_NAME } from "@/lib/constants";

export default function MainLayout() {
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const location = useLocation();
    const ipc = useIpc();
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ipc) return;

        const handleLog = (_: any, msg: string) => {
            setLogs(prev => [...prev, msg]);
        };

        ipc.on('slipstream-log', handleLog);
        ipc.on('slipstream-error', handleLog);

        return () => {
            ipc.removeListener('slipstream-log', handleLog);
            ipc.removeListener('slipstream-error', handleLog);
        };
    }, [ipc]);

    useEffect(() => {
        if (showLogs && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, showLogs]);

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: List, label: "Configs", path: "/configs" },
        { icon: Activity, label: "DNS Tester", path: "/dns" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
            {/* Sidebar */}
            <aside className="w-64 bg-card/30 backdrop-blur-2xl border-r border-white/5 flex flex-col p-4 relative z-20">
                <div className="mb-8 flex items-center gap-3 px-2 pt-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white/20 rounded-full" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight leading-none text-white">{APP_NAME}</h1>
                        <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">GUI Client for Slipstream</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                location.pathname === item.path
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-medium scale-[1.02]"
                                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 transition-transform duration-300", location.pathname === item.path ? "scale-110" : "group-hover:scale-110")} />
                            <span>{item.label}</span>
                            {location.pathname === item.path && (
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                            )}
                        </Link>
                    ))}
                </nav>

                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 mt-auto border border-transparent",
                        showLogs
                            ? "bg-accent/80 text-white border-white/10"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Terminal className="w-5 h-5" />
                    <span>Logs</span>
                    <div className="ml-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </div>
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-gradient-to-br from-background via-background to-blue-950/20">

                <div className="flex-1 overflow-auto p-6 scroll-smooth">
                    <Outlet />
                </div>

                {/* Logs Panel Overlay */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 transform transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) z-50",
                        showLogs ? "h-64 translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0"
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3 h-3 text-muted-foreground" />
                            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">System Logs</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setLogs([])} className="text-xs text-muted-foreground hover:text-white transition-colors">Clear</button>
                            <button onClick={() => setShowLogs(false)} className="text-muted-foreground hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="h-[calc(100%-36px)] overflow-auto p-4 font-mono text-xs space-y-1">
                        {logs.length === 0 && <div className="text-muted-foreground/50 italic">No logs yet...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={cn(
                                "break-all",
                                log.toLowerCase().includes('error') ? "text-red-400" : "text-blue-300/80"
                            )}>
                                <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
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
