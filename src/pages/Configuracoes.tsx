import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invoices } from "@/lib/mock-data";
import { CreditCard, LogOut, Moon, Sun, CheckCircle2, Sparkles, Gift, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/utils";

const defaultPrompt = `Você é o atendente virtual da Barbearia Vintage Petrolina.
- Horário: Seg a Sáb, 9h às 19h.
- Serviços: Corte (R$40), Barba (R$30), Corte+Barba (R$60), Pezinho (R$15).
- Endereço: Av. Souza Filho, 1234 - Centro, Petrolina/PE.
- Sempre confirme nome do cliente, serviço desejado e horário.
- Seja cordial, use linguagem informal e emojis com moderação.`;

const Configuracoes = () => {
  const { theme, toggle } = useTheme();
  const { user, isAdmin, signOut } = useAuth();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [credits, setCredits] = useState(0);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCredits(data?.credits ?? 0));
  }, [user]);

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
            <Card className="border-border/60 p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="text-base font-semibold">Manual de instruções do bot</h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Personalize como sua IA atende clientes. Inclua serviços, preços, horários e tom de voz.
              </p>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={14} className="resize-none font-mono text-sm" />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPrompt(defaultPrompt)}>Restaurar</Button>
                <Button onClick={() => toast.success("Treinamento salvo! A IA será atualizada em ~30s.")}>Salvar treinamento</Button>
              </div>
            </Card>
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
