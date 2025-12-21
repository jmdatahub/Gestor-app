
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envPath = path.resolve(process.cwd(), '.env');
let env = {};
try {
  const data = fs.readFileSync(envPath, 'utf8');
  data.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      env[key] = value;
    }
  });
} catch (e) {
  console.log("No .env file found");
}

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Verifying migration...");
  const { data, error } = await supabase.from('accounts').select('id, parent_account_id').limit(1);

  if (error) {
    const msg = `FAILED: ${error.message}`;
    fs.writeFileSync('migration_status.txt', msg);
    console.error(msg);
    process.exit(1);
  }
  fs.writeFileSync('migration_status.txt', 'SUCCESS');
  console.log("✅ Success: parent_account_id column detected.");
}

verify();
