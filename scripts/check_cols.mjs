import postgres from 'postgres';
const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='savings_goals' ORDER BY ordinal_position`;
console.log(cols.map(x => x.column_name).join(', '));
await sql.end();
