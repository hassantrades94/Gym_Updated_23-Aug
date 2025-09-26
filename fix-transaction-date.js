const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Load environment variables manually
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixTransactionDateColumn() {
  try {
    console.log('Testing wallet_transactions table access...')
    
    // Test a simple query to see what columns actually exist
    const { data: testData, error: testError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('Error accessing wallet_transactions:', testError)
      
      if (testError.message.includes('relation "wallet_transactions" does not exist')) {
        console.log('\n❌ The wallet_transactions table does not exist!')
        console.log('You need to run the wallet table creation script first:')
        console.log('scripts/09_create_wallet_tables.sql')
        console.log('\nLet\'s try to create the table...')
        
        // Try to create the wallet tables
        const createTableSQL = `
          -- Create wallet_transactions table
          CREATE TABLE IF NOT EXISTS wallet_transactions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            gym_id UUID NOT NULL,
            transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
              'recharge', 'deduction', 'monthly_billing', 'refund', 'adjustment'
            )),
            amount_inr DECIMAL(12,2) NOT NULL,
            balance_before_inr DECIMAL(12,2) NOT NULL,
            balance_after_inr DECIMAL(12,2) NOT NULL,
            reference_id VARCHAR(100),
            razorpay_payment_id VARCHAR(100),
            description TEXT,
            metadata JSONB,
            processed_by UUID,
            transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
        
        const { data: createData, error: createError } = await supabase.rpc('exec_sql', {
          sql: createTableSQL
        })
        
        if (createError) {
          console.error('Error creating table:', createError)
          console.log('\nPlease create the table manually in Supabase Dashboard or run the SQL script.')
        } else {
          console.log('✅ Successfully created wallet_transactions table')
        }
      } else if (testError.message.includes('column "transaction_date" does not exist')) {
        console.log('\n❌ Found the issue! The transaction_date column is missing!')
        console.log('Attempting to add the missing column...')
        
        const { data: alterData, error: alterError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE wallet_transactions ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();'
        })
        
        if (alterError) {
          console.error('Error adding column:', alterError)
          console.log('\nPlease add the column manually in Supabase Dashboard:')
          console.log('1. Go to https://supabase.com/dashboard')
          console.log('2. Navigate to Table Editor > wallet_transactions')
          console.log('3. Add column: transaction_date (timestamp with time zone, default NOW())')
        } else {
          console.log('✅ Successfully added transaction_date column')
        }
      }
    } else {
      console.log('✅ Successfully accessed wallet_transactions table')
      if (testData && testData.length > 0) {
        console.log('Available columns:', Object.keys(testData[0]))
        
        // Check if transaction_date exists in the columns
        const columns = Object.keys(testData[0])
        if (columns.includes('transaction_date')) {
          console.log('✅ transaction_date column exists')
        } else {
          console.log('❌ transaction_date column is missing from existing data')
        }
        
        if (columns.includes('balance_after_inr')) {
          console.log('✅ balance_after_inr column exists')
        } else {
          console.log('❌ balance_after_inr column is missing from existing data')
        }
      } else {
        console.log('Table exists but is empty - trying to select specific columns...')
        
        // Test specific columns
        const { data: dateTest, error: dateError } = await supabase
          .from('wallet_transactions')
          .select('transaction_date')
          .limit(1)
        
        if (dateError) {
          console.log('❌ transaction_date column does not exist:', dateError.message)
        } else {
          console.log('✅ transaction_date column exists')
        }
        
        const { data: balanceTest, error: balanceError } = await supabase
          .from('wallet_transactions')
          .select('balance_after_inr')
          .limit(1)
        
        if (balanceError) {
          console.log('❌ balance_after_inr column does not exist:', balanceError.message)
        } else {
          console.log('✅ balance_after_inr column exists')
        }
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

fixTransactionDateColumn()