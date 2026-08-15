const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.join('=').trim();
    }
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data: tx, error } = await supabase.from('transactions').select('order_id, user_id, phone, created_at').order('created_at', { ascending: false }).limit(5);
  console.log("LATEST TRANSACTIONS:", JSON.stringify(tx, null, 2));
}
run();
