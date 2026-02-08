import { memo } from "react";
import { Zap } from "lucide-react";
import type { Settings } from "@/types";
import { GlassCard } from "./GlassCard";
import { SettingRow } from "./SettingRow";
import { useTranslation } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CoreBehaviorProps = {
    mode: 'proxy' | 'tun';
    authoritative: boolean;
    verbose: boolean;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>
}

export const CoreBehavior = memo(({ mode, authoritative, verbose, updateSetting }: CoreBehaviorProps) => {
    const { t } = useTranslation();

    return (
        <GlassCard>
            <SectionHeader icon={Zap} title={t('Core Behavior')} />
            <div className="space-y-4">
                <SettingRow
                    label={t('System Integration')}
                    description={t('Choose between automatic system configuration or manual local proxy mode.')}
                >
                    <Select value={mode} onValueChange={(v) => updateSetting('mode', v)}>
                        <SelectTrigger className="w-[140px] bg-background/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="proxy">{t('Manual (Local Proxy)')}</SelectItem>
                            <SelectItem value="tun">{t('Automatic (System Proxy)')}</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>

                <div className="h-px bg-border/50 my-2" />

                <SettingRow
                    label={t('Authoritative Mode')}
                    description={t('Enforces strict DNS resolution policies. Use with caution.')}
                >
                    <Switch
                        checked={authoritative || false}
                        onCheckedChange={(c) => updateSetting('authoritative', c)}
                    />
                </SettingRow>

                <SettingRow
                    label={t('Verbose Logging')}
                    description={t('Enable detailed protocol logs for auditing and debugging.')}
                >
                    <Switch
                        checked={verbose || false}
                        onCheckedChange={(c) => updateSetting('verbose', c)}
                    />
                </SettingRow>
            </div>
        </GlassCard>
    )
})