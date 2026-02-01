import { useState, useRef } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square } from "lucide-react";
import { useAtom } from "jotai";
import { dnsResultsAtom, isDnsScanningAtom, dnsProgressAtom } from "@/store";
import { DnsResultRow } from "@/components/DnsResultRow";
import { APP_NAME } from "@/lib/constants";
import type { DnsCheckResult, Settings } from "@/types";

const DEFAULT_DNS_LIST = `1.1.1.1
1.0.0.1
8.8.8.8
8.8.4.4
9.9.9.9
149.112.112.112
76.76.2.0
76.76.10.0
208.67.222.222
208.67.220.220`;

export default function DnsTesterPage() {
    const ipc = useIpc();
    const [serversText, setServersText] = useState(DEFAULT_DNS_LIST);
    const [testDomain, setTestDomain] = useState("google.com");

    // Jotai atoms
    const [results, setResults] = useAtom(dnsResultsAtom);
    const [isRunning, setIsRunning] = useAtom(isDnsScanningAtom);
    const [progress, setProgress] = useAtom(dnsProgressAtom);

    const abortRef = useRef(false);

    // Load persisted results on mount? (If we want persistence across tabs, Jotai handles it in memory, 
    // but for app restart we'd need localStorage persistence. User asked "persist the dns test result on the dns page")
    // Since we are using an atom exported from store.ts, it will persist as long as the app is open.

    const parseServers = (text: string) => {
        return text.split('\n')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('#') && /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(s));
    };

    const runTest = async () => {
        if (!ipc || isRunning) return;

        const servers = parseServers(serversText);
        if (servers.length === 0) return;

        setIsRunning(true);
        setResults(servers.map(s => ({ server: s, status: 'Queued', stage: 'checking' })));
        setProgress(0);
        abortRef.current = false;

        // Sequential test
        for (let i = 0; i < servers.length; i++) {
            if (abortRef.current) break;

            const server = servers[i];

            // Mark as checking
            setResults(prev => {
                const next = [...prev];
                next[i] = { ...next[i], status: 'Checking...' };
                return next;
            });

            // Ping first (quick check)
            // Actually the IPC does both.

            const res = await ipc.invoke<DnsCheckResult>('dns-check-single', {
                server,
                domain: testDomain,
                pingTimeoutMs: 1500,
                dnsTimeoutMs: 2000
            });

            setResults(prev => {
                const next = [...prev];
                // Manually construct the new object to avoid spread issues if types are loose
                next[i] = {
                    ...res,
                    server,
                    stage: 'done' as const,
                    status: res.status ?? 'Unknown'
                };
                return next;
            });

            setProgress(((i + 1) / servers.length) * 100);
        }

        setIsRunning(false);
    };

    const stopTest = () => {
        abortRef.current = true;
        setIsRunning(false);
    };

    const handleUse = async (server: string) => {
        if (!ipc) return;
        const normalized = server.includes(':') ? server : `${server}:53`;

        // We just save it as the 'resolver' in settings, OR we need to let Home Page knw.
        // The user asked to "persist the selected dns on the home page".
        // So we will trigger a save-settings.
        const settings = await ipc.invoke<Settings>('get-settings');
        await ipc.invoke('save-settings', { ...settings, resolver: normalized });

        // Optionally navigate to home? 
        // For now just alert
        // alert(`Applied ${normalized}`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">DNS Tester</h2>
                    <p className="text-muted-foreground">Find the fastest DNS for your network.</p>
                </div>
                <div className="flex gap-2">
                    {!isRunning ? (
                        <Button onClick={runTest} className="gap-2 bg-green-600 hover:bg-green-700">
                            <Play className="w-4 h-4 fill-current" /> Start Scan
                        </Button>
                    ) : (
                        <Button onClick={stopTest} variant="destructive" className="gap-2">
                            <Square className="w-4 h-4 fill-current" /> Stop
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden gap-6">
                {/* Configuration Area */}
                <div className="shrink-0 space-y-4">
                    <Card className="bg-card/40 backdrop-blur border-white/5">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Test Domain</label>
                                    <Input
                                        value={testDomain}
                                        onChange={e => setTestDomain(e.target.value)}
                                        className="font-mono text-xs bg-black/20 border-white/10 max-w-[250px]"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        The domain should point to your {APP_NAME} server directly (A Record).
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">DNS Servers (one per line)</label>
                                    <Textarea
                                        value={serversText}
                                        onChange={e => setServersText(e.target.value)}
                                        className="font-mono text-xs bg-black/20 border-white/10 h-[120px] min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Area */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                    {isRunning && <Progress value={progress} className="h-1 shrink-0" />}

                    <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur overflow-hidden flex-1 relative">
                        <div className="absolute inset-0 overflow-auto">
                            <Table>
                                <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="w-[30%] pl-4">Server</TableHead>
                                        <TableHead className="w-[15%] text-right">Ping</TableHead>
                                        <TableHead className="w-[15%] text-right">DNS</TableHead>
                                        <TableHead className="w-[20%] text-center">Status</TableHead>
                                        <TableHead className="w-[20%] text-right pr-4">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                Ready to scan.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {results.map((res, i) => (
                                        <DnsResultRow key={`${res.server}-${i}`} index={i} handleUse={handleUse} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
