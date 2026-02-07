import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ipc } from "@/services/IpcService";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, MapPin, Globe, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Config } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useAtom } from "jotai";
import { themeAtom, statusAtom, trafficAtom, settingsAtom, fetchSettingsAtom } from "@/store";

import { GlassSelect } from "@/components/ui/GlassSelect";
import { GlassMultiSelect } from "@/components/ui/GlassMultiSelect";

const MotionButton = motion(Button);

const TrafficCard = ({ label, value, icon: Icon, colorClass }: { label: string, value: string, icon: React.ElementType, colorClass: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-secondary/40 border border-border rounded-lg p-4 flex items-center gap-4 w-40 sm:w-48"
    >
        <div className={cn("p-2.5 rounded-md bg-background/50 border border-border", colorClass)}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
            <span className="text-lg font-mono font-medium tracking-tight text-foreground">{value}</span>
        </div>
    </motion.div>
);

export default function ConnectionPage() {
    const { t } = useTranslation();
    const [status] = useAtom(statusAtom);
    const [traffic] = useAtom(trafficAtom);
    const [settings, setSettings] = useAtom(settingsAtom);
    const [, fetchSettings] = useAtom(fetchSettingsAtom);

    const [addDnsOpen, setAddDnsOpen] = useState(false);
    const [newDns, setNewDns] = useState("");
    const [theme] = useAtom(themeAtom);

    const isLight = theme === 'light';
    const systemProxy = !!settings?.systemProxyEnabledByApp;

    const toggleConnection = () => {
        if (status.isRunning) {
            ipc.invoke('stop-service');
        } else if (settings) {
            const payload = {
                resolver: settings.resolver,
                resolvers: settings.resolvers || [],
                domain: settings.domain,
                tunMode: settings.mode === 'tun',
                keepAliveInterval: settings.keepAliveInterval,
                congestionControl: settings.congestionControl
            };
            ipc.invoke('start-service', payload);
        }
    };

    const toggleSystemProxy = async () => {
        await ipc.invoke('toggle-system-proxy', !systemProxy);
        fetchSettings(); // Refresh settings to reflect system proxy state change from backend
    };

    const handleConfigChange = async (configId: string) => {
        const config = settings?.configs?.find((c: Config) => c.id === configId);
        if (config) {
            await setSettings({
                selectedConfigId: configId,
                domain: config.domain,
                socks5AuthUsername: config.socks?.username || "",
                socks5AuthPassword: config.socks?.password || "",
                socks5AuthEnabled: !!(config.socks?.username && config.socks?.password)
            });
        }
    };

    const handleDnsChange = async (val: string) => {
        const currentResolvers = settings?.resolvers || [];
        const newResolvers = currentResolvers.includes(val)
            ? currentResolvers.filter(r => r !== val)
            : [...currentResolvers, val];

        await setSettings({ resolvers: newResolvers });
        // Optional: backward compatibility or primary resolver setting
        if (newResolvers.length > 0) {
            await ipc.invoke('set-resolver', newResolvers[0]);
            await setSettings({ resolver: newResolvers[0] });
        }
    };

    const handleAddDns = async () => {
        if (!newDns || !settings) return;
        const formattedDns = newDns.includes(':') ? newDns : `${newDns}:53`;
        const newSavedDns = Array.from(new Set([formattedDns, ...(settings.savedDns || [])]));
        const newResolvers = Array.from(new Set([formattedDns, ...(settings.resolvers || [])]));

        await setSettings({ savedDns: newSavedDns, resolvers: newResolvers });
        setAddDnsOpen(false);
        setNewDns("");
    };

    const formatSpeed = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B/s`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB/s`;
    };

    const isConnected = !!status.isRunning;
    const configs = settings?.configs || [];
    const savedDns = settings?.savedDns || [];
    const currentResolvers = settings?.resolvers || ["8.8.8.8:53"];

    const dnsOptions = [
        "1.1.1.1:53",
        "1.0.0.1:53",
        "8.8.8.8:53",
        "8.8.4.4:53",
        "9.9.9.9:53",
        ...savedDns
    ].filter((v, i, a) => a.indexOf(v) === i);

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
                <GlassSelect value={settings?.selectedConfigId || ""} onValueChange={handleConfigChange} placeholder={t("Config")} icon={MapPin}>
                    {configs.map((c: Config) => (
                        <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                                <span>{c.country || "🏳️"}</span>
                                <span className="truncate">{c.remark}</span>
                            </span>
                        </SelectItem>
                    ))}
                </GlassSelect>

                <GlassMultiSelect
                    values={currentResolvers}
                    onValueChange={handleDnsChange}
                    placeholder={t("DNS")}
                    icon={Globe}
                    options={dnsOptions}
                    onAddCustom={() => setAddDnsOpen(true)}
                    addCustomLabel={t("Add Custom")}
                />
            </motion.div>

            {/* Center: Connect Button (Restored V0.0.2 Design) */}
            <div className="relative z-10 my-12">
                <motion.button
                    onClick={toggleConnection}
                    whileHover={isConnected ? "connectedHover" : "hover"}
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
                            background: isLight ? "#059669" : "rgba(0, 0, 0, 0.4)", // emerald-600 or dark glass
                            borderColor: "rgba(34, 197, 94, 0.5)",
                            scale: 1,
                            boxShadow: "0px 10px 30px -10px rgba(34, 197, 94, 0.2)",
                        },
                        connectedHover: {
                            background: isLight ? "#dc2626" : "rgba(0, 0, 0, 0.6)", // Red background on hover
                            borderColor: isLight ? "#dc2626" : "rgba(239, 68, 68, 0.5)",
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        },
                        hover: {
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        },
                        tap: { scale: 0.95 }
                    }}
                    className={cn(
                        "w-56 h-56 rounded-full text-2xl font-bold border-[6px] relative z-10 flex flex-col items-center justify-center gap-3 transition-shadow duration-300"
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                >
                    {/* Inner Content - handling specific hover overrides manually for "Stop" state */}
                    <motion.div
                        className="flex flex-col items-center gap-3 w-full h-full justify-center rounded-full"
                    >
                        <Zap
                            className={cn(
                                "w-10 h-10 fill-current transition-colors duration-300",
                                isConnected ? "text-white" : "text-white/90"
                            )}
                        />
                        <span
                            className={cn(
                                "tracking-widest transition-colors duration-300 font-bold",
                                isConnected ? "text-white" : "text-white"
                            )}
                        >
                            {isConnected ? t("STOP") : t("CONNECT")}
                        </span>

                        {/* Timer only shows when connected */}
                        {isConnected && (
                            <div className="text-white transition-colors duration-300">
                                <TimerDisplay />
                            </div>
                        )}
                    </motion.div>

                    {/* Pulse Ring for Connect State */}
                    {!isConnected && (
                        <span className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-20 duration-[3000ms]" />
                    )}
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
                        "w-full max-w-xs justify-between px-4 py-0 h-14 rounded-lg flex items-center gap-3 transition-all duration-300",
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
                <DialogContent className="bg-popover border-border text-foreground shadow-2xl sm:max-w-sm">
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
    // v0.0.2 format
    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    return <span className="text-xs font-normal opacity-80 tracking-normal font-mono">{formatTime(elapsed)}</span>;
}
