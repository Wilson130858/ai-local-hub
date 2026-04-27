# Finalizar integração Google Calendar

## Objetivo
Cadastrar as credenciais OAuth do Google como secrets do backend para ativar o fluxo de conexão da aba Agenda.

## O que será feito

1. **Cadastrar secret `GOOGLE_CLIENT_ID`**
   - Valor: `949232379010-jt4tdjv2rs8t45di2j7v9o6pcf6nb2i3.apps.googleusercontent.com`

2. **Cadastrar secret `GOOGLE_CLIENT_SECRET`**
   - Valor: o secret fornecido (armazenado criptografado, sem exibição no chat)

3. **Validação**
   - Confirmar que os secrets aparecem na lista via `fetch_secrets`
   - As edge functions já deployadas (`google-oauth-start`, `google-oauth-callback`, `google-calendar-sync`) passam a funcionar automaticamente — elas leem `Deno.env.get("GOOGLE_CLIENT_ID")` / `GOOGLE_CLIENT_SECRET`.

## Como testar depois

1. Acessar a aba **Agenda** no painel
2. Clicar em **Conectar Google Calendar**
3. Autorizar no popup do Google (usando o email cadastrado como Test user)
4. Confirmar que aparece o calendário do mês com os eventos

## Observação de segurança

Recomendo gerar um novo Client Secret no Google Cloud Console e descartar o atual, já que foi colado em texto no chat. Quando gerar o novo, me avise que atualizo o secret.

## Sem alterações de código ou banco

Apenas cadastro de secrets — nenhum arquivo do projeto ou migration é criado.