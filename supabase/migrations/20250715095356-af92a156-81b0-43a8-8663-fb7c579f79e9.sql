
-- Add client_id and client_secret columns to api_credentials table for OAuth providers
ALTER TABLE public.api_credentials 
ADD COLUMN client_id TEXT,
ADD COLUMN client_secret TEXT;

-- Update the existing SumUp record to include placeholders for client credentials
UPDATE public.api_credentials 
SET 
  client_id = 'placeholder_client_id_replace_with_real',
  client_secret = 'placeholder_client_secret_replace_with_real',
  additional_config = jsonb_set(
    COALESCE(additional_config, '{}'),
    '{auth_type}',
    '"oauth2"'
  )
WHERE provider = 'sumup';

-- Insert SumUp credentials if they don't exist
INSERT INTO public.api_credentials (provider, api_key, client_id, client_secret, additional_config) 
VALUES ('sumup', 'placeholder_api_key_replace_with_real', 'placeholder_client_id_replace_with_real', 'placeholder_client_secret_replace_with_real', '{"auth_type": "oauth2", "base_url": "https://api.sumup.com"}')
ON CONFLICT (provider) DO UPDATE SET
  client_id = EXCLUDED.client_id,
  client_secret = EXCLUDED.client_secret,
  additional_config = EXCLUDED.additional_config;

-- Update the get_api_credential function to return a JSON object with all credentials
CREATE OR REPLACE FUNCTION public.get_sumup_credentials()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credentials JSON;
BEGIN
  SELECT json_build_object(
    'api_key', api_key,
    'client_id', client_id,
    'client_secret', client_secret,
    'additional_config', additional_config
  ) INTO credentials
  FROM public.api_credentials
  WHERE provider = 'sumup';
  
  RETURN credentials;
END;
$$;
