import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Server, Palette, Wifi } from "lucide-react";
import { Input } from "@/components/ui/input";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { useAtom } from "jotai";
import { languageAtom, themeAtom } from "@/store";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

import type { Settings } from "@/types";

export default function SettingsPage() {
    const ipc = useIpc();
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useAtom(languageAtom);
    const [theme, setTheme] = useAtom(themeAtom);
    const { t } = useTranslation();

    useEffect(() => {
        // Sync atoms to localStorage
        localStorage.setItem('app-language', lang);
        localStorage.setItem('app-theme', theme);
    }, [lang, theme]);

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke<Settings>('get-settings').then((s) => {
            setSettings(s);
            setLoading(false);
            // Optionally sync backend settings if they existed
        });
    }, [ipc]);

    const updateSetting = async (key: keyof Settings, value: unknown) => {
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
                <h2 className="text-3xl font-bold tracking-tight">{t('Settings')}</h2>
                <p className="text-muted-foreground">{t('Configure global application behavior.')}</p>
            </div>

            <div className="grid gap-6">

                {/* Appearance Settings */}
                <Card className="bg-card/40 backdrop-blur border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 leading-none">
                            <Palette className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span className="h-5 flex items-center leading-none translate-y-[2px]">{t('Appearance')}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">{t('Language')}</Label>
                            <Select value={lang} onValueChange={(v: 'en' | 'fa') => setLang(v)}>
                                <SelectTrigger className="w-[180px] bg-muted border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="fa">فارسی (Persian)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-base">{t('Theme')}</Label>
                            <Select value={theme} onValueChange={(v: 'light' | 'dark' | 'system') => setTheme(v)}>
                                <SelectTrigger className="w-[180px] bg-muted border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dark">{t('Dark')}</SelectItem>
                                    <SelectItem value="light">{t('Light')}</SelectItem>
                                    <SelectItem value="system">{t('System')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Core Settings */}
                <Card className="bg-card/40 backdrop-blur border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 leading-none">
                            <Shield className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span className="h-5 flex items-center leading-none translate-y-[2px]">{t('Core Behavior')}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">{t('Authoritative Mode')}</Label>
                                <p className="text-sm text-muted-foreground max-w-[80%]">
                                    {t('Enforce strict DNS resolution. Only enable if you know what you are doing.')}
                                </p>
                            </div>
                            <Switch
                                checked={settings.authoritative || false}
                                onCheckedChange={(c) => updateSetting('authoritative', c)}
                                className="data-[state=checked]:bg-primary"
                            />
                        </div>
                    </CardContent>
                </Card>
                {/* Advanced Networking */}
                <Card className="bg-card/40 backdrop-blur border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 leading-none">
                            <Wifi className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span className="h-5 flex items-center leading-none translate-y-[2px]">{t('Advanced Networking')}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">{t('Congestion Control')}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {t('Select TCP/QUIC congestion control algorithm.')}
                                </p>
                            </div>
                            <Select
                                value={settings.congestionControl || 'auto'}
                                onValueChange={(v) => updateSetting('congestionControl', v)}
                            >
                                <SelectTrigger className="w-[180px] bg-muted border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="bbr">BBR</SelectItem>
                                    <SelectItem value="dcubic">DCubic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">{t('QUIC Keep Alive')}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {t('Interval in seconds (Default: 400).')}
                                </p>
                            </div>
                            <Input
                                type="number"
                                className="w-[180px] bg-muted border-border"
                                placeholder="400"
                                value={settings.keepAliveInterval || ''}
                                onChange={(e) => updateSetting('keepAliveInterval', parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </CardContent>
                </Card>
                {/* DNS Settings */}
                <Card className="bg-card/40 backdrop-blur border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 leading-none">
                            <Shield className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span className="h-5 flex items-center leading-none translate-y-[2px]">{t('DNS Configuration')}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">{t('Resolve Outbound Externally')}</Label>
                                <p className="text-sm text-muted-foreground max-w-[80%]">
                                    {t('Resolve hostname using custom DNS to bypass poisoning.')}
                                </p>
                            </div>
                            <Switch
                                checked={settings.customDnsEnabled || false}
                                onCheckedChange={(c) => updateSetting('customDnsEnabled', c)}
                                className="data-[state=checked]:bg-primary"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm">{t('Primary DNS')}</Label>
                                <Input
                                    className="bg-muted border-border font-mono"
                                    placeholder="8.8.8.8"
                                    value={settings.primaryDns || ''}
                                    onChange={(e) => updateSetting('primaryDns', e.target.value)}
                                    disabled={!settings.customDnsEnabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm">{t('Secondary DNS')}</Label>
                                <Input
                                    className="bg-muted border-border font-mono"
                                    placeholder="1.1.1.1"
                                    value={settings.secondaryDns || ''}
                                    onChange={(e) => updateSetting('secondaryDns', e.target.value)}
                                    disabled={!settings.customDnsEnabled}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* Proxy Info */}
                <Card className="bg-card/40 backdrop-blur border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 leading-none">
                            <Server className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span className="h-5 flex items-center leading-none translate-y-[2px]">{t('Local Proxies')}</span>
                        </CardTitle>
                        <CardDescription>
                            {t('These ports are exposed on your local machine.')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-muted border border-border flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-xs font-mono text-muted-foreground uppercase">{t('HTTP Proxy')}</div>
                                <div className="text-xl font-mono">127.0.0.1:8080</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                        <div className="p-4 rounded-xl bg-muted border border-border flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-xs font-mono text-muted-foreground uppercase">{t('SOCKS5 Proxy')}</div>
                                <div className="text-xl font-mono">0.0.0.0:10809</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                    </CardContent>
                </Card>



                {/* Info */}
                <div className="text-center text-xs text-muted-foreground pt-8">
                    <p>{`${APP_NAME} ${APP_VERSION}`}</p>
                    <p className="mt-1 opacity-50">{t('Designed with ❤️')}</p>
                </div>

            </div>
        </div>
    );
}
