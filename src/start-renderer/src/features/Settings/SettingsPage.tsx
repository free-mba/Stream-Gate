import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Server, Palette, Wifi, Zap, Bug, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { useAtom } from "jotai";
import { languageAtom, themeAtom } from "@/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Settings } from "@/types";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
}

const GlassCard = ({ children, className }: GlassCardProps) => (
    <div className={cn("glass-panel rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5", className)}>
        {children}
    </div>
);

interface SectionHeaderProps {
    icon: React.ElementType;
    title: string;
}

const SectionHeader = ({ icon: Icon, title }: SectionHeaderProps) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
    </div>
);

interface SettingRowProps {
    label: string;
    description?: string;
    children: React.ReactNode;
}

const SettingRow = ({ label, description, children }: SettingRowProps) => (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
        <div className="space-y-1">
            <Label className="text-base font-medium text-foreground">{label}</Label>
            {description && <p className="text-sm text-muted-foreground max-w-[80%] leading-relaxed">{description}</p>}
        </div>
        <div className="flex items-center gap-4">
            {children}
        </div>
    </div>
);

export default function SettingsPage() {
    const ipc = useIpc();
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useAtom(languageAtom);
    const [theme, setTheme] = useAtom(themeAtom);
    const { t } = useTranslation();
    const [copyingLogs, setCopyingLogs] = useState(false);

    const handleCopyLogs = async () => {
        if (!ipc) return;
        try {
            const logs = await ipc.invoke('get-logs');
            const element = document.createElement("textarea");
            element.value = JSON.stringify(logs, null, 2);
            document.body.appendChild(element);
            element.select();
            document.execCommand("copy");
            document.body.removeChild(element);

            setCopyingLogs(true);
            setTimeout(() => setCopyingLogs(false), 2000);
        } catch (err) {
            console.error('Failed to copy logs', err);
        }
    };

    useEffect(() => {
        localStorage.setItem('app-language', lang);
        localStorage.setItem('app-theme', theme);
    }, [lang, theme]);

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke<Settings>('get-settings').then((s) => {
            setSettings(s);
            setLoading(false);
        });
    }, [ipc]);

    const updateSetting = async (key: keyof Settings, value: unknown) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (ipc) {
            await ipc.invoke(key === 'authoritative' ? 'set-authoritative' : 'save-settings', key === 'authoritative' ? value : newSettings);
        }
    };

    if (loading) return null;

    return (
        <div className="w-full max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">{t('Settings')}</h1>
                <p className="text-lg text-muted-foreground">{t('Configure your quantum link parameters.')}</p>
            </div>

            <div className="grid gap-8">
                {/* Appearance */}
                <GlassCard>
                    <SectionHeader icon={Palette} title={t('Appearance')} />
                    <div className="space-y-2">
                        <SettingRow label={t('Language')} description={t('Select your preferred interface language.')}>
                            <Select value={lang} onValueChange={(v: 'en' | 'fa') => setLang(v)}>
                                <SelectTrigger className="w-[180px] bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="glass-panel border-border text-foreground">
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="fa">فارسی</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                        <SettingRow label={t('Theme')} description={t('Customize the visual atmosphere.')}>
                            <Select value={theme} onValueChange={(v: 'light' | 'dark' | 'system') => setTheme(v)}>
                                <SelectTrigger className="w-[180px] bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="glass-panel border-border text-foreground">
                                    <SelectItem value="dark">{t('Dark')}</SelectItem>
                                    <SelectItem value="light">{t('Light')}</SelectItem>
                                    <SelectItem value="system">{t('System')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    </div>
                </GlassCard>

                {/* Core Behavior */}
                <GlassCard>
                    <SectionHeader icon={Zap} title={t('Core Behavior')} />
                    <div className="space-y-2">
                        <SettingRow
                            label={t('Authoritative Mode')}
                            description={t('Enforces strict DNS resolution policies. Use with caution.')}
                        >
                            <Switch checked={settings.authoritative || false} onCheckedChange={(c) => updateSetting('authoritative', c)} />
                        </SettingRow>
                    </div>
                </GlassCard>

                {/* Advanced Networking */}
                <GlassCard>
                    <SectionHeader icon={Wifi} title={t('Advanced Networking')} />
                    <div className="space-y-2">
                        <SettingRow label={t('Congestion Control')} description={t('Algorithm for TCP/QUIC flow control.')}>
                            <Select value={settings.congestionControl || 'auto'} onValueChange={(v) => updateSetting('congestionControl', v)}>
                                <SelectTrigger className="w-[180px] bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="glass-panel border-border text-foreground">
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="bbr">BBR</SelectItem>
                                    <SelectItem value="dcubic">DCubic</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                        <SettingRow label={t('QUIC Keep Alive')} description={t('Interval in seconds for keep-alive packets.')}>
                            <Input
                                type="number"
                                className="w-[180px] bg-background/50 border-input text-foreground"
                                value={settings.keepAliveInterval || ''}
                                onChange={(e) => updateSetting('keepAliveInterval', parseInt(e.target.value) || 0)}
                                placeholder="400"
                            />
                        </SettingRow>
                    </div>
                </GlassCard>

                {/* DNS Configuration */}
                <GlassCard>
                    <SectionHeader icon={Shield} title={t('Secure DNS')} />
                    <div className="space-y-2">
                        <SettingRow label={t('Custom Resolver')} description={t('Bypass local DNS poisoning with encrypted upstream resolution.')}>
                            <Switch checked={settings.customDnsEnabled || false} onCheckedChange={(c) => updateSetting('customDnsEnabled', c)} />
                        </SettingRow>

                        {settings.customDnsEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t('Primary DNS')}</Label>
                                    <Input
                                        className="bg-background/50 border-input font-mono text-foreground"
                                        value={settings.primaryDns || ''}
                                        onChange={(e) => updateSetting('primaryDns', e.target.value)}
                                        placeholder="8.8.8.8"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t('Secondary DNS')}</Label>
                                    <Input
                                        className="bg-background/50 border-input font-mono text-foreground"
                                        value={settings.secondaryDns || ''}
                                        onChange={(e) => updateSetting('secondaryDns', e.target.value)}
                                        placeholder="1.1.1.1"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Local Proxy Info */}
                <GlassCard>
                    <SectionHeader icon={Server} title={t('Local Ports')} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background/50 border border-border flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t('HTTP Proxy')}</div>
                                <div className="text-xl font-mono text-primary">127.0.0.1:8080</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t('SOCKS5 Proxy')}</div>
                                <div className="text-xl font-mono text-primary">0.0.0.0:10809</div>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                    </div>
                </GlassCard>

                {/* Troubleshooting */}
                <GlassCard>
                    <SectionHeader icon={Bug} title={t('Troubleshooting')} />
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base font-medium text-foreground">{t('Debug Logs')}</Label>
                                <p className="text-sm text-muted-foreground">{t('Copy recent logs (last 2 minutes) for bug reporting.')}</p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleCopyLogs}
                                disabled={copyingLogs}
                                className="min-w-[140px]"
                            >
                                {copyingLogs ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {copyingLogs ? t('Copied') : t('Copy Logs')}
                            </Button>
                        </div>
                    </div>
                </GlassCard>

                <div className="flex flex-col items-center justify-center pt-8 opacity-50">
                    <span className="text-sm font-medium tracking-widest text-muted-foreground">{APP_NAME} <span className="text-primary">{APP_VERSION}</span></span>
                </div>
            </div>
        </div>
    );
}
