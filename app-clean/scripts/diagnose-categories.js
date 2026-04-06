import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  const { data: profiles } = await supabase.from('profiles').select('id, telegram_chat_id').not('telegram_chat_id', 'is', null);
  console.log('Profiles with Telegram:', JSON.stringify(profiles, null, 2));

  if (profiles && profiles.length > 0) {
    const userId = profiles[0].id;
    const { data: cats } = await supabase.from('categories').select('*').eq('user_id', userId);
    console.log(`Categories for user ${userId}:`, JSON.stringify(cats, null, 2));
    
    const { data: allCats } = await supabase.from('categories').select('*').limit(20);
    console.log('Sample of all categories:', JSON.stringify(allCats, null, 2));
  }
}

diagnose();
