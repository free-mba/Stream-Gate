import * as React from "react"
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface GlassSelectProps extends React.ComponentProps<typeof Select> {
    placeholder?: string
    icon?: React.ElementType
    triggerClassName?: string
    contentClassName?: string
}

export const GlassSelect = ({
    placeholder,
    icon: Icon,
    triggerClassName,
    contentClassName,
    children,
    ...props
}: GlassSelectProps) => {
    return (
        <Select {...props}>
            <SelectTrigger className={cn(
                "glass-button h-12 min-w-[160px] border-white/10 text-foreground/90 rounded-lg px-4 font-medium transition-all hover:border-primary/50 focus:ring-0 focus:ring-offset-0",
                triggerClassName
            )}>
                <div className="flex items-center gap-2.5 overflow-hidden">
                    {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
                    <div className="truncate flex-1 text-left text-sm">
                        <SelectValue placeholder={placeholder} />
                    </div>
                </div>
            </SelectTrigger>
            <SelectContent className={cn(
                "glass-panel border-white/10 text-foreground rounded-lg overflow-hidden backdrop-blur-2xl",
                contentClassName
            )}>
                {children}
            </SelectContent>
        </Select>
    );
};
