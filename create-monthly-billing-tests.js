const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local file
const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
const env = {};

envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMonthlyBillingTests() {
  try {
    console.log('\n=== Creating Test Monthly Billing Transactions ===\n');
    
    // Get the gym ID from existing transactions
    const { data: existingTransactions, error: fetchError } = await supabase
      .from('wallet_transactions')
      .select('gym_id')
      .limit(1);
    
    if (fetchError) {
      console.error('Error fetching existing transactions:', fetchError);
      return;
    }
    
    if (!existingTransactions || existingTransactions.length === 0) {
      console.error('No existing transactions found to get gym_id');
      return;
    }
    
    const gymId = existingTransactions[0].gym_id;
    console.log(`Using gym_id: ${gymId}\n`);
    
    // Create test monthly billing transactions (these are deductions)
    const testTransactions = [
      {
        gym_id: gymId,
        transaction_type: 'monthly_billing',
        amount_inr: -25, // Negative for deduction
        description: 'Monthly subscription billing - Premium Plan',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        balance_before_inr: 130,
        balance_after_inr: 105,
        transaction_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        gym_id: gymId,
        transaction_type: 'monthly_billing',
        amount_inr: -20, // Negative for deduction
        description: 'Monthly subscription billing - Basic Plan',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        balance_before_inr: 105,
        balance_after_inr: 85,
        transaction_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        gym_id: gymId,
        transaction_type: 'monthly_billing',
        amount_inr: -15, // Negative for deduction
        description: 'Monthly subscription billing - Student Plan',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        balance_before_inr: 85,
        balance_after_inr: 70,
        transaction_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Insert test transactions
    const { data: insertedData, error: insertError } = await supabase
      .from('wallet_transactions')
      .insert(testTransactions)
      .select();
    
    if (insertError) {
      console.error('Error inserting test transactions:', insertError);
      return;
    }
    
    console.log(`✅ Successfully created ${insertedData.length} test monthly billing transactions:\n`);
    
    insertedData.forEach((transaction, index) => {
      console.log(`${index + 1}. Type: ${transaction.transaction_type}`);
      console.log(`   Amount: ₹${transaction.amount_inr}`);
      console.log(`   Description: ${transaction.description}`);
      console.log(`   Date: ${new Date(transaction.created_at).toLocaleString()}`);
      console.log('');
    });
    
    console.log('🎉 Test monthly billing transactions have been created!');
    console.log('💡 These are deduction transactions that should now appear in the wallet history.');
    console.log('🔄 Refresh the wallet history page to see them displayed with red amounts and minus signs.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createMonthlyBillingTests();