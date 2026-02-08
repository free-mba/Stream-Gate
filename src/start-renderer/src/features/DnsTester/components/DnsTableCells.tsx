import type { PrimitiveAtom } from "jotai";
import type { DnsCheckResult } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { memo } from "react";
import { DnsResultCell } from "./DnsResultCell";
import { statusVariants, getDnsStatus } from "../DnsTesterConstants";

interface CellProps {
    resultAtom: PrimitiveAtom<DnsCheckResult>;
}

const serverSelector = (res: DnsCheckResult) => res.server;
const scoreSelector = (result: DnsCheckResult) => ({
    score: result.score,
    max: result.maxScore,
    status: getDnsStatus(result),
    stage: result.stage
});
const latencySelector = (result: DnsCheckResult) => ({
    latency: result.latency,
    stage: result.stage
});
const detailsSelector = (result: DnsCheckResult) => ({
    details: result.details,
    status: result.status,
    resStatus: getDnsStatus(result)
});
const actionSelector = (res: DnsCheckResult) => ({
    server: res.server,
    isSuccess: getDnsStatus(res) === "success"
});

export const DnsServerCell = memo(({ resultAtom }: CellProps) => (
    <DnsResultCell
        resultAtom={resultAtom}
        selector={serverSelector}
        render={(server) => {
            const displayServer = server.endsWith(':53') ? server.slice(0, -3) : server;
            return <span className="font-medium px-4">{displayServer}</span>;
        }}
        className="w-[200px]"
    />
));

export const DnsScoreCell = memo(({ resultAtom }: CellProps) => (
    <DnsResultCell
        resultAtom={resultAtom}
        selector={scoreSelector}
        render={(val) => (
            <span className={statusVariants({ status: val.status })}>
                {(val.stage === 'queued' || val.stage === 'checking') ? "..." : `${val.score}/${val.max}`}
            </span>
        )}
        className="w-[100px]"
    />
));

export const DnsLatencyCell = memo(({ resultAtom }: CellProps) => (
    <DnsResultCell
        resultAtom={resultAtom}
        selector={latencySelector}
        render={(val) => (
            <span className={val.latency && val.latency < 1000 ? "text-green-400" : "text-muted-foreground"}>
                {(val.stage === 'queued' || val.stage === 'checking') ? "..." : (val.latency ? `${Math.round(val.latency)}ms` : '-')}
            </span>
        )}
        className="w-[120px]"
    />
));

export const DnsDetailsCell = memo(({ resultAtom }: CellProps) => (
    <DnsResultCell
        resultAtom={resultAtom}
        selector={detailsSelector}
        render={(val) => (
            <span
                className={cn(
                    "text-[10px] truncate max-w-[300px] block text-start",
                    statusVariants({ status: val.resStatus })
                )}
                title={val.details}
            >
                {val.details || val.status}
            </span>
        )}
        className="min-w-[300px]"
    />
));

interface ActionCellProps extends CellProps {
    handleUse: (server: string) => void;
}

export const DnsActionCell = memo(({ resultAtom, handleUse }: ActionCellProps) => {
    const { t } = useTranslation();
    return (
        <DnsResultCell
            resultAtom={resultAtom}
            selector={actionSelector}
            render={(val) => (
                val.isSuccess ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs border-white/10 hover:bg-primary hover:text-primary-foreground hover:border-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleUse(val.server)}
                    >
                        {t("Use")}
                    </Button>
                ) : null
            )}
            className="w-[100px] px-4"
        />
    );
});
