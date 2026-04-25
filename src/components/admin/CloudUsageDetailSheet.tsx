import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { formatUsd, type CloudSettings, type CloudUsage } from "@/lib/cloud-usage";
import { Card, CardContent } from "@/components/ui/card";

type DailyPoint = { date: string; count: number };

export function CloudUsageDetailSheet({
  open,
  onOpenChange,
  usage,
  settings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usage: CloudUsage;
  settings: CloudSettings;
}) {
  const [series, setSeries] = useState<DailyPoint[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("leads")
        .select("created_at")
        .gte("created_at", since.toISOString())
        .limit(10000);
      const buckets = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      for (const row of data ?? []) {
        const k = (row.created_at as string).slice(0, 10);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      }
      setSeries(Array.from(buckets, ([date, count]) => ({ date, count })));
    })();
  }, [open]);

  const max = Math.max(1, ...series.map((p) => p.count));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes de consumo</SheetTitle>
          <SheetDescription>
            Mês {usage.month} • estimativa baseada em uso observável
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Breakdown estimado</h3>
              <Row label={`Leads do mês (${usage.leads_this_month.toLocaleString("pt-BR")})`} value={formatUsd(usage.cost_breakdown.leads)} />
              <Row label={`Invocações de função (~${usage.estimated_invocations.toLocaleString("pt-BR")})`} value={formatUsd(usage.cost_breakdown.invocations)} />
              <Row label={`Storage (~${usage.storage_gb.toFixed(3)} GB)`} value={formatUsd(usage.cost_breakdown.storage)} />
              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatUsd(usage.total_cost)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Projeção fim do mês</span>
                <span className="font-mono">{formatUsd(usage.projected_cost)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Leads / dia (últimos 30)</h3>
              <div className="flex h-32 items-end gap-[2px]">
                {series.map((p) => (
                  <div
                    key={p.date}
                    className="flex-1 rounded-sm bg-primary/70 transition-colors hover:bg-primary"
                    style={{ height: `${(p.count / max) * 100}%`, minHeight: 2 }}
                    title={`${p.date}: ${p.count}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{series[0]?.date.slice(5)}</span>
                <span>{series[series.length - 1]?.date.slice(5)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
              <p><strong>Coeficientes em uso:</strong></p>
              <Row label="USD por 1k leads" value={`$${settings.costPerKLeads.toFixed(3)}`} />
              <Row label="USD por 1k invocações" value={`$${settings.costPerKInvocations.toFixed(3)}`} />
              <Row label="USD por GB·mês" value={`$${settings.costPerGbStorage.toFixed(3)}`} />
              <p className="pt-2">Ajuste em Configurações conforme o gasto real reportado pelo Lovable.</p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}