const path = require('path');
const fs = require('fs');

// Load env manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eq = line.indexOf('=');
  if (eq > 0) {
    const key = line.substring(0, eq);
    const val = line.substring(eq + 1);
    process.env[key] = val;
  }
});

const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Check showcase_items table
  const r1 = await s.from('showcase_items').select('id').limit(1);
  console.log('TABLE showcase_items:', r1.error ? 'ERR: ' + r1.error.message : 'OK (' + r1.data.length + ' rows)');

  // Check storage buckets
  const r2 = await s.storage.listBuckets();
  const bucketNames = r2.data?.map(x => x.name) || [];
  console.log('BUCKETS:', bucketNames.join(', '));
  console.log('showcase bucket:', bucketNames.includes('showcase') ? 'EXISTS' : 'MISSING');

  // Check admin users
  const r3 = await s.from('stores').select('clerk_user_id, role').eq('role', 'admin');
  console.log('ADMINS:', JSON.stringify(r3.data));

  process.exit(0);
})();
