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
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub;

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
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      await audit("delete_user", user_id);
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

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return json({ error: msg }, 500);
  }
});
