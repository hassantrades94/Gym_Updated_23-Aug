const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=');
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.local:', error.message);
    return {};
  }
}

async function runMigration() {
  const envVars = loadEnvFile();
  
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('\n=== WALLET TRANSACTIONS TABLE MIGRATION ===');
  console.log('The columns are missing from the database.');
  console.log('Since Supabase REST API does not support DDL operations,');
  console.log('you need to add these columns manually via Supabase Dashboard.\n');
  
  console.log('MANUAL STEPS REQUIRED:');
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Navigate to Table Editor > wallet_transactions');
  console.log('3. Add the following columns:\n');
  
  console.log('COLUMN 1: balance_before_inr');
  console.log('- Type: numeric');
  console.log('- Precision: 12');
  console.log('- Scale: 2');
  console.log('- Default value: 0');
  console.log('- Not null: true\n');
  
  console.log('COLUMN 2: balance_after_inr');
  console.log('- Type: numeric');
  console.log('- Precision: 12');
  console.log('- Scale: 2');
  console.log('- Default value: 0');
  console.log('- Not null: true\n');
  
  console.log('COLUMN 3: transaction_date');
  console.log('- Type: timestamptz (timestamp with time zone)');
  console.log('- Default value: now()');
  console.log('- Not null: true\n');
  
  console.log('ALTERNATIVE: Run these SQL commands in Supabase SQL Editor:');
  console.log('\n-- Add balance_before_inr column');
  console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_before_inr DECIMAL(12,2) DEFAULT 0 NOT NULL;');
  console.log('\n-- Add balance_after_inr column');
  console.log('ALTER TABLE wallet_transactions ADD COLUMN balance_after_inr DECIMAL(12,2) DEFAULT 0 NOT NULL;');
  console.log('\n-- Add transaction_date column');
  console.log('ALTER TABLE wallet_transactions ADD COLUMN transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;');
  console.log('\n-- Update existing records');
  console.log('UPDATE wallet_transactions SET transaction_date = created_at WHERE transaction_date IS NULL;');
  console.log('UPDATE wallet_transactions SET balance_after_inr = balance_before_inr + amount_inr WHERE balance_after_inr = 0;\n');
  
  // Verify current table structure
  console.log('CURRENT TABLE STRUCTURE:');
  try {
    const { data: tableData, error: tableError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error accessing wallet_transactions:', tableError.message);
    } else {
      const columns = Object.keys(tableData[0] || {});
      console.log('Existing columns:', columns);
      
      const missingColumns = [];
      if (!columns.includes('balance_before_inr')) missingColumns.push('balance_before_inr');
      if (!columns.includes('balance_after_inr')) missingColumns.push('balance_after_inr');
      if (!columns.includes('transaction_date')) missingColumns.push('transaction_date');
      
      if (missingColumns.length > 0) {
        console.log('Missing columns:', missingColumns);
        console.log('\n❌ Migration needed - Please add the columns manually as described above.');
      } else {
        console.log('\n✅ All required columns are present!');
      }
    }
  } catch (error) {
    console.error('Error checking table structure:', error.message);
  }
}

runMigration();