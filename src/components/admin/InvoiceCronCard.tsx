import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InvoiceCronCard() {
  const [installing, setInstalling] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const install = async () => {
    setInstalling(true);
    const { data, error } = await supabase.functions.invoke("install-cron", { body: {} });
    setInstalling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const err = (data as { error?: string; sql_to_run_manually?: string })?.error;
    if (err) {
      toast.error(err);
      const sql = (data as { sql_to_run_manually?: string })?.sql_to_run_manually;
      if (sql) setLastResult(sql);
      return;
    }
    toast.success("Agendamento instalado: roda diariamente às 03:00 BRT");
    const scheduled = (data as { scheduled?: string })?.scheduled;
    setLastResult(typeof scheduled === "string" ? scheduled : "ok");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Fechamento automático de faturas
        </CardTitle>
        <CardDescription>
          Cria/atualiza o agendamento diário (03:00 BRT) que fecha as faturas dos clientes
          cujo dia de cobrança chega ao vencimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Você só precisa rodar isto uma vez (e novamente caso o token CRON_SECRET seja rotacionado).
          A função usa o Supabase pg_cron + pg_net para invocar a edge function close-invoices.
        </p>
        <Button onClick={install} disabled={installing}>
          {installing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Instalar / Reinstalar agendamento
        </Button>
        {lastResult && (
          <p className="rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
            {lastResult}
          </p>
        )}
      </CardContent>
    </Card>
  );
}