import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { memo } from "react";
import { DnsGeneralSettings } from "./DnsGeneralSettings";
import { DnsPerformanceSettings } from "./DnsPerformanceSettings";
import { DnsServersConfig } from "./DnsServersConfig";

interface DnsControlsProps {
    isRunning: boolean;
    progress: number;
    onStart: () => void;
    onStop: () => void;
}

export const DnsControls = memo(({ isRunning, progress, onStart, onStop }: DnsControlsProps) => {
    const { t } = useTranslation();

    return (
        <div className="glass-panel rounded-lg p-5 mb-6 space-y-5 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <DnsGeneralSettings />
                <DnsPerformanceSettings />
                <DnsServersConfig />
            </div>

            <div className="flex justify-end pt-2">
                {!isRunning ? (
                    <Button onClick={onStart} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider shadow-lg shadow-primary/20">
                        <Play className="w-3 h-3 mr-2 fill-current" /> {t("START SCAN")}
                    </Button>
                ) : (
                    <Button onClick={onStop} variant="destructive" className="font-bold tracking-wider">
                        <Square className="w-3 h-3 mr-2" /> {t("STOP")} ({Math.round(progress)}%)
                    </Button>
                )}
            </div>
        </div>
    );
});
