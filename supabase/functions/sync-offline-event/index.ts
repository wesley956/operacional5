import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OfflineEventType = 'presence' | 'occurrence' | 'sos' | 'ronda' | 'handover';

const OFFLINE_EVENT_TYPES: OfflineEventType[] = ['presence', 'occurrence', 'sos', 'ronda', 'handover'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pickAllowed(payload: Record<string, unknown>, allowed: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = payload[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Campo obrigatório ausente: ${field}`);
  }
  return value.trim();
}

function sanitizeEventPayload(params: {
  type: OfflineEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  callerProfile: { id: string; company_id: string };
  photoUrl?: string | null;
}) {
  const { type, idempotencyKey, payload, callerProfile, photoUrl } = params;

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

    insertPayload.employee_id = callerProfile.id;
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

    insertPayload.company_id = callerProfile.company_id;
    insertPayload.employee_id = callerProfile.id;
    insertPayload.type = type === 'sos' ? 'sos' : insertPayload.type ?? 'outro';
    insertPayload.severity = type === 'sos' ? 'critica' : insertPayload.severity ?? 'media';
    insertPayload.status = insertPayload.status ?? 'aberta';
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
    ]);

    insertPayload.employee_id = callerProfile.id;
    insertPayload.status = insertPayload.status ?? 'concluida';
    insertPayload.confirmed_at = insertPayload.confirmed_at ?? new Date().toISOString();
    insertPayload.idempotency_key = idempotencyKey;
    if (photoUrl) insertPayload.photo_url = photoUrl;

    return { table: 'ronda_logs', insertPayload };
  }

  const insertPayload = pickAllowed(payload, [
    'post_id',
    'outgoing_employee_id',
    'incoming_employee_id',
    'status',
    'notes',
    'pending_items',
    'retention_reason',
    'confirmed_at',
    'incoming_photo_url',
    'gps_lat',
    'gps_lng',
    'gps_valid',
    'device_info',
  ]);

  insertPayload.outgoing_employee_id = callerProfile.id;
  insertPayload.status = insertPayload.status ?? 'confirmada';
  insertPayload.confirmed_at = insertPayload.confirmed_at ?? new Date().toISOString();
  insertPayload.idempotency_key = idempotencyKey;

  return { table: 'shift_handovers', insertPayload };
}


async function sendPresenceReviewPush(params: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  adminClient: ReturnType<typeof createClient>;
  companyId: string;
  presenceId: string | null;
  insertPayload: Record<string, unknown>;
}) {
  try {
    const employeeId = typeof params.insertPayload.employee_id === 'string' ? params.insertPayload.employee_id : null;
    const postId = typeof params.insertPayload.post_id === 'string' ? params.insertPayload.post_id : null;

    let employeeName = 'Operador';
    let postName = 'posto não informado';

    if (employeeId) {
      const { data: employee } = await params.adminClient
        .from('profiles')
        .select('name')
        .eq('id', employeeId)
        .maybeSingle();

      if (typeof employee?.name === 'string') employeeName = employee.name;
    }

    if (postId) {
      const { data: post } = await params.adminClient
        .from('posts')
        .select('name')
        .eq('id', postId)
        .maybeSingle();

      if (typeof post?.name === 'string') postName = post.name;
    }

    const hasGps = typeof params.insertPayload.gps_lat === 'number' && typeof params.insertPayload.gps_lng === 'number';
    const gpsValid = params.insertPayload.gps_valid === true;
    const isMock = params.insertPayload.is_mock_location === true;

    const reason = isMock
      ? 'GPS suspeito/mock detectado'
      : !hasGps
        ? 'Sem GPS no aparelho'
        : !gpsValid
          ? 'GPS fora do raio ou inválido'
          : 'Aguardando revisão operacional';

    await fetch(`${params.supabaseUrl}/functions/v1/send-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.anonKey,
        Authorization: params.authorization,
      },
      body: JSON.stringify({
        company_id: params.companyId,
        roles: ['supervisor', 'gerente', 'diretor', 'admin'],
        title: '⚠️ Assumir posto em revisão',
        body: `${employeeName} assumiu ${postName}, mas o registro precisa de revisão: ${reason}.`,
        data: {
          type: 'presence_review',
          source: 'offline_sync',
          presence_id: params.presenceId,
          post_id: postId,
          employee_id: employeeId,
          gps_valid: gpsValid,
          has_gps: hasGps,
          has_photo: Boolean(params.insertPayload.photo_url),
        },
      }),
    });
  } catch (err) {
    console.warn('Push de revisão de presença ignorado:', err);
  }
}


