import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Receipt, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits } from "@/lib/utils";
import { formatDate, getInvoiceDisplayStatus } from "@/lib/billing";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type Invoice = {
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

type InvoiceItem = {
  id: string;
  description: string;
  amount: number;
  kind: "base" | "quote_recurring" | "quote_lifetime";
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice | null;
};

export function InvoiceDetailSheet({ open, onOpenChange, invoice }: Props) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setLoading(true);
    supabase
      .from("invoice_items")
      .select("id, description, amount, kind")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as InvoiceItem[]);
        setLoading(false);
      });
  }, [open, invoice]);

  if (!invoice) return null;
  const display = getInvoiceDisplayStatus(invoice.status, invoice.due_date);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Fatura
          </SheetTitle>
          <SheetDescription>Detalhes do período e itens cobrados</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between rounded-lg border border-border p-4">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Período</p>
              <p className="font-medium">{formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}</p>
              <p className="mt-2 text-muted-foreground">Vencimento</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            <div className="space-y-2 text-right">
              <InvoiceStatusBadge status={display} />
              <p className="font-mono text-2xl font-semibold">{formatCredits(invoice.total_amount)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
              Itens cobrados
            </div>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum item nesta fatura.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="text-foreground">{it.description}</span>
                    <span className="font-mono tabular-nums">{formatCredits(it.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-3 text-sm font-semibold">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatCredits(invoice.total_amount)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}