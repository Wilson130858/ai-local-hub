import { useEffect, useState } from "react";
import { Shield, Loader2, Plus, Send, KeyRound, Check, X, Trash2, UserPlus, Pause, LogIn, Coins, Receipt, Settings as SettingsIcon, Save, Eye, EyeOff, RefreshCw, Copy } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCredits, parseReaisToCents } from "@/lib/utils";
import { VoucherDialog, type VoucherDialogItem } from "@/components/admin/VoucherDialog";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { CloudUsageCard } from "@/components/admin/CloudUsageCard";
import { BillingOverview } from "@/components/admin/BillingOverview";

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

function CreditsAdjustPopover({
  currentCredits,
  onApply,
}: {
  currentCredits: number;
  onApply: (delta: string, sign: 1 | -1, reason: string) => boolean | Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("10,00");
  const [reason, setReason] = useState("");
  const submit = async (sign: 1 | -1) => {
    const ok = await onApply(value, sign, reason);
    if (!ok) return;
    setOpen(false);
    setValue("10,00");
    setReason("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" title="Ajustar créditos">
          <Coins className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$)</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Motivo (opcional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8" placeholder="Ex: bônus de boas-vindas" />
        </div>
        <p className="text-xs text-muted-foreground">Saldo atual: {formatCredits(currentCredits)}</p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => submit(1)}>Adicionar</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => submit(-1)}>Remover</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

  // user detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<Profile | null>(null);

  // set password dialog
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState<Profile | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  // cloud cost settings
  const [cloudBudget, setCloudBudget] = useState("25");
  const [cloudWarning, setCloudWarning] = useState("60");
  const [cloudCritical, setCloudCritical] = useState("85");
  const [costLeads, setCostLeads] = useState("0.20");
  const [costInvocations, setCostInvocations] = useState("0.10");
  const [costStorage, setCostStorage] = useState("0.125");
  const [savingCloud, setSavingCloud] = useState(false);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    const numOr = (k: string, fb: number) => {
      const v = map.get(k);
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fb;
    };
    setCloudBudget(String(numOr("cloud_monthly_budget_usd", 25)));
    setCloudWarning(String(numOr("cloud_warning_pct", 60)));
    setCloudCritical(String(numOr("cloud_critical_pct", 85)));
    setCostLeads(String(numOr("cost_per_1k_leads", 0.2)));
    setCostInvocations(String(numOr("cost_per_1k_function_invocations", 0.1)));
    setCostStorage(String(numOr("cost_per_gb_storage_month", 0.125)));
  };

  useEffect(() => { loadSettings(); }, []);

  const saveCloudSettings = async () => {
    const parse = (s: string) => {
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const entries: Array<[string, number | null]> = [
      ["cloud_monthly_budget_usd", parse(cloudBudget)],
      ["cloud_warning_pct", parse(cloudWarning)],
      ["cloud_critical_pct", parse(cloudCritical)],
      ["cost_per_1k_leads", parse(costLeads)],
      ["cost_per_1k_function_invocations", parse(costInvocations)],
      ["cost_per_gb_storage_month", parse(costStorage)],
    ];
    if (entries.some(([, v]) => v === null)) return toast.error("Valores inválidos");
    const w = parse(cloudWarning)!;
    const c = parse(cloudCritical)!;
    if (w > 100 || c > 100) return toast.error("Percentuais devem ser 0-100");
    if (w >= c) return toast.error("Atenção deve ser menor que crítico");
    setSavingCloud(true);
    let ok = true;
    for (const [key, value] of entries) {
      const r = await callAdmin("update_setting", { key, value });
      if (!r) { ok = false; break; }
    }
    setSavingCloud(false);
    if (ok) toast.success("Limites de Cloud salvos");
  };

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
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", { body: { action, ...payload } });
      if (error) {
        toast.error(error.message || "Não foi possível concluir a ação");
        return null;
      }
      if (data && (data as { error?: string }).error) {
        toast.error((data as { error: string }).error);
        return null;
      }
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir a ação";
      toast.error(message);
      return null;
    }
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
  const openSetPassword = (p: Profile) => {
    setPwdUser(p);
    setPwdValue("");
    setPwdShow(false);
    setPwdOpen(true);
  };
  const generateRandomPwd = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    const arr = crypto.getRandomValues(new Uint8Array(14));
    setPwdValue(Array.from(arr, (b) => chars[b % chars.length]).join(""));
    setPwdShow(true);
  };
  const submitSetPassword = async () => {
    if (!pwdUser) return;
    if (pwdValue.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
    if (pwdValue.length > 128) return toast.error("Senha muito longa");
    setPwdSaving(true);
    const r = await callAdmin("set_password", { user_id: pwdUser.id, password: pwdValue });
    setPwdSaving(false);
    if (r) {
      toast.success(`Senha de ${pwdUser.full_name ?? "usuário"} atualizada`);
      setPwdOpen(false);
      setPwdUser(null);
      setPwdValue("");
    }
  };
  const impersonate = async (userId: string) => {
    const r = await callAdmin("impersonate_user", { user_id: userId });
    const link = (r as { action_link?: string } | null)?.action_link;
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
      toast.success("Abrindo conta em nova aba", {
        description: "Dica: use uma janela anônima para preservar sua sessão admin.",
      });
    }
  };
  const adjustCredits = async (userId: string, deltaReais: string, sign: 1 | -1, reason: string) => {
    const cents = parseReaisToCents(deltaReais);
    if (!cents || cents <= 0) {
      toast.error("Valor inválido");
      return false;
    }
    const profile = profiles.find((item) => item.id === userId);
    if (sign < 0 && profile && cents > profile.credits) {
      toast.error(`Saldo insuficiente. Disponível: ${formatCredits(profile.credits)}`);
      return false;
    }
    const r = await callAdmin("adjust_credits", { user_id: userId, delta: sign * cents, reason });
    if (r) {
      toast.success(sign > 0 ? "Créditos adicionados" : "Créditos removidos");
      loadData();
      return true;
    }
    return false;
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
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="users">
              Usuários
              {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="billing">Faturamento</TabsTrigger>
            <TabsTrigger value="vouchers">Créditos</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <div className="mb-6">
              <CloudUsageCard />
            </div>
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
                                <CreditsAdjustPopover
                                  currentCredits={p.credits}
                                  onApply={(v, sign, reason) => adjustCredits(p.id, v, sign, reason)}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => impersonate(p.id)}
                                  title="Acessar conta"
                                >
                                  <LogIn className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setDetailUser(p); setDetailOpen(true); }}
                                  title="Faturamento"
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openSetPassword(p)} title="Definir nova senha">
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

          {/* BILLING */}
          <TabsContent value="billing">
            <BillingOverview />
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

          {/* SETTINGS */}
          <TabsContent value="settings">
            <div className="grid gap-6">
              <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                As configurações de faturamento (dia de cobrança e serviços) agora são individuais por cliente.
                Acesse a aba "Faturamento" para a visão consolidada ou abra um cliente específico.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-4 w-4" /> Limites de Lovable Cloud
                  </CardTitle>
                  <CardDescription>Controle de gasto e alertas automáticos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Orçamento mensal (USD)</Label>
                    <Input inputMode="decimal" value={cloudBudget} onChange={(e) => setCloudBudget(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Saldo grátis padrão é US$ 25.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Atenção (%)</Label>
                      <Input inputMode="decimal" value={cloudWarning} onChange={(e) => setCloudWarning(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Crítico (%)</Label>
                      <Input inputMode="decimal" value={cloudCritical} onChange={(e) => setCloudCritical(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>USD por 1.000 leads</Label>
                    <Input inputMode="decimal" value={costLeads} onChange={(e) => setCostLeads(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>USD por 1.000 invocações de função</Label>
                    <Input inputMode="decimal" value={costInvocations} onChange={(e) => setCostInvocations(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>USD por GB·mês de storage</Label>
                    <Input inputMode="decimal" value={costStorage} onChange={(e) => setCostStorage(e.target.value)} />
                  </div>
                  <Button onClick={saveCloudSettings} disabled={savingCloud}>
                    {savingCloud ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar limites
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <VoucherDialog
          voucher={activeVoucher}
          open={voucherOpen}
          onOpenChange={setVoucherOpen}
          onChanged={loadData}
        />

        <UserDetailSheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          userId={detailUser?.id ?? null}
          userName={detailUser?.full_name ?? null}
          credits={detailUser?.credits ?? 0}
          status={detailUser?.status ?? ""}
        />

        <Dialog open={pwdOpen} onOpenChange={(v) => { if (!pwdSaving) setPwdOpen(v); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Definir nova senha
              </DialogTitle>
              <DialogDescription>
                {pwdUser?.full_name ?? "Usuário"} terá a senha redefinida imediatamente. Compartilhe com segurança.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="admin-new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="admin-new-password"
                    type={pwdShow ? "text" : "password"}
                    value={pwdValue}
                    onChange={(e) => setPwdValue(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="pr-20 font-mono"
                    disabled={pwdSaving}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setPwdShow((v) => !v)}
                      title={pwdShow ? "Ocultar" : "Mostrar"}
                    >
                      {pwdShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (!pwdValue) return;
                        navigator.clipboard.writeText(pwdValue);
                        toast.success("Senha copiada");
                      }}
                      disabled={!pwdValue}
                      title="Copiar"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateRandomPwd}
                disabled={pwdSaving}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Gerar senha aleatória
              </Button>
              {pwdValue.length > 0 && (() => {
                const pwd = pwdValue;
                let score = 0;
                if (pwd.length >= 8) score++;
                if (pwd.length >= 12) score++;
                if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
                if (/\d/.test(pwd)) score++;
                if (/[^A-Za-z0-9]/.test(pwd)) score++;
                const common = /^(?:123456|senha|password|qwerty|admin|111111|123123|abc123)/i.test(pwd);
                if (common) score = Math.min(score, 1);
                const levels = [
                  { label: "Muito fraca", color: "bg-destructive", width: "20%" },
                  { label: "Fraca", color: "bg-destructive", width: "40%" },
                  { label: "Razoável", color: "bg-yellow-500", width: "60%" },
                  { label: "Boa", color: "bg-yellow-500", width: "80%" },
                  { label: "Forte", color: "bg-green-500", width: "100%" },
                ];
                const lvl = levels[Math.max(0, Math.min(4, score - 1))] ?? levels[0];
                return (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${lvl.color} transition-all`} style={{ width: lvl.width }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Força: <span className="font-medium text-foreground">{lvl.label}</span>
                      {score < 4 && " — recomendado: 12+ caracteres com maiúsculas, números e símbolos."}
                    </p>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPwdOpen(false)} disabled={pwdSaving}>
                Cancelar
              </Button>
              <Button onClick={submitSetPassword} disabled={pwdSaving || pwdValue.length < 6}>
                {pwdSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar nova senha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
