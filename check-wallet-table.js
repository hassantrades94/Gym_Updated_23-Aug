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

async function checkWalletTableStructure() {
  console.log('\n=== CHECKING WALLET_TRANSACTIONS TABLE STRUCTURE ===')
  
  try {
    // Try to get a sample record to see the current structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .limit(1)
    
    if (sampleError) {
      console.error('Error accessing wallet_transactions table:', sampleError.message)
      return
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('\n✅ Current table columns:')
      const columns = Object.keys(sampleData[0])
      columns.forEach(col => console.log(`  - ${col}`))
      
      // Check for missing columns
      const requiredColumns = [
        'reference_id',
        'balance_before_inr', 
        'balance_after_inr',
        'transaction_date'
      ]
      
      const missingColumns = requiredColumns.filter(col => !columns.includes(col))
      
      if (missingColumns.length > 0) {
        console.log('\n❌ Missing columns:')
        missingColumns.forEach(col => console.log(`  - ${col}`))
        
        console.log('\n📝 SQL commands to add missing columns:')
        if (missingColumns.includes('reference_id')) {
          console.log('ALTER TABLE wallet_transactions ADD COLUMN reference_id VARCHAR(100);')
        }
        if (missingColumns.includes('balance_before_inr')) {
          console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_before_inr DECIMAL(12,2) DEFAULT 0 NOT NULL;')
        }
        if (missingColumns.includes('balance_after_inr')) {
          console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_after_inr DECIMAL(12,2) DEFAULT 0 NOT NULL;')
        }
        if (missingColumns.includes('transaction_date')) {
          console.log('ALTER TABLE wallet_transactions ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();')
        }
      } else {
        console.log('\n✅ All required columns are present!')
      }
    } else {
      console.log('\n⚠️  Table exists but has no data. Cannot determine structure.')
      console.log('Attempting to insert a test record to check structure...')
      
      // Try to insert a minimal record to see what columns are available
      const { error: insertError } = await supabase
        .from('wallet_transactions')
        .insert({
          gym_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
          transaction_type: 'recharge',
          amount_inr: 0.01
        })
      
      if (insertError) {
        console.log('\n❌ Insert test failed. Error details:')
        console.log(insertError.message)
        
        if (insertError.message.includes('reference_id')) {
          console.log('\n🔍 The reference_id column is missing!')
        }
        if (insertError.message.includes('balance_before_inr')) {
          console.log('🔍 The balance_before_inr column is missing!')
        }
        if (insertError.message.includes('balance_after_inr')) {
          console.log('🔍 The balance_after_inr column is missing!')
        }
        if (insertError.message.includes('transaction_date')) {
          console.log('🔍 The transaction_date column is missing!')
        }
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkWalletTableStructure()
  .then(() => {
    console.log('\n=== TABLE STRUCTURE CHECK COMPLETE ===')
    process.exit(0)
  })
  .catch(error => {
    console.error('Script failed:', error)
    process.exit(1)
  })