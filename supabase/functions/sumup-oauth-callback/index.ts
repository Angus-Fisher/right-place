
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
      .single()

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

    console.log('Exchanging code for token...')

    // Exchange authorization code for access token using authorization code flow
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/sumup-oauth-callback`
    })

    console.log('Token request body:', tokenRequestBody.toString())

    const tokenResponse = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: tokenRequestBody
    })

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response(`
        <html>
          <body>
            <h1>Token Exchange Failed</h1>
            <p>Failed to exchange authorization code for access token</p>
            <p>Error: ${errorText}</p>
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

    const tokenData = await tokenResponse.json()
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token })

    // Store the access token for the user
    const { error: tokenError } = await supabaseClient
      .from('user_tokens')
      .upsert({
        user_id: userId,
        provider: 'sumup',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_at: tokenData.expires_in ? 
          new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        scope: tokenData.scope,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    // Clean up the OAuth state
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
          <p>Your SumUp account has been connected. You can now close this window.</p>
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
