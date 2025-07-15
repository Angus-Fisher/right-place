
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

    // Determine the correct API endpoint based on the available scope
    let apiEndpoint = 'https://api.sumup.com/v0.1/me/transactions'
    
    // If we have payments.read scope, we might need to use a different endpoint
    if (tokenData.scope && tokenData.scope.includes('payments')) {
      // Try the payments endpoint first
      apiEndpoint = 'https://api.sumup.com/v0.1/me/transactions'
    }

    console.log('Fetching from endpoint:', apiEndpoint)

    // Fetch transactions from SumUp API using the user's access token
    const sumupResponse = await fetch(apiEndpoint, {
      headers: {
        'Authorization': `${tokenData.token_type || 'Bearer'} ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('SumUp API response status:', sumupResponse.status)

    if (!sumupResponse.ok) {
      const errorText = await sumupResponse.text()
      console.error('SumUp API error:', errorText)
      
      // Try alternative endpoint if the first one fails
      if (sumupResponse.status === 404 || sumupResponse.status === 403) {
        console.log('Trying alternative endpoint...')
        const altResponse = await fetch('https://api.sumup.com/v0.1/me/transactions/history', {
          headers: {
            'Authorization': `${tokenData.token_type || 'Bearer'} ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (altResponse.ok) {
          const altData = await altResponse.json()
          console.log('Alternative endpoint successful')
          return processTransactions(altData, user_id, supabaseClient)
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch transactions from SumUp',
          details: errorText,
          status: sumupResponse.status 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sumupData = await sumupResponse.json()
    console.log('SumUp data structure:', Object.keys(sumupData))
    
    return processTransactions(sumupData, user_id, supabaseClient)

  } catch (error) {
    console.error('Sync transactions error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processTransactions(sumupData: any, user_id: string, supabaseClient: any) {
  const transactions = sumupData.items || sumupData.data || sumupData || []
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
