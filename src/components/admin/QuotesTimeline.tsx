import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Repeat, Infinity as InfinityIcon, Clock, Check, X, CalendarClock, Ban, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCredits } from "@/lib/utils";
import { formatDate, isQuoteActiveInPeriod, type ServiceQuote } from "@/lib/billing";

type Props = {
  quotes: ServiceQuote[];
  /** Quando informado, habilita ações de admin (revogar serviço ativo). */
  onChanged?: () => void;
};

export function QuotesTimeline({ quotes, onChanged }: Props) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async (quoteId: string) => {
    setRevokingId(quoteId);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "revoke_quote", quote_id: quoteId },
    });
    setRevokingId(null);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Erro ao revogar");
      return;
    }
    toast.success("Serviço revogado");
    onChanged?.();
  };

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
    if ((s as string) === "revoked")
      return <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground"><Ban className="mr-1 h-3 w-3" />Revogado</Badge>;
    return <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
  };

  return (
    <div className="space-y-2">
      {quotes.map((q) => {
        const isBillingChange = (q.billing_type as string) === "billing_change";
        const canRevoke =
          !!onChanged &&
          q.status === "accepted" &&
          !isBillingChange &&
          isQuoteActiveInPeriod(q);
        return (
        <Card key={q.id} className="border-border/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{q.name}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {isBillingChange ? (
                    <><CalendarClock className="mr-1 h-2.5 w-2.5" />Dia de cobrança</>
                  ) : q.billing_type === "recurring" ? (
                    <><Repeat className="mr-1 h-2.5 w-2.5" />{q.recurrence_months}x</>
                  ) : (
                    <><InfinityIcon className="mr-1 h-2.5 w-2.5" />Vitalício</>
                  )}
                </Badge>
                {statusBadge(q.status)}
              </div>
              {q.description && <p className="mt-1 text-xs text-muted-foreground">{q.description}</p>}
              {isBillingChange && q.proposed_billing_day && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Propõe alterar para o dia <strong>{q.proposed_billing_day}</strong>
                </p>
              )}
              {q.proration_amount && q.proration_amount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Prorata cobrado: <strong className="font-mono">{formatCredits(q.proration_amount)}</strong>
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enviado em {formatDate(q.created_at)}
                {q.decided_at && ` · Decidido em ${formatDate(q.decided_at)}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="font-mono text-sm font-semibold tabular-nums">
                {isBillingChange ? "—" : formatCredits(q.amount)}
              </div>
              {canRevoke && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={revokingId === q.id}>
                      {revokingId === q.id
                        ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        : <Ban className="mr-1 h-3 w-3" />}
                      Revogar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revogar este serviço?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{q.name}" deixará de ser cobrado nas próximas faturas. O cliente será notificado.
                        Esta ação não estorna valores já faturados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revoke(q.id)}>Revogar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </Card>
        );
      })}
    </div>
  );
}