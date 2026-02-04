import { memo } from "react";
import type { Settings } from "@/types"
import { SettingRow } from "./SettingRow"
import { useTranslation } from "@/lib/i18n"
import {
    Select,
    SelectItem,
    SelectValue,
    SelectTrigger,
    SelectContent,
} from "@/components/ui/select"

type CongestionControlProps = {
    congestionControl?: string;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>
}

export const CongestionControl = memo(({ congestionControl, updateSetting }: CongestionControlProps) => {
    const { t } = useTranslation();

    const handleValueChange = (v: string) => updateSetting('congestionControl', v);
    const value = congestionControl || 'auto';

    return (
        <SettingRow
            label={t('Congestion Control')}
            description={t('Algorithm for TCP/QUIC flow control.')}>
            <Select
                value={value}
                onValueChange={handleValueChange}>
                <SelectTrigger className="w-[180px] bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-panel border-border text-foreground">
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="bbr">BBR</SelectItem>
                    <SelectItem value="dcubic">DCubic</SelectItem>
                </SelectContent>
            </Select>
        </SettingRow >
    )
})