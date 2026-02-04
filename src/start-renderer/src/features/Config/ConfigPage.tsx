import { useState } from "react";
import { ipc } from "@/services/IpcService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Check, Globe, Share2, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Config, Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useAtom } from "jotai";
import { settingsAtom, fetchSettingsAtom } from "@/store";

interface ImportError {
    success: boolean;
    count?: number;
    errors?: number;
    error?: string;
    data?: string;
}

export default function ConfigPage() {
    const [settings, setSettings] = useAtom(settingsAtom);
    const [, fetchSettings] = useAtom(fetchSettingsAtom);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);
    const [formData, setFormData] = useState<Partial<Config>>({});
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importText, setImportText] = useState("");
    const [sharedId, setSharedId] = useState<string | null>(null);
    const [isExported, setIsExported] = useState(false);
    const { t } = useTranslation();

    if (!settings) return null;

    const confirmDelete = async () => {
        if (!deletingId) return;
        const currentConfigs = settings.configs || [];
        const configs = currentConfigs.filter((c) => c.id !== deletingId);
        const newSettings = { ...settings, configs };
        if (settings.selectedConfigId === deletingId) newSettings.selectedConfigId = null;

        await saveSettings(newSettings);
        setDeletingId(null);
    };



    const saveSettings = async (newSettings: Partial<Settings>) => {
        await setSettings(newSettings);
    };

    const handleSaveConfig = async () => {
        const currentConfigs = settings.configs || [];
        const configs = [...currentConfigs];

        if (editingConfig) {
            const index = configs.findIndex((c) => c.id === editingConfig.id);
            if (index !== -1) configs[index] = { ...editingConfig, ...formData } as Config;
        } else {
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...data } = config;
            const json = JSON.stringify(data);
            const base64 = btoa(encodeURIComponent(json).replaceAll(/%([0-9A-F]{2})/g, (_, p1) => String.fromCodePoint(Number.parseInt(p1, 16))));
            const shareLink = `ssgate:${config.remark}//${base64}`;
            navigator.clipboard.writeText(shareLink);
            setSharedId(config.id);
            setTimeout(() => setSharedId(null), 2000);
        } catch (err) { console.error('Failed to share:', err); }
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
            setIsImportDialogOpen(false);
            setImportText("");
            fetchSettings();
        } else {
            alert("Failed to import: " + (result?.error || "Unknown error"));
        }
    };

    const configs = (Array.isArray(settings?.configs) ? settings?.configs : []) as Config[];

    return (
        <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 overflow-hidden">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{t("Configurations")}</h2>
                    <p className="text-muted-foreground">{t("Manage your quantum endpoints.")}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setIsImportDialogOpen(true)} className="border-border">
                        <Upload className="w-4 h-4 mr-2" /> {t("Import")}
                    </Button>
                    <Button variant="secondary" onClick={handleExportAll} className={cn("border-border transition-colors", isExported ? "text-green-400 border-green-500/30" : "")}>
                        {isExported ? <Check className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                        {isExported ? t("Copied!") : t("Export")}
                    </Button>
                    <Button onClick={() => openValidForm()} variant="shiny">
                        <Plus className="w-4 h-4 mr-2" /> {t("Add Config")}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10">
                {configs.map((config: Config) => {
                    const isSelected = settings?.selectedConfigId === config.id;
                    return (
                        <div
                            key={config.id}
                            onClick={() => handleSelect(config)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(config); }}
                            tabIndex={0}
                            role="button"
                            className={cn(
                                "relative glass-panel rounded-2xl p-6 cursor-pointer group transition-all duration-300 border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 outline-none focus:ring-1 focus:ring-primary/50",
                                isSelected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/50" : "border-border/40"
                            )}
                        >
                            {isSelected && <div className="absolute top-4 right-4 text-primary"><Check className="w-5 h-5 shadow-[0_0_10px_currentColor]" /></div>}

                            <div className="flex items-start gap-4 mb-4">
                                <span className="text-4xl filter drop-shadow-lg">{config.country}</span>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-lg leading-tight text-foreground mb-1 group-hover:text-primary transition-colors truncate">{config.remark}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                        <Globe className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate max-w-[150px]">{config.domain}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className={cn("h-8 w-8 hover:bg-foreground/5 dark:hover:bg-white/10", sharedId === config.id ? "text-green-400" : "text-blue-400")} onClick={(e) => handleShare(config, e)}>
                                    {sharedId === config.id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-foreground/5 dark:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); openValidForm(config); }}>
                                    <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10" onClick={(e) => handleDelete(config.id, e)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {configs.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
                        <Globe className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t("No configurations found.")}</p>
                        <Button variant="link" onClick={() => openValidForm()} className="text-primary">{t("Create your first one")}</Button>
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="glass-panel border-border text-foreground sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingConfig ? t("Edit Configuration") : t("New Configuration")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input value={formData.remark || ""} onChange={e => setFormData({ ...formData, remark: e.target.value })} placeholder={t("Remark")} className="bg-background/50 border-input text-foreground" />
                        <Input value={formData.country || ""} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder={t("Flag (e.g., 🇺🇸)")} className="bg-background/50 border-input text-foreground" />
                        <Input value={formData.domain || ""} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder={t("Domain")} className="bg-background/50 border-input font-mono text-foreground" />
                        <div className="pt-2 border-t border-border text-xs text-muted-foreground uppercase tracking-widest text-center">{t("SOCKS5 Auth")}</div>
                        <Input value={formData.socks?.username || ""} onChange={e => setFormData({ ...formData, socks: { ...formData.socks, username: e.target.value } })} placeholder={t("Username")} className="bg-background/50 border-input text-foreground" />
                        <Input type="password" value={formData.socks?.password || ""} onChange={e => setFormData({ ...formData, socks: { ...formData.socks, password: e.target.value } })} placeholder={t("Password")} className="bg-background/50 border-input text-foreground" />
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setIsDialogOpen(false)}>{t("Cancel")}</Button><Button onClick={handleSaveConfig} className="bg-primary hover:bg-primary/90 text-primary-foreground">{t("Save")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="glass-panel border-border text-foreground sm:max-w-lg">
                    <DialogHeader><DialogTitle>{t("Import Configs")}</DialogTitle></DialogHeader>
                    <textarea value={importText} onChange={e => setImportText(e.target.value)} className="w-full h-32 bg-background/50 border border-input rounded-lg p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="ssgate:..." />
                    <DialogFooter><Button onClick={handleImport} className="bg-primary text-primary-foreground">{t("Import")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <DialogContent className="glass-panel border-border text-foreground sm:max-w-md">
                    <DialogHeader><DialogTitle>{t("Delete Configuration?")}</DialogTitle></DialogHeader>
                    <div className="py-4 text-sm text-muted-foreground">
                        {t("Are you sure you want to delete this configuration? This action cannot be undone.")}
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setDeletingId(null)}>{t("Cancel")}</Button><Button variant="destructive" onClick={confirmDelete}>{t("Delete")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
