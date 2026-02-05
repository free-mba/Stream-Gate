import { useAtom, useAtomValue } from "jotai";
import {
    isDnsScanningAtom,
    dnsProgressAtom,
    dnsScanStatsAtom
} from "@/store";

import { dnsScanner } from "./DnsScannerService";
import { DnsControls } from "./components/DnsControls";
import { DnsTable } from "./components/DnsTable";
import { ipc } from "@/services/IpcService";
import type { Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";
import { useCallback } from "react";
import { IP_REGEX, COMMENT_PREFIX, DEFAULT_DNS_PORT, type ScanConfig } from "./DnsTesterConstants";
import { dnsConfigAtom } from "./DnsTesterState";

export default function DnsTesterPage() {
    const { t } = useTranslation();

    // Global atoms
    const [config, setConfig] = useAtom(dnsConfigAtom);

    const {
        serversText,
        mode,
        domain,
        workers,
        timeout,
        showWorkingOnly
    } = config;

    const isRunning = useAtomValue(isDnsScanningAtom);
    const progress = useAtomValue(dnsProgressAtom);
    const stats = useAtomValue(dnsScanStatsAtom);

    // Handlers
    const handleStartScan = async () => {
        const servers = serversText
            .split('\n')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith(COMMENT_PREFIX) && IP_REGEX.test(s));

        const uniqueServers = Array.from(new Set(servers));
        if (uniqueServers.length === 0) return;

        const config: ScanConfig = {
            mode: mode,
            domain: domain,
            workers: workers,
            timeout: timeout,
            servers: uniqueServers
        };

        await dnsScanner.startScan(config);
    }

    const stopTest = useCallback(async () => {
        await dnsScanner.stopScan();
    }, []);

    const handleUse = useCallback(async (server: string) => {
        const normalized = server.includes(':') ? server : `${server}:${DEFAULT_DNS_PORT}`;
        const currentSettings = await ipc.invoke<Settings>('get-settings');
        await ipc.invoke('save-settings', { ...currentSettings, resolver: normalized });
    }, []);

    return (
        <div className="h-full flex flex-col p-4 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Activity className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{t("DNS Tester")}</h2>
                    <p className="text-xs text-muted-foreground">{t("Find the fastest quantum link.")}</p>
                </div>
            </div>

            <DnsControls
                onStop={stopTest}
                progress={progress}
                isRunning={isRunning}
                onStart={handleStartScan}
            />

            {/* Results Table Container */}
            <div className="flex-1 flex flex-col min-w-0 glass-panel rounded-lg overflow-hidden relative">
                <div className="flex items-center justify-between p-3 border-b border-border bg-background/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-mono font-medium text-primary tracking-wider animate-pulse">
                            {isRunning ? t('SCANNING_NETWORK...') : t('READY')}
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="showWorking"
                                checked={showWorkingOnly}
                                onCheckedChange={(c) => setConfig(prev => ({ ...prev, showWorkingOnly: !!c }))}
                                className="border-muted-foreground/30 data-[state=checked]:bg-primary"
                            />
                            <Label htmlFor="showWorking" className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">{t("Show working only")}</Label>
                        </div>
                    </div>
                    <div className="text-xs font-mono opacity-50 text-foreground">
                        {stats.completed}/{stats.total}
                    </div>
                </div>

                {isRunning && (
                    <Progress
                        value={progress}
                        className="h-[2px] w-full shrink-0 rounded-none bg-transparent [&>div]:bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                    />
                )}

                <DnsTable handleUse={handleUse} />
            </div>
        </div>
    );
}
