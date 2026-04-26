## Visão geral

Hoje o faturamento é meio-global meio-individual: a **mensalidade base** e o **dia de fechamento** vêm de `app_settings` (valem pra todos), e só os "orçamentos extras" (`service_quotes`) são individuais. Vamos eliminar essa parte global e tornar **tudo** per-tenant: cada cliente tem o próprio dia de cobrança e a própria carteira de serviços. Também adicionamos **cobrança proporcional (prorata)** quando um serviço é aceito no meio do ciclo.

A boa notícia: a tabela `service_quotes` já é per-tenant e o fluxo "admin propõe → cliente aprova/recusa" já existe via `decide_quote()`. Vamos **estender** esse fluxo, não recriar.

## O que muda

### Banco de dados (1 migration)

1. **`tenants.billing_day` (int 1-28, default 5)** — dia de vencimento individual.
2. **`service_quotes.proration_amount` (int, nullable)** — valor prorata calculado no aceite, em centavos.
3. **`service_quotes` ganha tipo `billing_change`** (alteração de dia de cobrança) além de `recurring`/`lifetime`. Campo extra: `proposed_billing_day` (int nullable).
4. **Atualizar `decide_quote()`**: quando aceito,
   - se `billing_type IN ('recurring','lifetime')` e estamos a <30 dias do próximo vencimento → calcula prorata `(amount / 30) * dias_restantes`, grava em `proration_amount`;
   - se `billing_type = 'billing_change'` → aplica `tenants.billing_day = proposed_billing_day`.
5. **Remover** chaves globais `monthly_base_amount` e `closing_day` de `app_settings` (mantendo as de cloud-usage). A "mensalidade base" deixa de existir como conceito global — passa a ser apenas serviços recorrentes per-tenant.

### Painel Admin (`/admin`)

- **Aba "Faturamento" do Admin**: remover os inputs globais de "mensalidade base" e "dia de fechamento" (linhas 700-720 de `Admin.tsx`).
- **`UserDetailSheet`** (já existe, abre ao clicar no cliente) ganha na aba **Faturamento**:
  - Campo "Dia de cobrança" (1-28) com botão "Propor alteração" → cria um `service_quote` do tipo `billing_change` (vai pra aprovação do cliente, não aplica direto).
  - Lista de serviços ativos do cliente (já existe via `QuotesTimeline`).
  - Botão "Adicionar serviço" (já existe via `QuoteDialog`) — sem mudanças visuais grandes, só passa a mostrar uma nota: *"O cliente precisa aprovar. Se aceitar antes do vencimento, será cobrado proporcionalmente nesta fatura."*

### Painel do Cliente (`/configuracoes` aba Pagamentos)

- **`CurrentInvoiceCard`**: remover linha "Mensalidade base" (não existe mais). Total = soma dos serviços ativos + prorata do mês corrente.
- **`PendingQuoteCard`**: 
  - Para serviços normais: mostrar **preview do prorata** ("Se aceitar hoje, R$ XX,XX serão cobrados nesta fatura referente a N dias restantes").
  - Para `billing_change`: card distinto ("O administrador propôs alterar seu dia de vencimento de **5** para **15**") com Aprovar/Recusar.
- **`computeCurrentInvoice`** em `src/lib/billing.ts`: passa a incluir a `proration_amount` na fatura do mês em que o quote foi aceito (apenas no primeiro mês).

### Edge function

- `admin-actions`: remover handler de salvar `monthly_base_amount`/`closing_day` globais. Adicionar handler `propose_billing_day_change` que cria um `service_quote` tipo `billing_change`.
- Cálculo de prorata fica no `decide_quote()` (Postgres), não na edge function — atomicidade.

## Diretrizes técnicas

- **Sem novas tabelas**: reaproveitamos `service_quotes` para propostas de mudança de dia, evitando duplicação. Campo `billing_type='billing_change'` distingue.
- Prorata em centavos: `floor((amount * dias_restantes) / 30)` para evitar arredondamento pra baixo do cliente.
- Se aceito no mesmo dia do vencimento ou depois → prorata = 0 (entra cheio só no próximo ciclo).
- `billing_day` limitado a 1-28 pra evitar problemas com fevereiro.
- RLS de `service_quotes` já cobre o novo tipo (admin gerencia, owner vê).

## Fora do escopo (deixar como está)

- Geração automática de faturas mensais (`invoices`/`invoice_items`) — hoje `CurrentInvoiceCard` calcula em runtime, mantemos assim.
- Histórico de mudanças de dia de cobrança — o próprio `service_quotes` serve como log.
