import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import { formatDate, getInvoiceDisplayStatus } from "@/lib/billing";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export type InvoiceRow = {
  id: string;
  status: "open" | "closed" | "paid";
  period_start: string;
  period_end: string;
  due_date: string;
  base_amount: number;
  extras_amount: number;
  total_amount: number;
  closed_at: string | null;
};

type Props = {
  invoices: InvoiceRow[];
  onOpen: (inv: InvoiceRow) => void;
  emptyText?: string;
};

export function InvoiceHistoryTable({ invoices, onOpen, emptyText = "Nenhuma fatura encontrada." }: Props) {
  if (invoices.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const display = getInvoiceDisplayStatus(inv.status, inv.due_date);
            return (
              <TableRow key={inv.id}>
                <TableCell className="text-sm">
                  {formatDate(inv.period_start)} <span className="text-muted-foreground">→</span> {formatDate(inv.period_end)}
                </TableCell>
                <TableCell className="text-sm">{formatDate(inv.due_date)}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatCredits(inv.total_amount)}</TableCell>
                <TableCell><InvoiceStatusBadge status={display} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(inv)}>
                    <Eye className="mr-1 h-4 w-4" /> Ver
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}