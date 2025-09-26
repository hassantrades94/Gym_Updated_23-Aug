const { createClient } = require('@supabase/supabase-js');

// Use environment variables directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGymPlansTable() {
  console.log('\n=== CHECKING GYM_PLANS TABLE STRUCTURE ===\n');
  
  try {
    // Get table structure
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'gym_plans' })
      .select('*');
    
    if (columnsError) {
      // Fallback: Try to get a sample record to see columns
      console.log('Using fallback method to check table structure...');
      const { data: sampleData, error: sampleError } = await supabase
        .from('gym_plans')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error checking table:', sampleError.message);
        return;
      }
      
      if (sampleData && sampleData.length > 0) {
        console.log('✅ Current table columns:');
        Object.keys(sampleData[0]).forEach(col => {
          console.log(`  - ${col}`);
        });
        
        // Check if features column exists
        const hasFeatures = 'features' in sampleData[0];
        console.log(`\n${hasFeatures ? '✅' : '❌'} Features column: ${hasFeatures ? 'EXISTS' : 'MISSING'}`);
        
        if (hasFeatures) {
          console.log('\n📋 Sample features data:');
          sampleData.forEach((plan, index) => {
            console.log(`  Plan ${index + 1}: "${plan.features}"`);
          });
        }
      } else {
        console.log('⚠️  No data found in gym_plans table');
      }
    } else {
      console.log('✅ Table structure retrieved successfully');
      console.log(columns);
    }
    
    // Check if we need to run the migration
    const { data: allPlans, error: allPlansError } = await supabase
      .from('gym_plans')
      .select('id, plan_name, features')
      .limit(5);
    
    if (!allPlansError && allPlans) {
      console.log('\n📊 Current gym plans with features:');
      allPlans.forEach(plan => {
        console.log(`  - ${plan.plan_name}: "${plan.features || 'NULL'}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
  
  console.log('\n=== TABLE STRUCTURE CHECK COMPLETE ===');
}

checkGymPlansTable();