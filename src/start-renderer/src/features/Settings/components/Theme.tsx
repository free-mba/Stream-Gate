import { useAtom } from "jotai";
import { themeAtom } from "@/store";
import { useTranslation } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingRow } from "./SettingRow";

export const Theme = () => {
    const { t } = useTranslation();
    const [theme, setTheme] = useAtom(themeAtom);

    return (
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
    )
}