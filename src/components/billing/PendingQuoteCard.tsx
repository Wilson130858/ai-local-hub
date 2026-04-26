import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, Loader2, Repeat, Infinity as InfinityIcon, CalendarClock, Info } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { previewProration, type ServiceQuote } from "@/lib/billing";

type Props = { quote: ServiceQuote; billingDay: number; onDecided: () => void };

export function PendingQuoteCard({ quote, billingDay, onDecided }: Props) {
  const [busy, setBusy] = useState(false);
  const isBillingChange = (quote.billing_type as string) === "billing_change";
  const isRecurring = quote.billing_type === "recurring";
  const { prorata, daysRemaining } = previewProration(quote.amount, billingDay);

  const decide = async (decision: "accepted" | "declined") => {
    setBusy(true);
    const { data, error } = await supabase.rpc("decide_quote", {
      _quote_id: quote.id,
      _decision: decision,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { success: boolean; error?: string };
    if (!r?.success) return toast.error(r?.error ?? "Erro ao processar");
    if (decision === "accepted") {
      toast.success(isBillingChange ? "Dia de cobrança alterado!" : "Serviço adicionado à sua fatura!", {
        icon: <Sparkles className="h-4 w-4 text-accent" />,
        description: isBillingChange
          ? `Novo dia: ${quote.proposed_billing_day}`
          : `${quote.name} • ${formatCredits(quote.amount)}`,
      });
    } else {
      toast("Proposta recusada");
    }
    onDecided();
  };

  if (isBillingChange) {
    return (
      <Card className="border-border/60 p-5 shadow-soft">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-semibold">Alteração do dia de vencimento</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              O administrador propôs alterar seu dia de vencimento de <strong>{billingDay}</strong> para{" "}
              <strong>{quote.proposed_billing_day}</strong>.
            </p>
            {quote.description && (
              <p className="mt-2 text-xs text-muted-foreground">{quote.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => decide("accepted")}
            disabled={busy}
            className="flex-1 bg-success text-success-foreground hover:bg-success/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar alteração
          </Button>
          <Button variant="destructive" disabled={busy} className="flex-1" onClick={() => decide("declined")}>
            <X className="h-4 w-4" /> Recusar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 p-5 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold">{quote.name}</h4>
          {quote.description && (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{quote.description}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0">
          {isRecurring ? (
            <><Repeat className="mr-1 h-3 w-3" /> {quote.recurrence_months}x</>
          ) : (
            <><InfinityIcon className="mr-1 h-3 w-3" /> Vitalício</>
          )}
        </Badge>
      </div>
      <div className="mb-4 text-2xl font-semibold tabular-nums">{formatCredits(quote.amount)}</div>
      {prorata > 0 && (
        <div className="mb-4 flex gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-accent-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <p>
            Se aceitar hoje, será cobrado um valor proporcional de{" "}
            <strong className="font-mono">{formatCredits(prorata)}</strong> nesta fatura, referente aos{" "}
            {daysRemaining} dia{daysRemaining !== 1 ? "s" : ""} restantes até o vencimento.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => decide("accepted")}
          disabled={busy}
          className="flex-1 bg-success text-success-foreground hover:bg-success/90"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aceitar e adicionar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy} className="flex-1">
              <X className="h-4 w-4" /> Recusar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recusar este orçamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a recusar "{quote.name}". O administrador será notificado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => decide("declined")}>Recusar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}