import React from "react";
import { Terminal } from "lucide-react";
import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { logsOpenAtom } from "@/store";

export const LogsToggleButton = React.memo(() => {
    const { t } = useTranslation();
    const [showLogs, setShowLogs] = useAtom(logsOpenAtom);

    return (
        <Button
            variant="ghost"
            onClick={() => setShowLogs(!showLogs)}
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 mt-auto border border-transparent shadow-sm w-full group justification-start h-auto",
                showLogs
                    ? "bg-foreground/5 text-foreground border-foreground/10"
                    : "text-muted-foreground"
            )}
        >
            <Terminal className={cn("w-5 h-5 transition-colors duration-300", showLogs ? "text-foreground" : "group-hover:text-foreground")} />
            <span className="text-sm font-medium">{t("Logs")}</span>
            <div className="ml-auto flex gap-1">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse",
                    showLogs ? "bg-primary" : "bg-primary/50"
                )} />
            </div>
        </Button>
    );
});
