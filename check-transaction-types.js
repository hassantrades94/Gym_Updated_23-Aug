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

async function checkTransactionTypes() {
  try {
    console.log('\n=== Checking Transaction Type Constraints ===\n');
    
    // Try to get table constraints information
    const { data: constraints, error: constraintError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            conname as constraint_name,
            pg_get_constraintdef(c.oid) as constraint_definition
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'wallet_transactions'
          AND contype = 'c'
          AND conname LIKE '%transaction_type%';
        `
      });
    
    if (constraintError) {
      console.log('Could not fetch constraint info via RPC, trying direct approach...');
      
      // Try inserting a test transaction with 'deduction' type to see what happens
      const testTransaction = {
        gym_id: '1d86e66e-d5b4-4efb-a69f-e53f2b9e6c38',
        transaction_type: 'deduction',
        amount_inr: -10,
        description: 'Test deduction transaction',
        balance_before_inr: 100,
        balance_after_inr: 90,
        transaction_date: new Date().toISOString()
      };
      
      const { data: testData, error: testError } = await supabase
        .from('wallet_transactions')
        .insert([testTransaction])
        .select();
      
      if (testError) {
        console.log('❌ Error inserting deduction transaction:');
        console.log('Error code:', testError.code);
        console.log('Error message:', testError.message);
        console.log('Error details:', testError.details);
        
        if (testError.message.includes('check constraint')) {
          console.log('\n💡 The transaction_type constraint may not include \'deduction\' type.');
          console.log('   This suggests the database schema needs to be updated.');
        }
      } else {
        console.log('✅ Successfully inserted deduction transaction!');
        console.log('Transaction ID:', testData[0].id);
        
        // Clean up the test transaction
        await supabase
          .from('wallet_transactions')
          .delete()
          .eq('id', testData[0].id);
        console.log('🧹 Test transaction cleaned up.');
      }
    } else {
      console.log('✅ Constraint information:');
      console.log(constraints);
    }
    
    // Also try with 'monthly_billing' type
    console.log('\n--- Testing monthly_billing type ---');
    const monthlyBillingTest = {
      gym_id: '1d86e66e-d5b4-4efb-a69f-e53f2b9e6c38',
      transaction_type: 'monthly_billing',
      amount_inr: -25,
      description: 'Test monthly billing transaction',
      balance_before_inr: 100,
      balance_after_inr: 75,
      transaction_date: new Date().toISOString()
    };
    
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('wallet_transactions')
      .insert([monthlyBillingTest])
      .select();
    
    if (monthlyError) {
      console.log('❌ Error inserting monthly_billing transaction:');
      console.log('Error message:', monthlyError.message);
    } else {
      console.log('✅ Successfully inserted monthly_billing transaction!');
      console.log('Transaction ID:', monthlyData[0].id);
      
      // Clean up
      await supabase
        .from('wallet_transactions')
        .delete()
        .eq('id', monthlyData[0].id);
      console.log('🧹 Test transaction cleaned up.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTransactionTypes();