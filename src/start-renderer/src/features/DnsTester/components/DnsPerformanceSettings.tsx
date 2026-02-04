import { useAtom } from "jotai";
import { useTranslation } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { memo } from "react";
import { dnsConfigAtom } from "../DnsTesterState";

export const DnsPerformanceSettings = memo(() => {
    const { t } = useTranslation();
    const [config, setConfig] = useAtom(dnsConfigAtom);

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="flex justify-between"><Label className="text-xs text-muted-foreground uppercase">{t("Workers")}</Label><span className="text-[10px] font-mono opacity-70 text-foreground">{config.workers}</span></div>
                <Slider value={[config.workers]} onValueChange={v => setConfig({ ...config, workers: v[0] })} max={30} step={1} min={2} className="[&_.bg-primary]:bg-primary" />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between"><Label className="text-xs text-muted-foreground uppercase">{t("Timeout")}</Label><span className="text-[10px] font-mono opacity-70 text-foreground">{config.timeout}s</span></div>
                <Slider value={[config.timeout]} onValueChange={v => setConfig({ ...config, timeout: v[0] })} max={10} step={1} min={1} className="[&_.bg-primary]:bg-primary" />
            </div>
        </div>
    );
});
