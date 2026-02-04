import { useState } from "react";
import { ipc } from "@/services/IpcService";
import type { Config, Settings } from "@/types";
import { useAtom } from "jotai";
import { settingsAtom, fetchSettingsAtom } from "@/store";
import { ConfigHeader } from "./components/ConfigHeader";
import { ConfigCard } from "./components/ConfigCard";
import { ConfigEmptyState } from "./components/ConfigEmptyState";
import { ConfigFormDialog } from "./components/ConfigFormDialog";
import { ConfigImportDialog } from "./components/ConfigImportDialog";
import { ConfigDeleteDialog } from "./components/ConfigDeleteDialog";

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
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    if (!settings) return null;

    const saveSettings = async (newSettings: Partial<Settings>) => {
        await setSettings(newSettings);
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        const currentConfigs = settings.configs || [];
        const configs = currentConfigs.filter((c) => c.id !== deletingId);
        const newSettings = { ...settings, configs };
        if (settings.selectedConfigId === deletingId) newSettings.selectedConfigId = null;

        await saveSettings(newSettings);
        setDeletingId(null);
    };

    const handleSaveConfig = async (formData: Partial<Config>) => {
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
        setEditingConfig(config || null);
        setIsDialogOpen(true);
    };

    const handleImport = async (importText: string) => {
        if (!importText.trim()) return;
        const result = await ipc?.invoke<ImportError>('import-configs', importText);
        if (result?.success) {
            setIsImportDialogOpen(false);
            fetchSettings();
        } else {
            alert("Failed to import: " + (result?.error || "Unknown error"));
        }
    };

    const configs = Array.isArray(settings?.configs) ? settings?.configs : [];

    return (
        <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 overflow-hidden">
            <ConfigHeader
                onImport={() => setIsImportDialogOpen(true)}
                onAdd={() => openValidForm()}
            />

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-max gap-6 overflow-y-auto pb-10">
                {configs.map((config: Config) => (
                    <ConfigCard
                        key={config.id}
                        config={config}
                        isSelected={settings?.selectedConfigId === config.id}
                        onSelect={handleSelect}
                        onEdit={(cfg, e) => { e.stopPropagation(); openValidForm(cfg); }}
                        onDelete={handleDelete}
                    />
                ))}
                {configs.length === 0 && (
                    <ConfigEmptyState onCreateFirst={() => openValidForm()} />
                )}
            </div>

            <ConfigFormDialog
                key={isDialogOpen ? (editingConfig?.id || 'new') : 'closed'}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingConfig={editingConfig}
                onSave={handleSaveConfig}
            />

            <ConfigImportDialog
                key={isImportDialogOpen ? "open" : "closed"}
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleImport}
            />

            <ConfigDeleteDialog
                open={!!deletingId}
                onOpenChange={(open) => !open && setDeletingId(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
