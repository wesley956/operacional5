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
  try { return JSON.stringify(err); } catch { return String(err); }
}

function asLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.min(Math.max(Math.floor(numeric), 1), 80);
}

function normalizeDate(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : new Date().toISOString();
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
    if (userError || !userData.user) return json({ ok: false, error: 'Token inválido ou expirado.' });

    const body = await req.json().catch(() => ({}));
    const limit = asLimit((body as { limit?: unknown }).limit);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id,user_id,company_id,role,active,name,email')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle();

    if (callerProfileError) throw callerProfileError;
    if (!callerProfile?.company_id) return json({ ok: false, error: 'Usuário autenticado sem empresa ativa.' });

    const companyId = String(callerProfile.company_id);

    const { data: profilesData, error: profilesError } = await adminClient
      .from('profiles')
      .select('id,name,email,role,company_id,active')
      .eq('company_id', companyId);
    if (profilesError) throw profilesError;

    const { data: postsData, error: postsError } = await adminClient
      .from('posts')
      .select('id,name,company_id')
      .eq('company_id', companyId);
    if (postsError) throw postsError;

    const profiles = profilesData ?? [];
    const posts = postsData ?? [];
    const employeeIds = profiles.map((profile) => String(profile.id));
    const postIds = posts.map((post) => String(post.id));

    const profileById = new Map(profiles.map((profile) => [
      String(profile.id),
      {
        name: String(profile.name ?? 'Funcionário'),
        email: typeof profile.email === 'string' ? profile.email : null,
        role: typeof profile.role === 'string' ? profile.role : null,
      },
    ]));

    const postById = new Map(posts.map((post) => [String(post.id), { name: String(post.name ?? 'Posto') }]));
    const warnings: string[] = [];

    async function optionalQuery<T>(label: string, run: () => Promise<{ data: T[] | null; error: unknown }>): Promise<T[]> {
      try {
        const result = await run();
        if (result.error) {
          warnings.push(`${label}: ${formatError(result.error)}`);
          return [];
        }
        return result.data ?? [];
      } catch (err) {
        warnings.push(`${label}: ${formatError(err)}`);
        return [];
      }
    }

    const presences = employeeIds.length === 0 ? [] : await optionalQuery<Record<string, unknown>>('presences', () =>
      adminClient
        .from('presences')
        .select('id,employee_id,post_id,status,confirmed_at,created_at,gps_lat,gps_lng,gps_valid,accuracy,validation_method,photo_url,is_mock_location')
        .in('employee_id', employeeIds)
        .order('confirmed_at', { ascending: false })
        .limit(limit)
    );

    const occurrences = employeeIds.length === 0 ? [] : await optionalQuery<Record<string, unknown>>('occurrences', () =>
      adminClient
        .from('occurrences')
        .select('id,employee_id,post_id,type,severity,status,description,created_at,photo_url,gps_lat,gps_lng')
        .in('employee_id', employeeIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 30))
    );

    const rondas = employeeIds.length === 0 ? [] : await optionalQuery<Record<string, unknown>>('ronda_logs', () =>
      adminClient
        .from('ronda_logs')
        .select('id,employee_id,post_id,status,created_at,confirmed_at,gps_lat,gps_lng,photo_url')
        .in('employee_id', employeeIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 30))
    );

    const handovers = postIds.length === 0 ? [] : await optionalQuery<Record<string, unknown>>('shift_handovers', () =>
      adminClient
        .from('shift_handovers')
        .select('id,post_id,outgoing_employee_id,incoming_employee_id,status,created_at,notes,incoming_photo_url,gps_lat,gps_lng')
        .in('post_id', postIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 30))
    );

    const events: Record<string, unknown>[] = [];

    for (const row of presences) {
      const employeeId = String(row.employee_id ?? '');
      const postId = String(row.post_id ?? '');
      const employee = profileById.get(employeeId);
      const post = postById.get(postId);
      const employeeName = employee?.name ?? 'Funcionário';
      const postName = post?.name ?? null;
      events.push({
        id: String(row.id),
        kind: 'presence',
        title: `${employeeName} assumiu posto`,
        description: postName ? `Posto: ${postName}` : 'Assunção de posto registrada.',
        status: String(row.status ?? 'unknown'),
        created_at: normalizeDate(row.confirmed_at ?? row.created_at),
        post_name: postName,
        employee_name: employeeName,
        gps_lat: row.gps_lat ?? null,
        gps_lng: row.gps_lng ?? null,
        gps_valid: row.gps_valid ?? null,
        accuracy: row.accuracy ?? null,
        validation_method: row.validation_method ?? null,
        photo_url: row.photo_url ?? null,
        is_mock_location: row.is_mock_location ?? null,
      });
    }

    for (const row of occurrences) {
      const employee = profileById.get(String(row.employee_id ?? ''));
      const post = postById.get(String(row.post_id ?? ''));
      events.push({
        id: String(row.id),
        kind: 'occurrence',
        title: `Ocorrência: ${String(row.type ?? 'registro')}`,
        description: `${row.severity ? `${String(row.severity)} · ` : ''}${String(row.description ?? 'Sem descrição')}${post?.name ? ` · ${post.name}` : ''}`,
        status: String(row.status ?? 'unknown'),
        created_at: normalizeDate(row.created_at),
        post_name: post?.name ?? null,
        employee_name: employee?.name ?? null,
        gps_lat: row.gps_lat ?? null,
        gps_lng: row.gps_lng ?? null,
        photo_url: row.photo_url ?? null,
      });
    }

    for (const row of rondas) {
      const employee = profileById.get(String(row.employee_id ?? ''));
      const post = postById.get(String(row.post_id ?? ''));
      events.push({
        id: String(row.id),
        kind: 'ronda',
        title: `${employee?.name ?? 'Funcionário'} registrou ronda`,
        description: post?.name ? `Posto: ${post.name}` : 'Ponto de ronda confirmado.',
        status: String(row.status ?? 'unknown'),
        created_at: normalizeDate(row.confirmed_at ?? row.created_at),
        post_name: post?.name ?? null,
        employee_name: employee?.name ?? null,
        gps_lat: row.gps_lat ?? null,
        gps_lng: row.gps_lng ?? null,
        photo_url: row.photo_url ?? null,
      });
    }

    for (const row of handovers) {
      const incoming = profileById.get(String(row.incoming_employee_id ?? ''));
      const outgoing = profileById.get(String(row.outgoing_employee_id ?? ''));
      const post = postById.get(String(row.post_id ?? ''));
      const title = incoming?.name && outgoing?.name ? `${outgoing.name} passou para ${incoming.name}` : 'Passagem de plantão';
      events.push({
        id: String(row.id),
        kind: 'handover',
        title,
        description: `${post?.name ? `Posto: ${post.name}` : 'Passagem registrada.'}${row.notes ? ` · ${String(row.notes)}` : ''}`,
        status: String(row.status ?? 'unknown'),
        created_at: normalizeDate(row.created_at),
        post_name: post?.name ?? null,
        employee_name: incoming?.name ?? outgoing?.name ?? null,
        gps_lat: row.gps_lat ?? null,
        gps_lng: row.gps_lng ?? null,
        photo_url: row.incoming_photo_url ?? null,
      });
    }

    events.sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
    return json({ ok: true, events: events.slice(0, limit), warnings });
  } catch (err) {
    return json({ ok: false, error: formatError(err) });
  }
});
