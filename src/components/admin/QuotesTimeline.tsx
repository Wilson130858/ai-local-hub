import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Repeat, Infinity as InfinityIcon, Clock, Check, X } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import { formatDate, type ServiceQuote } from "@/lib/billing";

export function QuotesTimeline({ quotes }: { quotes: ServiceQuote[] }) {
  if (quotes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhum orçamento enviado ainda.
      </p>
    );
  }

  const statusBadge = (s: ServiceQuote["status"]) => {
    if (s === "accepted")
      return <Badge className="bg-success text-success-foreground hover:bg-success/90"><Check className="mr-1 h-3 w-3" />Aceito</Badge>;
    if (s === "declined")
      return <Badge variant="destructive"><X className="mr-1 h-3 w-3" />Recusado</Badge>;
    return <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
  };

  return (
    <div className="space-y-2">
      {quotes.map((q) => (
        <Card key={q.id} className="border-border/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{q.name}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {q.billing_type === "recurring" ? (
                    <><Repeat className="mr-1 h-2.5 w-2.5" />{q.recurrence_months}x</>
                  ) : (
                    <><InfinityIcon className="mr-1 h-2.5 w-2.5" />Vitalício</>
                  )}
                </Badge>
                {statusBadge(q.status)}
              </div>
              {q.description && <p className="mt-1 text-xs text-muted-foreground">{q.description}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enviado em {formatDate(q.created_at)}
                {q.decided_at && ` · Decidido em ${formatDate(q.decided_at)}`}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-semibold tabular-nums">{formatCredits(q.amount)}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}