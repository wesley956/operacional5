import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: 'Configuração Supabase ausente.' });
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ ok: false, error: 'Authorization header obrigatório.' });

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: 'Token inválido ou expirado.' });
    }

    const body = await req.json().catch(() => ({}));
    const presenceId = typeof body.presence_id === 'string' ? body.presence_id : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

    if (!presenceId) return json({ ok: false, error: 'Registro de presença obrigatório.' });
    if (!['valid', 'rejected'].includes(status)) {
      return json({ ok: false, error: 'Status de revisão inválido.' });
    }

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('id,user_id,email,active')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle();

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id,user_id,company_id,role,active,email,name')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle();

    if (callerProfileError) throw callerProfileError;

    const allowedRoles = new Set(['admin', 'diretor', 'gerente', 'supervisor']);
    const isPlatformAdmin = Boolean(platformAdmin);

    if (!isPlatformAdmin && (!callerProfile || !allowedRoles.has(String(callerProfile.role)))) {
      return json({ ok: false, error: 'Você não tem permissão para revisar assunções de posto.' });
    }

    const { data: presence, error: presenceError } = await adminClient
      .from('presences')
      .select('id,employee_id,post_id,status')
      .eq('id', presenceId)
      .maybeSingle();

    if (presenceError) throw presenceError;
    if (!presence) return json({ ok: false, error: 'Registro não encontrado.' });

    const { data: employee, error: employeeError } = await adminClient
      .from('profiles')
      .select('id,company_id,name,email')
      .eq('id', presence.employee_id)
      .maybeSingle();

    if (employeeError) throw employeeError;
    if (!employee) return json({ ok: false, error: 'Funcionário do registro não encontrado.' });

    if (!isPlatformAdmin && employee.company_id !== callerProfile?.company_id) {
      return json({ ok: false, error: 'Registro pertence a outra empresa.' });
    }

    const { data: updated, error: updateError } = await adminClient
      .from('presences')
      .update({
        status,
        synced_at: new Date().toISOString(),
      })
      .eq('id', presenceId)
      .select('id,status,employee_id,post_id,confirmed_at')
      .single();

    if (updateError) throw updateError;

    try {
      await adminClient.from('audit_logs').insert({
        company_id: employee.company_id,
        actor_id: callerProfile?.id ?? null,
        action: status === 'valid' ? 'presence.review_approved' : 'presence.review_rejected',
        entity_type: 'presences',
        entity_id: presenceId,
        metadata: {
          previous_status: presence.status,
          status,
          reason,
          employee_id: presence.employee_id,
          post_id: presence.post_id,
        },
      });
    } catch {
      // auditoria é best-effort
    }

    return json({
      ok: true,
      presence: updated,
      message: status === 'valid'
        ? 'Assunção de posto aprovada.'
        : 'Assunção de posto rejeitada.',
    });
  } catch (err) {
    return json({ ok: false, error: formatError(err) });
  }
});
