const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eq = line.indexOf('=');
  if (eq > 0) process.env[line.substring(0, eq)] = line.substring(eq + 1);
});

const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Try without role column
  const r1 = await s.from('stores').select('id, clerk_user_id, name').limit(5);
  console.log('STORES (no role):', JSON.stringify(r1.data, null, 2));
  console.log('STORES error:', r1.error ? r1.error.message : 'none');

  // Try with role column
  const r2 = await s.from('stores').select('id, role').limit(1);
  console.log('ROLE COLUMN:', r2.error ? 'ERR: ' + r2.error.message : 'OK: ' + JSON.stringify(r2.data));
  
  process.exit(0);
})();
