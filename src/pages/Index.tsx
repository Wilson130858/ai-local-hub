import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PerformanceChart } from "@/components/PerformanceChart";
import { BotStatus } from "@/components/BotStatus";
import { AIInsights } from "@/components/AIInsights";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { CustomizeSheet } from "@/components/dashboard/CustomizeSheet";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { EmptyDashboard } from "@/components/dashboard/EmptyDashboard";
import { DEFAULT_SELECTED } from "@/lib/dashboard-metrics";

const Index = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [sheetOpen, setSheetOpen] = useState(false);
  const loadedRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // Load tenant + dashboard_config
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, dashboard_config")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        loadedRef.current = true;
        return;
      }
      if (data) {
        setTenantId(data.id);
        const cfg = data.dashboard_config as { metrics?: string[] } | null;
        if (cfg && Array.isArray(cfg.metrics)) {
          setSelected(cfg.metrics);
        }
      }
      loadedRef.current = true;
    })();
  }, [user]);

  // Persist with debounce when selection changes
  useEffect(() => {
    if (!loadedRef.current || !tenantId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("tenants")
        .update({ dashboard_config: { metrics: selected } })
        .eq("id", tenantId);
      if (error) toast.error("Não foi possível salvar suas preferências");
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [selected, tenantId]);

  return (
    <DashboardLayout title="Visão Geral">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bom dia, Vinícius 👋</h2>
          <p className="text-sm text-muted-foreground">Aqui está o resumo da sua barbearia hoje.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSheetOpen(true)}>
          <Settings className="h-4 w-4" /> Personalizar Painel
        </Button>
      </div>

      {selected.length === 0 ? (
        <EmptyDashboard onCustomize={() => setSheetOpen(true)} />
      ) : (
        <MetricsGrid selected={selected} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <BotStatus />
      </div>

      <AIInsights />

      <CustomizeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selected={selected}
        onChange={setSelected}
      />
    </DashboardLayout>
  );
};

export default Index;
