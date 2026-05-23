// ============================================================
// OPERACIONAL5 — Edge Function: escalate-alerts
// Escala alertas críticos sem ciência para o próximo nível
// Deve rodar a cada 10 minutos
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleEdgeError,
  jsonResponse,
  optionalBoolean,
  optionalString,
  readJsonObject,
} from '../_shared/validation.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    enforceRateLimit(req, {
      keyPrefix: 'escalate-alerts',
      maxRequests: 20,
      windowMs: 60000,
    });

    const body = await readJsonObject(req);
    const companyIdFilter = optionalString(body, 'company_id');
    const dryRun = optionalBoolean(body, 'dry_run') ?? false;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    let query = supabase
      .from('alert_log')
      .select('*, profiles:target_user_id(role, company_id)')
      .in('type', ['sos', 'ocorrencia_critica', 'ausencia'])
      .is('acknowledged_at', null)
      .eq('escalated', false)
      .lt('created_at', tenMinutesAgo);

    if (companyIdFilter) {
      query = query.eq('company_id', companyIdFilter);
    }

    const { data: unacknowledged } = await query;

    if (!unacknowledged || unacknowledged.length === 0) {
      return jsonResponse({ success: true, message: 'No alerts to escalate', escalated: 0, details: [] });
    }

    const escalations: Record<string, unknown>[] = [];

    for (const alert of unacknowledged) {
      const role = alert.profiles?.role;
      const companyId = alert.profiles?.company_id;

      let nextRole = '';
      if (role === 'supervisor') nextRole = 'gerente';
      else if (role === 'gerente') nextRole = 'diretor';
      else continue;

      const { data: nextTarget } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', nextRole)
        .eq('active', true)
        .limit(1)
        .single();

      if (!nextTarget) continue;

      if (!dryRun) {
        await supabase
          .from('alert_log')
          .update({ escalated: true })
          .eq('id', alert.id);

        await supabase.from('alert_log').insert({
          company_id: alert.company_id,
          type: alert.type,
          target_user_id: nextTarget.id,
          post_id: alert.post_id,
          occurrence_id: alert.occurrence_id,
          ft_request_id: alert.ft_request_id,
          payload: {
            ...alert.payload,
            original_alert_id: alert.id,
            escalated: true,
          },
          channel: 'system',
          status: 'sent',
          escalated: false,
        });
      }

      escalations.push({
        alert_id: alert.id,
        from_role: role,
        to_role: nextRole,
        to_user_id: nextTarget.id,
        action: dryRun ? 'would_escalate' : 'escalated',
      });
    }

    return jsonResponse({
      success: true,
      dry_run: dryRun,
      escalated: escalations.length,
      details: escalations,
    });
  } catch (error) {
    return handleEdgeError(error);
  }
});
