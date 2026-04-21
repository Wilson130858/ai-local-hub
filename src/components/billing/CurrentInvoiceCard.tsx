import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, CalendarDays } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import { computeCurrentInvoice, computeNextDueDate, formatDate, type ServiceQuote } from "@/lib/billing";

type Props = {
  baseAmount: number;
  closingDay: number;
  acceptedQuotes: ServiceQuote[];
};

export function CurrentInvoiceCard({ baseAmount, closingDay, acceptedQuotes }: Props) {
  const { lines, total } = computeCurrentInvoice(baseAmount, acceptedQuotes);
  const due = computeNextDueDate(closingDay);

  return (
    <Card className="overflow-hidden border-border/60 shadow-soft">
      <div className="bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm opacity-80">
              <Receipt className="h-3.5 w-3.5" /> Fatura atual
            </p>
            <h3 className="mt-1 text-3xl font-semibold tabular-nums transition-all">{formatCredits(total)}</h3>
          </div>
          <Badge className="bg-white/20 text-white hover:bg-white/30">
            <CalendarDays className="mr-1 h-3 w-3" />
            Vence {formatDate(due)}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border p-6 pt-4">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between py-2 text-sm">
            <span className={l.kind === "base" ? "font-medium" : "text-muted-foreground"}>{l.description}</span>
            <span className="font-mono tabular-nums">{formatCredits(l.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono tabular-nums">{formatCredits(total)}</span>
        </div>
      </div>
    </Card>
  );
}