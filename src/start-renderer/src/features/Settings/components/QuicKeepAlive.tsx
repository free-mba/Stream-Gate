import { memo } from "react";
import type { Settings } from "@/types"
import { SettingRow } from "./SettingRow"
import { useTranslation } from "@/lib/i18n"
import { Input } from "@/components/ui/input"

type QuicKeepAliveProps = {
    keepAliveInterval?: number;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>
}

export const QuicKeepAlive = memo(({ keepAliveInterval, updateSetting }: QuicKeepAliveProps) => {
    const { t } = useTranslation();

    const value = keepAliveInterval || 400;

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number.parseInt(e.target.value);

        if (value > 0) {
            updateSetting('keepAliveInterval', value);
        }
    };

    return (
        <SettingRow
            label={t('QUIC Keep Alive')}
            description={t('Interval in seconds for keep-alive packets.')}>
            <Input
                type="number"
                className="w-[180px] bg-background/50 border-input text-foreground"
                value={value}
                onChange={handleValueChange}
                placeholder="400"
            />
        </SettingRow>
    )
})