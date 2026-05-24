import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'\;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CompanyStatus = 'trialing' | 'active' | 'suspended' | 'cancelled' | 'expired';

const VALID_STATUS = new Set<CompanyStatus>(['trialing', 'active', 'suspended', 'cancelled', 'expired']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'Supabase env vars ausentes.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ ok: false, error: 'Authorization Bearer token obrigatório.' }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, error: 'Token inválido ou expirado.' }, 401);
  }

  const { data: platformAdmin, error: platformError } = await adminClient
    .from('platform_admins')
    .select('id,user_id,email,active')
    .eq('user_id', userData.user.id)
    .eq('active', true)
    .maybeSingle();

  if (platformError) {
    return json({ ok: false, error: platformError.message }, 500);
  }

  if (!platformAdmin) {
    return json({ ok: false, error: 'Apenas platform_admin ativo pode alterar status de empresa.' }, 403);
  }

  let payload: { company_id?: string; status?: CompanyStatus; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido.' }, 400);
  }

  const companyId = payload.company_id;
  const status = payload.status;
  const reason = payload.reason?.trim() || null;

  if (!companyId || typeof companyId !== 'string') {
    return json({ ok: false, error: 'company_id obrigatório.' }, 400);
  }

  if (!status || !VALID_STATUS.has(status)) {
    return json({ ok: false, error: 'status inválido.' }, 400);
  }

  const now = new Date().toISOString();
  const companyPatch: Record<string, unknown> = {
    subscription_status: status,
    active: status !== 'suspended' && status !== 'cancelled' && status !== 'expired',
  };

  if (status === 'active') {
    companyPatch.activated_at = now;
    companyPatch.suspended_at = null;
    companyPatch.cancelled_at = null;
    companyPatch.suspension_reason = null;
  }

  if (status === 'suspended') {
    companyPatch.suspended_at = now;
    companyPatch.suspension_reason = reason;
  }

  if (status === 'cancelled') {
    companyPatch.cancelled_at = now;
  }

  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .update(companyPatch)
    .eq('id', companyId)
    .select('id,name,subscription_status')
    .maybeSingle();

  if (companyError) {
    return json({ ok: false, error: companyError.message }, 500);
  }

  if (!company) {
    return json({ ok: false, error: 'Empresa não encontrada.' }, 404);
  }

  const subscriptionPatch: Record<string, unknown> = {
    status,
    updated_at: now,
    suspension_reason: status === 'suspended' ? reason : null,
  };

  if (status === 'active') subscriptionPatch.activated_at = now;
  if (status === 'suspended') subscriptionPatch.suspended_at = now;
  if (status === 'cancelled') subscriptionPatch.cancelled_at = now;

  const { data: subscription } = await adminClient
    .from('company_subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription?.id) {
    await adminClient
      .from('company_subscriptions')
      .update(subscriptionPatch)
      .eq('id', subscription.id);
  }

  await adminClient.from('global_audit_logs').insert({
    actor_id: platformAdmin.id,
    actor_type: 'platform_admin',
    action: `company_${status}`,
    target_company_id: companyId,
    metadata: {
      reason,
      status,
      company_name: company.name,
    },
  });

  return json({
    ok: true,
    company_id: companyId,
    status,
    company_name: company.name,
  });
});
