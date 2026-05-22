// ============================================================
// OPERACIONAL5 — Edge Function: scan-absences
// Detecta ausência de operadores e abre FT automática
// Deve rodar a cada 5 minutos via pg_cron ou scheduler
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Buscar postos ativos com turno em andamento
    const { data: activeShifts } = await supabase
      .from('schedules')
      .select('id, post_id, employee_id, shift_start, shift_end, posts(*)')
      .eq('is_active', true)
      .lt('shift_start', new Date().toISOString())
      .gt('shift_end', new Date().toISOString());

    if (!activeShifts || activeShifts.length === 0) {
      return new Response(JSON.stringify({ message: 'No active shifts found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, unknown>[] = [];

    for (const shift of activeShifts) {
      const post = shift.posts;
      if (!post || !post.active) continue;

      // 2. Calcular tolerância
      const toleranceMs = (post.tolerance_minutes || 15) * 60 * 1000;
      const shiftStart = new Date(shift.shift_start);
      const now = new Date();

      if (now.getTime() - shiftStart.getTime() < toleranceMs) {
        continue; // Ainda dentro da tolerância
      }

      // 3. Verificar presença confirmada
      const { data: presences } = await supabase
        .from('presences')
        .select('id')
        .eq('employee_id', shift.employee_id)
        .eq('post_id', shift.post_id)
        .gte('confirmed_at', shift.shift_start)
        .in('status', ['valid', 'pending_review']);

      if (presences && presences.length > 0) {
        continue; // Presença confirmada
      }

      // 4. Verificar se já existe alerta recente
      const { data: existingAlerts } = await supabase
        .from('alert_log')
        .select('id')
        .eq('post_id', shift.post_id)
        .eq('type', 'ausencia')
        .gt('created_at', new Date(now.getTime() - 30 * 60 * 1000).toISOString());

      if (existingAlerts && existingAlerts.length > 0) {
        continue; // Alerta já existe
      }

      // 5. Buscar supervisor do posto
      const { data: supervisorPost } = await supabase
        .from('supervisor_posts')
        .select('supervisor_id')
        .eq('post_id', shift.post_id)
        .limit(1)
        .single();

      const targetUserId = supervisorPost?.supervisor_id;

      // 6. Criar alerta de ausência
      if (targetUserId) {
        await supabase.from('alert_log').insert({
          company_id: post.company_id,
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

      // 7. Abrir FT automática
      const { data: existingFT } = await supabase
        .from('ft_requests')
        .select('id')
        .eq('post_id', shift.post_id)
        .in('status', ['aberta', 'acionando'])
        .gt('opened_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString());

      if (!existingFT || existingFT.length === 0) {
        await supabase.from('ft_requests').insert({
          company_id: post.company_id,
          post_id: shift.post_id,
          schedule_id: shift.id,
          opened_by: targetUserId,
          reason: 'ausencia',
          urgency: 'alta',
          status: 'aberta',
          notes: `FT automática: operador ausente no posto ${post.name}`,
        });
      }

      // 8. Audit log
      await supabase.from('audit_logs').insert({
        company_id: post.company_id,
        action: 'auto_ft_opened',
        entity: 'ft_request',
        entity_id: shift.post_id,
        metadata: { employee_id: shift.employee_id, automated: true },
      });

      results.push({
        post_id: shift.post_id,
        employee_id: shift.employee_id,
        action: 'ft_auto_opened',
      });
    }

    return new Response(JSON.stringify({
      success: true,
      scanned: activeShifts.length,
      actions: results,
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
