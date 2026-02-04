import { useAtom } from "jotai";
import { useCallback } from "react";
import { settingsAtom } from "@/store";
import type { Settings } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { Appearance } from "./components/Appearance";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { CoreBehavior } from "./components/CoreBehavior";
import { LocalProxyInfo } from "./components/LocalProxyInfo";
import { Troubleshooting } from "./components/Troubleshooting";
import { DnsConfiguration } from "./components/DnsConfiguration";
import { AdvancedNetworking } from "./components/AdvancedNetworking";


export default function SettingsPage() {
    const [settings, setSettings] = useAtom(settingsAtom);
    const { t } = useTranslation();

    const updateSetting = useCallback(async (key: keyof Settings, value: unknown) => {
        await setSettings({ [key]: value });
    }, [setSettings]);

    if (!settings) return null;

    return (
        <div className="w-full max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">
                    {t('Settings')}
                </h1>
                <p
                    className="text-lg text-muted-foreground">
                    {t('Configure your quantum link parameters.')}
                </p>
            </div>

            <div className="grid gap-8">
                <Appearance />

                <CoreBehavior
                    updateSetting={updateSetting}
                    mode={settings.mode}
                    authoritative={settings.authoritative || false}
                    verbose={settings.verbose || false}
                />

                <AdvancedNetworking
                    updateSetting={updateSetting}
                    congestionControl={settings.congestionControl}
                    keepAliveInterval={settings.keepAliveInterval}
                />

                <DnsConfiguration
                    updateSetting={updateSetting}
                    primaryDns={settings.primaryDns}
                    secondaryDns={settings.secondaryDns}
                    customDnsEnabled={settings.customDnsEnabled}
                />

                <LocalProxyInfo />

                <Troubleshooting />

                <div className="flex flex-col items-center justify-center pt-8 opacity-50">
                    <span className="text-sm font-medium tracking-widest text-muted-foreground">{APP_NAME} <span className="text-primary">{APP_VERSION}</span></span>
                </div>
            </div>
        </div>
    );
}
