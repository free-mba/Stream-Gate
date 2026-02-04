import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { ConfigDialogFrame } from "./ConfigDialogFrame";

interface ConfigDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export const ConfigDeleteDialog = ({
    open,
    onOpenChange,
    onConfirm
}: ConfigDeleteDialogProps) => {
    const { t } = useTranslation();

    const footer = (
        <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={onConfirm}>{t("Delete")}</Button>
        </>
    );

    return (
        <ConfigDialogFrame
            open={open}
            onOpenChange={onOpenChange}
            title={t("Delete Configuration?")}
            footer={footer}
            maxWidth="md"
        >
            <div className="text-sm text-muted-foreground">
                {t("Are you sure you want to delete this configuration? This action cannot be undone.")}
            </div>
        </ConfigDialogFrame>
    );
};
