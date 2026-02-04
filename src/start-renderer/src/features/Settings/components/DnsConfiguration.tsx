import { memo } from "react";
import { Shield } from "lucide-react";
import type { Settings } from "@/types";
import { GlassCard } from "./GlassCard";
import { SettingRow } from "./SettingRow";
import { useTranslation } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "./SectionHeader";

interface DnsConfigurationProps {
    customDnsEnabled?: boolean;
    primaryDns?: string;
    secondaryDns?: string;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>;
}

export const DnsConfiguration = memo(({ customDnsEnabled, primaryDns, secondaryDns, updateSetting }: DnsConfigurationProps) => {
    const { t } = useTranslation();

    const renderCustomDNS = () => {
        if (!customDnsEnabled) return null;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t('Primary DNS')}</Label>
                    <Input
                        className="bg-background/50 border-input font-mono text-foreground"
                        value={primaryDns || ''}
                        onChange={(e) => updateSetting('primaryDns', e.target.value)}
                        placeholder="8.8.8.8"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t('Secondary DNS')}</Label>
                    <Input
                        className="bg-background/50 border-input font-mono text-foreground"
                        value={secondaryDns || ''}
                        onChange={(e) => updateSetting('secondaryDns', e.target.value)}
                        placeholder="1.1.1.1"
                    />
                </div>
            </div>
        )
    }

    return (
        <GlassCard>
            <SectionHeader icon={Shield} title={t('Secure DNS')} />
            <div className="space-y-2">
                <SettingRow
                    label={t('Custom Resolver')}
                    description={t('Bypass local DNS poisoning with encrypted upstream resolution.')}>
                    <Switch
                        checked={customDnsEnabled || false}
                        onCheckedChange={(c) => updateSetting('customDnsEnabled', c)} />
                </SettingRow>
                {renderCustomDNS()}
            </div>
        </GlassCard>
    );
});
