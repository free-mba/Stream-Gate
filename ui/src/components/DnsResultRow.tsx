import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";
import type { DnsCheckResult } from "@/types";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { memo } from "react";

interface DnsResultRowProps {
    resultAtom: PrimitiveAtom<DnsCheckResult>;
    handleUse: (s: string) => void;
    showWorkingOnly?: boolean;
}

// Memoized row for high performance
export const DnsResultRow = memo(({ resultAtom, handleUse, showWorkingOnly }: DnsResultRowProps) => {
    const { t } = useTranslation();
    const [res] = useAtom(resultAtom);

    if (!res) return null;

    // determine if this is a worker result or legacy
    const isWorkerResult = !!res.data;
    const isSuccess = res.data?.isCompatible || res.status === 'OK';

    // Filter Logic
    if (showWorkingOnly && !isSuccess) {
        return null;
    }

    // Status color logic (for Details/Status text)
    // "OK" should be green, "Fail" or others red
    const isFailed = !isSuccess && res.stage === 'done';

    return (
        <TableRow className="border-0 bg-transparent transition-colors hover:bg-white/10">
            {/* Server IP */}
            <TableCell className="w-[200px] font-mono text-xs font-medium px-4">{res.server}</TableCell>

            {/* Score / Mode specific columns */}
            {isWorkerResult ? (
                <>
                    <TableCell className="w-[100px] text-start font-mono">
                        <span className={cn(
                            isSuccess ? "text-green-400" : isFailed ? "text-red-400" : "text-muted-foreground"
                        )}>
                            {res.data?.score}/{res.data?.maxScore}
                        </span>
                    </TableCell>
                    <TableCell className="w-[120px] text-start font-mono">
                        <span className={res.elapsed && res.elapsed < 1000 ? "text-green-400" : "text-muted-foreground"}>
                            {res.elapsed ? Math.round(res.elapsed) : '-'}ms
                        </span>
                    </TableCell>
                    <TableCell className="min-w-[300px]">
                        <span className={cn(
                            "text-[10px] font-mono truncate max-w-[300px] block text-start",
                            isSuccess ? "text-green-400" : isFailed ? "text-red-400" : "text-muted-foreground"
                        )} title={res.data?.details}>
                            {res.data?.details}
                        </span>
                    </TableCell>
                </>
            ) : (
                /* Legacy Columns Fallback */
                <>
                    <TableCell>
                        <div className={cn("flex items-center gap-1.5 text-xs", res.ping?.ok ? "text-green-400" : "text-muted-foreground")}>
                            <Clock className="w-3 h-3" />
                            {res.ping?.ok ? `${res.ping.timeMs}ms` : '-'}
                        </div>
                    </TableCell>

                    <TableCell>
                        <div className={cn("flex items-center gap-1.5 text-xs", res.dns?.ok ? "text-blue-400" : "text-muted-foreground")}>
                            <Zap className="w-3 h-3" />
                            {res.dns?.ok ? `${res.dns.timeMs}ms` : '-'}
                        </div>
                    </TableCell>

                    <TableCell>
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            isSuccess ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                        )}>
                            {isSuccess && <Check className="w-3 h-3" />}
                            {!isSuccess && <AlertCircle className="w-3 h-3" />}
                            {res.status}
                        </div>
                    </TableCell>
                </>
            )}

            <TableCell className="w-[100px] text-start px-4">
                {isSuccess && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs border-white/10 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                        onClick={() => handleUse(res.server)}
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

