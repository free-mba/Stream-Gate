import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, MapPin, Globe, Plus, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Settings, Status, TrafficData, Config } from "@/types";
import { useTranslation } from "@/lib/i18n";

import { GlassSelect } from "@/components/ui/GlassSelect";

const MotionButton = motion(Button);

const TrafficCard = ({ label, value, icon: Icon, colorClass }: { label: string, value: string, icon: React.ElementType, colorClass: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-4 flex items-center gap-4 w-40 sm:w-48"
    >
        <div className={cn("p-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border", colorClass)}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
            <span className="text-lg font-mono font-medium tracking-tight text-foreground">{value}</span>
        </div>
    </motion.div>
);

export default function ConnectionPage() {
    const ipc = useIpc();
    const { t } = useTranslation();
    const [status, setStatus] = useState<Partial<Status>>({});
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [addDnsOpen, setAddDnsOpen] = useState(false);
    const [newDns, setNewDns] = useState("");
    const [systemProxy, setSystemProxy] = useState(false);
    const [traffic, setTraffic] = useState<TrafficData>({ down: 0, up: 0 });

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke<Status>('get-status').then((s) => setStatus(s));
        ipc.invoke<Settings>('get-settings').then((s) => {
            setSettings(s);
            setSystemProxy(!!s.systemProxyEnabledByApp);
        });
        const handleStatus = (_: unknown, s: unknown) => setStatus(s as Status);
        const handleTraffic = (_: unknown, data: unknown) => setTraffic(data as TrafficData);

        ipc.on('status-update', handleStatus);
        ipc.on('traffic-update', handleTraffic);
        return () => {
            ipc.removeListener('status-update', handleStatus);
            ipc.removeListener('traffic-update', handleTraffic);
        };
    }, [ipc]);

    const toggleConnection = () => {
        if (!ipc) return;
        if (status.isRunning) {
            ipc.invoke('stop-service');
        } else {
            const payload = {
                resolver: settings.resolver,
                domain: settings.domain,
                tunMode: settings.mode === 'tun',
                keepAliveInterval: settings.keepAliveInterval,
                congestionControl: settings.congestionControl
            };
            ipc.invoke('start-service', payload);
        }
    };

    const toggleSystemProxy = async () => {
        if (!ipc) return;
        const newState = !systemProxy;
        setSystemProxy(newState);
        await ipc.invoke('toggle-system-proxy', newState);
        const updated = await ipc.invoke<Settings>('get-settings');
        setSystemProxy(!!updated.systemProxyEnabledByApp);
    };

    const handleConfigChange = async (configId: string) => {
        const config = settings.configs?.find((c: Config) => c.id === configId);
        if (config && ipc) {
            await ipc.invoke('save-settings', {
                ...settings,
                selectedConfigId: configId,
                domain: config.domain,
                socks5AuthUsername: config.socks?.username || "",
                socks5AuthPassword: config.socks?.password || "",
                socks5AuthEnabled: !!(config.socks?.username && config.socks?.password)
            });
            setSettings((prev) => ({ ...prev, selectedConfigId: configId }));
        }
    };

    const handleDnsChange = async (val: string) => {
        await ipc?.invoke('set-resolver', val);
        setSettings((prev) => ({ ...prev, resolver: val }));
    };

    const handleAddDns = async () => {
        if (!newDns) return;
        const formattedDns = newDns.includes(':') ? newDns : `${newDns}:53`;
        const newSavedDns = Array.from(new Set([formattedDns, ...(settings.savedDns || [])]));
        await ipc?.invoke('save-settings', { ...settings, savedDns: newSavedDns });
        setSettings((prev) => ({ ...prev, savedDns: newSavedDns }));
        setAddDnsOpen(false);
        setNewDns("");
        handleDnsChange(formattedDns);
    };

    const formatSpeed = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B/s`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB/s`;
    };

    const isConnected = !!status.isRunning;
    const configs = settings.configs || [];
    const savedDns = settings.savedDns || [];
    const COMMON_DNS = ["1.1.1.1:53", "1.0.0.1:53", "8.8.8.8:53", "8.8.4.4:53", "9.9.9.9:53"];
    const currentResolver = settings.resolver || "8.8.8.8:53";
    const dnsOptions = Array.from(new Set([currentResolver, ...savedDns, ...COMMON_DNS]));

    return (
        <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-2rem)] w-full p-6 overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{
                        opacity: isConnected ? 0.6 : 0.2,
                        scale: isConnected ? 1.2 : 1,
                    }}
                    transition={{ duration: 2 }}
                    className={cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] transition-colors duration-1000",
                        isConnected ? "bg-primary/20" : "bg-blue-500/5 dark:bg-blue-900/10"
                    )}
                />
            </div>

            {/* Top Bar: Selectors */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-6 w-full max-w-2xl flex justify-between gap-4 z-20 px-4"
            >
                <GlassSelect value={settings.selectedConfigId || ""} onValueChange={handleConfigChange} placeholder={t("Config")} icon={MapPin}>
                    {configs.map((c: Config) => (
                        <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                                <span>{c.country || "🏳️"}</span>
                                <span className="truncate">{c.remark}</span>
                            </span>
                        </SelectItem>
                    ))}
                </GlassSelect>

                <GlassSelect value={currentResolver} onValueChange={handleDnsChange} placeholder={t("DNS")} icon={Globe}>
                    {dnsOptions.map((d: string) => (
                        <SelectItem key={d} value={d} className="font-mono text-xs">{d}</SelectItem>
                    ))}
                    <div className="p-1 border-t border-border mt-1">
                        <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs gap-2 text-muted-foreground hover:text-foreground" onClick={(e) => { e.preventDefault(); setAddDnsOpen(true); }}>
                            <Plus className="w-3 h-3" /> {t("Add Custom")}
                        </Button>
                    </div>
                </GlassSelect>
            </motion.div>

            {/* Center: The ORB */}
            <div className="relative z-10 my-12">
                <motion.button
                    onClick={toggleConnection}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{
                        boxShadow: isConnected
                            ? "0 0 60px rgba(37, 99, 235, 0.4), inset 0 0 20px rgba(37, 99, 235, 0.2)"
                            : "0 0 20px rgba(0,0,0,0.05), inset 0 0 10px rgba(0,0,0,0.05)"
                    }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                        "w-64 h-64 rounded-full flex flex-col items-center justify-center relative backdrop-blur-md border transition-colors duration-500",
                        isConnected
                            ? "bg-primary/10 border-primary/50 dark:bg-black/40"
                            : "bg-background/80 border-foreground/10 shadow-sm dark:bg-white/5 dark:border-white/10 dark:shadow-none"
                    )}
                >
                    {/* Inner Rotating Ring */}
                    <motion.div
                        animate={{ rotate: isConnected ? 360 : 0 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className={cn(
                            "absolute inset-2 rounded-full border-[2px] border-dashed",
                            isConnected ? "border-primary/60" : "border-border/50"
                        )}
                    />

                    <div className="flex flex-col items-center gap-2 z-10">
                        <Power className={cn("w-12 h-12 mb-2 transition-colors duration-500", isConnected ? "text-primary drop-shadow-[0_0_10px_rgba(37,99,235,0.8)]" : "text-muted-foreground")} />
                        <span className={cn("text-2xl font-bold tracking-widest transition-colors duration-500", isConnected ? "text-foreground" : "text-muted-foreground")}>
                            {isConnected ? t("CONNECTED") : t("OFFLINE")}
                        </span>
                        {isConnected && <TimerDisplay />}
                    </div>
                </motion.button>
            </div>

            {/* Bottom: Stats & System Proxy */}
            <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg">
                <AnimatePresence>
                    {isConnected && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex gap-4 justify-center w-full"
                        >
                            <TrafficCard label={t("Download")} value={formatSpeed(traffic.down)} icon={ArrowDown} colorClass="text-emerald-500 shadow-sm" />
                            <TrafficCard label={t("Upload")} value={formatSpeed(traffic.up)} icon={ArrowUp} colorClass="text-blue-500 shadow-sm" />
                        </motion.div>
                    )}
                </AnimatePresence>

                <MotionButton
                    onClick={toggleSystemProxy}
                    variant="secondary"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "w-full max-w-xs justify-between px-4 py-0 h-14 rounded-xl flex items-center gap-3 transition-all duration-300",
                        systemProxy
                            ? "bg-primary/10 border-primary/40 shadow-sm"
                            : "bg-background/40 border-foreground/10 shadow-sm hover:bg-background/60 hover:shadow-md hover:-translate-y-[1px] dark:bg-white/5 dark:border-white/10"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full transition-colors duration-300", systemProxy ? "bg-primary box-shadow-glow" : "bg-muted-foreground/50")} />
                        <span className={cn("text-sm font-medium transition-colors duration-300", systemProxy ? "text-primary" : "text-muted-foreground")}>{t("System Proxy")}</span>
                    </div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold transition-all duration-300", systemProxy ? "bg-primary/20 text-primary" : "bg-muted/10 text-muted-foreground")}>
                        {systemProxy ? "ON" : "OFF"}
                    </span>
                </MotionButton>
            </div>

            {/* DNS Dialog */}
            <Dialog open={addDnsOpen} onOpenChange={setAddDnsOpen}>
                <DialogContent className="glass-panel border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>{t("Add Custom DNS")}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">{t("Enter IP:Port (e.g., 1.1.1.1:53)")}</DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newDns}
                        onChange={(e) => setNewDns(e.target.value)}
                        className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                        placeholder="8.8.8.8:53"
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAddDnsOpen(false)}>{t("Cancel")}</Button>
                        <Button onClick={handleAddDns} className="bg-primary text-primary-foreground hover:bg-primary/90">{t("Add")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TimerDisplay() {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(interval);
    }, []);
    const format = (s: number) => new Date(s * 1000).toISOString().substr(11, 8);
    return <span className="text-xs font-mono opacity-60">{format(elapsed)}</span>;
}
