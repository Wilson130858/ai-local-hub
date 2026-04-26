## Objetivo

Adicionar uma aba **"Faturamento"** dedicada no painel `/admin`, ao lado de Usuários, Créditos, Notificações e Configurações, centralizando toda a gestão financeira por cliente sem precisar abrir o sheet lateral de cada usuário.

## O que a nova aba terá

**1. Visão geral (cards no topo)**
- Receita prevista do mês (soma de todos os serviços ativos + prorratas).
- Quantidade de propostas pendentes de aprovação.
- Quantidade de clientes com dia de cobrança nos próximos 7 dias.

**2. Tabela "Clientes & Faturamento"**
Lista todos os tenants com colunas:
- Cliente (nome do negócio + dono).
- Dia de cobrança atual.
- Serviços ativos (contagem + total mensal).
- Status (em dia, proposta pendente, prorrata no mês).
- Ações: **Gerenciar** (abre o `UserDetailSheet` já direto na aba "Faturamento") e **+ Serviço** (atalho que abre o `QuoteDialog` direto).

**3. Tabela "Propostas pendentes" (global)**
Lista todos os `service_quotes` com `status = pending` de qualquer cliente, mostrando: cliente, nome do serviço, valor, tipo (recorrente/único/mudança de dia), data de envio. Permite ao admin acompanhar o que está aguardando aprovação sem precisar entrar cliente por cliente.

**4. Filtros**
- Busca por nome de cliente.
- Filtro por status (todos / com pendência / sem serviços / com prorrata ativa).

## Mudanças nos arquivos

**`src/pages/Admin.tsx`**
- Adicionar `<TabsTrigger value="billing">Faturamento</TabsTrigger>` entre "Usuários" e "Créditos".
- Criar `<TabsContent value="billing">` renderizando o novo componente `BillingOverview`.
- Manter o ícone `Receipt` na linha do usuário (atalho rápido) — não remover.
- Atualizar o aviso na aba "Configurações" para apontar para a nova aba "Faturamento" em vez da aba "Usuários".

**`src/components/admin/BillingOverview.tsx` (novo)**
- Carrega `tenants` (com `billing_day`, `business_name`, `owner_id`) + join com `profiles` para nome do dono.
- Carrega todos os `service_quotes` para calcular agregados por tenant (serviços ativos via `isQuoteActiveInPeriod`, total mensal, prorratas do mês corrente).
- Renderiza cards de resumo, tabela de clientes e tabela de propostas pendentes globais.
- Reaproveita `UserDetailSheet` (com prop opcional `defaultTab="billing"`) e `QuoteDialog` para as ações.

**`src/components/admin/UserDetailSheet.tsx`**
- Adicionar prop opcional `defaultTab?: "summary" | "billing"` (default `"summary"`) e passar ao `<Tabs defaultValue={defaultTab}>`.

## Não faz parte deste plano
- Mudar a lógica de cálculo de prorrata ou a estrutura do banco — tudo já está pronto em `src/lib/billing.ts` e nas migrações.
- Mexer na visão do cliente (`/configuracoes`).
