import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, List, Activity, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export const SidebarMenu = React.memo(() => {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { icon: Home, label: t("Home"), path: "/" },
        { icon: List, label: t("Configs"), path: "/configs" },
        { icon: Activity, label: t("DNS Tester"), path: "/dns" },
        { icon: Settings, label: t("Settings"), path: "/settings" },
    ];

    return (
        <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative overflow-hidden",
                        location.pathname === item.path
                            ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent"
                    )}
                >
                    <item.icon className={cn("w-5 h-5 transition-colors duration-300",
                        location.pathname === item.path ? "text-primary drop-shadow-[0_0_5px_currentColor]" : "group-hover:text-foreground"
                    )} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {location.pathname === item.path && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-primary rounded-r-full shadow-[0_0_10px_currentColor]" />}
                </Link>
            ))}
        </nav>
    );
});
