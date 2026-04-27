import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invoices } from "@/lib/mock-data";
import { CreditCard, LogOut, Moon, Sun, CheckCircle2, Sparkles, Gift, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/utils";
import { CurrentInvoiceCard } from "@/components/billing/CurrentInvoiceCard";
import { PendingQuoteCard } from "@/components/billing/PendingQuoteCard";
import type { ServiceQuote } from "@/lib/billing";
import { AITrainingPanel } from "@/components/ai-training/AITrainingPanel";

const Configuracoes = () => {
  const { theme, toggle } = useTheme();
  const { user, isAdmin, signOut } = useAuth();
  const [credits, setCredits] = useState(0);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [billingDay, setBillingDay] = useState(5);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCredits(data?.credits ?? 0));
  }, [user]);

  const loadBilling = async () => {
    if (!user || isAdmin) return;
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, billing_day")
      .eq("owner_id", user.id);
    const tenantIds = (tenants ?? []).map((t) => t.id);
    if (tenants && tenants.length > 0) {
      setBillingDay(Number((tenants[0] as { billing_day?: number }).billing_day ?? 5));
    }
    if (tenantIds.length === 0) { setQuotes([]); return; }
    const { data: qs } = await supabase
      .from("service_quotes").select("*").in("tenant_id", tenantIds).order("created_at", { ascending: false });
    setQuotes((qs ?? []) as ServiceQuote[]);
  };

  useEffect(() => {
    loadBilling();
    if (!user || isAdmin) return;
    const channel = supabase
      .channel(`quotes-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_quotes" }, () => loadBilling())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const redeem = async () => {
    if (!voucherCode.trim()) return;
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_voucher", { _code: voucherCode.trim().toUpperCase() });
    setRedeeming(false);
    if (error) return toast.error(error.message);
    const result = data as { success: boolean; error?: string; value?: number };
    if (!result.success) {
      const map: Record<string, string> = {
        invalid_code: "Código inválido",
        already_redeemed_by_user: "Você já resgatou este voucher",
        max_uses_reached: "Este voucher atingiu o limite de usos",
        not_authenticated: "Faça login para resgatar",
      };
      return toast.error(map[result.error ?? ""] ?? "Erro ao resgatar");
    }
    toast.success(`Crédito de ${formatCredits(result.value ?? 0)} adicionado!`);
    setCredits((c) => c + (result.value ?? 0));
    setVoucherCode("");
  };

  // Tabs visíveis dependem do papel
  const isClient = !isAdmin;

  return (
    <DashboardLayout title="Configurações">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Gerencie sua conta de administrador." : "Gerencie sua conta, créditos e treinamento da IA."}
        </p>
      </div>

      <Tabs defaultValue="tema" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="tema">Tema</TabsTrigger>
          {isClient && <TabsTrigger value="pagamento">Pagamento</TabsTrigger>}
          {isClient && <TabsTrigger value="ia">Treino da IA</TabsTrigger>}
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="logout">Logout</TabsTrigger>
        </TabsList>

        <TabsContent value="tema" className="mt-6">
          <Card className="border-border/60 p-6 shadow-soft">
            <h3 className="text-base font-semibold">Aparência</h3>
            <p className="text-sm text-muted-foreground">Escolha entre tema claro ou escuro.</p>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                  {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium">Modo {theme === "dark" ? "Escuro" : "Claro"}</p>
                  <p className="text-xs text-muted-foreground">Alterne para a outra paleta</p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </div>
          </Card>
        </TabsContent>

        {isClient && (
          <TabsContent value="pagamento" className="mt-6 space-y-4">
            {/* Fatura atual */}
            <CurrentInvoiceCard
              billingDay={billingDay}
              acceptedQuotes={quotes.filter((q) => q.status === "accepted")}
            />

            {/* Orçamentos pendentes */}
            <Card className="border-border/60 p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="text-base font-semibold">Orçamentos pendentes</h3>
              </div>
              {quotes.filter((q) => q.status === "pending").length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum orçamento aguardando sua aprovação.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {quotes.filter((q) => q.status === "pending").map((q) => (
                    <PendingQuoteCard key={q.id} quote={q} billingDay={billingDay} onDecided={loadBilling} />
                  ))}
                </div>
              )}
            </Card>

            {/* Saldo + resgate */}
            <Card className="overflow-hidden border-border/60 shadow-soft">
              <div className="bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Saldo de créditos</p>
                    <h3 className="mt-1 text-3xl font-semibold">{formatCredits(credits)}</h3>
                  </div>
                  <Badge className="bg-white/20 text-white hover:bg-white/30">Disponível</Badge>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Resgatar crédito</h4>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Digite o código do voucher"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                  <Button onClick={redeem} disabled={redeeming || !voucherCode.trim()}>
                    {redeeming ? "Resgatando..." : "Resgatar"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Cada voucher só pode ser usado uma vez por usuário.</p>
              </div>
            </Card>

            <Card className="border-border/60 p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Histórico de Faturas</h3>
              </div>
              <div className="divide-y divide-border">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{inv.id}</p>
                      <p className="text-xs text-muted-foreground">{inv.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{inv.amount}</span>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        )}

        {isClient && (
          <TabsContent value="ia" className="mt-6">
            <AITrainingPanel />
          </TabsContent>
        )}

        <TabsContent value="perfil" className="mt-6">
          <Card className="border-border/60 p-6 shadow-soft">
            <h3 className="text-base font-semibold">Informações do perfil</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input defaultValue={user?.user_metadata?.full_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input defaultValue={user?.email ?? ""} disabled />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => toast.success("Perfil atualizado!")}>Salvar alterações</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logout" className="mt-6">
          <Card className="border-border/60 p-6 shadow-soft">
            <h3 className="text-base font-semibold">Sair da conta</h3>
            <p className="mt-1 text-sm text-muted-foreground">Você precisará fazer login novamente para acessar o painel.</p>
            <Button variant="destructive" className="mt-6 gap-2" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              Encerrar sessão
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Configuracoes;
