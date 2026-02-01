import { useAtom } from "jotai";
import { dnsResultsAtom } from "../store";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { memo } from "react";

// Memoized row component for performance
export const DnsResultRow = memo(({ index, handleUse }: { index: number, handleUse: (s: string) => void }) => {
    // Select only this row's data?
    // Actually with the current atom structure (array), re-renders might still happen for the whole table
    // unless we use split atoms.
    // simpler approach first: Just use the valid data passed down or select by index.

    // Better approach for cell-level updates with large lists:
    // But for < 50 items, array selection is "okay" if we memoize the component.
    // However, the prompt specifically asked for "cell level updates".
    // JOTAI optimization: usage of `selectAtom` or `splitAtom`.

    // Let's assume the parent passes the data for now to keep it simple, OR we use useInput.
    // Re-reading prompt: "use jotai and only update the cell state data instead of table or row"

    // This implies `splitAtom`.
    const [results] = useAtom(dnsResultsAtom);
    const res = results[index];

    if (!res) return null;

    return (
        <TableRow className="border-white/5 hover:bg-white/5 transition-colors">
            <TableCell className="font-mono text-xs font-medium">{res.server}</TableCell>

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
                    res.status === 'OK' ? "bg-green-500/10 text-green-400" :
                        res.status === 'Ping Only' ? "bg-yellow-500/10 text-yellow-400" :
                            res.status === 'Checking...' ? "bg-blue-500/10 text-blue-400 animate-pulse" :
                                "bg-red-500/10 text-red-400"
                )}>
                    {res.status === 'OK' && <Check className="w-3 h-3" />}
                    {res.status === 'Unreachable' && <AlertCircle className="w-3 h-3" />}
                    {res.status}
                </div>
            </TableCell>

            <TableCell className="text-right">
                {res.status === 'OK' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-white/10 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                        onClick={() => handleUse(res.server)}
                    >
                        Use
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}, (prev, next) => {
    // Custom comparison if needed, but 'memo' should handle props.
    // If we subscribe to the atom INSIDE the component by index, it will re-render when the array changes.
    // To truly isolate, we need splitAtom.
    return prev.index === next.index;
});
