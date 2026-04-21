

# Sistema de Faturamento e Orçamentos

Vou implementar o ciclo completo: admin cria orçamentos → cliente aprova/recusa → fatura mensal acumula valores aceitos no dia de fechamento.

## 1. Modelagem de Dados (migrations)

**Nova tabela `service_quotes`** (orçamentos enviados pelo admin)
- `id`, `tenant_id`, `created_by` (admin), `name`, `description`, `amount` (cents), `billing_type` (`recurring` | `lifetime`), `recurrence_months` (nullable), `status` (`pending` | `accepted` | `declined`), `monthly_base_amount` (snapshot da mensalidade base na criação? não — fica em config global), `decided_at`, `created_at`.
- Index em `(tenant_id, status)`.

**Nova tabela `invoices`** (fatura mensal por tenant)
- `id`, `tenant_id`, `period_start`, `period_end`, `due_date`, `base_amount`, `extras_amount`, `total_amount`, `status` (`open` | `closed` | `paid`), `closed_at`, `created_at`.
- Unique `(tenant_id, period_start)`.

**Nova tabela `invoice_items`** (linhas da fatura)
- `id`, `invoice_id`, `quote_id` (nullable, p/ base), `description`, `amount`, `kind` (`base` | `quote_recurring` | `quote_lifetime`).

**Nova tabela `app_settings`** (chave-valor global)
- `key` (PK), `value` (jsonb), `updated_at`, `updated_by`.
- Seed inicial: `monthly_base_amount` (cents), `invoice_closing_day` (1-28).

**RLS**:
- `service_quotes`: tenant owner SELECT/UPDATE (apenas status pending→accepted/declined); admin ALL.
- `invoices` / `invoice_items`: tenant owner SELECT; admin ALL.
- `app_settings`: admin ALL; authenticated SELECT (read-only para mostrar valor base ao cliente).

**Função RPC `decide_quote(_quote_id uuid, _decision text)`** (security definer)
- Valida que caller é dono do tenant do quote.
- Atualiza status, registra `decided_at`.
- Cria notificação para o admin criador.
- Retorna `{ success, status }`.

## 2. Edge Function `admin-actions` — novas actions

- **`create_quote`**: insere em `service_quotes`, cria notificação para o tenant owner (“Novo orçamento: {name} - R$X”), audit log.
- **`update_setting`**: upsert em `app_settings` (apenas `monthly_base_amount` e `invoice_closing_day`), audit log.
- **`close_invoice_period`** (manual por enquanto, cron depois): para cada tenant, calcula período corrente, soma base + quotes aceitos no período (recurring ainda dentro dos meses contratados + lifetime do mês), gera `invoice` + `invoice_items`, fecha.

## 3. UI — Cliente (`src/pages/Configuracoes.tsx` aba Pagamento)

Reorganizar a aba “Pagamento” em três blocos:

**Bloco A — Fatura Atual** (Card destacado)
- Próximo vencimento (calculado a partir de `invoice_closing_day`).
- Linha: `Mensalidade base ............. R$ X`
- Linha por quote aceito ativo no período: `{name} ............. R$ Y`
- Total em destaque.
- Cálculo client-side a partir de `app_settings` + quotes accepted do tenant.

**Bloco B — Orçamentos Pendentes** (grid de cards)
- Cada card: nome, descrição, valor formatado, badge do tipo (Recorrência X meses / Vitalício).
- Dois botões: **Aceitar e Adicionar à Fatura** (`bg-success`) e **Recusar** (`variant="destructive"`).
- Ao aceitar: chama `decide_quote`, toast de confirmação com ícone Sparkles, atualiza fatura em tempo real (refetch + animação no total).
- Ao recusar: confirm dialog leve, depois `decide_quote`.
- Empty state amigável quando não há pendentes.

**Bloco C — Histórico de Faturas** (mantém o card existente, mas trocando mock por `invoices` reais quando existirem; fallback ao mock se vazio).

## 4. UI — Admin (`src/pages/Admin.tsx`)

**Nova sub-aba dentro de “Usuários”**: ao clicar num usuário, abre **Sheet/Dialog “Perfil do Cliente”** com tabs internas:
- **Resumo** (dados atuais — créditos, status).
- **Faturamento** (nova).

**Aba Faturamento contém**:
- Botão **“+ Adicionar Serviço/Orçamento”** → Dialog (`QuoteDialog`):
  - Nome (input), Descrição (textarea), Valor R$ (input mask), Tipo (RadioGroup: Recorrência | Vitalício).
  - Se Recorrência: campo numérico “Quantidade de meses” (1-60).
  - Submit chama edge function `create_quote`.
- **Timeline de orçamentos** (lista cronológica):
  - Card por quote: nome, valor, tipo, data de envio, **Badge** colorida:
    - Pendente → `secondary` (amarelo via classe custom)
    - Aceito → `default` com classe `bg-success`
    - Recusado → `destructive`
  - Mostra `decided_at` quando aplicável.

**Nova aba “Configurações” no Admin** (top-level):
- Input numérico **“Dia de fechamento da fatura”** (1-28).
- Input monetário **“Mensalidade base padrão”** (R$).
- Botão Salvar → `update_setting`.

## 5. Componentes novos

- `src/components/admin/QuoteDialog.tsx` — modal de criação.
- `src/components/admin/UserDetailSheet.tsx` — sheet com tabs Resumo/Faturamento.
- `src/components/admin/QuotesTimeline.tsx` — lista de quotes do tenant.
- `src/components/billing/PendingQuoteCard.tsx` — card de aprovação para o cliente.
- `src/components/billing/CurrentInvoiceCard.tsx` — card de fatura atual.
- `src/lib/billing.ts` — helpers: `computeNextDueDate(closingDay)`, `computeCurrentInvoice(base, quotes, period)`, formatters.

## 6. Realtime

- Habilitar realtime em `service_quotes` para que o cliente veja novos orçamentos chegarem sem refresh.
- Habilitar realtime em `notifications` (já existe? verificar).

## 7. Fora do escopo desta fatia (deixo registrado)

- Cobrança automática (Stripe) — plugar depois.
- Cron job para fechar faturas mensalmente (por enquanto botão manual no admin).
- PDF da fatura.

## Arquivos afetados

**Migrations** (novas):
- Criar `service_quotes`, `invoices`, `invoice_items`, `app_settings` com RLS + seed + função `decide_quote`.

**Edge function**:
- `supabase/functions/admin-actions/index.ts` — actions `create_quote`, `update_setting`, `close_invoice_period`.

**Frontend novos**:
- `src/components/admin/QuoteDialog.tsx`
- `src/components/admin/UserDetailSheet.tsx`
- `src/components/admin/QuotesTimeline.tsx`
- `src/components/billing/PendingQuoteCard.tsx`
- `src/components/billing/CurrentInvoiceCard.tsx`
- `src/lib/billing.ts`

**Frontend editados**:
- `src/pages/Configuracoes.tsx` — refactor aba Pagamento.
- `src/pages/Admin.tsx` — nova aba Configurações + integração com UserDetailSheet.

## Notas de design

- Mantém paleta HSL atual (success/destructive já existem em `index.css`).
- Cards com `shadow-soft` e `border-border/60` (padrão do projeto).
- Valores em centavos no banco, formatados via `formatCredits`/novo `formatBRL`.
- Badges seguem variantes shadcn + classes utilitárias do success.
- Mobile: timeline e cards em coluna única, botões full-width abaixo de `sm`.

