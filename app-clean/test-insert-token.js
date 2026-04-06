import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config(); // using the example that has the keys or .env

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // get any user
  const { data: users, error: userErr } = await supabase.from('profiles').select('id').limit(1);
  if (!users || users.length === 0) {
    console.log('No users found'); return;
  }
  const userId = users[0].id;
  
  console.log('Testing insert for user:', userId);
  
  const { data, error } = await supabase
    .from('api_tokens')
    .insert({
      user_id: userId,
      name: 'Test Token',
      token_hash: 'testhash123',
      organization_id: null,
      scopes: ['movements:read'],
      expires_at: null,
    })
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .single();
    
  console.log('Result:', data);
  console.log('Error:', error);
}

test();
