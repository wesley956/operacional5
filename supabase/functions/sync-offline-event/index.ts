// ============================================================
// OPERACIONAL5 — Edge Function: sync-offline-event
// Recebe eventos criados offline e processa com idempotência.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

type OfflineEventType = 'presence' | 'occurrence' | 'sos' | 'ronda' | 'handover';

const OFFLINE_EVENT_TYPES: OfflineEventType[] = ['presence', 'occurrence', 'sos', 'ronda', 'handover'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requiredString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function requiredObject(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = obj[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Campo obrigatório inválido: ${key}`);
  }
  return value as Record<string, unknown>;
}

function requiredEventType(obj: Record<string, unknown>): OfflineEventType {
  const value = requiredString(obj, 'type') as OfflineEventType;
  if (!OFFLINE_EVENT_TYPES.includes(value)) {
    throw new Error(`Tipo de evento offline inválido: ${value}`);
  }
  return value;
}

function pickAllowed(payload: Record<string, unknown>, allowed: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key];
  }
  return out;
}

function sanitizePayload(type: OfflineEventType, payload: Record<string, unknown>, idempotencyKey: string, photoUrl?: string) {
  if (type === 'presence') {
    const insertPayload = pickAllowed(payload, [
      'schedule_id',
      'employee_id',
      'post_id',
      'confirmed_at',
      'gps_lat',
      'gps_lng',
      'gps_valid',
      'accuracy',
      'validation_method',
      'photo_url',
      'is_mock_location',
      'mock_reasons',
      'status',
      'offline_created_at',
      'device_info',
    ]);
    insertPayload.idempotency_key = idempotencyKey;
    insertPayload.synced_at = new Date().toISOString();
    if (photoUrl) insertPayload.photo_url = photoUrl;
    return { table: 'presences', insertPayload };
  }

  if (type === 'occurrence' || type === 'sos') {
    const insertPayload = pickAllowed(payload, [
      'company_id',
      'post_id',
      'employee_id',
      'type',
      'severity',
      'description',
      'photo_url',
      'gps_lat',
      'gps_lng',
      'status',
    ]);
    insertPayload.type = type === 'sos' ? 'sos' : insertPayload.type;
    insertPayload.severity = type === 'sos' ? 'critica' : insertPayload.severity;
    insertPayload.idempotency_key = idempotencyKey;
    if (photoUrl) insertPayload.photo_url = photoUrl;
    return { table: 'occurrences', insertPayload };
  }

  if (type === 'ronda') {
    const insertPayload = pickAllowed(payload, [
      'post_id',
      'employee_id',
      'ronda_point_id',
      'gps_lat',
      'gps_lng',
      'status',
      'notes',
      'photo_url',
      'confirmed_at',
      'created_at',
    ]);
    insertPayload.idempotency_key = idempotencyKey;
    if (photoUrl) insertPayload.photo_url = photoUrl;
    return { table: 'ronda_logs', insertPayload };
  }

  const insertPayload = pickAllowed(payload, [
    'company_id',
    'post_id',
    'employee_id',
    'from_employee_id',
    'to_employee_id',
    'notes',
    'status',
    'created_at',
  ]);
  insertPayload.idempotency_key = idempotencyKey;
  return { table: 'shift_handovers', insertPayload };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'sync-offline-event',
      maxRequests: 60,
      windowMs: 60000,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Authorization header ausente.' }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ success: false, error: 'Usuário não autenticado.' }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id,company_id,role,active')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      return jsonResponse({ success: false, error: 'Perfil inválido ou inativo.' }, 403);
    }

    const body = await req.json() as Record<string, unknown>;
    const type = requiredEventType(body);
    const idempotencyKey = requiredString(body, 'idempotency_key');
    const payload = requiredObject(body, 'payload');
    const photoUrl = optionalString(body, 'photo_url');
    const companyId = requiredString(payload, 'company_id');

    if (companyId !== profile.company_id) {
      return jsonResponse({ success: false, error: 'Evento offline pertence a outra empresa.' }, 403);
    }

    const employeeId = optionalString(payload, 'employee_id');
    const elevatedRoles = ['supervisor', 'gerente', 'diretor', 'admin'];
    if (employeeId && employeeId !== profile.id && !elevatedRoles.includes(String(profile.role))) {
      return jsonResponse({ success: false, error: 'Usuário não pode sincronizar evento de outro colaborador.' }, 403);
    }

    const { table, insertPayload } = sanitizePayload(type, payload, idempotencyKey, photoUrl);

    const { data: existing } = await adminClient
      .from(table)
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ success: true, message: 'Evento já sincronizado.', id: existing.id, type });
    }

    const { data, error } = await adminClient
      .from(table)
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (type === 'sos') {
      const postId = requiredString(payload, 'post_id');

      const { data: supervisors } = await adminClient
        .from('supervisor_posts')
        .select('supervisor_id')
        .eq('post_id', postId);

      if (supervisors) {
        for (const sp of supervisors) {
          await adminClient.from('alert_log').insert({
            company_id: companyId,
            type: 'sos',
            target_user_id: sp.supervisor_id,
            post_id: postId,
            occurrence_id: data.id,
            payload: { message: 'SOS disparado pelo app mobile offline' },
            channel: 'system',
            status: 'sent',
          });
        }
      }
    }

    await adminClient.from('audit_logs').insert({
      company_id: companyId,
      actor_id: profile.id,
      action: `offline_sync_${type}`,
      entity: table,
      entity_id: data.id,
      metadata: { idempotency_key: idempotencyKey, offline: true },
    });

    return jsonResponse({ success: true, id: data.id, type });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 400);
  }
});
