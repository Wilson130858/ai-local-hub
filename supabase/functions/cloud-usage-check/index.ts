// Hourly check: estima consumo do Lovable Cloud no mês corrente,
// projeta o gasto até o fim do mês e dispara notificação para admins
// quando cruza pela primeira vez os limites de atenção/crítico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Settings = {
  budget: number;
  warningPct: number;
  criticalPct: number;
  costPerKLeads: number;
  costPerKInvocations: number;
  costPerGbStorage: number;
  alertState: { month: string | null; warning_sent: boolean; critical_sent: boolean };
};

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Carrega settings
    const { data: settingsRows } = await admin.from("app_settings").select("key, value");
    const map = new Map((settingsRows ?? []).map((r) => [r.key, r.value]));
    const num = (k: string, fallback: number) => {
      const v = map.get(k);
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const settings: Settings = {
      budget: num("cloud_monthly_budget_usd", 25),
      warningPct: num("cloud_warning_pct", 60),
      criticalPct: num("cloud_critical_pct", 85),
      costPerKLeads: num("cost_per_1k_leads", 0.2),
      costPerKInvocations: num("cost_per_1k_function_invocations", 0.1),
      costPerGbStorage: num("cost_per_gb_storage_month", 0.125),
      alertState: (map.get("cloud_alert_state") as Settings["alertState"]) ?? {
        month: null, warning_sent: false, critical_sent: false,
      },
    };

    // 2) Mede uso do mês corrente
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / 86400000));
    const daysInMonth = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86400000);

    const { count: leadsThisMonth } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());

    // Aproximação: invocations ~= leads + 5 ações admin/dia (não temos acesso direto a logs aqui)
    const estimatedInvocations = (leadsThisMonth ?? 0) + daysElapsed * 5;

    // Storage: aproximação grosseira pelo total de linhas das tabelas grandes (~1KB/linha)
    const [{ count: leadsTotal }, { count: notifTotal }, { count: auditTotal }] = await Promise.all([
      admin.from("leads").select("id", { count: "exact", head: true }),
      admin.from("notifications").select("id", { count: "exact", head: true }),
      admin.from("audit_logs").select("id", { count: "exact", head: true }),
    ]);
    const totalRows = (leadsTotal ?? 0) + (notifTotal ?? 0) + (auditTotal ?? 0);
    const storageGb = (totalRows * 1024) / (1024 ** 3);

    const costLeads = ((leadsThisMonth ?? 0) / 1000) * settings.costPerKLeads;
    const costInvocations = (estimatedInvocations / 1000) * settings.costPerKInvocations;
    const costStorage = storageGb * settings.costPerGbStorage;
    const totalCost = costLeads + costInvocations + costStorage;

    // Projeção linear até fim do mês
    const projected = (totalCost / daysElapsed) * daysInMonth;
    const projectedPct = settings.budget > 0 ? (projected / settings.budget) * 100 : 0;

    // 3) Reset de estado se mudou de mês
    const currentMonth = monthKey(now);
    let alertState = { ...settings.alertState };
    if (alertState.month !== currentMonth) {
      alertState = { month: currentMonth, warning_sent: false, critical_sent: false };
    }

    // 4) Dispara notificações se cruzou limite novo
    const fmt = (n: number) => `US$ ${n.toFixed(2)}`;
    const notify = async (level: "warning" | "critical") => {
      const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      if (!admins?.length) return;
      const title = level === "critical"
        ? `Crítico: consumo Cloud em ${projectedPct.toFixed(0)}% do orçamento`
        : `Atenção: consumo Cloud em ${projectedPct.toFixed(0)}% do orçamento`;
      const message = `Projeção do mês: ${fmt(projected)} de ${fmt(settings.budget)} (gasto até agora: ${fmt(totalCost)}). Considere revisar o uso ou aumentar o limite.`;
      const rows = admins.map((a) => ({
        target_user_id: a.user_id,
        title,
        message,
        type: "system" as const,
      }));
      await admin.from("notifications").insert(rows);
    };

    if (projectedPct >= settings.criticalPct && !alertState.critical_sent) {
      await notify("critical");
      alertState.critical_sent = true;
      alertState.warning_sent = true;
    } else if (projectedPct >= settings.warningPct && !alertState.warning_sent) {
      await notify("warning");
      alertState.warning_sent = true;
    }

    await admin.from("app_settings").upsert({
      key: "cloud_alert_state",
      value: alertState,
      updated_at: new Date().toISOString(),
    });

    return json({
      success: true,
      usage: {
        month: currentMonth,
        days_elapsed: daysElapsed,
        days_in_month: daysInMonth,
        leads_this_month: leadsThisMonth ?? 0,
        estimated_invocations: estimatedInvocations,
        storage_gb: storageGb,
        cost_breakdown: {
          leads: costLeads,
          invocations: costInvocations,
          storage: costStorage,
        },
        total_cost: totalCost,
        projected_cost: projected,
        projected_pct: projectedPct,
        budget: settings.budget,
      },
      alert_state: alertState,
    });
  } catch (e) {
    console.error("cloud-usage-check error", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return json({ error: msg }, 500);
  }
});