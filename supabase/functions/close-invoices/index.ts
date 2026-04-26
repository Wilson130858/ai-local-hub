// Cron-driven invoice closing.
// Authentication:
//   - Cron call: header `x-cron-secret` must match env CRON_SECRET.
//   - Manual admin call (single tenant): valid Bearer JWT of an admin user.
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tenant = { id: string; owner_id: string; business_name: string; billing_day: number };
type Quote = {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  status: string;
  billing_type: string;
  recurrence_months: number | null;
  proration_amount: number | null;
  decided_at: string | null;
};
type Invoice = {
  id: string;
  tenant_id: string;
  status: "open" | "closed" | "paid";
  period_start: string;
  period_end: string;
  due_date: string;
};

const TZ = "America/Sao_Paulo";

function ymdInTZ(d: Date): { y: number; m: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), day: get("day") };
}

function dateStr(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Próximo billing_day a partir de uma data (exclusivo). Resultado em ISO YYYY-MM-DD. */
function nextBillingDateAfter(today: { y: number; m: number; day: number }, billingDay: number): string {
  const day = Math.min(Math.max(billingDay, 1), 28);
  let y = today.y;
  let m = today.m;
  if (today.day >= day) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return dateStr(y, m, day);
}

function isQuoteActiveInPeriod(q: Quote, ref: Date): boolean {
  if (q.status !== "accepted" || !q.decided_at) return false;
  if (q.billing_type === "billing_change") return false;
  const decided = new Date(q.decided_at);
  const monthsElapsed =
    (ref.getUTCFullYear() - decided.getUTCFullYear()) * 12 +
    (ref.getUTCMonth() - decided.getUTCMonth());
  if (monthsElapsed < 0) return false;
  if (q.billing_type === "lifetime") return monthsElapsed === 0;
  const total = q.recurrence_months ?? 1;
  return monthsElapsed < total;
}

async function closeForTenant(
  admin: SupabaseClient<any, any, any>,
  tenant: Tenant,
): Promise<{ closed: boolean; invoice_id?: string; total?: number; reason?: string }> {
  const today = ymdInTZ(new Date());
  const todayISO = dateStr(today.y, today.m, today.day);

  // Idempotência: se já existe invoice closed/paid com period_end = ontem, não fecha de novo.
  const yesterdayISO = addDaysISO(todayISO, -1);
  const { data: alreadyClosed } = await admin
    .from("invoices")
    .select("id, status, period_end")
    .eq("tenant_id", tenant.id)
    .in("status", ["closed", "paid"])
    .eq("period_end", yesterdayISO)
    .maybeSingle();
  if (alreadyClosed) {
    return { closed: false, reason: "already_closed_for_period" };
  }

  // Busca/cria invoice aberta atual
  let openInvRes = await admin
    .from("invoices")
    .select("id, tenant_id, status, period_start, period_end, due_date")
    .eq("tenant_id", tenant.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let openInv = openInvRes.data as Invoice | null;

  if (!openInv) {
    // Cria uma invoice aberta cobrindo do início da janela até hoje
    const periodStart = addDaysISO(todayISO, -29);
    const { data: created, error: cErr } = await admin
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        period_start: periodStart,
        period_end: yesterdayISO,
        due_date: todayISO,
        status: "open",
        base_amount: 0,
        extras_amount: 0,
        total_amount: 0,
      })
      .select("id, tenant_id, status, period_start, period_end, due_date")
      .single();
    if (cErr || !created) throw cErr ?? new Error("failed to create invoice");
    openInv = created as Invoice;
  } else {
    // Ajusta o period_end e due_date para hoje
    const { error: uErr } = await admin
      .from("invoices")
      .update({ period_end: yesterdayISO, due_date: todayISO })
      .eq("id", openInv.id);
    if (uErr) throw uErr;
    openInv.period_end = yesterdayISO;
    openInv.due_date = todayISO;
  }

  // Materializa itens a partir dos quotes aceitos
  const { data: quotesData, error: qErr } = await admin
    .from("service_quotes")
    .select("id, tenant_id, name, amount, status, billing_type, recurrence_months, proration_amount, decided_at")
    .eq("tenant_id", tenant.id)
    .eq("status", "accepted");
  if (qErr) throw qErr;
  const quotes = (quotesData ?? []) as Quote[];

  const ref = new Date(`${todayISO}T12:00:00Z`);
  // Limpa itens existentes desta invoice (evita duplicar em fechamento manual)
  await admin.from("invoice_items").delete().eq("invoice_id", openInv.id);

  type ItemInsert = {
    invoice_id: string;
    description: string;
    amount: number;
    kind: "base" | "quote_recurring" | "quote_lifetime";
    quote_id: string | null;
  };
  const items: ItemInsert[] = [];
  for (const q of quotes) {
    if (!isQuoteActiveInPeriod(q, ref)) continue;
    const decided = q.decided_at ? new Date(q.decided_at) : null;
    const isAcceptanceMonth =
      decided !== null &&
      decided.getUTCFullYear() === ref.getUTCFullYear() &&
      decided.getUTCMonth() === ref.getUTCMonth();
    const useProration = isAcceptanceMonth && q.proration_amount && q.proration_amount > 0;
    const desc = useProration ? `${q.name} (proporcional do mês)` : q.name;
    const amount = useProration ? q.proration_amount! : q.amount;
    const kind: ItemInsert["kind"] = q.billing_type === "lifetime" ? "quote_lifetime" : "quote_recurring";
    items.push({ invoice_id: openInv.id, description: desc, amount, kind, quote_id: q.id });
  }

  if (items.length > 0) {
    const { error: iErr } = await admin.from("invoice_items").insert(items);
    if (iErr) throw iErr;
  }

  const total = items.reduce((s, i) => s + i.amount, 0);
  const baseAmount = items.filter((i) => i.kind === "base").reduce((s, i) => s + i.amount, 0);
  const extrasAmount = total - baseAmount;

  const { error: fErr } = await admin
    .from("invoices")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      base_amount: baseAmount,
      extras_amount: extrasAmount,
      total_amount: total,
    })
    .eq("id", openInv.id);
  if (fErr) throw fErr;

  // Abre a próxima invoice
  const nextDue = nextBillingDateAfter(today, tenant.billing_day);
  const nextStart = todayISO;
  const nextEnd = addDaysISO(nextDue, -1);
  await admin.from("invoices").insert({
    tenant_id: tenant.id,
    period_start: nextStart,
    period_end: nextEnd,
    due_date: nextDue,
    status: "open",
    base_amount: 0,
    extras_amount: 0,
    total_amount: 0,
  });

  // Notifica o dono
  const fmtBR = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const totalStr = (total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  await admin.from("notifications").insert({
    target_user_id: tenant.owner_id,
    title: "Fatura fechada",
    message: `Sua fatura de R$ ${totalStr} foi fechada e vence em ${fmtBR(todayISO)}.`,
    type: "system",
  });

  return { closed: true, invoice_id: openInv.id, total };
}

