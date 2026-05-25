import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não permitido.' }, 405);
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'send-alert',
      maxRequests: 120,
      windowMs: 60000,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: 'Configuração Supabase ausente.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return json({ ok: false, error: 'Authorization header obrigatório.' }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: 'Token inválido ou expirado.' }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('id, active')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if ((!callerProfile || !callerProfile.active) && (!platformAdmin || !platformAdmin.active)) {
      return json({ ok: false, error: 'Usuário não autorizado.' }, 403);
    }

    const body = await req.json();

    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : 'Operacional5';

    const message = typeof body.body === 'string' && body.body.trim()
      ? body.body.trim()
      : 'Novo alerta operacional.';

    const roles = asStringArray(body.roles);
    const targetUserIds = asStringArray(body.target_user_ids);
    const alertLogId = typeof body.alert_log_id === 'string' ? body.alert_log_id : null;

    const companyId = typeof body.company_id === 'string'
      ? body.company_id
      : callerProfile?.company_id;

    if (!companyId) {
      return json({ ok: false, error: 'company_id obrigatório.' }, 400);
    }

    if (callerProfile && callerProfile.company_id !== companyId && !platformAdmin?.active) {
      return json({ ok: false, error: 'Você não pode enviar alertas para outra empresa.' }, 403);
    }

    let targetProfileIds: string[] = [...targetUserIds];

    if (roles.length > 0) {
      const { data: roleProfiles, error: roleError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('active', true)
        .in('role', roles);

      if (roleError) throw roleError;
      targetProfileIds.push(...(roleProfiles ?? []).map((item) => String(item.id)));
    }

    targetProfileIds = Array.from(new Set(targetProfileIds));

    if (targetProfileIds.length === 0) {
      return json({ ok: false, error: 'Nenhum destinatário informado.' }, 400);
    }

    const { data: tokens, error: tokenError } = await adminClient
      .from('device_tokens')
      .select('id,user_id,company_id,token,platform,token_type')
      .eq('company_id', companyId)
      .eq('active', true)
      .in('user_id', targetProfileIds);

    if (tokenError) throw tokenError;

    const validTokens = (tokens ?? []).filter((item) => {
      const token = String(item.token ?? '');
      const tokenType = String(item.token_type ?? 'expo');
      return tokenType === 'expo' && isExpoPushToken(token);
    });

    if (validTokens.length === 0) {
      return json({
        ok: false,
        error: 'Nenhum Expo Push Token ativo encontrado para os destinatários.',
        target_count: targetProfileIds.length,
      }, 404);
    }

    const messages = validTokens.map((item) => ({
      to: item.token,
      sound: 'default',
      title,
      body: message,
      priority: 'high',
      data: {
        ...(typeof body.data === 'object' && body.data ? body.data : {}),
        company_id: companyId,
      },
    }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    const pushJson = await pushResponse.json();

    const results = Array.isArray(pushJson?.data) ? pushJson.data : [];
    const logs = validTokens.map((item, index) => {
      const ticket = results[index] ?? {};
      const status = ticket.status === 'ok' ? 'sent' : 'failed';

      return {
        company_id: companyId,
        alert_log_id: alertLogId,
        target_user_id: item.user_id,
        device_token_id: item.id,
        channel: 'expo_push',
        status,
        fcm_message_id: typeof ticket.id === 'string' ? ticket.id : null,
        error_message: ticket.message ?? ticket.details?.error ?? null,
        sent_at: new Date().toISOString(),
      };
    });

    if (logs.length > 0) {
      const { error: logError } = await adminClient
        .from('notification_logs')
        .insert(logs);

      if (logError) {
        console.error('notification_logs insert failed', logError);
      }
    }

    return json({
      ok: pushResponse.ok,
      provider: 'expo',
      sent: logs.filter((item) => item.status === 'sent').length,
      failed: logs.filter((item) => item.status === 'failed').length,
      target_count: targetProfileIds.length,
      token_count: validTokens.length,
      response: pushJson,
    }, pushResponse.ok ? 200 : 502);
  } catch (err) {
    return json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
