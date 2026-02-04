import { memo } from "react";
import { GlassCard } from "./GlassCard";
import { useTranslation } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";
import { useCopyLogs } from "@/hooks/useCopyLogs";

export const Troubleshooting = memo(function Troubleshooting() {
    const { t } = useTranslation();
    const { isCopying, copyLogs } = useCopyLogs();

    return (
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
                        onClick={copyLogs}
                        disabled={isCopying}
                        className="min-w-[140px]"
                    >
                        {isCopying ?
                            <Check className="w-4 h-4 mr-2" /> :
                            <Copy className="w-4 h-4 mr-2" />}
                        {isCopying ? t('Copied') : t('Copy Logs')}
                    </Button>
                </div>
            </div>
        </GlassCard>
    );
});
