
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

    console.log('Getting SumUp credentials from database...')
    // Get SumUp credentials using the new function
    const { data: credentials, error: credentialsError } = await supabaseClient
      .rpc('get_sumup_credentials')

    console.log('Credentials query result:', { hasCredentials: !!credentials, error: credentialsError })

    if (credentialsError) {
      console.error('Error getting SumUp credentials:', credentialsError)
      return new Response(
        JSON.stringify({ error: 'SumUp credentials not configured', details: credentialsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!credentials) {
      console.error('SumUp credentials are null or empty')
      return new Response(
        JSON.stringify({ error: 'SumUp credentials not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { client_id, client_secret } = credentials
    console.log('Credentials retrieved successfully, client_id length:', client_id?.length)

    if (!client_id || !client_secret) {
      console.error('Missing client_id or client_secret')
      return new Response(
        JSON.stringify({ error: 'SumUp client credentials not properly configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate state parameter for OAuth security
    const state = crypto.randomUUID()
    console.log('Generated OAuth state:', state)

    console.log('Storing OAuth state in database...')
    // Store the state in the database for verification
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

    // Build redirect URI
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sumup-oauth-callback`
    console.log('Using redirect URI:', redirectUri)
    
    // Build authorization URL according to SumUp's Authorization Code flow
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: client_id,
      redirect_uri: redirectUri,
      scope: 'payments.read',
      state: state
    })

    const authorizationUrl = `https://api.sumup.com/authorize?${authParams.toString()}`
    console.log('Built authorization URL:', authorizationUrl)

    return new Response(
      JSON.stringify({ authorization_url: authorizationUrl }),
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
