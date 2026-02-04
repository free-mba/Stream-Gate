import { Label } from "@/components/ui/label";


interface SettingRowProps {
    label: string;
    description?: string;
    children: React.ReactNode;
}

export const SettingRow = ({ label, description, children }: SettingRowProps) => (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
        <div className="space-y-1">
            <Label className="text-base font-medium text-foreground">{label}</Label>
            {description && <p className="text-sm text-muted-foreground max-w-[80%] leading-relaxed">{description}</p>}
        </div>
        <div className="flex items-center gap-4">
            {children}
        </div>
    </div>
);