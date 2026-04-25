import { supabase } from "@/integrations/supabase/client";

export type CloudUsage = {
  month: string;
  days_elapsed: number;
  days_in_month: number;
  leads_this_month: number;
  estimated_invocations: number;
  storage_gb: number;
  cost_breakdown: { leads: number; invocations: number; storage: number };
  total_cost: number;
  projected_cost: number;
  projected_pct: number;
  budget: number;
};

export type CloudSettings = {
  budget: number;
  warningPct: number;
  criticalPct: number;
  costPerKLeads: number;
  costPerKInvocations: number;
  costPerGbStorage: number;
};

export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  budget: 25,
  warningPct: 60,
  criticalPct: 85,
  costPerKLeads: 0.2,
  costPerKInvocations: 0.1,
  costPerGbStorage: 0.125,
};

export const CLOUD_SETTING_KEYS = [
  "cloud_monthly_budget_usd",
  "cloud_warning_pct",
  "cloud_critical_pct",
  "cost_per_1k_leads",
  "cost_per_1k_function_invocations",
  "cost_per_gb_storage_month",
] as const;

function num(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadCloudSettings(): Promise<CloudSettings> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", CLOUD_SETTING_KEYS as unknown as string[]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    budget: num(map.get("cloud_monthly_budget_usd"), DEFAULT_CLOUD_SETTINGS.budget),
    warningPct: num(map.get("cloud_warning_pct"), DEFAULT_CLOUD_SETTINGS.warningPct),
    criticalPct: num(map.get("cloud_critical_pct"), DEFAULT_CLOUD_SETTINGS.criticalPct),
    costPerKLeads: num(map.get("cost_per_1k_leads"), DEFAULT_CLOUD_SETTINGS.costPerKLeads),
    costPerKInvocations: num(map.get("cost_per_1k_function_invocations"), DEFAULT_CLOUD_SETTINGS.costPerKInvocations),
    costPerGbStorage: num(map.get("cost_per_gb_storage_month"), DEFAULT_CLOUD_SETTINGS.costPerGbStorage),
  };
}

/**
 * Calcula uso e projeção do mês corrente lendo direto do banco.
 * Usado pra mostrar o card no painel sem depender de invocar a edge function.
 */
export async function computeCloudUsage(settings: CloudSettings): Promise<CloudUsage> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / 86400000));
  const daysInMonth = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / 86400000);

  const { count: leadsThisMonth } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStart.toISOString());

  const [{ count: leadsTotal }, { count: notifTotal }, { count: auditTotal }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
  ]);

  const leads = leadsThisMonth ?? 0;
  const estimatedInvocations = leads + daysElapsed * 5;
  const totalRows = (leadsTotal ?? 0) + (notifTotal ?? 0) + (auditTotal ?? 0);
  const storageGb = (totalRows * 1024) / 1024 ** 3;

  const costLeads = (leads / 1000) * settings.costPerKLeads;
  const costInvocations = (estimatedInvocations / 1000) * settings.costPerKInvocations;
  const costStorage = storageGb * settings.costPerGbStorage;
  const totalCost = costLeads + costInvocations + costStorage;

  const projected = (totalCost / daysElapsed) * daysInMonth;
  const projectedPct = settings.budget > 0 ? (projected / settings.budget) * 100 : 0;

  return {
    month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    days_elapsed: daysElapsed,
    days_in_month: daysInMonth,
    leads_this_month: leads,
    estimated_invocations: estimatedInvocations,
    storage_gb: storageGb,
    cost_breakdown: { leads: costLeads, invocations: costInvocations, storage: costStorage },
    total_cost: totalCost,
    projected_cost: projected,
    projected_pct: projectedPct,
    budget: settings.budget,
  };
}

export function formatUsd(value: number): string {
  return `US$ ${value.toFixed(2)}`;
}

export type AlertLevel = "ok" | "warning" | "critical";

export function alertLevel(pct: number, settings: CloudSettings): AlertLevel {
  if (pct >= settings.criticalPct) return "critical";
  if (pct >= settings.warningPct) return "warning";
  return "ok";
}