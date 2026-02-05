import { cn } from "@/lib/utils";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
}

export const GlassCard = ({ children, className }: GlassCardProps) => (
    <div className={cn("glass-panel rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 will-change-transform transform-gpu", className)}>
        {children}
    </div>
);