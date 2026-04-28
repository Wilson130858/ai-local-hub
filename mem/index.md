# Project Memory

## Core
Projeto: AI Local Hub (multi-tenant SaaS, React + Lovable Cloud).
Buffer de 8s em `AIPlayground.tsx` (BUFFER_MS=8000) para agrupar mensagens estilo WhatsApp.
Admin tem acesso à rota `/agenda` (sem `blockAdmin`); apenas `/faturas` fica oculta para admin.

## Memories
- [Pending audit fixes](mem://audit/pending-fixes) — Backlog da auditoria: race conditions em invoices, HMAC no OAuth, atomicidade do delete_user, mocks remanescentes, timezone
