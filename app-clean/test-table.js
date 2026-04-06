import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config(); 

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // anon key can do this

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('api_tokens')
    .select('*')
    .limit(1);
    
  console.log('Result:', data);
  console.log('Error:', error);
}

test();
