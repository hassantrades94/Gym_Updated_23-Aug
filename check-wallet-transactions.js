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

async function checkWalletTransactions() {
  try {
    console.log('\n=== Checking Wallet Transactions ===\n');
    
    // Get all transactions
    const { data: allTransactions, error: allError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (allError) {
      console.error('Error fetching transactions:', allError);
      return;
    }
    
    console.log(`Total transactions found: ${allTransactions?.length || 0}\n`);
    
    if (allTransactions && allTransactions.length > 0) {
      // Group by transaction type
      const recharges = allTransactions.filter(t => t.transaction_type === 'recharge');
      const deductions = allTransactions.filter(t => t.transaction_type === 'deduction');
      const monthlyBilling = allTransactions.filter(t => t.transaction_type === 'monthly_billing');
      
      console.log(`Recharge transactions: ${recharges.length}`);
      console.log(`Deduction transactions: ${deductions.length}`);
      console.log(`Monthly billing transactions: ${monthlyBilling.length}\n`);
      
      // Show sample transactions
      console.log('=== Sample Transactions ===\n');
      allTransactions.slice(0, 10).forEach((transaction, index) => {
        console.log(`${index + 1}. Type: ${transaction.transaction_type}`);
        console.log(`   Amount: ₹${transaction.amount_inr}`);
        console.log(`   Description: ${transaction.description}`);
        console.log(`   Date: ${new Date(transaction.created_at).toLocaleString()}`);
        console.log(`   Gym ID: ${transaction.gym_id}`);
        console.log('');
      });
      
      // Check for any negative amounts in recharges or positive amounts in deductions
      console.log('=== Data Validation ===\n');
      const invalidRecharges = recharges.filter(t => t.amount_inr < 0);
      const invalidDeductions = deductions.filter(t => t.amount_inr > 0);
      const invalidMonthlyBilling = monthlyBilling.filter(t => t.amount_inr > 0);
      
      if (invalidRecharges.length > 0) {
        console.log(`⚠️  Found ${invalidRecharges.length} recharge transactions with negative amounts`);
      }
      if (invalidDeductions.length > 0) {
        console.log(`⚠️  Found ${invalidDeductions.length} deduction transactions with positive amounts`);
      }
      if (invalidMonthlyBilling.length > 0) {
        console.log(`⚠️  Found ${invalidMonthlyBilling.length} monthly billing transactions with positive amounts`);
      }
      
      if (invalidRecharges.length === 0 && invalidDeductions.length === 0 && invalidMonthlyBilling.length === 0) {
        console.log('✅ All transaction amounts have correct signs');
      }
      
    } else {
      console.log('No transactions found in the database.');
      console.log('\n💡 This might explain why only recharges are visible - there may be no deduction transactions to display.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkWalletTransactions();