-- ============================================================
-- OPERACIONAL5 — Edge Functions (Referência SQL)
-- Estas functions rodam no Supabase como cron jobs ou triggers.
-- Em produção, implementar como Supabase Edge Functions (Deno).
-- ============================================================

-- ============================================================
-- 1. scan_absences — Detecta ausências e gera alerta/FT automática
-- Deve rodar a cada 5 minutos via cron (pg_cron)
-- ============================================================

CREATE OR REPLACE FUNCTION scan_absences()
RETURNS TABLE(post_id UUID, post_name TEXT, missing_count INT, action TEXT) AS $$
DECLARE
  v_company RECORD;
  v_post RECORD;
  v_schedule RECORD;
  v_present_count INT;
  v_missing_count INT;
  v_alert_id UUID;
  v_ft_id UUID;
BEGIN
  -- Para cada empresa ativa
  FOR v_company IN SELECT id FROM companies WHERE active = true LOOP
    -- Para cada posto ativo com turno em andamento
    FOR v_post IN
      SELECT p.*, s.id as schedule_id, s.employee_id, s.shift_start, s.shift_end
      FROM posts p
      JOIN schedules s ON s.post_id = p.id AND s.is_active = true
      WHERE p.company_id = v_company.id
        AND p.active = true
        AND now() BETWEEN s.shift_start + (p.tolerance_minutes || ' minutes')::INTERVAL
                       AND s.shift_end
    LOOP
      -- Contar presenças válidas no turno
      SELECT COUNT(DISTINCT pr.employee_id) INTO v_present_count
      FROM presences pr
      WHERE pr.post_id = v_post.id
        AND pr.status = 'valid'
        AND pr.confirmed_at >= v_post.shift_start
        AND pr.confirmed_at < v_post.shift_end;

      v_missing_count := v_post.min_staff - v_present_count;

      -- Se há ausência após tolerância
      IF v_missing_count > 0 THEN
        -- Verificar se já existe alerta recente
        IF NOT EXISTS (
          SELECT 1 FROM alert_log al
          WHERE al.post_id = v_post.id
            AND al.type = 'ausencia'
            AND al.created_at > now() - INTERVAL '30 minutes'
        ) THEN
          -- Criar alerta
          INSERT INTO alert_log (company_id, type, target_user_id, post_id, payload, channel, status)
          VALUES (
            v_company.id, 'ausencia',
            COALESCE(
              (SELECT sp.supervisor_id FROM supervisor_posts sp WHERE sp.post_id = v_post.id LIMIT 1),
              (SELECT id FROM profiles WHERE company_id = v_company.id AND role = 'gerente' AND active = true LIMIT 1)
            ),
            v_post.id,
            jsonb_build_object(
              'message', format('Posto %s com %d de %d vigilantes após tolerância', v_post.name, v_present_count, v_post.min_staff),
              'present_count', v_present_count,
              'min_staff', v_post.min_staff,
              'missing_count', v_missing_count
            ),
            'system', 'sent'
          ) RETURNING id INTO v_alert_id;

          -- Criar FT automática se configurado
          -- (prevenido contra duplicação por verificação acima)
          INSERT INTO ft_requests (company_id, post_id, schedule_id, opened_by, reason, urgency, status, opened_at, notes)
          VALUES (
            v_company.id, v_post.id, v_post.schedule_id,
            (SELECT id FROM profiles WHERE company_id = v_company.id AND role = 'admin' LIMIT 1),
            'ausencia',
            CASE WHEN v_missing_count >= v_post.min_staff THEN 'critica' ELSE 'alta' END,
            'aberta', now(),
            format('FT automática: %d vigilante(s) ausente(s) no posto %s', v_missing_count, v_post.name)
          ) RETURNING id INTO v_ft_id;

          -- Audit
          PERFORM write_audit(v_company.id, NULL, 'auto_ft_opened', 'ft_request', v_ft_id::text,
            jsonb_build_object('post_id', v_post.id, 'missing', v_missing_count, 'automated', true)
          );

          RETURN QUERY SELECT v_post.id, v_post.name, v_missing_count, 'ft_auto_opened'::TEXT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. send_alert — Envia push/SMS/email
-- Em produção: Supabase Edge Function chamando FCM/Twilio
-- ============================================================

-- Em SQL, registramos apenas o envio. O push real é Edge Function (Deno).
-- Exemplo de Edge Function (Deno):
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { alert_id, channel } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: alert } = await supabase
    .from('alert_log')
    .select('*, profiles:fcm_token, posts:name')
    .eq('id', alert_id)
    .single()

  if (!alert) return new Response('Alert not found', { status: 404 })

  if (channel === 'push' && alert.profiles.fcm_token) {
    // FCM push
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: alert.profiles.fcm_token,
        notification: {
          title: alert.type.toUpperCase(),
          body: alert.payload?.message || 'Novo alerta',
          sound: 'default',
        },
        data: { alertId: alert.id, type: alert.type, postId: alert.post_id },
      }),
    })
  }

  if (channel === 'sms') {
    // Twilio SMS fallback
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_ACCOUNT_SID')}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: alert.profiles.phone,
        From: Deno.env.get('TWILIO_PHONE_NUMBER'),
        Body: `[OP5] ${alert.type.toUpperCase()}: ${alert.payload?.message}`,
      }),
    })
  }

  // Update alert status
  await supabase.from('alert_log').update({ channel, status: 'sent' }).eq('id', alert_id)

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
*/

-- ============================================================
-- 3. escalate_alerts — Escala alertas críticos sem ciência
-- Deve rodar a cada 10 minutos via cron
-- ============================================================

CREATE OR REPLACE FUNCTION escalate_alerts()
RETURNS TABLE(alert_id UUID, escalated_to TEXT, reason TEXT) AS $$
DECLARE
  v_alert RECORD;
  v_escalation_target UUID;
BEGIN
  -- Buscar alertas críticos sem ciência há mais de 10 minutos
  FOR v_alert IN
    SELECT al.*, p.company_id
    FROM alert_log al
    JOIN profiles p ON p.id = al.target_user_id
    WHERE al.acknowledged_at IS NULL
      AND al.type IN ('sos', 'ocorrencia_critica', 'ausencia')
      AND al.created_at < now() - INTERVAL '10 minutes'
      AND al.escalated = false
      AND al.status = 'sent'
  LOOP
    -- Determinar próximo nível de escalação
    v_escalation_target := CASE
      WHEN (SELECT role FROM profiles WHERE id = v_alert.target_user_id) = 'supervisor' THEN
        (SELECT id FROM profiles WHERE company_id = v_alert.company_id AND role = 'gerente' AND active = true LIMIT 1)
      WHEN (SELECT role FROM profiles WHERE id = v_alert.target_user_id) = 'gerente' THEN
        (SELECT id FROM profiles WHERE company_id = v_alert.company_id AND role = 'diretor' AND active = true LIMIT 1)
      ELSE NULL
    END;

    IF v_escalation_target IS NOT NULL THEN
      -- Marcar original como escalado
      UPDATE alert_log SET escalated = true WHERE id = v_alert.id;

      -- Criar novo alerta para escalação
      INSERT INTO alert_log (company_id, type, target_user_id, post_id, occurrence_id, ft_request_id, payload, channel, status, escalated)
      VALUES (
        v_alert.company_id,
        v_alert.type,
        v_escalation_target,
        v_alert.post_id,
        v_alert.occurrence_id,
        v_alert.ft_request_id,
        jsonb_build_object(
          'message', format('[ESCALADO] %s — sem ciência em 10 minutos', (v_alert.payload->>'message')::text),
          'original_alert_id', v_alert.id::text,
          'escalated', true
        ),
        'system', 'sent', false
      );

      -- Audit
      PERFORM write_audit(v_alert.company_id, NULL, 'alert_escalated', 'alert_log', v_alert.id::text,
        jsonb_build_object('from', v_alert.target_user_id::text, 'to', v_escalation_target::text)
      );

      RETURN QUERY SELECT v_alert.id, v_escalation_target::text, 'no_acknowledgement'::text;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. generate_daily_report — Gera resumo diário
-- Deve rodar uma vez ao dia (23:59) via pg_cron
-- ============================================================

CREATE OR REPLACE FUNCTION generate_daily_report()
RETURNS TABLE(company_id UUID, report_data JSONB) AS $$
DECLARE
  v_company RECORD;
  v_posts_total INT;
  v_posts_covered INT;
  v_occurrences_count INT;
  v_critical_count INT;
  v_fts_opened INT;
  v_fts_resolved INT;
  v_sos_count INT;
  v_presence_rate DECIMAL;
  v_ronda_completion DECIMAL;
BEGIN
  FOR v_company IN SELECT id FROM companies WHERE active = true LOOP
    -- Métricas do dia
    SELECT COUNT(*) INTO v_posts_total
    FROM posts WHERE company_id = v_company.id AND active = true;

    SELECT COUNT(DISTINCT pr.post_id) INTO v_posts_covered
    FROM presences pr
    JOIN posts p ON p.id = pr.post_id
    WHERE p.company_id = v_company.id
      AND pr.status = 'valid'
      AND pr.confirmed_at >= date_trunc('day', now())
      AND pr.confirmed_at < date_trunc('day', now() + interval '1 day');

    SELECT COUNT(*) INTO v_occurrences_count
    FROM occurrences WHERE company_id = v_company.id
      AND created_at >= date_trunc('day', now());

    SELECT COUNT(*) INTO v_critical_count
    FROM occurrences WHERE company_id = v_company.id
      AND severity = 'critica'
      AND created_at >= date_trunc('day', now());

    SELECT COUNT(*) INTO v_sos_count
    FROM occurrences WHERE company_id = v_company.id
      AND type = 'sos'
      AND created_at >= date_trunc('day', now());

    -- Montar report
    v_posts_covered := COALESCE(v_posts_covered, 0);
    v_presence_rate := CASE WHEN v_posts_total > 0
      THEN ROUND((v_posts_covered::DECIMAL / v_posts_total) * 100, 1)
      ELSE 0 END;

    RETURN QUERY SELECT v_company.id, jsonb_build_object(
      'date', date_trunc('day', now()),
      'posts_total', v_posts_total,
      'posts_covered', v_posts_covered,
      'occurrences_count', v_occurrences_count,
      'critical_occurrences', v_critical_count,
      'sos_count', v_sos_count,
      'presence_rate', v_presence_rate,
      'generated_at', now()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- pg_cron Setup (requer extensão pg_cron habilitada)
-- ============================================================

/*
-- Habilitar pg_cron (executar como postgres superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar scan_absences a cada 5 minutos
SELECT cron.schedule(
  'scan-absences',
  '*/5 * * * *',
  $$SELECT scan_absences();$$
);

-- Agendar escalate_alerts a cada 10 minutos
SELECT cron.schedule(
  'escalate-alerts',
  '*/10 * * * *',
  $$SELECT escalate_alerts();$$
);

-- Agendar generate_daily_report todo dia às 23:59
SELECT cron.schedule(
  'daily-report',
  '59 23 * * *',
  $$SELECT generate_daily_report();$$
);
*/
