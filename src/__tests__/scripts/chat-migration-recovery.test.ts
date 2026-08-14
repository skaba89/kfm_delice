import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ChatMessage migration recovery contract', () => {
  const repair = readRepoFile('scripts/repair-chat-message-migration.cjs');
  const startup = readRepoFile('render-start.sh');
  const readiness = readRepoFile('scripts/verify-schema-read-only.cjs');

  it('targets only the known failed ChatMessage migration', () => {
    expect(repair).toContain("const MIGRATION_NAME = '20260713050000_add_chat_messages'");
    expect(repair).toContain("['migrate', 'resolve', '--applied', MIGRATION_NAME]");
    expect(repair).not.toContain('migrate reset');
    expect(repair).not.toContain('db push');
    expect(repair).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i);
  });

  it('fails closed unless the historical table shape can be proven', () => {
    for (const column of [
      'id',
      'restaurantId',
      'senderId',
      'senderName',
      'senderRole',
      'content',
      'createdAt',
    ]) {
      expect(repair).toContain(column);
    }

    expect(repair).toContain('ChatMessage_restaurantId_createdAt_idx');
    expect(repair).toContain('ChatMessage_restaurantId_idx');
    expect(repair).toContain('ChatMessage_pkey');
    expect(repair).toContain('ChatMessage_restaurantId_fkey');
    expect(repair).toContain('refusing to invent data-bearing fields');
  });

  it('runs the targeted repair before strict prisma migrate deploy', () => {
    const repairPosition = startup.indexOf('node scripts/repair-chat-message-migration.cjs');
    const migratePosition = startup.indexOf('node_modules/.bin/prisma migrate deploy');

    expect(repairPosition).toBeGreaterThan(-1);
    expect(migratePosition).toBeGreaterThan(-1);
    expect(repairPosition).toBeLessThan(migratePosition);
    expect(startup).toContain('targeted ChatMessage migration repair failed');
  });

  it('keeps ChatMessage in the post-migration readiness gate', () => {
    expect(readiness).toContain("'ChatMessage'");
    expect(readiness).toContain('ChatMessage: [');
    for (const column of ['restaurantId', 'senderId', 'senderName', 'senderRole', 'content', 'createdAt']) {
      expect(readiness).toContain(`'${column}'`);
    }
  });
});
