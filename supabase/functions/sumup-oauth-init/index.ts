
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
    
    // Make the OAuth authorization request to SumUp using API key in header
    console.log('Making OAuth authorization request to SumUp...')
    const authResponse = await fetch('https://api.sumup.com/authorize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'payments.read',
        state: state
      })
    })

    console.log('SumUp auth response status:', authResponse.status)
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('SumUp authorization request failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to initiate SumUp authorization',
          details: errorText,
          status: authResponse.status 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    console.log('SumUp auth response data:', authData)

    // Return the authorization URL from SumUp's response
    if (authData.authorization_url || authData.url) {
      const authUrl = authData.authorization_url || authData.url
      console.log('Authorization URL received:', authUrl)
      
      return new Response(
        JSON.stringify({ authorization_url: authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('No authorization URL in response:', authData)
      return new Response(
        JSON.stringify({ error: 'No authorization URL received from SumUp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('OAuth init error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