async function notifyOverdue(admin: SupabaseClient<any, any, any>) {
  const today = ymdInTZ(new Date());
  const todayISO = dateStr(today.y, today.m, today.day);

  // Faturas closed cujo due_date < hoje e ainda não notificadas hoje
  const { data: overdue } = await admin
    .from("invoices")
    .select("id, tenant_id, total_amount, due_date")
    .eq("status", "closed")
    .lt("due_date", todayISO);

  if (!overdue?.length) return 0;

  let count = 0;
  for (const inv of overdue as Array<{ id: string; tenant_id: string; total_amount: number; due_date: string }>) {
    const { data: tenant } = await admin
      .from("tenants").select("owner_id").eq("id", inv.tenant_id).maybeSingle();
    if (!tenant?.owner_id) continue;
    const totalStr = ((inv.total_amount ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    // Evita spam: só notifica 1, 7 e 15 dias após vencimento
    const days = Math.floor(
      (new Date(`${todayISO}T00:00:00Z`).getTime() - new Date(`${inv.due_date}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    if (![1, 7, 15].includes(days)) continue;
    await admin.from("notifications").insert({
      target_user_id: tenant.owner_id,
      title: "Fatura em atraso",
      message: `Sua fatura de R$ ${totalStr} venceu há ${days} dia(s). Regularize para evitar suspensão.`,
      type: "system",
    });
    count++;
  }
  return count;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const cronHeader = req.headers.get("x-cron-secret");
    const authHeaderRaw = req.headers.get("Authorization") ?? "";
    // Aceita cron via x-cron-secret OU via Authorization Bearer = CRON_SECRET (mais simples para pg_cron)
    const isCron =
      !!CRON_SECRET &&
      (cronHeader === CRON_SECRET || authHeaderRaw === `Bearer ${CRON_SECRET}`);

    let isAdmin = false;
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
      if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
      const callerId = claims.claims.sub as string;
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "Forbidden" }, 403);
      isAdmin = true;
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tenantIdParam = (body as { tenant_id?: string }).tenant_id;

    // Caso 1: admin fechando manualmente um tenant específico
    if (isAdmin && tenantIdParam) {
      const { data: tenantRow } = await admin
        .from("tenants").select("id, owner_id, business_name, billing_day").eq("id", tenantIdParam).maybeSingle();
      const tenant = tenantRow as Tenant | null;
      if (!tenant) return json({ error: "tenant not found" }, 404);
      const result = await closeForTenant(admin, tenant);
      return json({ success: true, mode: "manual", result });
    }

    // Caso 2: cron diário — fecha todos os tenants cujo billing_day == dia atual em São Paulo
    const today = ymdInTZ(new Date());
    const { data: tenants } = await admin
      .from("tenants").select("id, owner_id, business_name, billing_day");
    const due = ((tenants ?? []) as Tenant[]).filter((t) => t.billing_day === today.day);

    const results: Array<{ tenant_id: string; ok: boolean; total?: number; error?: string }> = [];
    for (const t of due) {
      try {
        const r = await closeForTenant(admin, t);
        results.push({ tenant_id: t.id, ok: r.closed, total: r.total });
      } catch (e) {
        results.push({ tenant_id: t.id, ok: false, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    const overdueCount = await notifyOverdue(admin);

    return json({
      success: true,
      mode: isCron ? "cron" : "admin_all",
      tenants_processed: results.length,
      overdue_notified: overdueCount,
      results,
    });
  } catch (e) {
    console.error("close-invoices error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});