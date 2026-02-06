import * as React from "react"
import { Globe, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface GlassMultiSelectProps {
    values: string[]
    options: string[]
    onToggle: (value: string) => void
    onAddCustom?: () => void
    placeholder?: string
    icon?: React.ElementType
    className?: string
    addCustomLabel?: string
}

const DnsOptionItem = React.memo(({
    option,
    isSelected,
    onToggle
}: {
    option: string,
    isSelected: boolean,
    onToggle: (value: string) => void
}) => {
    return (
        <div
            className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
            onClick={() => onToggle(option)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onToggle(option);
                    e.preventDefault();
                }
            }}
        >
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(option)}
                id={`dns-${option}`}
            />
            <label
                htmlFor={`dns-${option}`}
                className="text-xs font-mono leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
            >
                {option}
            </label>
        </div>
    );
});

export const GlassMultiSelect = ({
    values,
    options,
    onToggle,
    onAddCustom,
    placeholder,
    icon: Icon = Globe,
    className,
    addCustomLabel = "Add Custom"
}: GlassMultiSelectProps) => {
    const displayText = values.length > 0
        ? `${values.length} selected`
        : placeholder;

    const selectedSet = React.useMemo(() => new Set(values), [values]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className={cn(
                    "glass-button h-12 min-w-[160px] border-white/10 text-foreground/90 rounded-lg px-4 font-medium transition-all hover:border-primary/50 focus:outline-none flex items-center justify-between gap-2",
                    className
                )}>
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate text-sm">{displayText}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                </button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 text-foreground rounded-xl overflow-hidden max-w-[300px] bg-background/98">
                <DialogHeader>
                    <DialogTitle className="text-sm font-semibold">{placeholder}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-1 py-2">
                        {options.map((option) => (
                            <DnsOptionItem
                                key={option}
                                option={option}
                                isSelected={selectedSet.has(option)}
                                onToggle={onToggle}
                            />
                        ))}
                    </div>
                </ScrollArea>
                {onAddCustom && (
                    <div className="pt-2 border-t border-white/10">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-9 text-xs gap-2 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                                e.preventDefault();
                                onAddCustom();
                            }}
                        >
                            <span className="text-lg">+</span> {addCustomLabel}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
