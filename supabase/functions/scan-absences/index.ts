// ============================================================
// OPERACIONAL5 — Edge Function: scan-absences
// Detecta ausência de operadores e abre FT automática.
// Segurança: exige x-cron-secret para scheduler/pg_cron.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleEdgeError,
  jsonResponse,
  optionalBoolean,
  optionalString,
  readJsonObject,
  ValidationError,
} from '../_shared/validation.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function assertCronSecret(req: Request): void {
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? Deno.env.get('SUPABASE_CRON_SECRET');

  if (!expectedSecret) {
    throw new ValidationError('CRON_SECRET não configurado na Edge Function.', 500);
  }

  const receivedSecret = req.headers.get('x-cron-secret');

  if (receivedSecret !== expectedSecret) {
    throw new ValidationError('Chamada não autorizada para scan-absences.', 401);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'scan-absences',
      maxRequests: 20,
      windowMs: 60000,
    });

    assertCronSecret(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ValidationError('Ambiente Supabase incompleto.', 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await readJsonObject(req);
    const companyId = optionalString(body, 'company_id');
    const dryRun = optionalBoolean(body, 'dry_run') ?? false;

    let query = supabase
      .from('schedules')
      .select('id, company_id, post_id, employee_id, shift_start, shift_end, posts!inner(*)')
      .eq('is_active', true)
      .lt('shift_start', new Date().toISOString())
      .gt('shift_end', new Date().toISOString());

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data: activeShifts, error: activeShiftsError } = await query;

    if (activeShiftsError) {
      throw new ValidationError(activeShiftsError.message, 500);
    }

    if (!activeShifts || activeShifts.length === 0) {
      return withCors(jsonResponse({ success: true, message: 'No active shifts found', scanned: 0, actions: [] }));
    }

    const results: Record<string, unknown>[] = [];

    for (const shift of activeShifts) {
      const post = Array.isArray(shift.posts) ? shift.posts[0] : shift.posts;
      if (!post || !post.active || post.company_id !== shift.company_id) continue;

      const toleranceMs = (post.tolerance_minutes || 15) * 60 * 1000;
      const shiftStart = new Date(shift.shift_start);
      const now = new Date();

      if (now.getTime() - shiftStart.getTime() < toleranceMs) continue;

      const { data: presences } = await supabase
        .from('presences')
        .select('id')
        .eq('employee_id', shift.employee_id)
        .eq('post_id', shift.post_id)
        .gte('confirmed_at', shift.shift_start)
        .in('status', ['valid', 'pending_review']);

      if (presences && presences.length > 0) continue;

      const { data: existingAlerts } = await supabase
        .from('alert_log')
        .select('id')
        .eq('company_id', shift.company_id)
        .eq('post_id', shift.post_id)
        .eq('type', 'ausencia')
        .gt('created_at', new Date(now.getTime() - 30 * 60 * 1000).toISOString());

      if (existingAlerts && existingAlerts.length > 0) continue;

      const { data: supervisorPost } = await supabase
        .from('supervisor_posts')
        .select('supervisor_id, posts!inner(company_id)')
        .eq('post_id', shift.post_id)
        .eq('posts.company_id', shift.company_id)
        .limit(1)
        .maybeSingle();

      const targetUserId = supervisorPost?.supervisor_id;

      if (!dryRun && targetUserId) {
        await supabase.from('alert_log').insert({
          company_id: shift.company_id,
          type: 'ausencia',
          target_user_id: targetUserId,
          post_id: shift.post_id,
          payload: {
            message: `Ausência detectada no posto ${post.name}`,
            employee_id: shift.employee_id,
            schedule_id: shift.id,
          },
          channel: 'system',
          status: 'sent',
        });
      }

      const { data: existingFT } = await supabase
        .from('ft_requests')
        .select('id')
        .eq('company_id', shift.company_id)
        .eq('post_id', shift.post_id)
        .in('status', ['aberta', 'acionando'])
        .gt('opened_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString());

      if (!dryRun && targetUserId && (!existingFT || existingFT.length === 0)) {
        await supabase.from('ft_requests').insert({
          company_id: shift.company_id,
          post_id: shift.post_id,
          schedule_id: shift.id,
          opened_by: targetUserId,
          reason: 'ausencia',
          urgency: 'alta',
          status: 'aberta',
          notes: `FT automática: operador ausente no posto ${post.name}`,
        });
      }

      if (!dryRun) {
        await supabase.from('audit_logs').insert({
          company_id: shift.company_id,
          actor_id: targetUserId ?? null,
          action: 'auto_ft_opened',
          entity: 'ft_request',
          entity_id: shift.post_id,
          metadata: { employee_id: shift.employee_id, automated: true },
        });
      }

      results.push({
        company_id: shift.company_id,
        post_id: shift.post_id,
        employee_id: shift.employee_id,
        action: dryRun ? 'would_open_ft' : 'ft_auto_opened',
      });
    }

    return withCors(jsonResponse({
      success: true,
      dry_run: dryRun,
      scanned: activeShifts.length,
      actions: results,
    }));
  } catch (error) {
    return withCors(handleEdgeError(error));
  }
});
