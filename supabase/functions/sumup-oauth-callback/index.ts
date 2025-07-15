
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

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>Missing Supabase configuration</p>
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

    console.log('Creating Supabase client with service role key')
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify state parameter
    console.log('Verifying OAuth state parameter:', state)
    const { data: stateData, error: stateError } = await supabaseClient
      .from('user_tokens')
      .select('user_id')
      .eq('provider', 'sumup_oauth_state')
      .eq('access_token', state)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (stateError) {
      console.error('Error verifying state parameter:', stateError)
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error verifying state parameter: ${stateError.message}</p>
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

    if (!stateData) {
      console.error('Invalid state parameter - no matching record found')
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
    console.log('Found user ID for OAuth state:', userId)

    // Get SumUp credentials
    console.log('Getting SumUp credentials...')
    const { data: credentials, error: credentialsError } = await supabaseClient
      .rpc('get_sumup_credentials')

    if (credentialsError || !credentials) {
      console.error('Error getting SumUp credentials:', credentialsError)
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>SumUp credentials not configured</p>
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

    const { client_id, client_secret } = credentials

    if (!client_id || !client_secret) {
      console.error('Missing client_id or client_secret')
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>SumUp client credentials not properly configured</p>
            <script>
              setTimeout () => {
                window.close()
              }, 3000)
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    console.log('Exchanging authorization code for access token...')

    // Create Basic Auth header
    const basicAuth = btoa(`${client_id}:${client_secret}`)
    const redirectUri = `${supabaseUrl}/functions/v1/sumup-oauth-callback`

    console.log('=== TOKEN EXCHANGE REQUEST DETAILS ===')
    console.log('Method: POST')
    console.log('URL: https://api.sumup.com/token')
    console.log('Headers:')
    console.log('  - Content-Type: application/x-www-form-urlencoded')
    console.log('  - Accept: application/json')
    console.log('  - Authorization: Basic [REDACTED]')
    console.log('Body parameters:')
    console.log('  - grant_type: authorization_code')
    console.log('  - code:', code)
    console.log('  - redirect_uri:', redirectUri)
    console.log('=== END REQUEST DETAILS ===')

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
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
    console.log('Storing access token for user:', userId)
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
        scope: tokenData.scope || 'transactions.history',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (tokenError) {
      console.error('Error storing token:', tokenError)
      return new Response(`
        <html>
          <body>
            <h1>Storage Error</h1>
            <p>Failed to store access token: ${tokenError.message}</p>
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

    // Clean up the OAuth state tokens
    console.log('Cleaning up OAuth state tokens')
    await supabaseClient
      .from('user_tokens')
      .delete()
      .eq('provider', 'sumup_oauth_state')
      .eq('access_token', state)

    console.log('OAuth flow completed successfully')

    // Success page
    return new Response(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #10b981;">SumUp Connected Successfully!</h1>
          <p>Your SumUp account has been connected with scope: ${tokenData.scope || 'transactions.history'}</p>
          <p>You can now close this window and return to the application.</p>
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
