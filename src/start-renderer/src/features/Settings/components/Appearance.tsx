import { memo } from "react";
import { Theme } from "./Theme";
import { Language } from "./Language";
import { Palette } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { useTranslation } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";

export const Appearance = memo(() => {
    const { t } = useTranslation();

    return (
        <GlassCard>
            <SectionHeader icon={Palette} title={t('Appearance')} />
            <div className="space-y-2">
                <Language />
                <Theme />
            </div>
        </GlassCard>
    )
})