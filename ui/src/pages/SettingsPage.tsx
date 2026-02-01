import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Server } from "lucide-react";
// import { cn } from "@/lib/utils"; // cn is NOT used in SettingsPage currently.

export default function SettingsPage() {
    const ipc = useIpc();
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke('get-settings').then((s: any) => {
            setSettings(s);
            setLoading(false);
        });
    }, [ipc]);

    const updateSetting = async (key: string, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (ipc) {
            if (key === 'authoritative') {
                await ipc.invoke('set-authoritative', value);
            } else {
                // Generic save
                await ipc.invoke('save-settings', newSettings);
            }
        }
    };

    if (loading) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Configure global application behavior.</p>
            </div>

            <div className="grid gap-6">

                {/* Core Settings */}
                <Card className="bg-card/40 backdrop-blur border-white/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Core Behavior
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Authoritative Mode</Label>
                                <p className="text-sm text-muted-foreground max-w-[80%]">
                                    Enforce strict DNS resolution. Only enable if you know what you are doing.
                                </p>
                            </div>
                            <Switch
                                checked={settings.authoritative || false}
                                onCheckedChange={(c) => updateSetting('authoritative', c)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Proxy Info */}
                <Card className="bg-card/40 backdrop-blur border-white/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="w-5 h-5 text-blue-400" />
                            Local Proxies
                        </CardTitle>
                        <CardDescription>
                            These ports are exposed on your local machine.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-xs font-mono text-muted-foreground uppercase">HTTP Proxy</div>
                                <div className="text-xl font-mono">127.0.0.1:8080</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                        <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-xs font-mono text-muted-foreground uppercase">SOCKS5 Proxy</div>
                                <div className="text-xl font-mono">0.0.0.0:10809</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                    </CardContent>
                </Card>



                {/* Info */}
                <div className="text-center text-xs text-muted-foreground pt-8">
                    <p>SlipStream GUI v1.0.53</p>
                    <p className="mt-1 opacity-50">Designed with ❤️</p>
                </div>

            </div>
        </div>
    );
}
