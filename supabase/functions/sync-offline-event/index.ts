// ============================================================
// OPERACIONAL5 — Edge Function: sync-offline-event
// Recebe eventos criados offline e processa com idempotência.
// Segurança: exige Authorization Bearer e valida company_id do caller.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleEdgeError,
  jsonResponse,
  optionalString,
  readJsonObject,
  requiredEnum,
  requiredObject,
  requiredString,
  ValidationError,
  type JsonRecord,
} from '../_shared/validation.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const OFFLINE_EVENT_TYPES = ['presence', 'occurrence', 'sos', 'ronda', 'handover'] as const;
const ELEVATED_ROLES = ['admin', 'diretor', 'gerente', 'supervisor'] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OfflineEventType = typeof OFFLINE_EVENT_TYPES[number];

type CallerProfile = {
  id: string;
  company_id: string;
  role: string;
  active: boolean;
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function isElevated(role: string): boolean {
  return ELEVATED_ROLES.includes(role as typeof ELEVATED_ROLES[number]);
}

function stringValue(payload: JsonRecord, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function assertPayloadCompany(payload: JsonRecord, callerProfile: CallerProfile): void {
  const companyId = requiredString(payload, 'company_id');

  if (companyId !== callerProfile.company_id) {
    throw new ValidationError('Evento pertence a outra empresa.', 403);
  }
}

function assertActorIsAllowed(payload: JsonRecord, callerProfile: CallerProfile): void {
  if (isElevated(callerProfile.role)) return;

  const employeeId = stringValue(payload, 'employee_id');
  const outgoingEmployeeId = stringValue(payload, 'outgoing_employee_id');
  const incomingEmployeeId = stringValue(payload, 'incoming_employee_id');

  if (employeeId && employeeId !== callerProfile.id) {
    throw new ValidationError('Operador só pode sincronizar eventos próprios.', 403);
  }

  if (outgoingEmployeeId && outgoingEmployeeId !== callerProfile.id) {
    throw new ValidationError('Operador só pode sincronizar passagens próprias.', 403);
  }

  if (incomingEmployeeId && incomingEmployeeId !== callerProfile.id) {
    throw new ValidationError('Operador só pode sincronizar passagens próprias.', 403);
  }
}

function tableForType(type: OfflineEventType): string {
  return {
    presence: 'presences',
    occurrence: 'occurrences',
    sos: 'occurrences',
    ronda: 'ronda_logs',
    handover: 'shift_handovers',
  }[type];
}

function buildInsertPayload(type: OfflineEventType, payload: JsonRecord, idempotencyKey: string, photoUrl?: string): JsonRecord {
  const now = new Date().toISOString();
  const insertPayload: JsonRecord = {
    ...payload,
    idempotency_key: idempotencyKey,
  };

  if (photoUrl || payload.photo_url) {
    insertPayload.photo_url = photoUrl || payload.photo_url;
  }

  if (type === 'presence' || type === 'occurrence' || type === 'sos' || type === 'ronda' || type === 'handover') {
    insertPayload.synced_at = now;
  }

  if (type === 'sos') {
    insertPayload.type = 'sos';
    insertPayload.severity = insertPayload.severity || 'critica';
    insertPayload.status = insertPayload.status || 'aberta';
  }

  return insertPayload;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new ValidationError('Ambiente Supabase incompleto.', 500);
    }

    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      throw new ValidationError('Authorization header ausente.', 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();

    if (userError || !userData.user) {
      throw new ValidationError('Usuário não autenticado.', 401);
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .single<CallerProfile>();

    if (profileError || !callerProfile) {
      throw new ValidationError('Perfil do usuário autenticado não encontrado.', 403);
    }

    const body = await readJsonObject(req);
    const type = requiredEnum(body, 'type', OFFLINE_EVENT_TYPES);
    const idempotencyKey = requiredString(body, 'idempotency_key');
    const payload = requiredObject(body, 'payload');
    const photoUrl = optionalString(body, 'photo_url');

    assertPayloadCompany(payload, callerProfile);
    assertActorIsAllowed(payload, callerProfile);

    const postId = stringValue(payload, 'post_id');

    if (postId) {
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .eq('company_id', callerProfile.company_id)
        .maybeSingle();

      if (postError || !post) {
        throw new ValidationError('Posto não encontrado nesta empresa.', 403);
      }
    }

    const table = tableForType(type);

    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      return withCors(jsonResponse({
        success: true,
        message: 'Event already synced (idempotent)',
        id: existing.id,
      }));
    }

    const insertPayload = buildInsertPayload(type, payload, idempotencyKey, photoUrl);
    delete insertPayload.offline_created_at;

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      return withCors(jsonResponse({ success: false, error: error.message }, 500));
    }

    if (type === 'sos') {
      const sosPostId = requiredString(payload, 'post_id');

      const { data: supervisors } = await supabase
        .from('supervisor_posts')
        .select('supervisor_id, posts!inner(company_id)')
        .eq('post_id', sosPostId)
        .eq('posts.company_id', callerProfile.company_id);

      if (supervisors) {
        for (const sp of supervisors) {
          await supabase.from('alert_log').insert({
            company_id: callerProfile.company_id,
            type: 'sos',
            target_user_id: sp.supervisor_id,
            post_id: sosPostId,
            occurrence_id: data.id,
            payload: { message: 'SOS disparado (sync offline)' },
            channel: 'system',
            status: 'sent',
          });
        }
      }
    }

    await supabase.from('audit_logs').insert({
      company_id: callerProfile.company_id,
      actor_id: callerProfile.id,
      action: `offline_sync_${type}`,
      entity: table,
      entity_id: data.id,
      metadata: { idempotency_key: idempotencyKey, offline: true },
    });

    return withCors(jsonResponse({
      success: true,
      id: data.id,
      type,
    }));
  } catch (error) {
    return withCors(handleEdgeError(error));
  }
});
