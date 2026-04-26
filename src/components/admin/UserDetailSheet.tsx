import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, CalendarClock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits } from "@/lib/utils";
import { QuoteDialog } from "./QuoteDialog";
import { QuotesTimeline } from "./QuotesTimeline";
import type { ServiceQuote } from "@/lib/billing";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userName: string | null;
  credits: number;
  status: string;
  defaultTab?: "summary" | "billing";
};

export function UserDetailSheet({ open, onOpenChange, userId, userName, credits, status, defaultTab = "summary" }: Props) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [billingDay, setBillingDay] = useState<number>(5);
  const [proposedDay, setProposedDay] = useState<string>("5");
  const [proposingDay, setProposingDay] = useState(false);
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data: tenant } = await supabase
      .from("tenants").select("id, business_name, billing_day").eq("owner_id", userId).maybeSingle();
    if (tenant) {
      setTenantId(tenant.id);
      setTenantName(tenant.business_name);
      const day = Number((tenant as { billing_day?: number }).billing_day ?? 5);
      setBillingDay(day);
      setProposedDay(String(day));
      const { data: qs } = await supabase
        .from("service_quotes").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
      setQuotes((qs ?? []) as ServiceQuote[]);
    } else {
      setTenantId(null);
      setTenantName("");
      setQuotes([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (open && userId) load(); }, [open, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const proposeBillingDay = async () => {
    if (!tenantId) return;
    const day = parseInt(proposedDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) return toast.error("Dia deve ser entre 1 e 28");
    if (day === billingDay) return toast.error("Esse já é o dia atual");
    setProposingDay(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "propose_billing_day_change", tenant_id: tenantId, proposed_billing_day: day },
    });
    setProposingDay(false);
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    toast.success("Proposta enviada ao cliente para aprovação");
    load();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName ?? "Cliente"}</SheetTitle>
          <SheetDescription>Perfil e gestão de faturamento</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue={defaultTab} key={`${userId}-${defaultTab}`} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="billing">Faturamento</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-3">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">{status}</Badge>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="mt-1 font-mono text-lg font-semibold">{formatCredits(credits)}</p>
            </div>
            {tenantName && (
              <div className="rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground">Negócio</p>
                <p className="mt-1 font-medium">{tenantName}</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="billing" className="mt-4 space-y-4">
            {!tenantId ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Este usuário ainda não tem um negócio configurado.
              </p>
            ) : (
              <>
                <div className="rounded-md border border-border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Dia de cobrança</Label>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Atual: <strong>dia {billingDay}</strong>. Alterações precisam ser aprovadas pelo cliente.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={proposedDay}
                      onChange={(e) => setProposedDay(e.target.value)}
                      className="h-9 w-24"
                    />
                    <Button size="sm" onClick={proposeBillingDay} disabled={proposingDay}>
                      {proposingDay ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Propor alteração
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Adicionar serviço/orçamento
                  </Button>
                </div>
                <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Ao adicionar um serviço, o cliente precisa aprovar. Se aceitar antes do próximo vencimento,
                  uma cobrança proporcional aos dias restantes será adicionada à fatura corrente.
                </p>
                {loading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <QuotesTimeline quotes={quotes} />
                )}
                <QuoteDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  tenantId={tenantId}
                  tenantName={tenantName}
                  onCreated={load}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}