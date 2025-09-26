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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createWalletTable() {
  try {
    console.log('Creating wallet_transactions table with all required columns...')
    
    // First, check if the table exists
    const { data: existingData, error: checkError } = await supabase
      .from('wallet_transactions')
      .select('id')
      .limit(1)
    
    if (checkError && checkError.message.includes('relation "wallet_transactions" does not exist')) {
      console.log('Table does not exist. You need to create it manually in Supabase Dashboard.')
      console.log('\nGo to your Supabase Dashboard and run this SQL:')
      console.log(`
CREATE TABLE wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'recharge', 'deduction', 'monthly_billing', 'refund', 'adjustment'
  )),
  amount_inr DECIMAL(12,2) NOT NULL,
  balance_before_inr DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_after_inr DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  description TEXT,
  metadata JSONB,
  processed_by UUID,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_gym_id ON wallet_transactions(gym_id);
CREATE INDEX idx_wallet_transactions_date ON wallet_transactions(transaction_date);
`)
      return
    }
    
    if (existingData) {
      console.log('✅ Table exists. Checking for missing columns...')
      
      // Test for transaction_date column
      const { data: dateTest, error: dateError } = await supabase
        .from('wallet_transactions')
        .select('transaction_date')
        .limit(1)
      
      if (dateError && dateError.message.includes('column "transaction_date" does not exist')) {
        console.log('❌ transaction_date column is missing')
        console.log('\nAdd this column in Supabase Dashboard SQL Editor:')
        console.log('ALTER TABLE wallet_transactions ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();')
      } else {
        console.log('✅ transaction_date column exists')
      }
      
      // Test for balance_after_inr column
      const { data: balanceTest, error: balanceError } = await supabase
        .from('wallet_transactions')
        .select('balance_after_inr')
        .limit(1)
      
      if (balanceError && balanceError.message.includes('column "balance_after_inr" does not exist')) {
        console.log('❌ balance_after_inr column is missing')
        console.log('\nAdd this column in Supabase Dashboard SQL Editor:')
        console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_after_inr DECIMAL(12,2) DEFAULT 0;')
      } else {
        console.log('✅ balance_after_inr column exists')
      }
      
      // Test for balance_before_inr column
      const { data: beforeTest, error: beforeError } = await supabase
        .from('wallet_transactions')
        .select('balance_before_inr')
        .limit(1)
      
      if (beforeError && beforeError.message.includes('column "balance_before_inr" does not exist')) {
        console.log('❌ balance_before_inr column is missing')
        console.log('\nAdd this column in Supabase Dashboard SQL Editor:')
        console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_before_inr DECIMAL(12,2) DEFAULT 0;')
      } else {
        console.log('✅ balance_before_inr column exists')
      }
    }
    
    console.log('\n📋 Summary:')
    console.log('1. Go to https://supabase.com/dashboard')
    console.log('2. Navigate to your project')
    console.log('3. Go to SQL Editor')
    console.log('4. Run the SQL commands shown above')
    console.log('5. This will resolve the "column transaction_date does not exist" error')
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

createWalletTable()