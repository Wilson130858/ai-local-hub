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
import { invoices } from "@/lib/mock-data";
import { CreditCard, LogOut, Moon, Sun, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const defaultPrompt = `Você é o atendente virtual da Barbearia Vintage Petrolina.
- Horário: Seg a Sáb, 9h às 19h.
- Serviços: Corte (R$40), Barba (R$30), Corte+Barba (R$60), Pezinho (R$15).
- Endereço: Av. Souza Filho, 1234 - Centro, Petrolina/PE.
- Sempre confirme nome do cliente, serviço desejado e horário.
- Seja cordial, use linguagem informal e emojis com moderação.`;

const Configuracoes = () => {
  const { theme, toggle } = useTheme();
  const [prompt, setPrompt] = useState(defaultPrompt);

  return (
    <DashboardLayout title="Configurações">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">Gerencie sua conta, plano e treinamento da IA.</p>
      </div>

      <Tabs defaultValue="tema" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-5">
          <TabsTrigger value="tema">Tema</TabsTrigger>
          <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
          <TabsTrigger value="ia">Treino da IA</TabsTrigger>
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

        <TabsContent value="pagamento" className="mt-6 space-y-4">
          <Card className="overflow-hidden border-border/60 shadow-soft">
            <div className="bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Plano atual</p>
                  <h3 className="mt-1 text-2xl font-semibold">Pro Mensal</h3>
                </div>
                <Badge className="bg-white/20 text-white hover:bg-white/30">Ativo</Badge>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">R$ 297</span>
                <span className="text-sm opacity-80">/mês</span>
              </div>
              <p className="mt-2 text-sm opacity-80">Próxima cobrança em 01/05/2026</p>
            </div>
            <div className="flex flex-wrap gap-2 p-6">
              <Button variant="outline">Alterar plano</Button>
              <Button variant="ghost">Atualizar método de pagamento</Button>
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

        <TabsContent value="ia" className="mt-6">
          <Card className="border-border/60 p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-base font-semibold">Manual de instruções do bot</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Personalize como sua IA atende clientes. Inclua serviços, preços, horários e tom de voz.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={14}
              className="resize-none font-mono text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrompt(defaultPrompt)}>Restaurar</Button>
              <Button onClick={() => toast.success("Treinamento salvo! A IA será atualizada em ~30s.")}>
                Salvar treinamento
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="perfil" className="mt-6">
          <Card className="border-border/60 p-6 shadow-soft">
            <h3 className="text-base font-semibold">Informações do perfil</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input defaultValue="Vinícius Barbosa" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input defaultValue="vinicius@barbeariavintage.com" />
              </div>
              <div className="space-y-2">
                <Label>Negócio</Label>
                <Input defaultValue="Barbearia Vintage Petrolina" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input defaultValue="(87) 99999-0000" />
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
            <Button variant="destructive" className="mt-6 gap-2" onClick={() => toast("Logout simulado.")}>
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
