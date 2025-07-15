
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('SumUp OAuth init function called')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Creating Supabase client...')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Parsing request body...')
    const { user_id } = await req.json()
    console.log('User ID received:', user_id)

    if (!user_id) {
      console.error('No user ID provided')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Getting SumUp API key from database...')
    // Get SumUp API key
    const { data: apiKey, error: credentialsError } = await supabaseClient
      .rpc('get_api_credential', { provider_name: 'sumup' })

    console.log('API key query result:', { hasApiKey: !!apiKey, error: credentialsError })

    if (credentialsError) {
      console.error('Error getting SumUp API key:', credentialsError)
      return new Response(
        JSON.stringify({ error: 'SumUp API key not configured', details: credentialsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!apiKey) {
      console.error('SumUp API key is null or empty')
      return new Response(
        JSON.stringify({ error: 'SumUp API key not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('API key retrieved successfully, length:', apiKey.length)

    // Generate state parameter for OAuth security
    const state = crypto.randomUUID()
    console.log('Generated OAuth state:', state)

    console.log('Storing OAuth state in database...')
    // Store the state in the database for verification - INSERT instead of UPSERT
    const { error: stateError } = await supabaseClient
      .from('user_tokens')
      .insert({
        user_id,
        provider: 'sumup_oauth_state',
        access_token: state,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (stateError) {
      console.error('Error storing OAuth state:', stateError)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow', details: stateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('OAuth state stored successfully')

    // Build SumUp OAuth URL for authorization code flow
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sumup-oauth-callback`
    // Updated scopes - using payments.read which is the correct scope for transaction access
    const scope = 'payments.read'
    
    console.log('Building authorization URL with redirect URI:', redirectUri)
    console.log('Using scope:', scope)
    
    const authUrl = new URL('https://api.sumup.com/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', apiKey)  // Use API key as client_id
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)

    const finalAuthUrl = authUrl.toString()
    console.log('Final authorization URL created:', finalAuthUrl)

    return new Response(
      JSON.stringify({ authorization_url: finalAuthUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth init error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
