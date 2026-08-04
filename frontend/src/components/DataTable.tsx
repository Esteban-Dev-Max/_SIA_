import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DataTableProps = {
  headers: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  className?: string;
};

export function DataTable({
  headers,
  rows,
  emptyMessage = "Sin datos",
  loading = false,
  loadingMessage = "Cargando datos...",
  className,
}: DataTableProps) {
  return (
    <Card className={cn("overflow-hidden border-border/50 shadow-sm rounded-xl", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
            {headers.map((h, i) => (
              <TableHead
                key={i}
                className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="h-40 text-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">{loadingMessage}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <>
              {rows.map((r, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    i % 2 === 0 ? "bg-white" : "bg-muted/10",
                  )}
                >
                  {r.map((c, j) => (
                    <TableCell key={j} className="px-4 py-3 text-sm">
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={headers.length} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                        <Inbox className="h-6 w-6 opacity-40" />
                      </div>
                      <span className="text-sm font-medium">{emptyMessage}</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
