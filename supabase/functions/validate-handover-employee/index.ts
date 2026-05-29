import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normalizeCode(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);

  try {
    enforceRateLimit(req, { keyPrefix: 'validate-handover-employee', maxRequests: 80, windowMs: 60000 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ ok: false, error: 'Configuração Supabase ausente.' }, 500);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ ok: false, error: 'Authorization header obrigatório.' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: 'Token inválido ou expirado.' }, 401);

    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('id, company_id, active, role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (!callerProfile || !callerProfile.active) return json({ ok: false, error: 'Perfil do usuário logado não encontrado ou inativo.' }, 403);

    const body = await req.json();
    const fieldCode = normalizeCode(body.field_code);
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!fieldCode) return json({ ok: false, error: 'Digite a matrícula/código do funcionário que vai assumir.' }, 400);

    const { data: employee, error: employeeError } = await adminClient
      .from('profiles')
      .select('id, name, email, role, active, company_id, field_code, field_pin_hash')
      .eq('company_id', callerProfile.company_id)
      .eq('field_code', fieldCode)
      .maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee || !employee.active) return json({ ok: false, error: 'Funcionário não encontrado ou inativo para esta empresa.' }, 404);

    const { data: pinOk, error: pinError } = await adminClient.rpc('verify_profile_field_pin', { p_profile_id: employee.id, p_plain_pin: pin });
    if (pinError) throw pinError;
    if (!pinOk) return json({ ok: false, error: 'PIN inválido para este funcionário.' }, 403);

    return json({ ok: true, employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role, field_code: employee.field_code, pin_required: Boolean(employee.field_pin_hash) } });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
