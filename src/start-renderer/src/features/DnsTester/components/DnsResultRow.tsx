import { memo } from "react";
import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";
import type { DnsCheckResult } from "@/types";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { statusVariants, getDnsStatus } from "../DnsTesterConstants";

interface DnsResultRowProps {
    resultAtom: PrimitiveAtom<DnsCheckResult>;
    handleUse: (s: string) => void;
    showWorkingOnly?: boolean;
}


export const DnsResultRow = memo(({ resultAtom, handleUse, showWorkingOnly }: DnsResultRowProps) => {
    const { t } = useTranslation();
    const [result] = useAtom(resultAtom);

    if (!result) return null;

    const status = getDnsStatus(result);
    const statusColor = statusVariants({ status });

    const isSuccess = status === "success";

    if (showWorkingOnly && !isSuccess) {
        return null;
    }

    return (
        <TableRow className="border-0 bg-transparent transition-colors hover:bg-white/10">
            {/* Server IP */}
            <TableCell className="w-[200px] font-mono text-xs font-medium px-4">{result.server}</TableCell>

            {/* Score */}
            <TableCell className="w-[100px] text-start font-mono">
                <span className={statusColor}>
                    {result.score}/{result.maxScore}
                </span>
            </TableCell>
            {/* Latency */}
            <TableCell className="w-[120px] text-start font-mono">
                <span className={result.latency && result.latency < 1000 ? "text-green-400" : "text-muted-foreground"}>
                    {result.latency ? Math.round(result.latency) : '-'}ms
                </span>
            </TableCell>
            {/* Details */}
            <TableCell className="min-w-[300px]">
                <span className={cn(
                    "text-[10px] font-mono truncate max-w-[300px] block text-start",
                    statusColor
                )} title={result.details}>
                    {result.details || result.status}
                </span>
            </TableCell>

            <TableCell className="w-[100px] text-start px-4">
                {isSuccess && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs border-white/10 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                        onClick={() => handleUse(result.server)}
                    >
                        {t("Use")}
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}, (prev, next) => {
    // Re-render if filter state changes
    if (prev.showWorkingOnly !== next.showWorkingOnly) return false;
    return prev.resultAtom === next.resultAtom;
});

