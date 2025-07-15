
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

    // Get user's most recent SumUp access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token, token_type, scope')
      .eq('user_id', user_id)
      .eq('provider', 'sumup')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tokenError || !tokenData) {
      console.error('Token error:', tokenError)
      return new Response(
        JSON.stringify({ error: 'SumUp account not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Using token with scope:', tokenData.scope)

    const authHeaders = {
      'Authorization': `${tokenData.token_type || 'Bearer'} ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    }

    // Step 1: Get merchant profile to obtain merchant_code
    console.log('Step 1: Fetching merchant profile from https://api.sumup.com/v0.1/me')
    const profileResponse = await fetch('https://api.sumup.com/v0.1/me', {
      headers: authHeaders
    })

    console.log('Profile API response status:', profileResponse.status)

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.error('SumUp Profile API error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch merchant profile from SumUp',
          details: errorText,
          status: profileResponse.status 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const profileData = await profileResponse.json()
    console.log('Profile data received:', Object.keys(profileData))
    console.log('Full profile data structure:', JSON.stringify(profileData, null, 2))
    
    // Try to get merchant_code from different possible locations in the response
    let merchantCode = profileData.merchant_code
    if (!merchantCode && profileData.merchant_profile) {
      merchantCode = profileData.merchant_profile.merchant_code
    }
    
    if (!merchantCode) {
      console.error('No merchant_code found in profile response:', profileData)
      return new Response(
        JSON.stringify({ 
          error: 'No merchant_code found in SumUp profile',
          details: 'The merchant profile response did not contain a merchant_code in expected locations',
          profileStructure: Object.keys(profileData)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found merchant_code:', merchantCode)

    // Step 2: Fetch transactions using the merchant_code
    const transactionsEndpoint = `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history`
    console.log('Step 2: Fetching transactions from:', transactionsEndpoint)

    const transactionsResponse = await fetch(transactionsEndpoint, {
      headers: authHeaders
    })

    console.log('Transactions API response status:', transactionsResponse.status)
    console.log('Transactions API response headers:', Object.fromEntries(transactionsResponse.headers.entries()))

    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text()
      console.error('SumUp Transactions API error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch transactions from SumUp',
          details: errorText,
          status: transactionsResponse.status,
          endpoint: transactionsEndpoint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const transactionsData = await transactionsResponse.json()
    
    // ===== DETAILED LOGGING OF TRANSACTION RESPONSE =====
    console.log('=== FULL SUMUP TRANSACTIONS RESPONSE ===')
    console.log('Response status:', transactionsResponse.status)
    console.log('Response headers:', Object.fromEntries(transactionsResponse.headers.entries()))
    console.log('Full response body:', JSON.stringify(transactionsData, null, 2))
    console.log('Response data structure - top level keys:', Object.keys(transactionsData))
    
    if (transactionsData.items) {
      console.log('Found "items" array with length:', transactionsData.items.length)
      console.log('First item structure (if exists):', transactionsData.items[0] ? Object.keys(transactionsData.items[0]) : 'No items')
    }
    
    if (transactionsData.data) {
      console.log('Found "data" array with length:', transactionsData.data.length)
      console.log('First data item structure (if exists):', transactionsData.data[0] ? Object.keys(transactionsData.data[0]) : 'No data items')
    }
    
    if (transactionsData.pagination) {
      console.log('Pagination info found:', JSON.stringify(transactionsData.pagination, null, 2))
    }
    
    if (transactionsData.meta) {
      console.log('Meta info found:', JSON.stringify(transactionsData.meta, null, 2))
    }
    
    // Check if response is directly an array
    if (Array.isArray(transactionsData)) {
      console.log('Response is a direct array with length:', transactionsData.length)
      console.log('First array item structure (if exists):', transactionsData[0] ? Object.keys(transactionsData[0]) : 'No items in array')
    }
    
    console.log('=== END FULL SUMUP TRANSACTIONS RESPONSE ===')
    
    return processTransactions(transactionsData, user_id, supabaseClient)

  } catch (error) {
    console.error('Sync transactions error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processTransactions(transactionsData: any, user_id: string, supabaseClient: any) {
  const transactions = transactionsData.items || transactionsData.data || transactionsData || []
  console.log(`Processing ${transactions.length} transactions`)

  let syncedCount = 0

  // Process and store transactions
  for (const transaction of transactions) {
    try {
      const { error: insertError } = await supabaseClient
        .from('transactions')
        .upsert({
          user_id: user_id,
          provider: 'sumup',
          transaction_id: transaction.id || transaction.transaction_id,
          amount: parseFloat(transaction.amount || transaction.value || 0),
          currency: transaction.currency || 'EUR',
          status: transaction.status || 'completed',
          description: transaction.description || transaction.product_summary || null,
          merchant_name: transaction.merchant_name || transaction.merchant?.name || null,
          transaction_date: new Date(transaction.timestamp || transaction.created_at || new Date()).toISOString(),
          raw_data: transaction,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'provider,transaction_id'
        })

      if (!insertError) {
        syncedCount++
      } else {
        console.error('Error inserting transaction:', insertError)
      }
    } catch (error) {
      console.error('Error processing transaction:', error)
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      synced_count: syncedCount,
      total_fetched: transactions.length 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
