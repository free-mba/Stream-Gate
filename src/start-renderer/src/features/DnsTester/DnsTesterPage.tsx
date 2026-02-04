import { useState, useEffect } from "react";
import { ipc } from "@/services/IpcService";
import { Button } from "@/components/ui/button";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Square, Play, Activity } from "lucide-react";
import { useAtom } from "jotai";
import { dnsResultsAtom, dnsResultsAtomsAtom, isDnsScanningAtom, dnsProgressAtom, dnsScanStatsAtom } from "@/store";
import { DnsResultRow } from "./components/DnsResultRow";
import type { DnsCheckResult, Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";

export interface ScanConfig {
    mode: 'dnstt' | 'stream';
    domain: string;
    workers: number;
    timeout: number;
    servers: string[];
}

const DEFAULT_SERVERS = `1.1.1.1\n1.0.0.1\n8.8.8.8\n8.8.4.4\n9.9.9.9\n149.112.112.112\n76.76.2.0\n76.76.10.0\n208.67.222.222\n208.67.220.220`;

export default function DnsTesterPage() {

    const { t } = useTranslation();

    const [mode, setMode] = useState<'dnstt' | 'stream'>('stream');
    const [domain, setDomain] = useState("google.com");
    const [workers, setWorkers] = useState(20);
    const [scanTimeout, setScanTimeout] = useState(3);
    const [showWorkingOnly, setShowWorkingOnly] = useState(() => localStorage.getItem("dnsShowWorkingOnly") === "true");
    const [serversText, setServersText] = useState(() => localStorage.getItem("savedDnsServers") || DEFAULT_SERVERS);

    useEffect(() => { localStorage.setItem("dnsShowWorkingOnly", String(showWorkingOnly)); }, [showWorkingOnly]);

    const [results, setResults] = useAtom(dnsResultsAtom);
    const [resultAtoms] = useAtom(dnsResultsAtomsAtom);
    const [isRunning, setIsRunning] = useAtom(isDnsScanningAtom);
    const [progress, setProgress] = useAtom(dnsProgressAtom);
    const [stats, setStats] = useAtom(dnsScanStatsAtom);

    useEffect(() => {
        localStorage.setItem('dnsTestResults', JSON.stringify(results));
    }, [results]);

    useEffect(() => {
        const onProgress = (_: unknown, data: unknown) => {
            const d = data as { completed: number, total: number };
            setProgress((d.completed / d.total) * 100);
            setStats(d);
        };
        const onResult = (_: unknown, res: unknown) => {
            const r = res as DnsCheckResult;
            setResults(prev => prev.map(item => item.server === r.server ? { ...item, ...r, stage: 'done' } : item));
        };
        const onComplete = () => setIsRunning(false);

        ipc.on('dns-scan-progress', onProgress);
        ipc.on('dns-scan-result', onResult);
        ipc.on('dns-scan-complete', onComplete);

        return () => {
            ipc.removeListener('dns-scan-progress', onProgress);
            ipc.removeListener('dns-scan-result', onResult);
            ipc.removeListener('dns-scan-complete', onComplete);
        };
    }, [setResults, setProgress, setStats, setIsRunning]);

    const handleStartScan = async () => {
        const servers = serversText.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#') && /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(s));
        const uniqueServers = Array.from(new Set(servers));

        if (uniqueServers.length === 0) return;

        const config: ScanConfig = { mode, domain, workers, timeout: scanTimeout, servers: uniqueServers };
        const initialResults: DnsCheckResult[] = config.servers.map(s => ({ server: s, stage: 'queued', status: 'Queued' }));

        setResults(initialResults);
        setProgress(0);
        setStats({ completed: 0, total: initialResults.length });
        setIsRunning(true);
        await ipc.invoke('dns-scan-start', config);
    };

    const stopTest = async () => {
        await ipc.invoke('dns-scan-stop');
        setIsRunning(false);
    };

    const handleUse = async (server: string) => {
        const normalized = server.includes(':') ? server : `${server}:53`;
        const settings = await ipc.invoke<Settings>('get-settings');
        await ipc.invoke('save-settings', { ...settings, resolver: normalized });
    };

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

            {/* Config Panel */}
            <div className="glass-panel rounded-xl p-5 mb-6 space-y-5 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Settings Col */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("Mode")}</Label>
                            <Select value={mode} onValueChange={(v: string) => setMode(v as 'dnstt' | 'stream')}>
                                <SelectTrigger className="h-8 text-xs bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="glass-panel border-border text-foreground">
                                    <SelectItem value="stream">Stream Gate</SelectItem>
                                    <SelectItem value="dnstt">Custom Protocol</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("Domain")}</Label>
                            <Input value={domain} onChange={e => setDomain(e.target.value)} className="h-8 text-xs bg-background/50 border-input font-mono text-foreground" />
                        </div>
                    </div>

                    {/* Sliders Col */}
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex justify-between"><Label className="text-xs text-muted-foreground uppercase">{t("Workers")}</Label><span className="text-[10px] font-mono opacity-70 text-foreground">{workers}</span></div>
                            <Slider value={[workers]} onValueChange={v => setWorkers(v[0])} max={30} step={1} min={2} className="[&_.bg-primary]:bg-primary" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between"><Label className="text-xs text-muted-foreground uppercase">{t("Timeout")}</Label><span className="text-[10px] font-mono opacity-70 text-foreground">{scanTimeout}s</span></div>
                            <Slider value={[scanTimeout]} onValueChange={v => setScanTimeout(v[0])} max={10} step={1} min={1} className="[&_.bg-primary]:bg-primary" />
                        </div>
                    </div>

                    {/* Servers Textarea */}
                    <div className="md:col-span-2 space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("DNS Servers")}</Label>
                        <Textarea
                            value={serversText}
                            onChange={e => setServersText(e.target.value)}
                            className="h-[100px] text-[10px] font-mono bg-background/50 border-input resize-none rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    {!isRunning ? (
                        <Button onClick={handleStartScan} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider shadow-lg shadow-primary/20">
                            <Play className="w-3 h-3 mr-2 fill-current" /> {t("START SCAN")}
                        </Button>
                    ) : (
                        <Button onClick={stopTest} variant="destructive" className="font-bold tracking-wider">
                            <Square className="w-3 h-3 mr-2" /> {t("STOP")} ({Math.round(progress)}%)
                        </Button>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 flex flex-col min-w-0 glass-panel rounded-xl overflow-hidden relative">
                <div className="flex items-center justify-between p-3 border-b border-border bg-background/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-mono font-medium text-primary tracking-wider animate-pulse">
                            {isRunning ? t('SCANNING_NETWORK...') : t('READY')}
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="showWorking" checked={showWorkingOnly} onCheckedChange={(c) => setShowWorkingOnly(!!c)} className="border-muted-foreground/30 data-[state=checked]:bg-primary" />
                            <Label htmlFor="showWorking" className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">{t("Show working only")}</Label>
                        </div>
                    </div>
                    <div className="text-xs font-mono opacity-50 text-foreground">{stats.completed}/{stats.total}</div>
                </div>

                {isRunning && <Progress value={progress} className="h-[2px] w-full shrink-0 rounded-none bg-transparent [&>div]:bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />}

                <div className="flex-1 overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-md z-10">
                            <TableRow className="border-border hover:bg-transparent text-[10px] uppercase tracking-widest text-muted-foreground">
                                <TableHead className="w-[200px] px-4">{t("Server")}</TableHead>
                                <TableHead className="w-[100px]">{t("Score")}</TableHead>
                                <TableHead className="w-[120px]">{t("Latency")}</TableHead>
                                <TableHead className="min-w-[300px]">{t("Details")}</TableHead>
                                <TableHead className="w-[100px] px-4">{t("Action")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="[&_tr:nth-child(even)]:bg-foreground/5 dark:[&_tr:nth-child(even)]:bg-white/5">
                            {resultAtoms.map((atom) => (
                                <DnsResultRow key={`${atom}`} resultAtom={atom} handleUse={handleUse} showWorkingOnly={showWorkingOnly} />
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>
        </div>
    );
}
