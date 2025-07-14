
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

    // Get user's SumUp access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('access_token, token_type')
      .eq('user_id', user_id)
      .eq('provider', 'sumup')
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'SumUp account not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch transactions from SumUp API
    const sumupResponse = await fetch('https://api.sumup.com/v0.1/me/transactions', {
      headers: {
        'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!sumupResponse.ok) {
      const errorText = await sumupResponse.text()
      console.error('SumUp API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions from SumUp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sumupData = await sumupResponse.json()
    const transactions = sumupData.items || []

    let syncedCount = 0

    // Process and store transactions
    for (const transaction of transactions) {
      try {
        const { error: insertError } = await supabaseClient
          .from('transactions')
          .upsert({
            user_id: user_id,
            provider: 'sumup',
            transaction_id: transaction.id,
            amount: parseFloat(transaction.amount),
            currency: transaction.currency,
            status: transaction.status,
            description: transaction.description || null,
            merchant_name: transaction.merchant_name || null,
            transaction_date: new Date(transaction.timestamp).toISOString(),
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

  } catch (error) {
    console.error('Sync transactions error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
