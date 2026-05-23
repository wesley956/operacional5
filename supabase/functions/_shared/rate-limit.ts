// OPERACIONAL5 — Shared Edge Function Rate Limit
// Rate limit em memória por instância.
// Para produção pesada, substituir por Redis/Upstash ou tabela Supabase.

type RateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request, keyPrefix: string): string {
  const auth = req.headers.get('authorization') ?? '';
  const clientId = req.headers.get('x-client-id') ?? '';
  const forwardedFor = req.headers.get('x-forwarded-for') ?? '';
  const realIp = req.headers.get('x-real-ip') ?? '';

  const identity =
    clientId ||
    auth.slice(0, 48) ||
    forwardedFor.split(',')[0]?.trim() ||
    realIp ||
    'anonymous';

  return `${keyPrefix}:${identity}`;
}

function cleanupExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function enforceRateLimit(req: Request, options: RateLimitOptions): void {
  const now = Date.now();

  cleanupExpiredBuckets(now);

  const key = getClientKey(req, options.keyPrefix);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }

  bucket.count += 1;

  if (bucket.count > options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const error = new Error(`Muitas requisições. Tente novamente em ${retryAfterSeconds}s.`);
    error.name = 'RateLimitError';
    throw error;
  }
}
