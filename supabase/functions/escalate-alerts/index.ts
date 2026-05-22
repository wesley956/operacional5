// ============================================================
// OPERACIONAL5 — Edge Function: escalate-alerts
// Escala alertas críticos sem ciência para o próximo nível
// Deve rodar a cada 10 minutos
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Buscar alertas críticos sem ciência há mais de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: unacknowledged } = await supabase
      .from('alert_log')
      .select('*, profiles:target_user_id(role, company_id)')
      .in('type', ['sos', 'ocorrencia_critica', 'ausencia'])
      .is('acknowledged_at', null)
      .eq('escalated', false)
      .lt('created_at', tenMinutesAgo);

    if (!unacknowledged || unacknowledged.length === 0) {
      return new Response(JSON.stringify({ message: 'No alerts to escalate' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const escalations: Record<string, unknown>[] = [];

    for (const alert of unacknowledged) {
      const role = alert.profiles?.role;
      const companyId = alert.profiles?.company_id;

      // Determinar próximo nível
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

      // Marcar original como escalado
      await supabase
        .from('alert_log')
        .update({ escalated: true })
        .eq('id', alert.id);

      // Criar novo alerta escalado
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

      escalations.push({
        alert_id: alert.id,
        from_role: role,
        to_role: nextRole,
        to_user_id: nextTarget.id,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      escalated: escalations.length,
      details: escalations,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
