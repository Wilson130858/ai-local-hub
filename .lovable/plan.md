
# Monitoramento de custo Lovable Cloud no painel Admin

Adicionar visibilidade do consumo da plataforma para você antecipar quando o saldo grátis de US$ 25/mês está perto de estourar, com limites configuráveis e notificação automática.

## O que será construído

### 1. Configurações (aba Configurações do Admin)

Três novos campos editáveis (salvos em `app_settings`):

- **Saldo mensal de Cloud (USD)** — padrão `25` (o saldo grátis).
- **Limite de atenção (% do saldo)** — padrão `60`. Pinta o card de amarelo quando o gasto projetado passar disso.
- **Limite crítico (% do saldo)** — padrão `85`. Pinta de vermelho e dispara notificação.

### 2. Card "Consumo Lovable Cloud" no painel Admin

Card destacado no topo da aba "Visão Geral" do `/admin` mostrando, **da plataforma inteira**:

- **Gasto estimado do mês corrente em USD** (com barra de progresso colorida vs limite).
- **Projeção para o fim do mês** (extrapolação linear do ritmo atual).
- **Breakdown** por tipo de uso:
  - Leads ingeridos no mês (volume × custo unitário estimado).
  - Invocações de edge function (admin-actions + ingest-lead).
  - Linhas em tabelas de alto crescimento (`leads`, `notifications`, `audit_logs`).
- **Status visual**: verde (ok) / amarelo (atenção) / vermelho (crítico).
- Botão **"Ver detalhes"** abrindo um Sheet com gráfico de leads/dia dos últimos 30 dias.

### 3. Notificação automática quando estourar limite

Quando a projeção mensal cruza o limite de atenção ou crítico **pela primeira vez no mês**:

- Cria uma `notification` para todos os admins com título tipo "Atenção: consumo Cloud em 62% do saldo" e mensagem com a projeção.
- Marca em `app_settings` que o aviso daquele nível já foi disparado naquele mês (evita spam).
- Reseta no início de cada mês.

A verificação roda a cada hora via cron (`pg_cron` + `pg_net`) chamando uma nova edge function `cloud-usage-check`.

## Como o cálculo de custo funciona

Não temos acesso direto à API de billing do Lovable Cloud, então usamos uma **estimativa baseada em uso observável** com coeficientes configuráveis:

- `cost_per_1k_leads` (USD) — padrão `0.20`
- `cost_per_1k_function_invocations` (USD) — padrão `0.10`
- `cost_per_gb_storage_month` (USD) — padrão `0.125`

Tudo armazenado em `app_settings` e editável pelo admin pra você calibrar conforme o gasto real for aparecendo no Lovable. A estimativa é claramente rotulada como "estimada" na UI.

## Detalhes técnicos

**Migration (schema)**: nenhuma tabela nova — só seeds em `app_settings` para as chaves novas:
- `cloud_monthly_budget_usd`, `cloud_warning_pct`, `cloud_critical_pct`
- `cost_per_1k_leads`, `cost_per_1k_function_invocations`, `cost_per_gb_storage_month`
- `cloud_alert_state` (jsonb com `{month, warning_sent, critical_sent}`)

**Edge function nova**: `supabase/functions/cloud-usage-check/index.ts`
- Conta `leads` do mês, invocações via `function_edge_logs` (analytics), tamanho aproximado das tabelas via `pg_total_relation_size`.
- Calcula custo estimado e projeção.
- Compara com limites e dispara notificações para todos admins se cruzou um nível novo.
- Atualiza `cloud_alert_state`.

**Cron job** (via insert tool, não migração — contém URL/anon key):
- `cloud_usage_hourly_check` rodando de hora em hora.

**Frontend novo**:
- `src/components/admin/CloudUsageCard.tsx` — card principal.
- `src/components/admin/CloudUsageDetailSheet.tsx` — gráfico e breakdown detalhado.
- `src/lib/cloud-usage.ts` — funções de cálculo (custo estimado, projeção mensal, helpers de formatação USD).

**Frontend editado**:
- `src/pages/Admin.tsx` — montar o `CloudUsageCard` no topo da aba Visão Geral; adicionar os 6 novos campos na aba Configurações.

**RLS**: tudo usa `is_admin()` que já existe — só admins veem o card e editam os limites.

## Fora do escopo

- Integração real com a API de billing do Lovable (não é exposta).
- Bloqueio automático de ingest quando estourar (só alerta — você decide o que fazer).
- Histórico mensal persistido (mostramos só o mês corrente; histórico fica para depois se quiser).
