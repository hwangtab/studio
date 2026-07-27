import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables.');
  process.exit(1);
}

const client = createClient({ url, authToken });

try {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%drizzle%';",
  );
  console.log('✅ Turso connection successful');
  console.log('Tables:', result.rows.map((row) => row.name));
} catch (error) {
  console.error('❌ Turso connection failed:', error);
  process.exit(1);
} finally {
  await client.close();
}
