import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";
import type { DnsCheckResult } from "@/types";
import { TableRow } from "@/components/ui/table";
import { memo, useMemo } from "react";
import { getDnsStatus } from "../DnsTesterConstants";
import { selectAtom } from "jotai/utils";
import {
    DnsServerCell,
    DnsScoreCell,
    DnsLatencyCell,
    DnsDetailsCell,
    DnsActionCell
} from "./DnsTableCells";

interface DnsRowProps {
    resultAtom: PrimitiveAtom<DnsCheckResult>;
    handleUse: (s: string) => void;
    showWorkingOnly: boolean;
}

export const DnsRow = memo(({ resultAtom, handleUse, showWorkingOnly }: DnsRowProps) => {
    const isVisibleAtom = useMemo(() => selectAtom(resultAtom, (res) => {
        if (!showWorkingOnly) return true;
        return getDnsStatus(res) === "success";
    }), [resultAtom, showWorkingOnly]);

    const [isVisible] = useAtom(isVisibleAtom);

    if (!isVisible) return null;

    return (
        <TableRow className="border-0 bg-transparent transition-colors hover:bg-white/10 group">
            <DnsServerCell resultAtom={resultAtom} />
            <DnsScoreCell resultAtom={resultAtom} />
            <DnsLatencyCell resultAtom={resultAtom} />
            <DnsDetailsCell resultAtom={resultAtom} />
            <DnsActionCell resultAtom={resultAtom} handleUse={handleUse} />
        </TableRow>
    );
});

