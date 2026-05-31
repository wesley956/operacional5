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

function normalizeCode(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function normalizePin(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
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

    const { data: platformAdmin } = await adminClient
      .from('platform_admins')
      .select('id,user_id,email,active')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle();

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id,user_id,company_id,role,active,email')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle();

    if (callerProfileError) throw callerProfileError;

    const allowedRoles = new Set(['admin', 'diretor', 'gerente']);
    const isPlatformAdmin = Boolean(platformAdmin);

    if (!isPlatformAdmin && (!callerProfile || !allowedRoles.has(String(callerProfile.role)))) {
      return json({ ok: false, error: 'Você não tem permissão para alterar código/PIN de campo.' });
    }

    const body = await req.json();
    const employeeId = typeof body.employee_id === 'string' ? body.employee_id : '';
    const fieldCode = normalizeCode(body.field_code);
    const pin = normalizePin(body.pin);

    if (!employeeId) return json({ ok: false, error: 'Funcionário obrigatório.' });
    if (!fieldCode) return json({ ok: false, error: 'Código/matrícula obrigatório.' });
    if (fieldCode.length < 2) return json({ ok: false, error: 'Código/matrícula muito curto.' });
    if (pin && pin.length < 4) return json({ ok: false, error: 'PIN deve ter pelo menos 4 caracteres.' });

    const { data: employee, error: employeeError } = await adminClient
      .from('profiles')
      .select('id,company_id,name,email,role,active,field_code')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) throw employeeError;
    if (!employee) return json({ ok: false, error: 'Funcionário não encontrado.' });

    if (!isPlatformAdmin && employee.company_id !== callerProfile?.company_id) {
      return json({ ok: false, error: 'Funcionário pertence a outra empresa.' });
    }

    const { data: duplicate, error: duplicateError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', employee.company_id)
      .eq('field_code', fieldCode)
      .neq('id', employeeId)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return json({ ok: false, error: 'Este código/matrícula já está em uso nesta empresa.' });
    }

    const { data: updated, error: updateError } = await adminClient
      .from('profiles')
      .update({
        field_code: fieldCode,
        field_code_updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .select('id,name,email,role,active,field_code,field_code_updated_at')
      .single();

    if (updateError) throw updateError;

    let pinUpdated = false;

    if (pin) {
      const { error: pinError } = await adminClient.rpc('set_profile_field_pin', {
        p_profile_id: employeeId,
        p_plain_pin: pin,
      });

      if (pinError) throw pinError;
      pinUpdated = true;
    }

    return json({
      ok: true,
      employee: updated,
      pin_updated: pinUpdated,
    });
  } catch (err) {
    return json({ ok: false, error: formatError(err) });
  }
});
