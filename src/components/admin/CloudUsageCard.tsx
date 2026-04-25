import { useEffect, useState } from "react";
import { Cloud, AlertTriangle, ShieldCheck, ShieldAlert, RefreshCw, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  alertLevel,
  computeCloudUsage,
  formatUsd,
  loadCloudSettings,
  type CloudSettings,
  type CloudUsage,
} from "@/lib/cloud-usage";
import { CloudUsageDetailSheet } from "./CloudUsageDetailSheet";

export function CloudUsageCard() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<CloudUsage | null>(null);
  const [settings, setSettings] = useState<CloudSettings | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const s = await loadCloudSettings();
    const u = await computeCloudUsage(s);
    setSettings(s);
    setUsage(u);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  if (!usage || !settings) {
    return (
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4" /> Consumo Lovable Cloud
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{loading ? "Calculando…" : "Sem dados"}</p>
        </CardContent>
      </Card>
    );
  }

  const level = alertLevel(usage.projected_pct, settings);
  const accent =
    level === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : level === "warning"
        ? "border-warning/40 bg-warning/5"
        : "border-success/30 bg-success/5";

  const Icon = level === "critical" ? ShieldAlert : level === "warning" ? AlertTriangle : ShieldCheck;
  const iconColor =
    level === "critical" ? "text-destructive" : level === "warning" ? "text-warning" : "text-success";
  const badgeLabel = level === "critical" ? "Crítico" : level === "warning" ? "Atenção" : "Saudável";

  const progressValue = Math.min(100, usage.projected_pct);
  const progressIndicatorClass =
    level === "critical"
      ? "[&>div]:bg-destructive"
      : level === "warning"
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-success";

  return (
    <>
      <Card className={`shadow-soft border-2 ${accent}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4" /> Consumo Lovable Cloud
              <Badge variant="outline" className={iconColor}>
                <Icon className="mr-1 h-3 w-3" /> {badgeLabel}
              </Badge>
            </CardTitle>
            <CardDescription>Estimativa do mês corrente vs orçamento configurado</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={refresh} title="Atualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <BarChart3 className="mr-1 h-3.5 w-3.5" /> Detalhes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Gasto até agora" value={formatUsd(usage.total_cost)} />
            <Stat label="Projeção do mês" value={formatUsd(usage.projected_cost)} highlight={level !== "ok"} level={level} />
            <Stat label="Orçamento" value={formatUsd(usage.budget)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{usage.projected_pct.toFixed(0)}% do orçamento (projeção)</span>
              <span>Dia {usage.days_elapsed}/{usage.days_in_month}</span>
            </div>
            <Progress value={progressValue} className={`h-2 ${progressIndicatorClass}`} />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Estimativa baseada em volume de leads, invocações e storage. Calibre os custos unitários em Configurações.
          </p>
        </CardContent>
      </Card>

      <CloudUsageDetailSheet open={open} onOpenChange={setOpen} usage={usage} settings={settings} />
    </>
  );
}

function Stat({ label, value, highlight, level }: { label: string; value: string; highlight?: boolean; level?: "ok" | "warning" | "critical" }) {
  const color = highlight
    ? level === "critical" ? "text-destructive" : "text-warning"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}