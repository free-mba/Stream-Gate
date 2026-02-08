import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import type { Config } from "@/types";
import { ConfigDialogFrame } from "./ConfigDialogFrame";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ConfigFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingConfig: Config | null;
    onSave: (data: Partial<Config>) => void;
}

export const ConfigFormDialog = ({
    open,
    onOpenChange,
    editingConfig,
    onSave
}: ConfigFormDialogProps) => {
    const { t } = useTranslation();

    const initFormData = useCallback((): Partial<Config> => {
        if (editingConfig) {
            return {
                ...editingConfig,
                socks: {
                    username: editingConfig.socks?.username || "",
                    password: editingConfig.socks?.password || "",
                },
            };
        }
        return {
            country: "🏳️",
            remark: "",
            domain: "",
            socks: { username: "", password: "" },
        };
    }, [editingConfig]);

    const [formData, setFormData] = useState<Partial<Config>>(initFormData());

    const updateField = (field: keyof Config | "socks-username" | "socks-password", value: string) => {
        setFormData(prev => {
            if (field === "socks-username") {
                return { ...prev, socks: { ...prev.socks, username: value } };
            }
            if (field === "socks-password") {
                return { ...prev, socks: { ...prev.socks, password: value } };
            }
            return { ...prev, [field]: value };
        });
    };

    const footer = (
        <div className="flex w-full justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-accent/50 rounded-lg px-6 transition-all">
                {t("Cancel")}
            </Button>
            <Button
                onClick={() => onSave(formData)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
                {t("Save")}
            </Button>
        </div>
    );

    const inputWrapperClass = "relative group transition-all duration-300";
    const inputClass = "h-11 bg-muted/30 border-border/40 focus:border-primary/50 focus:ring-primary/20 focus:bg-background/60 transition-all duration-300 rounded-lg";

    return (
        <ConfigDialogFrame
            open={open}
            onOpenChange={onOpenChange}
            title={editingConfig ? t("Edit Configuration") : t("New Configuration")}
            footer={footer}
            maxWidth="sm"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="space-y-6 px-1"
                >
                    <div className="grid gap-6">
                        {/* Basic Information Section */}
                        <div className="space-y-3">
                            <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 ml-1">
                                {t("Basic Info")}
                            </Label>
                            <div className="grid grid-cols-4 gap-3">
                                <div className={cn(inputWrapperClass, "col-span-1")}>
                                    <Input
                                        value={formData.country || ""}
                                        onChange={e => updateField("country", e.target.value)}
                                        placeholder="🏳️"
                                        className={cn(inputClass, "text-center placeholder:opacity-50")}
                                        maxLength={10}
                                    />
                                </div>
                                <div className={cn(inputWrapperClass, "col-span-3")}>
                                    <Input
                                        value={formData.remark || ""}
                                        onChange={e => updateField("remark", e.target.value)}
                                        placeholder={t("Remark / Name")}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Connection Section */}
                        <div className="space-y-3">
                            <Label className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 ml-1">
                                {t("Connection")}
                            </Label>
                            <div className={inputWrapperClass}>
                                <Input
                                    value={formData.domain || ""}
                                    onChange={e => updateField("domain", e.target.value)}
                                    placeholder={t("Domain")}
                                    className={cn(inputClass, "text-sm")}
                                />
                            </div>
                        </div>

                        {/* Authentication Section */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-3">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
                                <Label className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 shrink-0">
                                    {t("SOCKS5 Auth")}
                                </Label>
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className={inputWrapperClass}>
                                    <Input
                                        value={formData.socks?.username || ""}
                                        onChange={e => updateField("socks-username", e.target.value)}
                                        placeholder={t("Username")}
                                        className={inputClass}
                                    />
                                </div>
                                <div className={inputWrapperClass}>
                                    <Input
                                        type="password"
                                        value={formData.socks?.password || ""}
                                        onChange={e => updateField("socks-password", e.target.value)}
                                        placeholder={t("Password")}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </ConfigDialogFrame>
    );
};
