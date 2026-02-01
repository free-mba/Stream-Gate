import { useState, useEffect } from "react";
import { useIpc } from "@/hooks/useIpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface Config {
    id: string;
    remark: string;
    domain: string;
    country: string; // Emoji or code
    socks?: { username?: string; password?: string };
}

export default function ConfigPage() {
    const ipc = useIpc();
    const [settings, setSettings] = useState<any>({});
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Config>>({});
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const confirmDelete = async () => {
        if (!deletingId) return;

        const configs = Array.isArray(settings.configs) ? settings.configs.filter((c: any) => c.id !== deletingId) : [];
        const newSettings = { ...settings, configs };

        if (settings.selectedConfigId === deletingId) {
            newSettings.selectedConfigId = null;
        }

        await saveSettings(newSettings);
        setDeletingId(null);
    };

    useEffect(() => {
        if (!ipc) return;
        ipc.invoke('get-settings').then(setSettings);
    }, [ipc]);

    const saveSettings = async (newSettings: any) => {
        if (!ipc) return;
        setSettings(newSettings); // Optimistic update
        await ipc.invoke('save-settings', newSettings);
    };

    const handleSaveConfig = async () => {
        const configs = Array.isArray(settings.configs) ? [...settings.configs] : [];

        if (editingConfig) {
            // Edit existing
            const index = configs.findIndex((c: any) => c.id === editingConfig.id);
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

    const configs = Array.isArray(settings.configs) ? settings.configs : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Configurations</h2>
                    <p className="text-muted-foreground">Manage your VPN connections.</p>
                </div>
                <Button onClick={() => openValidForm()} className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" />
                    Add Config
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configs.map((config: Config) => {
                    const isSelected = settings.selectedConfigId === config.id;
                    return (
                        <Card
                            key={config.id}
                            className={cn(
                                "group cursor-pointer transition-all duration-300 border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden relative",
                                isSelected ? "ring-2 ring-primary border-primary/50 bg-primary/5" : "hover:bg-accent/50 hover:border-white/10"
                            )}
                            onClick={() => handleSelect(config)}
                        >
                            {isSelected && (
                                <div className="absolute top-0 right-0 p-2 bg-primary text-primary-foreground rounded-bl-xl shadow-lg">
                                    <Check className="w-4 h-4" />
                                </div>
                            )}
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl filter drop-shadow-lg">{config.country}</span>
                                        <div>
                                            <h3 className="font-bold text-lg leading-tight">{config.remark}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                                <Globe className="w-3 h-3" />
                                                <span className="truncate max-w-[120px] font-mono">{config.domain}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); openValidForm(config); }}>
                                        <Edit className="w-4 h-4 text-blue-400" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/20" onClick={(e) => handleDelete(config.id, e)}>
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {configs.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl bg-white/5/50">
                        <Globe className="w-12 h-12 mb-4 opacity-20" />
                        <p>No configurations found.</p>
                        <Button variant="link" onClick={() => openValidForm()}>Create your first one</Button>
                    </div>
                )}
            </div>

            {/* Edit/Add Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10">
                    <DialogHeader>
                        <DialogTitle>{editingConfig ? "Edit Configuration" : "New Configuration"}</DialogTitle>
                    </DialogHeader>
                    {/* ... form content ... */}
                    <div className="space-y-4 py-4">
                        {/* ... logic unchanged for form fields ... */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Remark</Label>
                            <Input
                                value={formData.remark || ""}
                                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                                className="col-span-3 bg-black/20 border-white/10"
                                placeholder="My Server"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Flag</Label>
                            <Input
                                value={formData.country || ""}
                                onChange={e => setFormData({ ...formData, country: e.target.value })}
                                className="col-span-3 bg-black/20 border-white/10"
                                placeholder="🇺🇸"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Domain</Label>
                            <Input
                                value={formData.domain || ""}
                                onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                className="col-span-3 bg-black/20 border-white/10 font-mono text-xs"
                                placeholder="s.example.com"
                            />
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">SOCKS5 Auth (Optional)</span></div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">Username</Label>
                            <Input
                                value={formData.socks?.username || ""}
                                onChange={e => setFormData({ ...formData, socks: { ...formData.socks, username: e.target.value } })}
                                className="col-span-3 bg-black/20 border-white/10 h-8"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">Password</Label>
                            <Input
                                type="password"
                                value={formData.socks?.password || ""}
                                onChange={e => setFormData({ ...formData, socks: { ...formData.socks, password: e.target.value } })}
                                className="col-span-3 bg-black/20 border-white/10 h-8"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 hover:bg-white/5">Cancel</Button>
                        <Button onClick={handleSaveConfig} className="bg-primary hover:bg-primary/90">Save Config</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10">
                    <DialogHeader>
                        <DialogTitle>Delete Configuration?</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm text-muted-foreground">
                        Are you sure you want to delete this configuration? This action cannot be undone.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingId(null)} className="border-white/10 hover:bg-white/5">Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
