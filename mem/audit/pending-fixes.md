---
name: Pending audit fixes
description: Findings from end-to-end audit (security, scalability, bugs) awaiting implementation
type: feature
---
# Auditoria pendente — AI Local Hub

Resultados da revisão de ponta a ponta. Nada foi implementado ainda; usar como backlog.

## 🔴 Críticos
1. **close-invoices — idempotência & race condition**
   - Notificações de fatura vencida podem duplicar (sem checagem de já-notificado no dia).
   - Criação de nova fatura "open" tem race condition.
   - Fix: `CREATE UNIQUE INDEX one_open_invoice_per_tenant ON invoices(tenant_id) WHERE status = 'open';`
   - Adicionar `last_notified_at` para idempotência das notificações diárias.

2. **admin-actions `delete_user` — atomicidade**
   - Múltiplos DELETEs não atômicos → risco de estado inconsistente.
   - Fix: mover para função SQL `SECURITY DEFINER` única, transacional.

3. **install-cron — vazamento de CRON_SECRET**
   - SQL de fallback retornado ao cliente contém `CRON_SECRET` em texto puro.
   - Várias funções `SECURITY DEFINER` com GRANT para `anon` — restringir.

## 🟠 Alta prioridade
4. **Google OAuth `state` sem HMAC**
   - `google-oauth-start` gera `state = btoa(JSON.stringify({tenant_id, user_id, nonce}))` sem assinatura.
   - Fix: assinar com HMAC-SHA256 e validar no callback.

5. **ingest-lead**
   - Sem rate limiting.
   - Não verifica existência/status do tenant antes de inserir.

6. **Hardcodes / mocks**
   - "Vinícius 👋" hardcoded em `src/pages/Index.tsx`.
   - `Leads.tsx` e `Configuracoes.tsx` ainda usam mock data apesar das tabelas reais.

## 🟡 Performance & escalabilidade
7. **Timezones inconsistentes** — mistura UTC vs `America/Sao_Paulo` no faturamento. Padronizar.
8. **Realtime sem filtro por tenant** em `Configuracoes.tsx` (`service_quotes`). Adicionar `filter: tenant_id=eq.${tenantId}`.

## Top 5 para começar
1. Índice único parcial `one_open_invoice_per_tenant`.
2. Idempotência nas notificações do cron `close-invoices`.
3. RPC atômica para `delete_user`.
4. HMAC no `state` do Google OAuth.
5. Substituir mocks/hardcodes por dados reais.
