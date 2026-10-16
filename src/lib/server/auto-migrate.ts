import { sql } from 'drizzle-orm';
import { db } from './db/index.js';

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(
    sql.raw(`SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}' LIMIT 1`)
  );
  return (result as any).rows?.length > 0 || (Array.isArray(result) && result.length > 0);
}

async function addColumnIfMissing(table: string, column: string, type: string): Promise<boolean> {
  const exists = await columnExists(table, column);
  if (!exists) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`));
    console.log(`[Auto-Migrate] Added column "${column}" to "${table}"`);
    return true;
  }
  return false;
}

export async function runAutoMigrations(): Promise<void> {
  try {
    console.log('[Auto-Migrate] Checking for missing columns...');

    const migrations = [
      { table: 'user', column: 'profession', type: 'text' },
      { table: 'user', column: 'personalInstructions', type: 'text' },
      { table: 'pricing_plan', column: 'voiceGenerationLimit', type: 'integer' },
      { table: 'otp_code', column: 'metadata', type: 'text' },
    ];

    let addedCount = 0;
    for (const { table, column, type } of migrations) {
      const added = await addColumnIfMissing(table, column, type);
      if (added) addedCount++;
    }

    if (addedCount > 0) {
      console.log(`[Auto-Migrate] ${addedCount} column(s) added successfully`);
    } else {
      console.log('[Auto-Migrate] All columns present, no migration needed');
    }
  } catch (error) {
    console.error('[Auto-Migrate] Migration check failed:', error);
  }
}
