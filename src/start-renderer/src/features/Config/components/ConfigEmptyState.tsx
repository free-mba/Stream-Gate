import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ConfigEmptyStateProps {
    onCreateFirst: () => void;
}

export const ConfigEmptyState = ({ onCreateFirst }: ConfigEmptyStateProps) => {
    const { t } = useTranslation();

    return (
        <div className="col-span-full h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/20 rounded-2xl p-10">
            <Globe className="w-16 h-16 mb-4 opacity-10 animate-pulse" />
            <h3 className="text-xl font-medium mb-2">{t("Connection Points")}</h3>
            <p className="text-sm opacity-60 mb-6 text-center max-w-xs">{t("Setup your first gateway to start routing traffic through the quantum link.")}</p>
            <Button onClick={onCreateFirst} className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 hover:border-primary/40 px-8">
                {t("Create Config")}
            </Button>
        </div>
    );
};
