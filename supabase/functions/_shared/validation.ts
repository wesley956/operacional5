// OPERACIONAL5 — Shared Edge Function Validation

export type JsonRecord = Record<string, unknown>;

export class ValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function readJsonObject(req: Request): Promise<JsonRecord> {
  if (req.method !== 'POST') {
    throw new ValidationError('Método inválido. Use POST.');
  }

  const body = await req.json().catch(() => ({}));

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Payload precisa ser um objeto JSON.');
  }

  return body as JsonRecord;
}

export function optionalString(payload: JsonRecord, key: string): string | undefined {
  const value = payload[key];

  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value !== 'string') {
    throw new ValidationError(`Campo ${key} precisa ser string.`);
  }

  return value;
}

export function requiredString(payload: JsonRecord, key: string): string {
  const value = optionalString(payload, key);

  if (!value) {
    throw new ValidationError(`Campo obrigatório ausente: ${key}.`);
  }

  return value;
}

export function optionalBoolean(payload: JsonRecord, key: string): boolean | undefined {
  const value = payload[key];

  if (value === undefined || value === null) return undefined;

  if (typeof value !== 'boolean') {
    throw new ValidationError(`Campo ${key} precisa ser boolean.`);
  }

  return value;
}

export function requiredObject(payload: JsonRecord, key: string): JsonRecord {
  const value = payload[key];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`Campo ${key} precisa ser objeto.`);
  }

  return value as JsonRecord;
}

export function optionalEnum<T extends string>(
  payload: JsonRecord,
  key: string,
  values: readonly T[],
): T | undefined {
  const value = optionalString(payload, key);

  if (!value) return undefined;

  if (!values.includes(value as T)) {
    throw new ValidationError(`Campo ${key} inválido: ${value}.`);
  }

  return value as T;
}

export function requiredEnum<T extends string>(
  payload: JsonRecord,
  key: string,
  values: readonly T[],
): T {
  const value = optionalEnum(payload, key, values);

  if (!value) {
    throw new ValidationError(`Campo obrigatório ausente: ${key}.`);
  }

  return value;
}

export function assertIsoDateString(value: string, key: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Campo ${key} precisa estar no formato YYYY-MM-DD.`);
  }
}

export function handleEdgeError(error: unknown): Response {
  if (error instanceof ValidationError) {
    return jsonResponse({ ok: false, error: error.message }, error.status);
  }

  return jsonResponse({
    ok: false,
    error: error instanceof Error ? error.message : 'Erro desconhecido',
  }, 500);
}
