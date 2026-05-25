import * as SQLite from 'expo-sqlite';
import { supabase } from './supabase';

export type OfflineEventType = 'presence' | 'occurrence' | 'sos' | 'ronda' | 'handover';
export type OfflineEventStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineQueueRow {
  id: string;
  type: OfflineEventType;
  idempotency_key: string;
  payload: string;
  photo_url: string | null;
  status: OfflineEventStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface OfflineQueueStats {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}

export interface EnqueueOfflineEventInput {
  type: OfflineEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  photoUrl?: string | null;
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('operacional5_offline.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_queue (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          payload TEXT NOT NULL,
          photo_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_queue_status_created ON offline_queue(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_offline_queue_idempotency ON offline_queue(idempotency_key);
      `);
      return db;
    });
  }
  return dbPromise;
}

function nowIso() {
  return new Date().toISOString();
}

function makeLocalId(type: OfflineEventType) {
  return `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error ?? 'Erro ao sincronizar evento offline.');
  const maybeContext = error as { context?: Response };
  if (!maybeContext.context) return fallback;

  try {
    const body = await maybeContext.context.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {
    // ignore
  }

  try {
    const text = await maybeContext.context.clone().text();
    if (text) return text;
  } catch {
    // ignore
  }

  return fallback;
}

export async function enqueueOfflineEvent(input: EnqueueOfflineEventInput): Promise<OfflineQueueRow> {
  const db = await getDb();
  const createdAt = nowIso();
  const id = makeLocalId(input.type);
  const payload = JSON.stringify(input.payload);

  await db.runAsync(
    `INSERT OR IGNORE INTO offline_queue
      (id, type, idempotency_key, payload, photo_url, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    [id, input.type, input.idempotencyKey, payload, input.photoUrl ?? null, createdAt, createdAt]
  );

  const row = await db.getFirstAsync<OfflineQueueRow>(
    `SELECT * FROM offline_queue WHERE idempotency_key = ? LIMIT 1`,
    [input.idempotencyKey]
  );

  if (!row) throw new Error('Não foi possível salvar evento offline.');
  return row;
}

export async function getQueueStats(): Promise<OfflineQueueStats> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: OfflineEventStatus; total: number }>(
    `SELECT status, COUNT(*) as total FROM offline_queue GROUP BY status`
  );

  const stats: OfflineQueueStats = { pending: 0, syncing: 0, synced: 0, failed: 0 };
  for (const row of rows) stats[row.status] = Number(row.total);
  return stats;
}

export async function getPendingQueue(limit = 25): Promise<OfflineQueueRow[]> {
  const db = await getDb();
  return db.getAllAsync<OfflineQueueRow>(
    `SELECT * FROM offline_queue
     WHERE status IN ('pending', 'failed')
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit]
  );
}

export async function markEventPending(id: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_queue SET status = 'pending', updated_at = ? WHERE id = ?`,
    [nowIso(), id]
  );
}

export async function syncOfflineQueue(limit = 25): Promise<SyncResult> {
  const db = await getDb();
  const rows = await getPendingQueue(limit);
  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    await db.runAsync(
      `UPDATE offline_queue SET status = 'syncing', attempts = attempts + 1, updated_at = ? WHERE id = ?`,
      [nowIso(), row.id]
    );

    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const { data, error } = await supabase.functions.invoke('sync-offline-event', {
        body: {
          type: row.type,
          idempotency_key: row.idempotency_key,
          payload,
          photo_url: row.photo_url ?? undefined,
        },
      });

      if (error) throw new Error(await readFunctionError(error));
      if (!data?.success) throw new Error(String(data?.error ?? 'Sincronização recusada pelo servidor.'));

      await db.runAsync(
        `UPDATE offline_queue SET status = 'synced', last_error = NULL, synced_at = ?, updated_at = ? WHERE id = ?`,
        [nowIso(), nowIso(), row.id]
      );
      synced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.runAsync(
        `UPDATE offline_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`,
        [message, nowIso(), row.id]
      );
      failed += 1;
    }
  }

  return { total: rows.length, synced, failed };
}

export async function clearSyncedEvents(olderThanDays = 7) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(`DELETE FROM offline_queue WHERE status = 'synced' AND synced_at < ?`, [cutoff]);
}
