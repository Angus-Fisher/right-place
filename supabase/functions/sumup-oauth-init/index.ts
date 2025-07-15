
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SumUp API key
    const { data: apiKey, error: credentialsError } = await supabaseClient
      .rpc('get_api_credential', { provider_name: 'sumup' })

    if (credentialsError) {
      console.error('Error getting SumUp API key:', credentialsError)
      return new Response(
        JSON.stringify({ error: 'SumUp API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'SumUp API key not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate state parameter for OAuth security
    const state = crypto.randomUUID()

    // Store the state in the database for verification
    const { error: stateError } = await supabaseClient
      .from('user_tokens')
      .upsert({
        user_id,
        provider: 'sumup_oauth_state',
        access_token: state,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (stateError) {
      console.error('Error storing OAuth state:', stateError)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build SumUp OAuth URL for authorization code flow
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sumup-oauth-callback`
    const scope = 'transactions:read'
    
    const authUrl = new URL('https://api.sumup.com/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', apiKey)  // Use API key as client_id
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)

    return new Response(
      JSON.stringify({ authorization_url: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth init error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
