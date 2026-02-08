import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Globe, Share2, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Config } from "@/types";

interface ConfigCardProps {
    config: Config;
    isSelected: boolean;
    onSelect: (config: Config) => void;
    onEdit: (config: Config, e: React.MouseEvent) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

export const ConfigCard = ({
    config,
    isSelected,
    onSelect,
    onEdit,
    onDelete
}: ConfigCardProps) => {
    const [isShared, setIsShared] = useState(false);

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...data } = config;
            const json = JSON.stringify(data);
            const base64 = btoa(encodeURIComponent(json).replaceAll(/%([0-9A-F]{2})/g, (_, p1) => String.fromCodePoint(Number.parseInt(p1, 16))));
            const shareLink = `ssgate:${config.remark}//${base64}`;
            navigator.clipboard.writeText(shareLink);
            setIsShared(true);
            setTimeout(() => setIsShared(false), 2000);
        } catch (err) {
            console.error('Failed to share:', err);
        }
    };

    return (
        <div
            className={cn(
                "relative group transition-all duration-300 outline-none rounded-lg p-6 border-2",
                isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
                    : "border-transparent glass-panel backdrop-blur-md hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
            )}
        >
            <button
                type="button"
                onClick={() => onSelect(config)}
                className="absolute inset-0 w-full h-full rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 z-0"
                aria-label={`Select ${config.remark} config`}
            />

            {isSelected && (
                <div className="absolute top-4 right-4 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground z-10">
                    <Check className="w-4 h-4" />
                </div>
            )}

            <div className="relative z-10 pointer-events-none">
                <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{config.country}</span>
                    <div className="min-w-0">
                        <h3 className={cn(
                            "font-bold text-lg leading-tight transition-colors truncate",
                            isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                        )}>
                            {config.remark}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">{config.domain}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                            "h-8 w-8 hover:bg-primary/10",
                            isShared ? "text-green-500" : "text-primary/70"
                        )}
                        onClick={handleShare}
                    >
                        {isShared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        onClick={(e) => onEdit(config, e)}
                    >
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => onDelete(config.id, e)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
