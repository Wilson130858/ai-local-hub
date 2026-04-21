import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, Loader2, Repeat, Infinity as InfinityIcon } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ServiceQuote } from "@/lib/billing";

type Props = { quote: ServiceQuote; onDecided: () => void };

export function PendingQuoteCard({ quote, onDecided }: Props) {
  const [busy, setBusy] = useState(false);

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
      toast.success("Serviço adicionado à sua fatura!", {
        icon: <Sparkles className="h-4 w-4 text-accent" />,
        description: `${quote.name} • ${formatCredits(quote.amount)}`,
      });
    } else {
      toast("Orçamento recusado");
    }
    onDecided();
  };

  const isRecurring = quote.billing_type === "recurring";

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