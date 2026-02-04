import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { useMemo, memo } from "react";
import type { ReactNode } from "react";
import type { DnsCheckResult } from "@/types";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DnsResultCellProps<T> {
    resultAtom: PrimitiveAtom<DnsCheckResult>;
    selector: (result: DnsCheckResult) => T;
    render: (value: T, result: DnsCheckResult) => ReactNode;
    className?: string;
    onClick?: () => void;
}

function DnsResultCellComponent<T>({
    render,
    onClick,
    selector,
    className,
    resultAtom,
}: Readonly<DnsResultCellProps<T>>) {
    const valueAtom = useMemo(() => selectAtom(resultAtom, selector), [resultAtom, selector]);
    const [value] = useAtom(valueAtom);

    return (
        <TableCell className={cn("font-mono text-xs", className)} onClick={onClick}>
            {render(value, {} as DnsCheckResult)}
        </TableCell>
    );
}

export const DnsResultCell = memo(DnsResultCellComponent) as typeof DnsResultCellComponent;
