-- Atualiza o default do ai_config para a nova estrutura, mantendo compatibilidade.
ALTER TABLE public.tenants
  ALTER COLUMN ai_config SET DEFAULT jsonb_build_object(
    'assistant_name', 'Assistente',
    'tone', 'amigavel',
    'use_emojis', true,
    'golden_rules', '',
    'faq', '[]'::jsonb,
    -- legados
    'rules', ''
  );