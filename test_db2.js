const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) acc[k.trim()] = v.trim().replace(/["']/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('custom_simulations').select('result').not('result', 'is', null).order('created_at', { ascending: false }).limit(1);
  if (error) console.error(error);
  else console.log(JSON.stringify(data[0].result, null, 2));
}
run();
