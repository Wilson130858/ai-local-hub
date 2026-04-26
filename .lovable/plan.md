## Objetivo

1. **Fechamento automático** de faturas no dia de cobrança de cada cliente — materializa os itens, fecha o ciclo, abre a próxima e notifica o cliente.
2. **Histórico de faturas** acessível pelo cliente, com itens detalhados e status (aberta / fechada / paga / atrasada).

---

## 1. Fechamento automático (cron diário)

### Regra de negócio
Para cada tenant, todo dia às 03:00 (horário de São Paulo), o sistema verifica se hoje é o `billing_day` daquele tenant. Se for:

- Localiza a invoice `open` do tenant (ou cria uma se não existir).
- Materializa `invoice_items` a partir dos `service_quotes` aceitos ativos no período (mesma lógica já usada em `computeCurrentInvoice`):
  - Mês de aceite com `proration_amount > 0` → item proporcional.
  - Demais casos → valor cheio.
- Calcula `base_amount`, `extras_amount`, `total_amount`.
- Marca a invoice como `closed`, define `closed_at = now()`.
- Cria a próxima invoice `open` com `period_start = hoje`, `period_end = próximo billing_day - 1`, `due_date = próximo billing_day`.
- Insere notificação para o dono do tenant: "Sua fatura de R$ X foi fechada e vence em DD/MM".

Idempotência: se já existe invoice `closed` cobrindo o `period_end = ontem` para o tenant, pula. Evita cobrança duplicada caso o cron rode duas vezes.

### Status "atrasada" (overdue)
Não é necessário um novo valor de enum — é derivado: invoice com `status = 'closed'` e `due_date < hoje` é apresentada como "Atrasada" na UI. A mesma rotina diária pode disparar uma notificação quando a invoice ultrapassa o vencimento (ex.: 1 dia, 7 dias).

### Implementação técnica
- Nova edge function **`close-invoices`** (sem JWT, validada por header `x-cron-secret`).
- Habilitar `pg_cron` + `pg_net` e agendar via SQL (ferramenta `insert`, não migration — contém a anon key e o secret).
- Schedule: `0 6 * * *` UTC (= 03:00 BRT).
- Migration: índice `(tenant_id, status)` em `invoices` para a busca da invoice aberta + novo secret `CRON_SECRET`.

### Trigger manual (admin)
Botão "Fechar fatura agora" no `UserDetailSheet` aba Faturamento, que chama a mesma função com `tenant_id` específico. Útil para testes e correções pontuais.

---

## 2. Histórico de faturas (cliente)

### UI
Nova rota **`/faturas`** acessível pelo menu lateral (entre Leads e Configurações), apenas para usuários `approved`.

Layout:
```text
┌──────────────────────────────────────────────────┐
│ Fatura atual (CurrentInvoiceCard já existente)   │
├──────────────────────────────────────────────────┤
│ Histórico                                        │
│ ┌──────────────────────────────────────────────┐ │
│ │ Período   Vencimento  Total    Status   →   │ │
│ │ Mar/26    05/04       R$ 240   Paga     →   │ │
│ │ Fev/26    05/03       R$ 240   Paga     →   │ │
│ │ Jan/26    05/02       R$ 180   Atrasada →   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Clicar numa linha abre um Sheet com:
- Cabeçalho (período, vencimento, status, total)
- Lista de `invoice_items` (descrição + valor + tipo)
- Botão "Baixar comprovante" (gera PDF simples client-side — opcional nesta fase, ou já implementado com `window.print()` numa view dedicada).

### Status renderizados
- `open` → "Aberta" (azul)
- `closed` + `due_date >= hoje` → "A vencer" (amarelo)
- `closed` + `due_date < hoje` → "Atrasada" (vermelho)
- `paid` → "Paga" (verde)

### Componentes novos
- `src/pages/Faturas.tsx`
- `src/components/billing/InvoiceHistoryTable.tsx`
- `src/components/billing/InvoiceDetailSheet.tsx`
- Helper `getInvoiceDisplayStatus(invoice)` em `src/lib/billing.ts`.

### Visão admin
Adicionar a mesma listagem de invoices (filtrada pelo tenant) na aba Faturamento do `UserDetailSheet`, abaixo da fatura atual. Permite ao admin ver o histórico de qualquer cliente e marcar manualmente como "paga" (botão que chama `admin-actions` com nova action `mark_invoice_paid`).

---

## Mudanças resumidas

**Banco (migration):**
- Índice `idx_invoices_tenant_status` em `invoices(tenant_id, status)`.

**Banco (insert tool — contém secrets):**
- Habilitar `pg_cron`, `pg_net`.
- Agendar `cron.schedule('close-invoices-daily', '0 6 * * *', ...)`.

**Secrets:**
- `CRON_SECRET` (gerado e salvo via `add_secret`).

**Edge functions:**
- `close-invoices/index.ts` (nova) — fecha faturas e notifica.
- `admin-actions/index.ts` — adicionar action `mark_invoice_paid` e `close_invoice_now`.

**Frontend:**
- `src/pages/Faturas.tsx` (nova rota).
- `src/components/billing/InvoiceHistoryTable.tsx`, `InvoiceDetailSheet.tsx` (novos).
- `src/lib/billing.ts` — helper `getInvoiceDisplayStatus`.
- `src/App.tsx` — registrar rota `/faturas`.
- `src/components/AppSidebar.tsx` — link "Faturas".
- `src/components/admin/UserDetailSheet.tsx` — bloco de histórico + botões "Fechar agora" e "Marcar paga".

---

## Notas e limites desta etapa

- Cobrança real (cartão/PIX/boleto) **não entra agora** — o fluxo termina em "fatura fechada e visível ao cliente". A integração Stripe é a etapa seguinte e usará o evento de fatura fechada como gatilho natural.
- O cálculo de itens segue a mesma lógica já validada em `computeCurrentInvoice`, então não muda o que o cliente já vê hoje — apenas persiste no banco quando o ciclo fecha.
- Idempotência forte garante que rodar o cron várias vezes (ou clicar manualmente) não duplica faturas.
