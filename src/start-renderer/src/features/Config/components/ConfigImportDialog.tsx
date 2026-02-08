import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { ConfigDialogFrame } from "./ConfigDialogFrame";

interface ConfigImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (text: string) => void;
}

export const ConfigImportDialog = ({
    open,
    onOpenChange,
    onImport
}: ConfigImportDialogProps) => {
    const { t } = useTranslation();
    const [importText, setImportText] = useState("");

    const footer = (
        <Button onClick={() => onImport(importText)} className="bg-primary text-primary-foreground w-full sm:w-auto">
            {t("Import")}
        </Button>
    );

    return (
        <ConfigDialogFrame
            open={open}
            onOpenChange={onOpenChange}
            title={t("Import Configs")}
            footer={footer}
            maxWidth="lg"
        >
            <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full h-32 bg-background/50 border border-input rounded-lg p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="ssgate:..."
            />
        </ConfigDialogFrame>
    );
};
