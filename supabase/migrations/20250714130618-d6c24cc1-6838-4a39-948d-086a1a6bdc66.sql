
-- Create a table to store API credentials for open banking providers
CREATE TABLE public.api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  additional_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Create a restrictive policy that blocks all access to regular users
-- Only service role and functions with SECURITY DEFINER can access this table
CREATE POLICY "Block all user access to api_credentials" 
  ON public.api_credentials 
  FOR ALL 
  USING (false);

-- Create a security definer function to retrieve API credentials for application use
CREATE OR REPLACE FUNCTION public.get_api_credential(provider_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credential_key TEXT;
BEGIN
  SELECT api_key INTO credential_key
  FROM public.api_credentials
  WHERE provider = provider_name;
  
  RETURN credential_key;
END;
$$;

-- Create a security definer function to manage API credentials (insert/update)
CREATE OR REPLACE FUNCTION public.upsert_api_credential(
  provider_name TEXT,
  new_api_key TEXT,
  config JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_credentials (provider, api_key, additional_config, updated_at)
  VALUES (provider_name, new_api_key, config, now())
  ON CONFLICT (provider)
  DO UPDATE SET
    api_key = EXCLUDED.api_key,
    additional_config = EXCLUDED.additional_config,
    updated_at = now();
END;
$$;

-- Insert some example open banking providers (you can modify these as needed)
INSERT INTO public.api_credentials (provider, api_key, additional_config) VALUES
('plaid', 'placeholder_key_replace_with_real', '{"base_url": "https://production.plaid.com", "environment": "production"}'),
('yodlee', 'placeholder_key_replace_with_real', '{"base_url": "https://api.yodlee.com", "version": "1.1"}'),
('saltedge', 'placeholder_key_replace_with_real', '{"base_url": "https://www.saltedge.com/api", "version": "5"}'),
('truelayer', 'placeholder_key_replace_with_real', '{"base_url": "https://api.truelayer.com", "version": "v1"}')
ON CONFLICT (provider) DO NOTHING;
