import { useAtom } from "jotai";
import { useTranslation } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memo } from "react";
import { dnsConfigAtom } from "../DnsTesterState";
import type { DnsMode } from "../DnsTesterConstants";

export const DnsGeneralSettings = memo(() => {
    const { t } = useTranslation();
    const [config, setConfig] = useAtom(dnsConfigAtom);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("Mode")}</Label>
                <Select value={config.mode} onValueChange={(mode: DnsMode) => setConfig({ ...config, mode })}>
                    <SelectTrigger className="h-8 text-xs bg-background/50 border-input text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-border text-foreground">
                        <SelectItem value="slipstream">{t("Slipstream")}</SelectItem>
                        <SelectItem value="dnstt">{t("DNSTT")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">{t("Domain")}</Label>
                <Input value={config.domain} onChange={e => setConfig({ ...config, domain: e.target.value })} className="h-8 text-xs bg-background/50 border-input text-foreground" />
            </div>
        </div>
    );
});
