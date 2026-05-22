// ============================================================
// OPERACIONAL5 — Edge Function: sync-offline-event
// Recebe eventos criados offline e processa com idempotência
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { type, idempotency_key, payload, photo_url } = await req.json();

    if (!type || !idempotency_key) {
      return new Response(JSON.stringify({ error: 'Missing type or idempotency_key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Verificar idempotência — se já existe, retornar sucesso sem duplicar
    const tables: Record<string, string> = {
      presence: 'presences',
      occurrence: 'occurrences',
      sos: 'occurrences',
      ronda: 'ronda_logs',
      handover: 'shift_handovers',
    };

    const table = tables[type];
    if (!table) {
      return new Response(JSON.stringify({ error: `Unknown event type: ${type}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Event already synced (idempotent)',
        id: existing.id,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Inserir novo evento
    const insertPayload = {
      ...payload,
      idempotency_key,
      photo_url: photo_url || payload.photo_url,
      synced_at: new Date().toISOString(),
    };

    // Remover campos que podem causar conflito
    delete insertPayload.offline_created_at;

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Ações pós-inserção baseadas no tipo
    if (type === 'sos') {
      // Disparar alertas para supervisor e gerente
      const { data: supervisors } = await supabase
        .from('supervisor_posts')
        .select('supervisor_id')
        .eq('post_id', payload.post_id);

      if (supervisors) {
        for (const sp of supervisors) {
          await supabase.from('alert_log').insert({
            company_id: payload.company_id,
            type: 'sos',
            target_user_id: sp.supervisor_id,
            post_id: payload.post_id,
            occurrence_id: data.id,
            payload: { message: `SOS disparado (sync offline)` },
            channel: 'system',
            status: 'sent',
          });
        }
      }
    }

    // 4. Audit
    await supabase.from('audit_logs').insert({
      company_id: payload.company_id,
      action: `offline_sync_${type}`,
      entity: table,
      entity_id: data.id,
      metadata: { idempotency_key, offline: true },
    });

    return new Response(JSON.stringify({
      success: true,
      id: data.id,
      type,
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
