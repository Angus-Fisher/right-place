
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  console.log('OAuth callback received')
  
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    console.log('OAuth callback params:', { code: !!code, state: !!state, error })

    if (error) {
      console.error('OAuth error:', error)
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    if (!code || !state) {
      console.error('Missing code or state parameter')
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Missing authorization code or state parameter</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify state parameter
    const { data: stateData, error: stateError } = await supabaseClient
      .from('user_tokens')
      .select('user_id')
      .eq('provider', 'sumup_oauth_state')
      .eq('access_token', state)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (stateError || !stateData) {
      console.error('Invalid state parameter:', stateError)
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Invalid state parameter</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    const userId = stateData.user_id

    // Get SumUp API key
    const { data: apiKey, error: credentialsError } = await supabaseClient
      .rpc('get_api_credential', { provider_name: 'sumup' })

    if (credentialsError || !apiKey) {
      console.error('Error getting SumUp API key:', credentialsError)
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>SumUp API key not configured</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    console.log('Exchanging code for token using API key in header...')

    // Exchange authorization code for access token using API key in header
    const tokenResponse = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/sumup-oauth-callback`
      })
    })

    console.log('Token response status:', tokenResponse.status)
    const responseText = await tokenResponse.text()
    console.log('Token response body:', responseText)

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', responseText)
      return new Response(`
        <html>
          <body>
            <h1>Token Exchange Failed</h1>
            <p>Failed to exchange authorization code for access token</p>
            <p>Status: ${tokenResponse.status}</p>
            <p>Error: ${responseText}</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    let tokenData
    try {
      tokenData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse token response:', parseError)
      return new Response(`
        <html>
          <body>
            <h1>Token Parse Error</h1>
            <p>Failed to parse token response</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    console.log('Token data received:', { 
      hasAccessToken: !!tokenData.access_token,
      scope: tokenData.scope,
      tokenType: tokenData.token_type
    })

    // Store the access token for the user
    const { error: tokenError } = await supabaseClient
      .from('user_tokens')
      .insert({
        user_id: userId,
        provider: 'sumup',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_at: tokenData.expires_in ? 
          new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        scope: tokenData.scope || 'payments.read',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    // Clean up the OAuth state tokens
    await supabaseClient
      .from('user_tokens')
      .delete()
      .eq('provider', 'sumup_oauth_state')
      .eq('access_token', state)

    if (tokenError) {
      console.error('Error storing token:', tokenError)
      return new Response(`
        <html>
          <body>
            <h1>Storage Error</h1>
            <p>Failed to store access token</p>
            <script>
              setTimeout(() => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Success page
    return new Response(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #10b981;">SumUp Connected Successfully!</h1>
          <p>Your SumUp account has been connected with scope: ${tokenData.scope || 'payments.read'}</p>
          <p>You can now close this window.</p>
          <script>
            setTimeout(() => {
              window.close()
            }, 3000)
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(`
      <html>
        <body>
          <h1>Authorization Error</h1>
          <p>An unexpected error occurred during authorization</p>
          <p>Error: ${error.message}</p>
          <script>
            setTimeout(() => {
              window.close()
            }, 3000)
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
})
