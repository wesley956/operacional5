import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CreateCompanyPayload = {
  company_name?: string;
  legal_name?: string;
  document?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  admin_name?: string;
  admin_email?: string;
  plan?: string;
  trial_days?: number;
  timezone?: string;
  locale?: string;
};

type PlatformAdminRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  active: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function onlyDigits(value: unknown): string {
  return normalizeText(value).replace(/\D/g, '');
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidCnpj(cnpj: string): boolean {
  if (!cnpj) return true;
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

function validatePayload(raw: CreateCompanyPayload) {
  const companyName = normalizeText(raw.company_name);
  const legalName = normalizeText(raw.legal_name);
  const document = onlyDigits(raw.document);
  const contactName = normalizeText(raw.contact_name);
  const contactEmail = normalizeEmail(raw.contact_email);
  const contactPhone = normalizeText(raw.contact_phone);
  const adminName = normalizeText(raw.admin_name);
  const adminEmail = normalizeEmail(raw.admin_email);
  const plan = normalizeText(raw.plan || 'free_trial') || 'free_trial';
  const trialDays = Number(raw.trial_days ?? 14);
  const timezone = normalizeText(raw.timezone || 'America/Sao_Paulo') || 'America/Sao_Paulo';
  const locale = normalizeText(raw.locale || 'pt-BR') || 'pt-BR';

  if (companyName.length < 3) throw new Error('Nome da empresa deve ter pelo menos 3 caracteres.');
  if (contactEmail && !isEmail(contactEmail)) throw new Error('E-mail de contato inválido.');
  if (!adminName || adminName.length < 3) throw new Error('Nome do admin da empresa é obrigatório.');
  if (!isEmail(adminEmail)) throw new Error('E-mail do admin da empresa inválido.');
  if (document && !isValidCnpj(document)) throw new Error('CNPJ inválido. Informe 14 dígitos válidos ou deixe em branco.');
  if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 90) {
    throw new Error('trial_days deve estar entre 1 e 90.');
  }

  return {
    companyName,
    legalName: legalName || companyName,
    document: document || null,
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    adminName,
    adminEmail,
    plan,
    trialDays,
    timezone,
    locale,
  };
}

function addDays(date: Date, days: number): string {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function isDuplicateError(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === '23505' || /duplicate|already registered|already exists|unique/i.test(error?.message ?? '');
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
    .select('id,user_id,name,email,active')
    .eq('user_id', userData.user.id)
    .eq('active', true)
    .maybeSingle<PlatformAdminRow>();

  if (platformError) {
    return json({ ok: false, error: `Erro ao validar SuperAdmin: ${platformError.message}` }, 500);
  }

  if (!platformAdmin) {
    return json({ ok: false, error: 'Somente platform_admin ativo pode criar empresas.' }, 403);
  }

  let payload: ReturnType<typeof validatePayload>;
  try {
    payload = validatePayload(await req.json());
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Payload inválido.' }, 400);
  }

  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('id,name,display_name,active')
    .eq('name', payload.plan)
    .eq('active', true)
    .maybeSingle();

  if (planError) {
    return json({ ok: false, error: `Erro ao buscar plano: ${planError.message}` }, 500);
  }

  if (!plan) {
    return json({ ok: false, error: `Plano '${payload.plan}' não encontrado ou inativo.` }, 400);
  }

  if (payload.document) {
    const { data: existingCompany, error: existingCompanyError } = await adminClient
      .from('companies')
      .select('id,name')
      .or(`document.eq.${payload.document},cnpj.eq.${payload.document}`)
      .maybeSingle();

    if (existingCompanyError) {
      return json({ ok: false, error: `Erro ao verificar CNPJ: ${existingCompanyError.message}` }, 500);
    }

    if (existingCompany) {
      return json({ ok: false, error: 'Já existe empresa cadastrada com esse CNPJ.' }, 409);
    }
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from('profiles')
    .select('id,company_id,email')
    .ilike('email', payload.adminEmail)
    .maybeSingle();

  if (existingProfileError) {
    return json({ ok: false, error: `Erro ao verificar e-mail do admin: ${existingProfileError.message}` }, 500);
  }

  if (existingProfile) {
    return json({ ok: false, error: 'Esse e-mail já está vinculado a outro perfil de empresa.' }, 409);
  }

  let companyId: string | null = null;
  let adminUserId: string | null = null;

  async function cleanup() {
    if (adminUserId) {
      await adminClient.auth.admin.deleteUser(adminUserId).catch(() => undefined);
    }
    if (companyId) {
      await adminClient.from('profiles').delete().eq('company_id', companyId);
      await adminClient.from('company_subscriptions').delete().eq('company_id', companyId);
      await adminClient.from('company_settings').delete().eq('company_id', companyId);
      await adminClient.from('global_audit_logs').delete().eq('target_company_id', companyId);
      await adminClient.from('companies').delete().eq('id', companyId);
    }
  }

  try {
    const now = new Date();
    const trialEndsAt = addDays(now, payload.trialDays);

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert({
        name: payload.companyName,
        legal_name: payload.legalName,
        cnpj: payload.document,
        document: payload.document,
        email: payload.contactEmail,
        phone: payload.contactPhone,
        contact_name: payload.contactName,
        contact_phone: payload.contactPhone,
        timezone: payload.timezone,
        locale: payload.locale,
        active: true,
        subscription_status: 'trialing',
      })
      .select('id,name')
      .single();

    if (companyError || !company) {
      if (isDuplicateError(companyError)) {
        return json({ ok: false, error: 'Já existe empresa com esse CNPJ ou documento.' }, 409);
      }
      throw new Error(companyError?.message ?? 'Falha ao criar empresa.');
    }

    companyId = company.id;

    const { error: settingsError } = await adminClient
      .from('company_settings')
      .insert({
        company_id: companyId,
        timezone: payload.timezone,
        tolerance_minutes: 15,
        default_gps_radius: 50,
        min_gps_accuracy: 50,
        require_photo: true,
        detect_mock_location: true,
        ronda_interval_minutes: 120,
      });

    if (settingsError) throw new Error(`Falha ao criar configurações: ${settingsError.message}`);

    const { error: subscriptionError } = await adminClient
      .from('company_subscriptions')
      .insert({
        company_id: companyId,
        plan_id: plan.id,
        status: 'trialing',
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEndsAt,
        created_by: platformAdmin.id,
      });

    if (subscriptionError) throw new Error(`Falha ao criar assinatura: ${subscriptionError.message}`);

    const redirectTo = Deno.env.get('CREATE_COMPANY_REDIRECT_URL') || undefined;
    const inviteResult = await adminClient.auth.admin.inviteUserByEmail(payload.adminEmail, {
      data: {
        name: payload.adminName,
        company_id: companyId,
        role: 'admin',
      },
      redirectTo,
    });

    if (inviteResult.error || !inviteResult.data.user) {
      if (isDuplicateError(inviteResult.error)) {
        await cleanup();
        return json({ ok: false, error: 'Esse e-mail já existe no Supabase Auth.' }, 409);
      }
      throw new Error(inviteResult.error?.message ?? 'Falha ao convidar admin da empresa.');
    }

    adminUserId = inviteResult.data.user.id;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: adminUserId,
        company_id: companyId,
        role: 'admin',
        name: payload.adminName,
        email: payload.adminEmail,
        ft_available: false,
        regime_trabalho: '12x36',
        data_referencia_ciclo: '2024-01-01',
        active: true,
      })
      .select('id')
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message ?? 'Falha ao criar profile do admin da empresa.');
    }

    await adminClient.from('global_audit_logs').insert({
      actor_id: platformAdmin.id,
      actor_type: 'platform_admin',
      action: 'company_created',
      target_company_id: companyId,
      target_user_id: adminUserId,
      metadata: {
        company_name: payload.companyName,
        admin_email: payload.adminEmail,
        plan: plan.name,
        trial_days: payload.trialDays,
        trial_ends_at: trialEndsAt,
      },
    });

    return json({
      ok: true,
      company_id: companyId,
      company_name: payload.companyName,
      admin_email: payload.adminEmail,
      plan: plan.name,
      trial_ends_at: trialEndsAt,
      note: 'Empresa criada e convite enviado ao admin.',
    });
  } catch (error) {
    await cleanup();
    return json({ ok: false, error: error instanceof Error ? error.message : 'Erro inesperado ao criar empresa.' }, 500);
  }
});
