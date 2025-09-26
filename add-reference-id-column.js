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

async function addReferenceIdColumn() {
  console.log('\n=== ADDING REFERENCE_ID COLUMN TO WALLET_TRANSACTIONS ===')
  console.log('\n⚠️  Since Supabase REST API doesn\'t support DDL operations,')
  console.log('you need to run the SQL commands manually in Supabase Dashboard.')
  console.log('\n📋 MANUAL STEPS REQUIRED:')
  console.log('1. Go to your Supabase Dashboard')
  console.log('2. Navigate to SQL Editor')
  console.log('3. Run the following SQL commands:\n')
  
  console.log('-- Step 1: Add the reference_id column')
  console.log('ALTER TABLE wallet_transactions ADD COLUMN reference_id VARCHAR(100);')
  console.log('')
  console.log('-- Step 2: Update existing records with reference_id values')
  console.log('UPDATE wallet_transactions')
  console.log('SET reference_id = \'TXN_\' || EXTRACT(EPOCH FROM created_at)::BIGINT || \'_\' || SUBSTRING(id::TEXT FROM 1 FOR 8)')
  console.log('WHERE reference_id IS NULL;')
  console.log('')
  console.log('-- Step 3: Create the index that was failing in script 09')
  console.log('CREATE INDEX idx_wallet_transactions_reference')
  console.log('ON wallet_transactions(reference_id)')
  console.log('WHERE reference_id IS NOT NULL;')
  console.log('')
  console.log('-- Step 4: Create unique constraint for reference_id')
  console.log('CREATE UNIQUE INDEX uq_wallet_transactions_reference_id')
  console.log('ON wallet_transactions(reference_id)')
  console.log('WHERE reference_id IS NOT NULL;')
  console.log('')
  
  console.log('\n🔗 Alternative: Use the SQL file created:')
  console.log('   File: add-reference-id-column.sql')
  console.log('   Copy the contents and paste into Supabase SQL Editor')
  
  // Try to verify current state
  console.log('\n🔍 CURRENT TABLE STATE:')
  try {
    const { data: sampleData, error: sampleError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .limit(1)
    
    if (sampleError) {
      console.error('Error accessing table:', sampleError.message)
    } else if (sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0])
      console.log('Current columns:', columns.join(', '))
      
      if (columns.includes('reference_id')) {
        console.log('\n✅ reference_id column already exists!')
        console.log('\n🔍 Checking if indexes exist...')
        
        // Check if we can query with reference_id (indicates column exists and is usable)
        const { data: testData, error: testError } = await supabase
          .from('wallet_transactions')
          .select('reference_id')
          .limit(1)
        
        if (!testError) {
          console.log('✅ reference_id column is functional')
          console.log('\n✨ The missing column issue appears to be resolved!')
          console.log('You can now run script 09_create_wallet_tables.sql without errors.')
        }
      } else {
        console.log('\n❌ reference_id column is still missing')
        console.log('Please run the SQL commands above in Supabase Dashboard')
      }
    }
  } catch (error) {
    console.error('Error checking table state:', error)
  }
}

addReferenceIdColumn()
  .then(() => {
    console.log('\n=== REFERENCE_ID COLUMN CHECK COMPLETE ===')
    process.exit(0)
  })
  .catch(error => {
    console.error('Script failed:', error)
    process.exit(1)
  })