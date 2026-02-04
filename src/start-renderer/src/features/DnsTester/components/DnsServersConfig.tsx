import { useAtom } from "jotai";
import { useTranslation } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { memo } from "react";
import { dnsConfigAtom } from "../DnsTesterState";

export const DnsServersConfig = memo(() => {
    const { t } = useTranslation();
    const [config, setConfig] = useAtom(dnsConfigAtom);

    return (
        <div className="md:col-span-2 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("DNS Servers")}</Label>
            <Textarea
                value={config.serversText}
                onChange={e => setConfig({ ...config, serversText: e.target.value })}
                className="h-[150px] text-[10px] font-mono bg-background/50 border-input resize-none rounded-lg text-foreground focus:ring-1 focus:ring-primary"
            />
        </div>
    );
});
