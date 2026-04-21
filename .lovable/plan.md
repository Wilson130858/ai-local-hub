
# Slice 2: Impersonation + Gestão de Créditos

## O que será entregue

### 1. Impersonation ("Acessar Conta")
- Botão **"Acessar conta"** na linha de cada usuário no painel admin.
- Ao clicar, o admin gera um **magic link** do usuário-alvo e abre em **nova aba**, ficando logado como aquele usuário.
- A sessão original do admin permanece intacta na aba atual.
- Toda impersonation é registrada em `audit_logs` com ação `impersonate_user`.

### 2. Gestão Manual de Créditos
- Novos controles na linha de cada usuário: campo numérico + botões **"Adicionar"** e **"Remover"** créditos.
- Campo opcional de **motivo** (registrado no audit log).
- Validações: valor > 0, créditos não podem ficar negativos.
- Cria notificação automática para o usuário informando o ajuste.
- Tudo registrado em `audit_logs` com ação `adjust_credits` e detalhes (delta, motivo, saldo antes/depois).

## Implementação técnica

### Edge Function `admin-actions` — duas novas actions

**`impersonate_user`**
- Input: `{ action: "impersonate_user", user_id }`
- Busca email do usuário via `admin.auth.admin.getUserById(user_id)`.
- Gera magic link com `admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: origin + "/" } })`.
- Retorna `{ action_link }` para o frontend abrir em nova aba.
- Audit: `impersonate_user`, target_user_id.

**`adjust_credits`**
- Input: `{ action: "adjust_credits", user_id, delta: number, reason?: string }`
- Lê saldo atual da `profiles`.
- Valida: `saldo + delta >= 0`.
- Atualiza `profiles.credits` (service role bypassa RLS).
- Insere notificação: "Seus créditos foram ajustados em {delta}. Motivo: {reason}".
- Audit: `adjust_credits` com `{ delta, reason, before, after }`.

### Frontend — `src/pages/Admin.tsx`
Na tabela de usuários, adicionar coluna **Ações** com:
- Input numérico (delta) + select +/− + botão "Aplicar" + input de motivo (popover).
- Botão "Acessar conta" (ícone `LogIn`) → chama edge function → `window.open(action_link, "_blank")`.
- Toast de sucesso/erro em ambos.

## Arquivos afetados
- **Edited**: `supabase/functions/admin-actions/index.ts` (2 novas actions)
- **Edited**: `src/pages/Admin.tsx` (UI de créditos + impersonation por linha)

## Notas importantes
- **Sessão isolada**: o magic link abre nova aba; no mesmo browser, a aba nova substitui a sessão atual do Supabase (storage compartilhado). Recomendo abrir em **janela anônima** se quiser preservar a sessão admin — vou adicionar essa dica no toast.
- **Sem schema change** nesta fatia: tudo via service role + tabelas existentes.
- **Segurança**: ambas actions exigem caller admin (já validado no início da edge function).
