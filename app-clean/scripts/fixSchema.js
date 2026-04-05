import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const passTxt = fs.readFileSync('../pass.txt', 'utf8');
const projectRef = passTxt.split('\n').find(l => l.includes('SUPABASE_PROJECT_REF')).split('=')[1].trim();
const password = passTxt.split('\n').find(l => l.includes('SUPABASE_DATABASE_PASSWORD')).split('=')[1].trim();

const client = new Client({
  connectionString: `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log("Connected to DB!");
  
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'accounts'
  `);
  console.log("accounts columns:", res.rows.map(r => r.column_name));
  
  const columns = res.rows.map(r => r.column_name);
  if (columns.includes('parent_id') && !columns.includes('parent_account_id')) {
    console.log("Renaming parent_id to parent_account_id...");
    await client.query(`ALTER TABLE accounts RENAME COLUMN parent_id TO parent_account_id`);
    console.log("Renamed successfully.");
  } else if (!columns.includes('parent_account_id')) {
    console.log("Adding parent_account_id...");
    await client.query(`ALTER TABLE accounts ADD COLUMN parent_account_id UUID REFERENCES accounts(id)`);
    console.log("Added successfully.");
  } else {
    console.log("parent_account_id already exists.");
  }
  
  await client.end();
}

run().catch(console.error);
