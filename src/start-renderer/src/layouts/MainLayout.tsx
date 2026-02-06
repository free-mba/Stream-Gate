import { Outlet } from "react-router-dom";
import { Zap } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { SidebarMenu } from "./SidebarMenu";
import { LogsToggleButton } from "./LogsToggleButton";
import { SystemLogs } from "./SystemLogs";

export default function MainLayout() {
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

                <SidebarMenu />

                <LogsToggleButton />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col h-full overflow-hidden bg-gradient-to-br from-background via-background to-background/50">
                <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50" />

                <div className="flex-1 overflow-auto p-0 scroll-smooth relative z-10">
                    <Outlet />
                </div>

                {/* Logs Overlay */}
                <SystemLogs />
            </main>
        </div>
    );
}
