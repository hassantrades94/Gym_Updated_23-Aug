const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const envLines = envContent.split('\n')
const env = {}
envLines.forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    env[key.trim()] = value.trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to wallet_transactions table...')
    
    // Add transaction_date column
    console.log('Adding transaction_date column...')
    const { data: dateResult, error: dateError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE wallet_transactions 
        ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Update existing records to use created_at as transaction_date
        UPDATE wallet_transactions 
        SET transaction_date = created_at 
        WHERE transaction_date IS NULL;
      `
    })
    
    if (dateError) {
      console.error('Error adding transaction_date column:', dateError)
    } else {
      console.log('✅ Successfully added transaction_date column')
    }
    
    // Add balance_after_inr column
    console.log('Adding balance_after_inr column...')
    const { data: balanceResult, error: balanceError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE wallet_transactions 
        ADD COLUMN balance_after_inr DECIMAL(12,2) DEFAULT 0;
        
        -- Also add balance_before_inr if it doesn't exist
        ALTER TABLE wallet_transactions 
        ADD COLUMN IF NOT EXISTS balance_before_inr DECIMAL(12,2) DEFAULT 0;
        
        -- Update existing records with default balance values
        UPDATE wallet_transactions 
        SET balance_before_inr = 0, balance_after_inr = amount_inr 
        WHERE balance_after_inr IS NULL;
      `
    })
    
    if (balanceError) {
      console.error('Error adding balance columns:', balanceError)
    } else {
      console.log('✅ Successfully added balance columns')
    }
    
    // Verify the changes
    console.log('\nVerifying changes...')
    const { data: testData, error: testError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('Error verifying changes:', testError)
    } else {
      console.log('✅ Updated table structure:')
      if (testData && testData.length > 0) {
        console.log('Available columns:', Object.keys(testData[0]))
      } else {
        // Test specific columns
        const { data: dateTest, error: dateTestError } = await supabase
          .from('wallet_transactions')
          .select('transaction_date')
          .limit(1)
        
        const { data: balanceTest, error: balanceTestError } = await supabase
          .from('wallet_transactions')
          .select('balance_after_inr')
          .limit(1)
        
        if (!dateTestError) {
          console.log('✅ transaction_date column is now available')
        }
        
        if (!balanceTestError) {
          console.log('✅ balance_after_inr column is now available')
        }
      }
    }
    
    console.log('\n🎉 Column addition complete! The "transaction_date does not exist" error should now be resolved.')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

addMissingColumns()