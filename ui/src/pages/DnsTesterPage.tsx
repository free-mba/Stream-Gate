import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Square, Play } from "lucide-react";
import { useAtom } from "jotai";
import { dnsResultsAtom, dnsResultsAtomsAtom, isDnsScanningAtom, dnsProgressAtom, dnsScanStatsAtom } from "@/store";
import { DnsResultRow } from "@/components/DnsResultRow";
import type { DnsCheckResult, Settings } from "@/types";
import type { IpcRendererEvent } from "electron";

// Types from modal
export interface ScanConfig {
    mode: 'dnstt' | 'slipstream';
    domain: string;
    workers: number;
    timeout: number;
    servers: string[];
}

const DEFAULT_SERVERS = `1.1.1.1
1.0.0.1
8.8.8.8
8.8.4.4
9.9.9.9
149.112.112.112
76.76.2.0
76.76.10.0
208.67.222.222
208.67.220.220`;

import { useTranslation } from "@/lib/i18n";

export default function DnsTesterPage() {
    const ipc = useIpc();
    const { t } = useTranslation();

    // Local Config State
    const [mode, setMode] = useState<'dnstt' | 'slipstream'>('slipstream');
    const [domain, setDomain] = useState("google.com");
    const [workers, setWorkers] = useState(20);
    const [scanTimeout, setScanTimeout] = useState(3);
    const [showWorkingOnly, setShowWorkingOnly] = useState(() => {
        return localStorage.getItem("dnsShowWorkingOnly") === "true";
    });
    const [serversText, setServersText] = useState(() => {
        return localStorage.getItem("savedDnsServers") || DEFAULT_SERVERS;
    });



    // Persist showWorkingOnly
    useEffect(() => {
        localStorage.setItem("dnsShowWorkingOnly", String(showWorkingOnly));
    }, [showWorkingOnly]);

    // Jotai atoms
    const [results, setResults] = useAtom(dnsResultsAtom);
    const [resultAtoms] = useAtom(dnsResultsAtomsAtom);

    // Persist results
    useEffect(() => {
        localStorage.setItem('dnsTestResults', JSON.stringify(results));
    }, [results]);
    const [isRunning, setIsRunning] = useAtom(isDnsScanningAtom);
    const [progress, setProgress] = useAtom(dnsProgressAtom);
    const [stats, setStats] = useAtom(dnsScanStatsAtom);

    // Clean up listeners on unmount
    useEffect(() => {
        if (!ipc) return;

        const onProgress = (_event: IpcRendererEvent, data: unknown) => {
            const { completed, total } = data as { completed: number, total: number };
            setProgress((completed / total) * 100);
            setStats({ completed, total });
        };

        const onResult = (_event: IpcRendererEvent, result: unknown) => {
            const res = result as DnsCheckResult;
            setResults(prev => {
                return prev.map(item => {
                    if (item.server === res.server) {
                        return { ...item, ...res, stage: 'done' };
                    }
                    return item;
                });
            });
        };

        const onComplete = () => {
            setIsRunning(false);
        };

        ipc.on('dns-scan-progress', onProgress);
        ipc.on('dns-scan-result', onResult);
        ipc.on('dns-scan-complete', onComplete);

        return () => {
            ipc.removeListener('dns-scan-progress', onProgress);
            ipc.removeListener('dns-scan-result', onResult);
            ipc.removeListener('dns-scan-complete', onComplete);
        };
    }, [ipc, setResults, setProgress, setStats, setIsRunning]);


    const handleStartScan = async () => {
        if (!ipc) return;

        // Parse servers
        const servers = serversText
            .split('\n')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('#') && /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(s));

        const uniqueServers = Array.from(new Set(servers));

        if (uniqueServers.length === 0) {
            // In a real app we might use a toast here
            console.error("No valid IPv4 servers found!");
            return;
        }

        const config: ScanConfig = {
            mode,
            domain,
            workers,
            timeout: scanTimeout,
            servers: uniqueServers
        };

        // Reset state
        const initialResults: DnsCheckResult[] = config.servers.map(s => ({
            server: s,
            stage: 'queued',
            status: 'Queued'
        }));

        setResults(initialResults);
        setProgress(0);
        setStats({ completed: 0, total: initialResults.length });
        setIsRunning(true);

        // Start backend scan
        await ipc.invoke('dns-scan-start', config);
    };

    const stopTest = async () => {
        if (ipc) {
            await ipc.invoke('dns-scan-stop');
            setIsRunning(false);
        }
    };

    const handleUse = async (server: string) => {
        if (!ipc) return;
        const normalized = server.includes(':') ? server : `${server}:53`;
        const settings = await ipc.invoke<Settings>('get-settings');
        await ipc.invoke('save-settings', { ...settings, resolver: normalized });
    };

    return (
        <div className="h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between shrink-0 mb-4 px-1">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("DNS Tester")}</h2>
                    <p className="text-xs text-muted-foreground">{t("Compare DNS resolvers for speed and compatibility.")}</p>
                </div>
            </div>

            {/* Configuration Section (Top, Full Width) */}
            <div className="shrink-0 p-4 rounded-xl bg-card border border-border space-y-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{t("Configuration")}</h3>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{t("Setup")}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Column 1: Mode & Domain */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs">{t("Scan Mode")}</Label>
                            <Select value={mode} onValueChange={(v: string) => setMode(v as 'dnstt' | 'slipstream')}>
                                <SelectTrigger className="h-8 text-xs bg-muted border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="slipstream">Slipstream</SelectItem>
                                    <SelectItem value="dnstt">DNSTT</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                {mode === 'slipstream' ? t('Verify Slipstream') : t('Verify DNSTT')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">{t("Test Domain")}</Label>
                            <Input
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                                className="h-8 text-xs bg-muted border-border text-left"
                                dir="ltr"
                                placeholder="google.com"
                            />
                        </div>
                    </div>

                    {/* Column 2: Workers & Timeout */}
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label className="text-xs">{t("Workers")}</Label>
                                <span className="text-[10px] font-mono text-muted-foreground">{workers}</span>
                            </div>
                            <Slider
                                value={[workers]}
                                onValueChange={v => setWorkers(v[0])}
                                max={20}
                                step={1}
                                min={2}
                                className="[&_.bg-primary]:bg-primary"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label className="text-xs">{t("Timeout")}</Label>
                                <span className="text-[10px] font-mono text-muted-foreground">{scanTimeout}s</span>
                            </div>
                            <Slider
                                value={[scanTimeout]}
                                onValueChange={v => setScanTimeout(v[0])}
                                max={20}
                                step={1}
                                min={1}
                                className="[&_.bg-primary]:bg-primary"
                            />
                        </div>
                    </div>

                    {/* Column 3: Servers (Large Textarea) */}
                    <div className="md:col-span-2 flex flex-col space-y-2">
                        <div className="flex items-center justify-between mb-2 h-6">
                            <div className="h-6 flex items-center">
                                <Label className="text-xs leading-none translate-y-[2px]">{t("DNS Servers (one per line)")}</Label>
                            </div>

                        </div>
                        <Textarea
                            value={serversText}
                            onChange={e => setServersText(e.target.value)}
                            onBlur={() => localStorage.setItem("savedDnsServers", serversText)}
                            className="flex-1 min-h-[100px] text-[10px] font-mono leading-relaxed bg-muted border-border resize-none text-left"
                            dir="ltr"
                            placeholder="1.1.1.1"
                        />
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex justify-end rtl:justify-start pt-2">
                    {!isRunning ? (
                        <Button onClick={handleStartScan} className="w-48 bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-xs font-bold tracking-wide shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            <Play className="w-3 h-3 fill-current shrink-0" />
                            <span className="h-3 flex items-center leading-none translate-y-[1.5px]">{t("START SCAN")}</span>
                        </Button>
                    ) : (
                        <Button onClick={stopTest} variant="destructive" className="w-48 h-9 text-xs font-semibold tracking-wide flex items-center justify-center gap-2">
                            <Square className="w-3 h-3 fill-current shrink-0" />
                            <span className="h-3 flex items-center leading-none translate-y-[1.5px]">{t("STOP")} ({Math.round(progress)}%)</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Results Section (Bottom, Full Width) */}
            <div className="flex-1 flex flex-col min-w-0 bg-card/60 rounded-xl border border-border overflow-hidden relative">
                {/* Header */}
                <div className="flex items-center justify-between rtl:flex-row-reverse p-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-mono text-muted-foreground">
                            {isRunning ? t('SCANNING...') : t('READY')}
                        </div>
                        {/* Working Only Filter */}
                        <div className="flex items-center gap-2 h-4">
                            <div className="flex items-center h-4">
                                <Checkbox
                                    id="showWorking"
                                    checked={showWorkingOnly}
                                    onCheckedChange={(checked: boolean | 'indeterminate') => setShowWorkingOnly(checked === true)}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                            <Label htmlFor="showWorking" className="text-[10px] font-medium leading-none cursor-pointer flex items-center h-4 translate-y-[1.5px]">
                                {t("Show working only")}
                            </Label>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{stats.completed}/{stats.total}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                {isRunning && <Progress value={progress} className="h-[2px] w-full shrink-0 rounded-none bg-transparent [&>div]:bg-primary" />}

                <div className="flex-1 overflow-auto relative">
                    <table className="w-full caption-bottom text-sm min-h-full">
                        <TableHeader className="bg-muted sticky top-0 z-10 backdrop-blur-md">
                            <TableRow className="border-border hover:bg-transparent text-[11px] uppercase tracking-wider">
                                <TableHead className="w-[200px] px-4 text-start">{t("Server")}</TableHead>
                                <TableHead className="w-[100px] text-start">{t("Score")}</TableHead>
                                <TableHead className="w-[120px] text-start">{t("Time")}</TableHead>
                                <TableHead className="min-w-[300px] text-start">{t("Details")}</TableHead>
                                <TableHead className="w-[100px] text-start px-4">{t("Action")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs font-mono [&_tr:nth-child(odd)]:bg-muted/30">
                            {resultAtoms.length === 0 && (
                                <TableRow className="h-full border-0 hover:bg-transparent bg-transparent!">
                                    <TableCell colSpan={5} className="h-full text-center text-muted-foreground align-middle pb-20">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-50 h-full">
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center animate-pulse">
                                                <Play className="w-6 h-6 ml-0.5" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-medium">{t("Ready to scan")}</p>
                                                <p className="text-xs">{t("Configure settings above and click start")}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {resultAtoms.map((atom) => (
                                <DnsResultRow
                                    key={`${atom}`}
                                    resultAtom={atom}
                                    handleUse={handleUse}
                                    showWorkingOnly={showWorkingOnly}
                                />
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>
        </div>
    );
}
