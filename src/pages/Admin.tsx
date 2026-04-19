import { useEffect, useState } from "react";
import { Shield, Loader2, Plus, Send, KeyRound, Copy, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Profile = {
  id: string;
  full_name: string | null;
  category: "barbearia" | "clinica" | "petshop" | null;
  credits: number;
  created_at: string;
};

type Voucher = {
  id: string;
  code: string;
  value: number;
  is_used: boolean;
  created_at: string;
};

export default function Admin() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  // voucher form
  const [voucherValue, setVoucherValue] = useState("100");
  const [voucherQty, setVoucherQty] = useState("1");

  // notification form
  const [notifTarget, setNotifTarget] = useState<string>("all");
  const [notifMsg, setNotifMsg] = useState("");
  const [notifType, setNotifType] = useState<"system" | "alert">("system");

  const loadData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: vData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("credit_vouchers").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setProfiles(pData ?? []);
    setVouchers(vData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateCategory = async (userId: string, category: Profile["category"]) => {
    const { error } = await supabase.from("profiles").update({ category }).eq("id", userId);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      admin_id: user!.id,
      action: "update_category",
      target_user_id: userId,
      details: { category },
    });
    toast.success("Categoria atualizada");
    loadData();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "reset_password", email },
    });
    if (error) return toast.error(error.message);
    toast.success(`Email de redefinição enviado para ${email}`);
  };

  const generateVouchers = async () => {
    const value = parseInt(voucherValue);
    const qty = parseInt(voucherQty);
    if (!value || !qty || qty > 50) return toast.error("Valor inválido (máx 50 por vez)");

    const codes = Array.from({ length: qty }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    const rows = codes.map((code) => ({ code, value, created_by: user!.id }));
    const { error } = await supabase.from("credit_vouchers").insert(rows);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      admin_id: user!.id,
      action: "generate_vouchers",
      details: { quantity: qty, value },
    });
    toast.success(`${qty} vouchers gerados`);
    loadData();
  };

  const sendNotification = async () => {
    if (!notifMsg.trim()) return toast.error("Mensagem vazia");
    const targets = notifTarget === "all" ? profiles.map((p) => p.id) : [notifTarget];
    const rows = targets.map((tid) => ({
      target_user_id: tid,
      message: notifMsg,
      type: notifType,
      created_by: user!.id,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Notificação enviada para ${targets.length} usuário(s)`);
    setNotifMsg("");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Modo Administrador</h1>
              <p className="text-sm text-muted-foreground">Gestão completa da plataforma</p>
            </div>
          </div>
          <Badge variant="default" className="bg-primary">ADMIN</Badge>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="vouchers">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Usuários</CardTitle>
                <CardDescription>Altere categorias e gerencie senhas</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                          <TableCell>
                            <Select value={p.category ?? ""} onValueChange={(v) => updateCategory(p.id, v as Profile["category"])}>
                              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="barbearia">Barbearia</SelectItem>
                                <SelectItem value="clinica">Clínica</SelectItem>
                                <SelectItem value="petshop">Petshop</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{p.credits}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => {
                              const email = prompt("Email do usuário para redefinir senha:");
                              if (email) resetPassword(email);
                            }}>
                              <KeyRound className="mr-1 h-3 w-3" /> Reset
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VOUCHERS */}
          <TabsContent value="vouchers">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Gerar Vouchers</CardTitle>
                  <CardDescription>Códigos aleatórios resgatáveis pelos usuários</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor (créditos)</Label>
                    <Input type="number" value={voucherValue} onChange={(e) => setVoucherValue(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input type="number" value={voucherQty} onChange={(e) => setVoucherQty(e.target.value)} max={50} />
                  </div>
                  <Button onClick={generateVouchers} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Gerar
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos Vouchers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 space-y-2 overflow-auto">
                    {vouchers.map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <code className="font-mono">{v.code}</code>
                          <Badge variant="outline">{v.value}</Badge>
                          {v.is_used && <Badge variant="secondary">Usado</Badge>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(v.code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {vouchers.length === 0 && <p className="text-center text-sm text-muted-foreground">Nenhum voucher</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Central de Notificações</CardTitle>
                <CardDescription>Envie mensagens para um usuário ou em massa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Destinatário</Label>
                    <Select value={notifTarget} onValueChange={setNotifTarget}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os usuários</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={notifType} onValueChange={(v) => setNotifType(v as "system" | "alert")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Sistema</SelectItem>
                        <SelectItem value="alert">Alerta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea rows={4} value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Escreva a mensagem..." />
                </div>
                <Button onClick={sendNotification}>
                  <Send className="mr-2 h-4 w-4" /> Enviar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
