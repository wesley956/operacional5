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

const WEB_QUEUE_KEY = 'operacional5:offline_queue';

function nowIso() {
  return new Date().toISOString();
}

function makeLocalId(type: OfflineEventType) {
  return `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function readQueue(): OfflineQueueRow[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(WEB_QUEUE_KEY) || '[]') as OfflineQueueRow[];
  } catch {
    return [];
  }
}

function writeQueue(rows: OfflineQueueRow[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WEB_QUEUE_KEY, JSON.stringify(rows));
}

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error ?? 'Erro ao sincronizar evento offline.');
  const maybeContext = error as { context?: Response };

  if (!maybeContext.context) return fallback;

  try {
    const body = await maybeContext.context.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {}

  try {
    const text = await maybeContext.context.clone().text();
    if (text) return text;
  } catch {}

  return fallback;
}

export async function enqueueOfflineEvent(input: EnqueueOfflineEventInput): Promise<OfflineQueueRow> {
  const rows = readQueue();
  const existing = rows.find((row) => row.idempotency_key === input.idempotencyKey);
  if (existing) return existing;

  const createdAt = nowIso();

  const row: OfflineQueueRow = {
    id: makeLocalId(input.type),
    type: input.type,
    idempotency_key: input.idempotencyKey,
    payload: JSON.stringify(input.payload),
    photo_url: input.photoUrl ?? null,
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: createdAt,
    updated_at: createdAt,
    synced_at: null,
  };

  writeQueue([...rows, row]);
  return row;
}

export async function getQueueStats(): Promise<OfflineQueueStats> {
  const stats: OfflineQueueStats = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
  };

  for (const row of readQueue()) {
    if (row.status in stats) {
      stats[row.status] += 1;
    }
  }

  return stats;
}

export async function getPendingQueue(limit = 25): Promise<OfflineQueueRow[]> {
  return readQueue()
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export async function markEventPending(id: string) {
  const rows = readQueue();
  writeQueue(
    rows.map((row) =>
      row.id === id
        ? { ...row, status: 'pending', updated_at: nowIso() }
        : row
    )
  );
}

export async function syncOfflineQueue(limit = 25): Promise<SyncResult> {
  const pendingRows = await getPendingQueue(limit);
  let synced = 0;
  let failed = 0;

  for (const row of pendingRows) {
    let rows = readQueue();

    rows = rows.map((item) =>
      item.id === row.id
        ? { ...item, status: 'syncing', attempts: item.attempts + 1, updated_at: nowIso() }
        : item
    );
    writeQueue(rows);

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
      if (!data?.success) {
        throw new Error(String(data?.error ?? 'Sincronização recusada pelo servidor.'));
      }

      rows = readQueue().map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: 'synced',
              last_error: null,
              synced_at: nowIso(),
              updated_at: nowIso(),
            }
          : item
      );
      writeQueue(rows);
      synced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      rows = readQueue().map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: 'failed',
              last_error: message,
              updated_at: nowIso(),
            }
          : item
      );
      writeQueue(rows);
      failed += 1;
    }
  }

  return {
    total: pendingRows.length,
    synced,
    failed,
  };
}

export async function clearSyncedEvents(olderThanDays = 7) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  writeQueue(
    readQueue().filter((row) => {
      if (row.status !== 'synced') return true;
      if (!row.synced_at) return true;
      return row.synced_at >= cutoff;
    })
  );
}
