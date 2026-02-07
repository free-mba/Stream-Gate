import { memo } from "react";
import { DnsRow } from "./DnsRow";
import { useAtomValue } from "jotai";
import { useTranslation } from "@/lib/i18n";
import { dnsResultsAtomsAtom } from '@/store/dns';
import { dnsConfigAtom } from "../DnsTesterState";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DnsTableProps {
    handleUse: (s: string) => void;
}

export const DnsTable = memo(({ handleUse }: DnsTableProps) => {
    const { t } = useTranslation();
    const resultAtoms = useAtomValue(dnsResultsAtomsAtom);
    const { showWorkingOnly } = useAtomValue(dnsConfigAtom);

    return (
        <div className="flex-1 overflow-auto min-h-0 h-full">
            <table className="w-full caption-bottom text-sm">
                <TableHeader className="bg-muted/30 sticky top-0 backdrop-blur-md z-10">
                    <TableRow className="border-border hover:bg-transparent text-[10px] uppercase tracking-widest text-muted-foreground">
                        <TableHead className="w-[200px] px-4">{t("Server")}</TableHead>
                        <TableHead className="w-[100px]">{t("Score")}</TableHead>
                        <TableHead className="w-[120px]">{t("Latency")}</TableHead>
                        <TableHead className="min-w-[300px]">{t("Details")}</TableHead>
                        <TableHead className="w-[100px] px-4">{t("Action")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:nth-child(even)]:bg-foreground/5 dark:[&_tr:nth-child(even)]:bg-white/5">
                    {resultAtoms.map((atom, index) => (
                        <DnsRow
                            key={`row-${index}`}
                            resultAtom={atom}
                            handleUse={handleUse}
                            showWorkingOnly={showWorkingOnly}
                        />
                    ))}
                </TableBody>
            </table>
        </div>
    );
});
