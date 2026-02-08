import { memo } from "react";
import { Server } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { useTranslation } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";

export const LocalProxyInfo = memo(function LocalProxyInfo() {
    const { t } = useTranslation();

    return (
        <GlassCard>
            <SectionHeader icon={Server} title={t('Local Ports')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-background/50 border border-border flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t('HTTP Proxy')}</div>
                        <div className="text-xl text-primary">127.0.0.1:8080</div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-border flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t('SOCKS5 Proxy')}</div>
                        <div className="text-xl text-primary">0.0.0.0:10809</div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
            </div>
        </GlassCard>
    );
});
