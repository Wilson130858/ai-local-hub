import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("auth getClaims failed", claimsErr);
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    const audit = (a: string, target: string | null, details: Record<string, unknown> = {}) =>
      admin.from("audit_logs").insert({ admin_id: callerId, action: a, target_user_id: target, details });

    if (action === "reset_password") {
      const { email } = body;
      if (!email || typeof email !== "string") return json({ error: "email required" }, 400);
      const redirectTo = (req.headers.get("origin") ?? "") + "/auth";
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      await audit("reset_password", null, { email });
      return json({ success: true });
    }

    if (action === "approve_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { error } = await admin.from("profiles").update({ status: "approved" }).eq("id", user_id);
      if (error) throw error;
      await audit("approve_user", user_id);
      // notifica o usuário
      await admin.from("notifications").insert({
        target_user_id: user_id,
        message: "Sua conta foi aprovada! Você já pode acessar o painel.",
        type: "system",
        created_by: callerId,
      });
      return json({ success: true });
    }

    if (action === "reject_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { error } = await admin.from("profiles").update({ status: "rejected" }).eq("id", user_id);
      if (error) throw error;
      await audit("reject_user", user_id);
      return json({ success: true });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      if (user_id === callerId) return json({ error: "cannot delete yourself" }, 400);

      // Limpa referências que bloqueiam o delete (FKs NO ACTION em profiles)
      await admin.from("audit_logs").delete().or(`admin_id.eq.${user_id},target_user_id.eq.${user_id}`);
      await admin.from("notifications").delete().or(`target_user_id.eq.${user_id},created_by.eq.${user_id}`);
      await admin.from("credit_vouchers").update({ created_by: callerId }).eq("created_by", user_id);
      await admin.from("credit_vouchers").update({ used_by: null }).eq("used_by", user_id);
      await admin.from("voucher_redemptions").delete().eq("user_id", user_id);
      await admin.from("leads").delete().in("tenant_id",
        (await admin.from("tenants").select("id").eq("owner_id", user_id)).data?.map((t: { id: string }) => t.id) ?? []
      );
      await admin.from("tenants").delete().eq("owner_id", user_id);
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);

      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      // Audit sem target_user_id (já deletado), guarda no details
      await audit("delete_user", null, { deleted_user_id: user_id });
      return json({ success: true });
    }

    if (action === "create_user") {
      const { email, password, full_name } = body;
      if (!email || !password) return json({ error: "email and password required" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? "" },
      });
      if (error) throw error;
      const newId = created.user?.id;
      if (newId) {
        // garante aprovação imediata
        await admin.from("profiles").update({ status: "approved" }).eq("id", newId);
      }
      await audit("create_user", newId ?? null, { email });
      return json({ success: true, user_id: newId });
    }

    if (action === "impersonate_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { data: target, error: getErr } = await admin.auth.admin.getUserById(user_id);
      if (getErr) {
        console.error("getUserById error", getErr);
        return json({ error: "user not found", detail: getErr.message }, 404);
      }
      const email = target?.user?.email;
      if (!email) {
        console.error("user has no email", { user_id, target });
        return json({ error: "user has no email" }, 404);
      }
      const origin = req.headers.get("origin") ?? "";
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: origin + "/" },
      });
      if (linkErr) throw linkErr;
      await audit("impersonate_user", user_id, { email });
      return json({ success: true, action_link: linkData.properties?.action_link });
    }

    if (action === "adjust_credits") {
      const { user_id, delta, reason } = body;
      if (!user_id || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
        return json({ error: "user_id and non-zero numeric delta required" }, 400);
      }
      const { data: prof, error: pErr } = await admin
        .from("profiles").select("credits, full_name").eq("id", user_id).maybeSingle();
      if (pErr || !prof) return json({ error: "profile not found" }, 404);
      const before = prof.credits ?? 0;
      const after = before + delta;
      if (after < 0) return json({ error: "insufficient credits" }, 400);
      const { error: updErr } = await admin.from("profiles").update({ credits: after }).eq("id", user_id);
      if (updErr) throw updErr;
      const reasonText = (reason && String(reason).trim()) || "ajuste manual";
      const sign = delta > 0 ? "+" : "";
      await admin.from("notifications").insert({
        target_user_id: user_id,
        title: "Créditos ajustados",
        message: `Seus créditos foram ajustados em ${sign}${(delta / 100).toFixed(2)}. Motivo: ${reasonText}`,
        type: "system",
        created_by: callerId,
      });
      await audit("adjust_credits", user_id, { delta, reason: reasonText, before, after });
      return json({ success: true, before, after });
    }

    if (action === "create_quote") {
      const { tenant_id, name, description, amount, billing_type, recurrence_months } = body;
      if (!tenant_id || !name || typeof amount !== "number" || amount <= 0) {
        return json({ error: "tenant_id, name and positive amount required" }, 400);
      }
      if (billing_type !== "recurring" && billing_type !== "lifetime") {
        return json({ error: "invalid billing_type" }, 400);
      }
      if (billing_type === "recurring") {
        if (!Number.isInteger(recurrence_months) || recurrence_months < 1 || recurrence_months > 60) {
          return json({ error: "recurrence_months must be 1-60" }, 400);
        }
      }
      const { data: tenant, error: tErr } = await admin
        .from("tenants").select("id, owner_id, business_name").eq("id", tenant_id).maybeSingle();
      if (tErr || !tenant) return json({ error: "tenant not found" }, 404);

      const { data: quote, error: qErr } = await admin.from("service_quotes").insert({
        tenant_id,
        created_by: callerId,
        name,
        description: description ?? null,
        amount,
        billing_type,
        recurrence_months: billing_type === "recurring" ? recurrence_months : null,
      }).select().single();
      if (qErr) throw qErr;

      await admin.from("notifications").insert({
        target_user_id: tenant.owner_id,
        title: "Novo orçamento recebido",
        message: `${name} • R$ ${(amount / 100).toFixed(2)}. Acesse Configurações > Pagamento para aprovar.`,
        type: "system",
        created_by: callerId,
      });
      await audit("create_quote", tenant.owner_id, { quote_id: quote.id, amount, billing_type });
      return json({ success: true, quote });
    }

    if (action === "update_setting") {
      const { key, value } = body;
      if (key !== "monthly_base_amount" && key !== "invoice_closing_day") {
        return json({ error: "invalid setting key" }, 400);
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return json({ error: "value must be a non-negative number" }, 400);
      }
      if (key === "invoice_closing_day" && (value < 1 || value > 28 || !Number.isInteger(value))) {
        return json({ error: "invoice_closing_day must be integer 1-28" }, 400);
      }
      const { error } = await admin.from("app_settings").upsert({
        key, value, updated_at: new Date().toISOString(), updated_by: callerId,
      });
      if (error) throw error;
      await audit("update_setting", null, { key, value });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return json({ error: msg }, 500);
  }
});
