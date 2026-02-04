interface SectionHeaderProps {
    icon: React.ElementType;
    title: string;
}

export const SectionHeader = ({ icon: Icon, title }: SectionHeaderProps) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
    </div>
);