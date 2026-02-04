import { memo } from "react";
import { Zap } from "lucide-react";
import type { Settings } from "@/types";
import { GlassCard } from "./GlassCard";
import { SettingRow } from "./SettingRow";
import { useTranslation } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";
import { Switch } from "@radix-ui/react-switch";

type CoreBehaviorProps = {
    authoritative: boolean;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>
}

export const CoreBehavior = memo(({ authoritative, updateSetting }: CoreBehaviorProps) => {
    const { t } = useTranslation();

    return (
        <GlassCard>
            <SectionHeader icon={Zap} title={t('Core Behavior')} />
            <div className="space-y-2">
                <SettingRow
                    label={t('Authoritative Mode')}
                    description={t('Enforces strict DNS resolution policies. Use with caution.')}
                >
                    <Switch checked={authoritative || false} onCheckedChange={(c) => updateSetting('authoritative', c)} />
                </SettingRow>
            </div>
        </GlassCard>
    )
})