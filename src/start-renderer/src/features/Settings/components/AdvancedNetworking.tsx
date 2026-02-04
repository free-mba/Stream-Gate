import { memo } from "react";
import { Wifi } from "lucide-react";
import { GlassCard } from "./GlassCard";
import type { Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";
import { QuicKeepAlive } from "./QuicKeepAlive";
import { CongestionControl } from "./CongestionControl";

type AdvancedNetworkingProps = {
    congestionControl?: string;
    keepAliveInterval?: number;
    updateSetting: (key: keyof Settings, value: unknown) => Promise<void>
}

export const AdvancedNetworking = memo(({ congestionControl, keepAliveInterval, updateSetting }: AdvancedNetworkingProps) => {
    const { t } = useTranslation();

    return (
        <GlassCard>
            <SectionHeader icon={Wifi} title={t('Advanced Networking')} />
            <div className="space-y-2">
                <CongestionControl congestionControl={congestionControl} updateSetting={updateSetting} />
                <QuicKeepAlive keepAliveInterval={keepAliveInterval} updateSetting={updateSetting} />
            </div>
        </GlassCard>
    )
})