-- Migração T5: Coluna expected_invoice em cards
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS expected_invoice jsonb DEFAULT '{}'::jsonb;
