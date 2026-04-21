import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { BotStatus } from "@/components/BotStatus";
import { AIInsights } from "@/components/AIInsights";
import { metrics } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";

type WidgetKey = "metrics" | "performance" | "bot" | "insights";
const DEFAULT_WIDGETS: Record<WidgetKey, boolean> = {
  metrics: true,
  performance: true,
  bot: true,
  insights: true,
};
const WIDGET_LABELS: Record<WidgetKey, string> = {
  metrics: "Métricas",
  performance: "Gráfico de desempenho",
  bot: "Status do bot",
  insights: "Insights de IA",
};

const Index = () => {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(DEFAULT_WIDGETS);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("dashboard_widgets").eq("id", user.id).maybeSingle();
      const stored = (data?.dashboard_widgets ?? null) as Partial<Record<WidgetKey, boolean>> | null;
      if (stored && typeof stored === "object") {
        setWidgets({ ...DEFAULT_WIDGETS, ...stored });
      }
    })();
  }, [user]);

  const toggle = async (key: WidgetKey, value: boolean) => {
    const next = { ...widgets, [key]: value };
    setWidgets(next);
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ dashboard_widgets: next }).eq("id", user.id);
    if (error) toast.error("Não foi possível salvar a preferência");
  };

  return (
    <DashboardLayout title="Visão Geral">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bom dia, Vinícius 👋</h2>
          <p className="text-sm text-muted-foreground">Aqui está o resumo da sua barbearia hoje.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Personalizar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <p className="text-sm font-medium">Widgets visíveis</p>
            {(Object.keys(WIDGET_LABELS) as WidgetKey[]).map((k) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <Label htmlFor={`w-${k}`} className="cursor-pointer text-sm font-normal">
                  {WIDGET_LABELS[k]}
                </Label>
                <Switch id={`w-${k}`} checked={widgets[k]} onCheckedChange={(v) => toggle(k, v)} />
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {widgets.metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      )}

      {(widgets.performance || widgets.bot) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {widgets.performance && (
            <div className={widgets.bot ? "lg:col-span-2" : "lg:col-span-3"}>
              <PerformanceChart />
            </div>
          )}
          {widgets.bot && <BotStatus />}
        </div>
      )}

      {widgets.insights && <AIInsights />}
    </DashboardLayout>
  );
};

export default Index;
