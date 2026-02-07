import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Plus } from "lucide-react";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import { motion, AnimatePresence } from "framer-motion";

interface GlassMultiSelectProps {
    values: string[];
    onValueChange: (value: string) => void;
    placeholder: string;
    icon: React.ElementType;
    options: string[];
    className?: string;
    onAddCustom?: () => void;
    addCustomLabel?: string;
}

const MultiSelectItem = ({
    option,
    isSelected,
    onToggle,
}: {
    option: string;
    isSelected: boolean;
    onToggle: (val: string) => void;
}) => (
    <button
        onClick={() => onToggle(option)}
        className={cn(
            "relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-3 pr-10 text-xs font-mono outline-none transition-all duration-200",
            isSelected
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "hover:bg-accent/40 hover:text-accent-foreground text-muted-foreground/90"
        )}
    >
        <span className="truncate">{option}</span>
        {isSelected && (
            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                <Check className="h-4 w-4" />
            </span>
        )}
    </button>
);

export const GlassMultiSelect = ({
    values,
    onValueChange,
    placeholder,
    icon: Icon,
    options,
    className,
    onAddCustom,
    addCustomLabel = "Add Custom",
}: GlassMultiSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const onToggle = (val: string) => {
        onValueChange(val);
    };

    const selectedSet = new Set(values);
    const displayText = values.length > 0
        ? `${values.length} Selected`
        : placeholder;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative w-fit" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between h-12 min-w-[160px] px-4 py-2 bg-secondary/50 border border-border rounded-lg hover:bg-secondary transition-all duration-300 w-40 text-left shrink-0",
                    isOpen && "ring-2 ring-primary/20 border-primary/50",
                    className
                )}
            >
                <div className="flex items-center gap-2.5 overflow-hidden">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate text-sm font-medium">{displayText}</span>
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 opacity-50 shrink-0 transition-transform duration-200",
                    isOpen && "transform rotate-180"
                )} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-full mt-2 right-0 border border-border/60 text-foreground rounded-xl overflow-hidden w-full min-w-[max-content] bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/80 z-[100] p-1"
                    >
                        <div className="pb-1 px-2 mb-1 border-b border-border/20">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                                {placeholder}
                            </span>
                        </div>

                        <ScrollArea className="max-h-[280px]">
                            <div className="space-y-0.5">
                                {options.map((option) => (
                                    <MultiSelectItem
                                        key={option}
                                        option={option}
                                        isSelected={selectedSet.has(option)}
                                        onToggle={onToggle}
                                    />
                                ))}
                            </div>
                        </ScrollArea>

                        {onAddCustom && (
                            <div className="pt-2 mt-2 border-t border-border">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-9 text-xs gap-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onAddCustom();
                                        setIsOpen(false);
                                    }}
                                >
                                    <Plus className="w-3.5 h-3.5" /> {addCustomLabel}
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
