
-- Remove the unique constraint that's preventing multiple tokens per user/provider
ALTER TABLE public.user_tokens DROP CONSTRAINT IF EXISTS user_tokens_user_id_provider_key;

-- Add an index for performance on queries by user_id and provider
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_provider_created 
ON public.user_tokens (user_id, provider, created_at DESC);
