// ============================================================
// OPERACIONAL5 — Edge Function: create-employee
// ============================================================
// Cria usuário no Supabase Auth + profile operacional.
// Deve ser chamada pelo frontend com Authorization Bearer do usuário logado.
// Apenas gerente, diretor e admin podem criar funcionários.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Role = 'admin' | 'diretor' | 'gerente' | 'supervisor' | 'lider' | 'operador';
type RegimeTrabalho = '12x36' | '12x36_noturno' | '24x48' | 'custom';

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

class ValidationError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function requiredString(payload: JsonRecord, key: string): string {
  const value = payload[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`Campo obrigatório inválido: ${key}.`);
  }

  return value.trim();
}

function optionalString(payload: JsonRecord, key: string): string | undefined {
  const value = payload[key];

  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value !== 'string') {
    throw new ValidationError(`Campo ${key} precisa ser string.`);
  }

  return value.trim();
}

function optionalBoolean(payload: JsonRecord, key: string, fallback = false): boolean {
  const value = payload[key];

  if (value === undefined || value === null) return fallback;

  if (typeof value !== 'boolean') {
    throw new ValidationError(`Campo ${key} precisa ser boolean.`);
  }

  return value;
}

function enumValue<T extends string>(
  payload: JsonRecord,
  key: string,
  values: readonly T[],
  fallback?: T,
): T {
  const value = payload[key];

  if ((value === undefined || value === null || value === '') && fallback) {
    return fallback;
  }

  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new ValidationError(`Campo ${key} inválido.`);
  }

  return value as T;
}

function assertEmail(email: string): void {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError('Email inválido.');
  }
}

function assertPassword(password: string): void {
  if (password.length < 8) {
    throw new ValidationError('Senha precisa ter pelo menos 8 caracteres.');
  }
}

async function findAuthUserByEmail(adminClient: any, email: string): Promise<{ id: string; email?: string } | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new ValidationError(error.message, 500);
    }

    const found = data.users.find((user: { id: string; email?: string }) =>
      user.email?.toLowerCase() === email.toLowerCase()
    );

    if (found) {
      return found;
    }

    if (data.users.length < 1000) {
      break;
    }
  }

  return null;
}

async function readPayload(req: Request): Promise<JsonRecord> {
  if (req.method !== 'POST') {
    throw new ValidationError('Método inválido. Use POST.', 405);
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Payload precisa ser um objeto JSON.');
  }

  return body as JsonRecord;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();

    if (userError || !userData.user) {
      throw new ValidationError('Usuário não autenticado.', 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .single();

    if (callerProfileError || !callerProfile) {
      throw new ValidationError('Perfil do usuário autenticado não encontrado.', 403);
    }

    if (!['admin', 'diretor', 'gerente'].includes(callerProfile.role)) {
      throw new ValidationError('Você não tem permissão para cadastrar funcionários.', 403);
    }

    const payload = await readPayload(req);

    const name = requiredString(payload, 'name');
    const email = requiredString(payload, 'email').toLowerCase();
    const password = requiredString(payload, 'password');
    const phone = optionalString(payload, 'phone');
    const role = enumValue<Role>(payload, 'role', ['admin', 'diretor', 'gerente', 'supervisor', 'lider', 'operador']);
    const regimeTrabalho = enumValue<RegimeTrabalho>(
      payload,
      'regime_trabalho',
      ['12x36', '12x36_noturno', '24x48', 'custom'],
      '12x36',
    );
    const dataReferenciaCiclo = optionalString(payload, 'data_referencia_ciclo') ?? '2024-01-01';
    const ftAvailable = optionalBoolean(payload, 'ft_available', false);

    assertEmail(email);
    assertPassword(password);

    let authUserId: string;
    let authUserWasCreated = false;

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
      },
    });

    if (createdUser?.user) {
      authUserId = createdUser.user.id;
      authUserWasCreated = true;
    } else {
      const message = createUserError?.message ?? '';

      if (
        message.toLowerCase().includes('already') ||
        message.toLowerCase().includes('registered') ||
        message.toLowerCase().includes('exists')
      ) {
        const existingUser = await findAuthUserByEmail(adminClient, email);

        if (!existingUser) {
          throw new ValidationError('Usuário Auth já existe, mas não foi possível localizar pelo email.', 409);
        }

        authUserId = existingUser.id;
      } else {
        throw new ValidationError(message || 'Erro ao criar usuário Auth.', 400);
      }
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (existingProfileError) {
      throw new ValidationError(existingProfileError.message, 400);
    }

    if (existingProfile) {
      return jsonResponse({
        ok: true,
        profile: existingProfile,
        reused_auth_user: true,
        reused_profile: true,
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: authUserId,
        company_id: callerProfile.company_id,
        role,
        name,
        email,
        phone,
        ft_available: ftAvailable,
        regime_trabalho: regimeTrabalho,
        data_referencia_ciclo: dataReferenciaCiclo,
        active: true,
      })
      .select('*')
      .single();

    if (profileError) {
      if (authUserWasCreated) {
        await adminClient.auth.admin.deleteUser(authUserId);
      }

      throw new ValidationError(profileError.message, 400);
    }

    await adminClient.from('audit_logs').insert({
      company_id: callerProfile.company_id,
      actor_id: callerProfile.id,
      action: authUserWasCreated ? 'employee_created' : 'employee_profile_created_for_existing_auth_user',
      entity: 'profiles',
      entity_id: profile.id,
      metadata: {
        email,
        role,
        auth_user_id: authUserId,
        auth_user_was_created: authUserWasCreated,
      },
    });

    return jsonResponse({
      ok: true,
      profile,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }

    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    }, 500);
  }
});
