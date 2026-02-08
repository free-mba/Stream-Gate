import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { ipc } from "@/services/IpcService";

interface ImportError {
    success: boolean;
    count?: number;
    errors?: number;
    error?: string;
    data?: string;
}

interface ConfigHeaderProps {
    onImport: () => void;
    onAdd: () => void;
}

export const ConfigHeader = ({ onImport, onAdd }: ConfigHeaderProps) => {
    const { t } = useTranslation();
    const [isExported, setIsExported] = useState(false);

    const handleExport = async () => {
        const result = await ipc?.invoke<ImportError>('export-configs');
        if (result?.success && result.data) {
            try {
                await ipc.invoke('copy-to-clipboard', result.data);
            } catch (e) {
                console.warn("IPC copy failed, trying navigator", e);
                await navigator.clipboard.writeText(result.data);
            }
            setIsExported(true);
            setTimeout(() => setIsExported(false), 2000);
        }
    };

    return (
        <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
                <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{t("Configurations")}</h2>
                <p className="text-muted-foreground">{t("Manage your quantum endpoints.")}</p>
            </div>
            <div className="flex gap-3">
                <Button variant="secondary" onClick={onImport} className="border-border">
                    <Upload className="w-4 h-4 mr-2" /> {t("Import")}
                </Button>
                <Button variant="secondary" onClick={handleExport} className={cn("border-border transition-colors", isExported ? "text-green-400 border-green-500/30" : "")}>
                    {isExported ? <Check className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    {isExported ? t("Copied!") : t("Export")}
                </Button>
                <Button onClick={onAdd} variant="shiny">
                    <Plus className="w-4 h-4 mr-2" /> {t("Add Config")}
                </Button>
            </div>
        </div>
    );
};
