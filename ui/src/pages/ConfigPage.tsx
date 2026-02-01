import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, Check, Globe, Share2, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Config, Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";

interface ImportError {
    success: boolean;
    count?: number;
    errors?: number;
    error?: string;
    data?: string;
}

export default function ConfigPage() {
    const ipc = useIpc();
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Config>>({});
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importText, setImportText] = useState("");
    const [sharedId, setSharedId] = useState<string | null>(null);
    const [isExported, setIsExported] = useState(false);

    const confirmDelete = async () => {
        if (!deletingId) return;

        const currentConfigs = settings.configs || [];
        const configs = currentConfigs.filter((c) => c.id !== deletingId);
        const newSettings = { ...settings, configs };

        if (settings.selectedConfigId === deletingId) {
            newSettings.selectedConfigId = null;
        }

        await saveSettings(newSettings);
        setDeletingId(null);
    };

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke<Settings>('get-settings').then(setSettings);
    }, [ipc]);

    const saveSettings = async (newSettings: Partial<Settings>) => {
        if (!ipc) return;
        setSettings(newSettings); // Optimistic update
        await ipc.invoke('save-settings', newSettings);
    };

    const handleSaveConfig = async () => {
        const currentConfigs = settings.configs || [];
        const configs = [...currentConfigs];

        if (editingConfig) {
            // Edit existing
            const index = configs.findIndex((c) => c.id === editingConfig.id);
            if (index !== -1) {
                configs[index] = { ...editingConfig, ...formData } as Config;
            }
        } else {
            // Add new
            const newConfig: Config = {
                id: crypto.randomUUID(),
                remark: formData.remark || "New Config",
                domain: formData.domain || "",
                country: formData.country || "🏳️",
                socks: formData.socks
            };
            configs.push(newConfig);
        }

        await saveSettings({ ...settings, configs });
        setIsDialogOpen(false);
        setEditingConfig(null);
        setFormData({});
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingId(id);
    };

    const handleSelect = async (config: Config) => {
        await saveSettings({
            ...settings,
            selectedConfigId: config.id,
            // Also update the active domain/resolver to match this config?
            // The user request said "each config ... we have a server config and we have a list of dns".
            // It implies Config = Server (Domain). DNS is separate.
            domain: config.domain,
            socks5AuthUsername: config.socks?.username || "",
            socks5AuthPassword: config.socks?.password || "",
            socks5AuthEnabled: !!(config.socks?.username && config.socks?.password)
        });
    };

    const openValidForm = (config?: Config) => {
        if (config) {
            setEditingConfig(config);
            setFormData({ ...config });
        } else {
            setEditingConfig(null);
            setFormData({ country: "🏳️" });
        }
        setIsDialogOpen(true);
    };

    const handleShare = (config: Config, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Create a copy without the ID
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...data } = config;

            // Handle UTF-8 for base64 (to support emojis)
            const json = JSON.stringify(data);
            const base64 = btoa(encodeURIComponent(json).replaceAll(/%([0-9A-F]{2})/g, (_, p1) =>
                String.fromCodePoint(Number.parseInt(p1, 16))
            ));

            const shareLink = `ssgate:${config.remark}//${base64}`;
            navigator.clipboard.writeText(shareLink);

            setSharedId(config.id);
            setTimeout(() => setSharedId(null), 2000);
        } catch (err) {
            console.error('Failed to share:', err);
        }
    };

    const handleExportAll = async () => {
        const result = await ipc?.invoke<ImportError>('export-configs');
        if (result?.success && result.data) {
            navigator.clipboard.writeText(result.data);
            setIsExported(true);
            setTimeout(() => setIsExported(false), 2000);
        }
    };

    const handleImport = async () => {
        if (!importText.trim()) return;
        const result = await ipc?.invoke<ImportError>('import-configs', importText);

        if (result?.success) {
            const errorMsg = result.errors ? ` (${result.errors} errors)` : "";
            alert(`Imported ${result.count} configurations successfully!${errorMsg}`);

            setIsImportDialogOpen(false);
            setImportText("");
            // Refresh settings
            if (ipc) {
                const newSettings = await ipc.invoke<Settings>('get-settings');
                setSettings(newSettings);
            }
        } else {
            alert("Failed to import: " + (result?.error || "Unknown error"));
        }
    };

    const configs = Array.isArray(settings.configs) ? settings.configs : [];
    const { t } = useTranslation();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("Configurations")}</h2>
                    <p className="text-muted-foreground">{t("Manage your VPN connections.")}</p>
                </div>
                <div className="flex gap-2 rtl:justify-start">
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="gap-2 flex items-center justify-center">
                        <Upload className="w-4 h-4 shrink-0" />
                        <span className="h-4 flex items-center leading-none translate-y-[1px]">{t("Import")}</span>
                    </Button>
                    <Button
                        variant={isExported ? "default" : "outline"}
                        onClick={handleExportAll}
                        className={cn("gap-2 transition-all duration-300 flex items-center justify-center font-semibold",
                            isExported ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20" : "hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                        )}
                    >
                        {isExported ? <Check className="w-4 h-4 animate-in zoom-in duration-300 shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
                        <span className="h-4 flex items-center leading-none translate-y-[1px]">{isExported ? t("Copied!") : t("Export All")}</span>
                    </Button>
                    <Button onClick={() => openValidForm()} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center font-bold">
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="h-4 flex items-center leading-none translate-y-[1px]">{t("Add Config")}</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configs.map((config: Config) => {
                    const isSelected = settings.selectedConfigId === config.id;
                    return (
                        <Card
                            key={config.id}
                            className={cn(
                                "group cursor-pointer transition-all duration-300 border-border bg-card/40 backdrop-blur-sm overflow-hidden relative",
                                isSelected ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_-12px_rgba(37,99,235,0.3)] shadow-primary/10" : "hover:bg-accent/50 hover:border-accent"
                            )}
                            onClick={() => handleSelect(config)}
                        >
                            {isSelected && (
                                <div className="absolute top-0 right-0 p-1.5 bg-primary/10 text-primary rounded-bl-xl border-b border-l border-primary/20">
                                    <Check className="w-3.5 h-3.5" />
                                </div>
                            )}
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl filter drop-shadow-lg">{config.country}</span>
                                        <div>
                                            <h3 className="font-bold text-lg leading-tight">{config.remark}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 h-3">
                                                <Globe className="w-3 h-3 shrink-0" />
                                                <span className="truncate max-w-[120px] font-mono h-3 flex items-center leading-none translate-y-[1px]">{config.domain}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end rtl:justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                                    <Button size="icon" variant="ghost" title="Share"
                                        className={cn("h-8 w-8 transition-all duration-300 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30", sharedId === config.id ? "bg-green-500/20 border-green-500/30" : "")}
                                        onClick={(e) => handleShare(config, e)}
                                    >
                                        <div className="relative w-4 h-4">
                                            <Share2 className={cn("w-4 h-4 absolute inset-0 transition-all duration-300", sharedId === config.id ? "scale-0 opacity-0" : "scale-100 opacity-100 text-green-500")} />
                                            <Check className={cn("w-4 h-4 absolute inset-0 transition-all duration-300 text-green-500", sharedId === config.id ? "scale-100 opacity-100" : "scale-0 opacity-0 rotate-90")} />
                                        </div>
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30" onClick={(e) => { e.stopPropagation(); openValidForm(config); }}>
                                        <Edit className="w-4 h-4 text-blue-500" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20" onClick={(e) => handleDelete(config.id, e)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {configs.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-muted/30">
                        <Globe className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t("No configurations found.")}</p>
                        <Button variant="link" onClick={() => openValidForm()}>{t("Create your first one")}</Button>
                    </div>
                )}
            </div>

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-xl bg-background border-border">
                    <DialogHeader>
                        <DialogTitle>{t("Import Configurations")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Label>{t("Paste ssgate links (one per line)")}</Label>
                        <textarea
                            dir="ltr"
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            className="w-full h-48 bg-secondary border border-border rounded-xl p-4 font-mono text-xs focus:ring-1 focus:ring-primary outline-none transition-all text-left"
                            placeholder="ssgate:MyConfig//eyJyZW1hcmsiOiJNeSBDb25maWcuLi4="
                        />
                        <p className="text-[10px] text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("Each line should start with ssgate:name// ...") }} />
                    </div>
                    <DialogFooter className="rtl:justify-start">
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} className="border-border hover:bg-accent">{t("Cancel")}</Button>
                        <Button onClick={handleImport} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">{t("Import Configs")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit/Add Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle>{editingConfig ? t("Edit Configuration") : t("New Configuration")}</DialogTitle>
                    </DialogHeader>
                    {/* ... form content ... */}
                    <div className="space-y-4 py-4">
                        {/* ... logic unchanged for form fields ... */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-justify [text-align-last:justify] w-full">{t("Remark")}</Label>
                            <Input
                                value={formData.remark || ""}
                                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                                className="col-span-3 bg-secondary border-border text-left"
                                dir="ltr"
                                placeholder="My Server"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-justify [text-align-last:justify] w-full">{t("Flag")}</Label>
                            <Input
                                value={formData.country || ""}
                                onChange={e => setFormData({ ...formData, country: e.target.value })}
                                className="col-span-3 bg-secondary border-border text-left"
                                dir="ltr"
                                placeholder="🇺🇸"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-justify [text-align-last:justify] w-full">{t("Domain")}</Label>
                            <Input
                                value={formData.domain || ""}
                                onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                className="col-span-3 bg-secondary border-border font-mono text-xs text-left"
                                dir="ltr"
                                placeholder="s.example.com"
                            />
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t("SOCKS5 Auth (Optional)")}</span></div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-xs text-justify [text-align-last:justify] w-full">{t("Username")}</Label>
                            <Input
                                value={formData.socks?.username || ""}
                                onChange={e => setFormData({ ...formData, socks: { ...formData.socks, username: e.target.value } })}
                                className="col-span-3 bg-secondary border-border h-8 text-left"
                                dir="ltr"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-xs text-justify [text-align-last:justify] w-full">{t("Password")}</Label>
                            <Input
                                type="password"
                                value={formData.socks?.password || ""}
                                onChange={e => setFormData({ ...formData, socks: { ...formData.socks, password: e.target.value } })}
                                className="col-span-3 bg-secondary border-border h-8 text-left"
                                dir="ltr"
                            />
                        </div>
                    </div>
                    <DialogFooter className="rtl:justify-start">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white">{t("Cancel")}</Button>
                        <Button onClick={handleSaveConfig} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">{t("Save Config")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle>{t("Delete Configuration?")}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm text-muted-foreground">
                        {t("Are you sure you want to delete this configuration? This action cannot be undone.")}
                    </div>
                    <DialogFooter className="rtl:justify-start">
                        <Button variant="outline" onClick={() => setDeletingId(null)} className="border-border hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white">{t("Cancel")}</Button>
                        <Button variant="destructive" onClick={confirmDelete}>{t("Delete")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
