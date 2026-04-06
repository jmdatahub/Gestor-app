import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('api_tokens')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      name: 'Test Token',
      token_hash: 'ignore_me',
      organization_id: null,
      scopes: ['movements:read']
    });
    
  console.log('Result:', data);
  console.log('Error:', error);
}

test();
