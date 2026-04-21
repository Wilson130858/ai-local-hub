import { useEffect, useState } from "react";
import { Shield, Loader2, Plus, Send, KeyRound, Check, X, Trash2, UserPlus, Pause } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCredits, parseReaisToCents } from "@/lib/utils";
import { VoucherDialog, type VoucherDialogItem } from "@/components/admin/VoucherDialog";

type ProfileStatus = "pending" | "approved" | "rejected";
type Profile = {
  id: string;
  full_name: string | null;
  category: string | null;
  credits: number;
  status: ProfileStatus;
  created_at: string;
};

type Voucher = {
  id: string;
  code: string;
  value: number;
  is_used: boolean;
  is_paused: boolean;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
};

export default function Admin() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // voucher form
  const [voucherValue, setVoucherValue] = useState("100,00");
  const [voucherQty, setVoucherQty] = useState("1");
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState("1");

  // notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

  // voucher modal
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<VoucherDialogItem | null>(null);

  // create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: vData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, category, credits, status, created_at").order("created_at", { ascending: false }),
      supabase.from("credit_vouchers").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setProfiles((pData ?? []) as Profile[]);
    setVouchers((vData ?? []) as Voucher[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body: { action, ...payload } });
    if (error) {
      toast.error(error.message);
      return null;
    }
    if (data && (data as { error?: string }).error) {
      toast.error((data as { error: string }).error);
      return null;
    }
    return data;
  };

  const updateCategory = async (userId: string, category: string) => {
    const { error } = await supabase.from("profiles").update({ category: category || null } as never).eq("id", userId);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action: "update_category", target_user_id: userId, details: { category } });
    toast.success("Categoria atualizada");
  };

  const approveUser = async (userId: string) => {
    const r = await callAdmin("approve_user", { user_id: userId });
    if (r) { toast.success("Usuário aprovado"); loadData(); }
  };
  const rejectUser = async (userId: string) => {
    const r = await callAdmin("reject_user", { user_id: userId });
    if (r) { toast.success("Usuário rejeitado"); loadData(); }
  };
  const deleteUser = async (userId: string) => {
    const r = await callAdmin("delete_user", { user_id: userId });
    if (r) { toast.success("Usuário excluído"); loadData(); }
  };
  const resetPassword = async (email: string) => {
    const r = await callAdmin("reset_password", { email });
    if (r) toast.success(`Email de redefinição enviado para ${email}`);
  };
  const createUser = async () => {
    if (!newEmail || !newPassword) return toast.error("Email e senha obrigatórios");
    const r = await callAdmin("create_user", { email: newEmail, password: newPassword, full_name: newName });
    if (r) {
      toast.success("Usuário criado e aprovado");
      setCreateOpen(false);
      setNewEmail(""); setNewPassword(""); setNewName("");
      loadData();
    }
  };

  const generateVouchers = async () => {
    const cents = parseReaisToCents(voucherValue);
    const qty = parseInt(voucherQty);
    if (!cents || cents <= 0 || !qty || qty > 50) return toast.error("Valor ou quantidade inválidos (máx 50)");
    let max: number | null = null;
    if (limitUses) {
      max = parseInt(maxUses);
      if (!max || max < 1) return toast.error("Quantidade de usos inválida");
    }

    const randomCode = () => {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").substring(0, 8).toUpperCase();
    };
    const codes = Array.from({ length: qty }, randomCode);
    const rows = codes.map((code) => ({ code, value: cents, max_uses: max, created_by: user!.id }));
    const { error } = await supabase.from("credit_vouchers").insert(rows);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({ admin_id: user!.id, action: "generate_vouchers", details: { quantity: qty, value_cents: cents, max_uses: max } });
    toast.success(`${qty} voucher(s) gerados`);
    loadData();
  };

  const sendNotification = async () => {
    if (!notifTitle.trim()) return toast.error("Título obrigatório");
    if (!notifMsg.trim()) return toast.error("Mensagem vazia");
    if (selectedRecipients.size === 0) return toast.error("Selecione ao menos um destinatário");
    const rows = Array.from(selectedRecipients).map((tid) => ({
      target_user_id: tid,
      title: notifTitle,
      message: notifMsg,
      created_by: user!.id,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Notificação enviada para ${rows.length} usuário(s)`);
    setNotifTitle("");
    setNotifMsg("");
    setSelectedRecipients(new Set());
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllRecipients = () => {
    setSelectedRecipients((prev) =>
      prev.size === profiles.length ? new Set() : new Set(profiles.map((p) => p.id))
    );
  };
  const openVoucher = (v: Voucher) => {
    setActiveVoucher(v as VoucherDialogItem);
    setVoucherOpen(true);
  };

  const filtered = profiles.filter((p) => filter === "all" ? true : p.status === filter);
  const pendingCount = profiles.filter((p) => p.status === "pending").length;

  const statusBadge = (s: ProfileStatus) => {
    if (s === "approved") return <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Aprovado</Badge>;
    if (s === "pending") return <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Pendente</Badge>;
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Rejeitado</Badge>;
  };

  return (
    <DashboardLayout title="Administração">
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
            <TabsTrigger value="users">
              Usuários
              {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="vouchers">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Gestão de Usuários</CardTitle>
                  <CardDescription>Aprove cadastros, edite categorias e gerencie senhas</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                    <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="approved">Aprovados</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><UserPlus className="mr-1 h-4 w-4" /> Novo</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar usuário</DialogTitle>
                        <DialogDescription>O usuário será criado já aprovado.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2"><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Senha temporária</Label><Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={createUser}>Criar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Créditos</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                            <TableCell>{statusBadge(p.status)}</TableCell>
                            <TableCell>
                              <Input
                                defaultValue={p.category ?? ""}
                                placeholder="Ex: Barbearia"
                                className="h-8 w-40"
                                onBlur={(e) => {
                                  if ((e.target.value || "") !== (p.category ?? "")) updateCategory(p.id, e.target.value);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{formatCredits(p.credits)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {p.status === "pending" && (
                                  <>
                                    <Button size="sm" variant="ghost" className="text-success" onClick={() => approveUser(p.id)} title="Aprovar">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => rejectUser(p.id)} title="Rejeitar">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => {
                                  const email = prompt("Email do usuário para redefinir senha:");
                                  if (email) resetPassword(email);
                                }} title="Reset senha">
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="text-destructive" title="Excluir">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação remove permanentemente {p.full_name ?? "este usuário"} e todos os seus dados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteUser(p.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filtered.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum usuário</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
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
                  <CardDescription>Códigos resgatáveis pelos clientes (em R$)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="text" inputMode="decimal" value={voucherValue} onChange={(e) => setVoucherValue(e.target.value)} placeholder="100,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de códigos</Label>
                    <Input type="number" value={voucherQty} onChange={(e) => setVoucherQty(e.target.value)} max={50} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="limit" checked={limitUses} onCheckedChange={(v) => setLimitUses(!!v)} />
                    <Label htmlFor="limit" className="text-sm font-normal cursor-pointer">Limitar uso</Label>
                  </div>
                  {limitUses && (
                    <div className="space-y-2">
                      <Label>Quantidade máxima de usos por código</Label>
                      <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Cada usuário só pode resgatar o mesmo código uma vez.</p>
                    </div>
                  )}
                  <Button onClick={generateVouchers} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Gerar
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos Vouchers</CardTitle>
                  <CardDescription>Clique em um voucher para ver detalhes e histórico</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 space-y-2 overflow-auto">
                    {vouchers.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => openVoucher(v)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-2 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="font-mono">{v.code}</code>
                          <Badge variant="outline">{formatCredits(v.value)}</Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {v.uses_count}/{v.max_uses ?? "∞"}
                          </Badge>
                          {v.is_paused && (
                            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
                              <Pause className="mr-1 h-2.5 w-2.5" /> Pausado
                            </Badge>
                          )}
                          {v.is_used && <Badge variant="outline" className="text-[10px]">Esgotado</Badge>}
                        </div>
                      </button>
                    ))}
                    {vouchers.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhum voucher</p>}
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
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Título da notificação" />
                </div>
                <div className="space-y-2">
                  <Label>Texto</Label>
                  <Textarea rows={4} value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Escreva a mensagem..." />
                </div>
                <div className="space-y-2">
                  <Label>Destinatários ({selectedRecipients.size}/{profiles.length})</Label>
                  <div className="rounded-md border border-border">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                      <Checkbox
                        id="notif-all"
                        checked={profiles.length > 0 && selectedRecipients.size === profiles.length}
                        onCheckedChange={toggleAllRecipients}
                      />
                      <Label htmlFor="notif-all" className="cursor-pointer text-sm font-medium">
                        Selecionar todos
                      </Label>
                    </div>
                    <div className="max-h-72 overflow-auto">
                      {profiles.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum usuário</p>
                      ) : (
                        profiles.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0">
                            <Checkbox
                              id={`notif-${p.id}`}
                              checked={selectedRecipients.has(p.id)}
                              onCheckedChange={() => toggleRecipient(p.id)}
                            />
                            <Label htmlFor={`notif-${p.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                              {p.full_name ?? p.id.slice(0, 8)}
                            </Label>
                            {statusBadge(p.status)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <Button onClick={sendNotification} disabled={selectedRecipients.size === 0}>
                  <Send className="mr-2 h-4 w-4" /> Enviar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <VoucherDialog
          voucher={activeVoucher}
          open={voucherOpen}
          onOpenChange={setVoucherOpen}
          onChanged={loadData}
        />
      </div>
    </DashboardLayout>
  );
}
