import { useAtom } from "jotai";
import { languageAtom } from "@/store";
import { useTranslation } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingRow } from "./SettingRow";

export const Language = () => {
    const { t } = useTranslation();
    const [lang, setLang] = useAtom(languageAtom);

    return (
        <SettingRow label={t('Language')} description={t('Select your preferred interface language.')}>
            <Select value={lang} onValueChange={(v: 'en' | 'fa') => setLang(v)}>
                <SelectTrigger className="w-[180px] bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-panel border-border text-foreground">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fa">فارسی</SelectItem>
                </SelectContent>
            </Select>
        </SettingRow>
    )
}