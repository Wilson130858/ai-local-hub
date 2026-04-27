## Objetivo
Transformar o Dashboard (`/`) em um painel 100% personalizável, onde o usuário escolhe quais métricas (cards de estatística) aparecem, organizadas em três categorias: Financeiro, Atendimento (IA) e Agenda. As preferências ficam salvas no banco (tabela `tenants`, nova coluna `dashboard_config`).

Hoje o Dashboard já tem um popover "Personalizar" que liga/desliga 4 widgets fixos (métricas, gráfico, bot, insights) salvos em `profiles.dashboard_widgets`. Vou substituir essa lógica por um sistema mais rico baseado em métricas atômicas, mantendo o gráfico, bot e insights como seções extras (também controláveis).

## O que vai mudar

### 1. Banco de dados
- Migration adicionando coluna `dashboard_config jsonb NOT NULL DEFAULT` na tabela `tenants`, com formato:
  ```json
  { "metrics": ["faturamento_dia", "leads_gerados", "agendamentos_hoje", "ticket_medio"] }
  ```
- Default já vem com 4 métricas selecionadas para uma primeira experiência boa.
- Sem alteração de RLS — políticas atuais de `tenants` já permitem o owner ler/atualizar.

### 2. Catálogo de métricas (novo arquivo `src/lib/dashboard-metrics.ts`)
Um catálogo central com chave, label, ícone Lucide, categoria e valor mock (até integrarmos dados reais):

- **Financeiro**: Faturamento do Dia, Ticket Médio, Inadimplência, Receita do Mês
- **Atendimento (IA)**: Leads Gerados, Tempo de Resposta, Taxa de Conversão do Bot, Mensagens Hoje
- **Agenda**: Agendamentos Hoje, Cancelamentos, Taxa de Ocupação, Próximo Horário Livre

Cada métrica retorna `{ key, label, category, icon, value, trend, trendUp }`.

### 3. Componentes novos
- `src/components/dashboard/CustomizeSheet.tsx` — `Sheet` lateral (shadcn) com:
  - Header "Personalizar Painel" + descrição
  - Lista agrupada por categoria com `Switch` por métrica
  - Contador "X de Y métricas ativas"
  - Botão "Restaurar padrão"
  - Salva no Supabase ao fechar (ou em tempo real, com debounce)
- `src/components/dashboard/MetricsGrid.tsx` — grid responsivo (1/2/3/4 colunas) que renderiza os `MetricCard` selecionados, com animação de entrada/saída via `framer-motion` (`AnimatePresence` + `motion.div` com `layout`).
- `src/components/dashboard/EmptyDashboard.tsx` — empty state ilustrado quando nenhuma métrica está ativa, com CTA "Personalizar Painel" que abre o Sheet.

### 4. Refatoração de `src/pages/Index.tsx`
- Carrega `dashboard_config.metrics` do tenant do usuário logado (via `tenants.owner_id = auth.uid()`).
- Substitui o `Popover` atual pelo botão "Personalizar Painel" (ícone `Settings`) que abre o `CustomizeSheet`.
- Renderiza `MetricsGrid` ou `EmptyDashboard` conforme seleção.
- Mantém `PerformanceChart`, `BotStatus` e `AIInsights` como seções fixas abaixo (essas três continuam sempre visíveis para não perder funcionalidade).

### 5. Animações
- `framer-motion` (já é dependência comum em projetos shadcn — adiciono via `bun add framer-motion` se não estiver presente).
- `MetricsGrid` usa `AnimatePresence` com `motion.div` (fade + scale + layout) para transições suaves ao adicionar/remover cards.
- Switches no Sheet usam o `transition-colors` nativo do shadcn.

## O que NÃO muda
- `profiles.dashboard_widgets` continua existindo (não removo para evitar quebrar dados antigos), mas deixa de ser usado pelo Dashboard.
- Sidebar, autenticação, outras páginas — sem alteração.
- O gráfico, bot status e insights continuam aparecendo (não foram pedidos como toggles de métrica).

## Arquivos
**Criar**
- `supabase/migrations/<timestamp>_add_dashboard_config_to_tenants.sql`
- `src/lib/dashboard-metrics.ts`
- `src/components/dashboard/CustomizeSheet.tsx`
- `src/components/dashboard/MetricsGrid.tsx`
- `src/components/dashboard/EmptyDashboard.tsx`

**Editar**
- `src/pages/Index.tsx` (refatoração completa da lógica de personalização)
- `package.json` (se necessário, adicionar `framer-motion`)

## Resultado para o usuário
1. Abre o Dashboard → vê 4 métricas padrão + gráfico + bot + insights.
2. Clica em "Personalizar Painel" (canto superior direito, ícone engrenagem) → abre painel lateral.
3. Vê métricas agrupadas em Financeiro / Atendimento / Agenda, ativa/desativa com switches.
4. Cards aparecem/somem com animação suave em tempo real.
5. Fecha o painel → preferência fica salva no banco e persiste entre sessões e dispositivos.
6. Se desativar tudo → vê empty state convidando a personalizar.
