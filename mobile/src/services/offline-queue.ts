// ============================================================
// OPERACIONAL5 Mobile — Offline Queue (SQLite)
// ============================================================

/**
 * Estrutura da fila offline.
 * Em produção: usar expo-sqlite para persistência real.
 * Esta é a interface e lógica que o app mobile usa.
 */

export type OfflineActionType = 'presence' | 'occurrence' | 'sos' | 'ronda' | 'handover';

export interface OfflineQueueItem {
  id: string;
  type: OfflineActionType;
  payload: string; // JSON
  local_photo_uri?: string;
  idempotency_key: string;
  created_at: string;
  synced_at?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message?: string;
  retry_count: number;
}

// SQL Schema para SQLite local
export const OFFLINE_DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS offline_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    local_photo_uri TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status);
  CREATE INDEX IF NOT EXISTS idx_queue_type ON offline_queue(type);
`;

/**
 * Gera idempotency key para ações offline.
 * Formato: timestamp-random-string
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Prioridade de sincronização.
 * SOS tem prioridade máxima e deve ser reenviado repetidamente.
 */
export function getSyncPriority(type: OfflineActionType): number {
  switch (type) {
    case 'sos': return 100;
    case 'presence': return 50;
    case 'occurrence': return 30;
    case 'ronda': return 20;
    case 'handover': return 10;
  }
}

/**
 * Ordena itens por prioridade (SOS primeiro).
 */
export function sortByPriority(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return [...items].sort((a, b) => getSyncPriority(b.type) - getSyncPriority(a.type));
}

/**
 * Máximo de tentativas antes de desistir (exceto SOS).
 */
export function getMaxRetries(type: OfflineActionType): number {
  return type === 'sos' ? Infinity : 5;
}