async function sendSOSPush(params: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  adminClient: ReturnType<typeof createClient>;
  companyId: string;
  occurrenceId: string | null;
  insertPayload: Record<string, unknown>;
}) {
  try {
    const employeeId = typeof params.insertPayload.employee_id === 'string' ? params.insertPayload.employee_id : null;
    const postId = typeof params.insertPayload.post_id === 'string' ? params.insertPayload.post_id : null;

    let employeeName = 'Operador';
    let postName = 'posto não informado';

    if (employeeId) {
      const { data: employee } = await params.adminClient
        .from('profiles')
        .select('name')
        .eq('id', employeeId)
        .maybeSingle();

      if (typeof employee?.name === 'string') employeeName = employee.name;
    }

    if (postId) {
      const { data: post } = await params.adminClient
        .from('posts')
        .select('name')
        .eq('id', postId)
        .maybeSingle();

      if (typeof post?.name === 'string') postName = post.name;
    }

    await fetch(`${params.supabaseUrl}/functions/v1/send-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.anonKey,
        Authorization: params.authorization,
      },
      body: JSON.stringify({
        company_id: params.companyId,
        roles: ['supervisor', 'gerente', 'diretor', 'admin'],
        title: '🚨 SOS Operacional5',
        body: `${employeeName} acionou SOS no posto ${postName}.`,
        data: {
          type: 'sos',
          source: 'offline_sync',
          occurrence_id: params.occurrenceId,
          post_id: postId,
          employee_id: employeeId,
          gps_lat: params.insertPayload.gps_lat ?? null,
          gps_lng: params.insertPayload.gps_lng ?? null,
          has_gps: params.insertPayload.gps_lat !== null && params.insertPayload.gps_lng !== null,
        },
      }),
    });
  } catch (err) {
    console.warn('Push de SOS ignorado:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Método não permitido.' }, 405);
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'sync-offline-event',
      maxRequests: 80,
      windowMs: 60000,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: 'Configuração Supabase ausente.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return json({ success: false, error: 'Authorization header obrigatório.' }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ success: false, error: 'Token inválido ou expirado.' }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, company_id, active, role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || !profile.active) {
      return json({ success: false, error: 'Perfil do usuário não encontrado ou inativo.' }, 403);
    }

    const body = await req.json();
    const type = requireString(body.type, 'type') as OfflineEventType;
    const idempotencyKey = requireString(body.idempotency_key, 'idempotency_key');
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const photoUrl = typeof body.photo_url === 'string' ? body.photo_url : null;

    if (!OFFLINE_EVENT_TYPES.includes(type)) {
      return json({ success: false, error: `Tipo de evento offline inválido: ${type}` }, 400);
    }

    const { table, insertPayload } = sanitizeEventPayload({
      type,
      idempotencyKey,
      payload,
      callerProfile: {
        id: String(profile.id),
        company_id: String(profile.company_id),
      },
      photoUrl,
    });

    const { data, error } = await adminClient
      .from(table)
      .upsert(insertPayload, { onConflict: 'idempotency_key', ignoreDuplicates: false })
      .select('id')
      .single();

    if (error) throw error;

    if (table === 'presences' && insertPayload.status === 'pending_review') {
      await sendPresenceReviewPush({
        supabaseUrl,
        anonKey,
        authorization,
        adminClient,
        companyId: String(profile.company_id),
        presenceId: data?.id ? String(data.id) : null,
        insertPayload,
      });
    }

    if (table === 'occurrences' && insertPayload.type === 'sos') {
      await sendSOSPush({
        supabaseUrl,
        anonKey,
        authorization,
        adminClient,
        companyId: String(profile.company_id),
        occurrenceId: data?.id ? String(data.id) : null,
        insertPayload,
      });
    }

    return json({
      success: true,
      table,
      id: data?.id,
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    return json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
