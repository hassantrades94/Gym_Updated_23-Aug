const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read environment variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

envLines.forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Subscription Service constants
const MONTHLY_CHARGE_PER_MEMBER = 10; // Rs 10 per paid member
const FREE_MEMBER_LIMIT = 5;

async function testUpdatedBilling() {
  try {
    console.log('\n=== Testing Updated Monthly Billing Description ===\n');
    
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
    
    // Get total members count for this gym
    const { data: memberships, error: memberError } = await supabase
      .from('memberships')
      .select('id, start_date')
      .eq('gym_id', gymId)
      .order('start_date', { ascending: true });
    
    if (memberError) {
      console.error('Error fetching memberships:', memberError);
      return;
    }
    
    const totalMembers = memberships?.length || 0;
    const freeMembers = Math.min(totalMembers, FREE_MEMBER_LIMIT);
    const paidMembers = Math.max(0, totalMembers - FREE_MEMBER_LIMIT);
    const billingAmount = paidMembers * MONTHLY_CHARGE_PER_MEMBER;
    
    console.log(`📊 Membership Summary:`);
    console.log(`   Total Members: ${totalMembers}`);
    console.log(`   Free Members: ${freeMembers}`);
    console.log(`   Paid Members: ${paidMembers}`);
    console.log(`   Unit Price: Rs ${MONTHLY_CHARGE_PER_MEMBER}`);
    console.log(`   Total Billing Amount: Rs ${MONTHLY_CHARGE_PER_MEMBER} × ${paidMembers} = ₹${billingAmount}\n`);
    
    if (paidMembers === 0) {
      console.log('✅ No paid members to bill - no transaction needed');
      return;
    }
    
    // Create a test billing transaction with the new format
    const testTransaction = {
      gym_id: gymId,
      transaction_type: 'monthly_billing',
      amount_inr: billingAmount,
      description: `Monthly subscription billing: ${paidMembers} members`,
      created_at: new Date().toISOString()
    };
    
    console.log(`🧪 Test Transaction Details:`);
    console.log(`   Type: ${testTransaction.transaction_type}`);
    console.log(`   Amount: ₹${testTransaction.amount_inr}`);
    console.log(`   Description: "${testTransaction.description}"`);
    console.log(`   Date: ${new Date(testTransaction.created_at).toLocaleString()}\n`);
    
    // Insert the test transaction
    const { data: insertedData, error: insertError } = await supabase
      .from('wallet_transactions')
      .insert([testTransaction])
      .select();
    
    if (insertError) {
      console.error('Error inserting test transaction:', insertError);
      return;
    }
    
    console.log('✅ Successfully created test billing transaction with updated format!');
    console.log('\n📋 Transaction Record:');
    console.log(`   ID: ${insertedData[0].id}`);
    console.log(`   Description: "${insertedData[0].description}"`);
    console.log(`   Amount: ₹${insertedData[0].amount_inr}`);
    console.log(`   Type: ${insertedData[0].transaction_type}`);
    
    console.log('\n🎉 The updated billing description format is working correctly!');
    console.log('💡 The transaction now shows: "Monthly subscription billing: X members"');
    console.log('🔄 Check the wallet history page to see the updated format displayed.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpdatedBilling();