import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentInvoiceCard } from "@/components/billing/CurrentInvoiceCard";
import { InvoiceHistoryTable, type InvoiceRow } from "@/components/billing/InvoiceHistoryTable";
import { InvoiceDetailSheet } from "@/components/billing/InvoiceDetailSheet";
import type { ServiceQuote } from "@/lib/billing";

export default function Faturas() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [billingDay, setBillingDay] = useState(5);
  const [acceptedQuotes, setAcceptedQuotes] = useState<ServiceQuote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, billing_day")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!tenant) {
        if (!cancelled) {
          setBillingDay(5);
          setAcceptedQuotes([]);
          setInvoices([]);
          setLoading(false);
        }
        return;
      }
      const day = Number((tenant as { billing_day?: number }).billing_day ?? 5);
      const [{ data: qs }, { data: invs }] = await Promise.all([
        supabase
          .from("service_quotes")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("status", "accepted"),
        supabase
          .from("invoices")
          .select("id, status, period_start, period_end, due_date, base_amount, extras_amount, total_amount, closed_at")
          .eq("tenant_id", tenant.id)
          .neq("status", "open")
          .order("due_date", { ascending: false }),
      ]);
      if (cancelled) return;
      setBillingDay(day);
      setAcceptedQuotes((qs ?? []) as ServiceQuote[]);
      setInvoices((invs ?? []) as InvoiceRow[]);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <DashboardLayout title="Faturas">
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <CurrentInvoiceCard billingDay={billingDay} acceptedQuotes={acceptedQuotes} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Histórico de faturas
                </CardTitle>
                <CardDescription>
                  Faturas fechadas, pagas e em atraso. Clique em "Ver" para detalhar os itens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InvoiceHistoryTable
                  invoices={invoices}
                  onOpen={(inv) => { setActiveInvoice(inv); setDetailOpen(true); }}
                  emptyText="Você ainda não tem faturas fechadas. A primeira será gerada no próximo dia de vencimento."
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <InvoiceDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        invoice={activeInvoice}
      />
    </DashboardLayout>
  );
}