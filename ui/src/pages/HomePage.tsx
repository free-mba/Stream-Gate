import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, MapPin, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function HomePage() {
    const ipc = useIpc();
    const [status, setStatus] = useState<any>({});
    const [settings, setSettings] = useState<any>({});
    const [addDnsOpen, setAddDnsOpen] = useState(false);
    const [newDns, setNewDns] = useState("");
    const [systemProxy, setSystemProxy] = useState(false);

    // Mock traffic stats
    const [traffic, setTraffic] = useState({ down: 0, up: 0 });

    useEffect(() => {
        if (!ipc) return;

        // Initial fetch
        ipc.invoke('get-status').then((s: any) => setStatus(s));
        ipc.invoke('get-settings').then((s: any) => {
            setSettings(s);
            setSystemProxy(!!s.systemProxyEnabledByApp);
        });

        const handleStatus = (_: any, s: any) => setStatus(s);
        ipc.on('status-update', handleStatus);

        return () => {
            ipc.removeListener('status-update', handleStatus);
        };
    }, [ipc]);



    // Handle traffic updates from backend
    useEffect(() => {
        if (!ipc) return;

        const handleTraffic = (_: any, data: any) => {
            setTraffic(data);
        };

        ipc.on('traffic-update', handleTraffic);

        return () => {
            ipc.removeListener('traffic-update', handleTraffic);
        };
    }, [ipc]);

    const toggleSystemProxy = async () => {
        if (!ipc) return;
        const newState = !systemProxy;
        setSystemProxy(newState); // Optimistic update
        await ipc.invoke('toggle-system-proxy', newState);
        // Verify (optional, IPC usually returns result)
        const updated = await ipc.invoke('get-settings');
        setSystemProxy(!!updated.systemProxyEnabledByApp);
    };

    const toggleConnection = () => {
        if (!!ipc && status.isRunning) {
            ipc?.invoke('stop-service');
        } else {
            const payload = {
                resolver: settings.resolver,
                domain: settings.domain,
                tunMode: settings.mode === 'tun'
            };
            ipc?.invoke('start-service', payload);
        }
    };

    const isConnected = !!status.isRunning;

    // We need lists for the selects
    const configs = Array.isArray(settings.configs) ? settings.configs : [];

    // Combine default and saved DNS
    const savedDns = Array.isArray(settings.savedDns) ? settings.savedDns : [];
    const COMMON_DNS = [
        "1.1.1.1:53", "1.0.0.1:53",
        "8.8.8.8:53", "8.8.4.4:53",
        "9.9.9.9:53",
        "149.112.112.112:53", // Quad9
        "208.67.222.222:53", // OpenDNS
    ];

    // Ensure current resolver is in the list
    const currentResolver = settings.resolver || "8.8.8.8:53";
    const dnsOptions = Array.from(new Set([currentResolver, ...savedDns, ...COMMON_DNS]));

    const handleConfigChange = async (configId: string) => {
        const config = configs.find((c: any) => c.id === configId);
        if (config) {
            await ipc?.invoke('save-settings', {
                ...settings,
                selectedConfigId: configId,
                domain: config.domain,
                socks5AuthUsername: config.socks?.username || "",
                socks5AuthPassword: config.socks?.password || "",
                socks5AuthEnabled: !!(config.socks?.username && config.socks?.password)
            });
            // Update local state instantly
            setSettings((prev: any) => ({ ...prev, selectedConfigId: configId }));
        }
    };

    const handleDnsChange = async (val: string) => {
        await ipc?.invoke('set-resolver', val); // This saves internally + updates settings
        // Also update local state
        setSettings((prev: any) => ({ ...prev, resolver: val }));
    };

    const handleAddDns = async () => {
        if (!newDns) return;
        // Basic validation or formatting could go here
        const formattedDns = newDns.includes(':') ? newDns : `${newDns}:53`;

        const newSavedDns = Array.from(new Set([formattedDns, ...savedDns]));

        await ipc?.invoke('save-settings', {
            ...settings,
            savedDns: newSavedDns
        });

        setSettings((prev: any) => ({ ...prev, savedDns: newSavedDns }));
        setAddDnsOpen(false);
        setNewDns("");

        // Optionally select it immediately
        handleDnsChange(formattedDns);
    };

    const formatSpeed = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B/s`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB/s`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-8 animate-in fade-in duration-500">

            {/* Controls */}
            <div className="flex flex-col items-center gap-4 w-full max-w-sm z-20">
                <div className="grid grid-cols-2 gap-2 w-full">
                    {/* Config Select */}
                    <Select value={settings.selectedConfigId || ""} onValueChange={handleConfigChange}>
                        <SelectTrigger className="w-full min-w-[140px] bg-card/40 backdrop-blur border-white/5 h-12 text-left px-3">
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                <span className="truncate block flex-1 text-left">
                                    <SelectValue placeholder="Config" />
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card backdrop-blur-xl border-white/10 max-h-[300px] overflow-hidden">
                            {configs.map((c: any) => (
                                <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span>{c.country || "🏳️"}</span>
                                        <span className="font-medium truncate max-w-[150px]">{c.remark}</span>
                                    </span>
                                </SelectItem>
                            ))}
                            {configs.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">No configs</div>}
                        </SelectContent>
                    </Select>


                    <Select value={currentResolver} onValueChange={handleDnsChange}>
                        <SelectTrigger className="w-full min-w-[140px] bg-card/40 backdrop-blur border-white/5 h-12 text-left px-3">
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="truncate block flex-1 text-left">
                                    <SelectValue placeholder="DNS" />
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-card backdrop-blur-xl border-white/10 max-h-[200px] overflow-hidden">
                            {dnsOptions.map((d: string) => (
                                <SelectItem key={d} value={d} className="font-mono text-xs cursor-pointer">
                                    {d}
                                </SelectItem>
                            ))}
                            <div className="p-1 border-t border-white/10 mt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-8 text-xs font-medium"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setAddDnsOpen(true);
                                    }}
                                >
                                    + Add Custom DNS
                                </Button>
                            </div>
                        </SelectContent>
                    </Select>
                </div>

                <Dialog open={addDnsOpen} onOpenChange={setAddDnsOpen}>
                    <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-white/10">
                        <DialogHeader>
                            <DialogTitle>Add Custom DNS</DialogTitle>
                            <DialogDescription>
                                Enter a DNS server address (IP:Port).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center space-x-2">
                            <div className="grid flex-1 gap-2">
                                <Input
                                    id="link"
                                    placeholder="8.8.8.8:53"
                                    value={newDns}
                                    onChange={(e) => setNewDns(e.target.value)}
                                    className="col-span-3 bg-white/5 border-white/10"
                                />
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-end">
                            <Button type="button" variant="secondary" onClick={() => setAddDnsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleAddDns}>
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {settings.authoritative && (
                <div className="flex items-center gap-2 text-xs md:text-sm text-yellow-500/90 bg-yellow-500/10 px-3 py-1 rounded-md uppercase tracking-wider font-bold border border-yellow-500/20 shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]">
                    <Shield className="w-4 h-4" />
                    Authoritative Mode
                </div>
            )}
            <div className="relative group my-8">
                {/* Background Glow Effect */}
                <motion.div
                    animate={{
                        backgroundColor: isConnected ? "rgba(34, 197, 94, 0.2)" : "rgba(37, 99, 235, 0.2)",
                        scale: isConnected ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        backgroundColor: { duration: 0.5 }
                    }}
                    className="absolute -inset-8 rounded-full blur-xl"
                />

                {/* Main Button */}
                <motion.button
                    onClick={toggleConnection}
                    whileHover="hover"
                    whileTap="tap"
                    animate={isConnected ? "connected" : "disconnected"}
                    variants={{
                        disconnected: {
                            background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            scale: 1,
                            boxShadow: "0px 10px 30px -10px rgba(37, 99, 235, 0.5)",
                        },
                        connected: {
                            background: "rgba(0, 0, 0, 0.4)",
                            borderColor: "rgba(34, 197, 94, 0.5)",
                            scale: 1,
                            boxShadow: "0px 10px 30px -10px rgba(34, 197, 94, 0.2)",
                        },
                        hover: {
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        },
                        tap: { scale: 0.95 }
                    }}
                    className={cn(
                        "w-56 h-56 rounded-full text-2xl font-bold border-[6px] relative z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-md transition-shadow duration-300"
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                >
                    {/* Inner Content - handling specific hover overrides manually for "Stop" state */}
                    <motion.div
                        className="flex flex-col items-center gap-3 w-full h-full justify-center rounded-full"
                        variants={{
                            // specialized sub-variants for inner content if needed, 
                            // but we can just use conditional rendering for simpler logic
                        }}
                    >
                        <Zap
                            className={cn(
                                "w-10 h-10 fill-current transition-colors duration-300",
                                isConnected ? "text-green-400 group-hover:text-red-500" : "text-white/90"
                            )}
                        />
                        <span
                            className={cn(
                                "tracking-widest transition-colors duration-300",
                                isConnected ? "text-green-400 group-hover:text-red-500" : "text-white"
                            )}
                        >
                            {isConnected ? "STOP" : "CONNECT"}
                        </span>

                        {/* Timer only shows when connected */}
                        {isConnected && (
                            <div className="group-hover:text-red-400 transition-colors duration-300">
                                <TimerDisplay />
                            </div>
                        )}
                    </motion.div>

                    {/* Pulse Ring for Connect State */}
                    {!isConnected && (
                        <span className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-20 duration-[3000ms]" />
                    )}

                    {/* Red Border Overlay for Stop State Hover */}
                    {isConnected && (
                        <div className="absolute inset-0 rounded-full border-[6px] border-red-500/0 transition-colors duration-300 group-hover:border-red-500" />
                    )}
                </motion.button>
            </div>

            {/* Stats - visible when connected */}
            <div className={cn(
                "grid grid-cols-2 gap-4 w-full max-w-lg transition-all duration-700 transform",
                isConnected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
            )}>
                <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-lg overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                            <ArrowDown className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Download</div>
                            <div className="text-lg font-mono font-medium">{formatSpeed(traffic.down)}</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-lg overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                            <ArrowUp className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Upload</div>
                            <div className="text-lg font-mono font-medium">{formatSpeed(traffic.up)}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Proxy Toggle - Centered and Larger */}
            <div className="flex justify-center mt-8">
                <motion.button
                    onClick={toggleSystemProxy}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                        "flex items-center gap-4 px-8 py-4 rounded-full backdrop-blur-xl border transition-all duration-300 shadow-xl",
                        systemProxy
                            ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
                    )}
                >
                    <div className={cn(
                        "w-3 h-3 rounded-full shadow-[0_0_15px_currentColor] transition-colors duration-300",
                        systemProxy ? "bg-green-500" : "bg-neutral-500"
                    )} />
                    <span className="font-medium text-lg">System Proxy</span>
                    <span className={cn(
                        "text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-full transition-colors",
                        systemProxy ? "bg-green-500/20 text-green-400" : "bg-white/10 text-muted-foreground"
                    )}>
                        {systemProxy ? "ON" : "OFF"}
                    </span>
                </motion.button>
            </div>

        </div>
    );
}

function TimerDisplay() {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return <span className="text-xs font-normal opacity-80 tracking-normal font-mono">{formatTime(elapsed)}</span>;
}


