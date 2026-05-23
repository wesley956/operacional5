// ============================================================
// OPERACIONAL5 — Edge Function: sync-offline-event
// Recebe eventos criados offline e processa com idempotência
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleEdgeError,
  jsonResponse,
  optionalString,
  readJsonObject,
  requiredEnum,
  requiredObject,
  requiredString,
} from '../_shared/validation.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

const OFFLINE_EVENT_TYPES = ['presence', 'occurrence', 'sos', 'ronda', 'handover'] as const;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    enforceRateLimit(req, {
      keyPrefix: 'sync-offline-event',
      maxRequests: 60,
      windowMs: 60000,
    });

    const body = await readJsonObject(req);

    const type = requiredEnum(body, 'type', OFFLINE_EVENT_TYPES);
    const idempotencyKey = requiredString(body, 'idempotency_key');
    const payload = requiredObject(body, 'payload');
    const photoUrl = optionalString(body, 'photo_url');

    const tables: Record<typeof type, string> = {
      presence: 'presences',
      occurrence: 'occurrences',
      sos: 'occurrences',
      ronda: 'ronda_logs',
      handover: 'shift_handovers',
    };

    const table = tables[type];

    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        success: true,
        message: 'Event already synced (idempotent)',
        id: existing.id,
      });
    }

    const insertPayload: Record<string, unknown> = {
      ...payload,
      idempotency_key: idempotencyKey,
      photo_url: photoUrl || payload.photo_url,
      synced_at: new Date().toISOString(),
    };

    delete insertPayload.offline_created_at;

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (type === 'sos') {
      const postId = requiredString(payload, 'post_id');
      const companyId = requiredString(payload, 'company_id');

      const { data: supervisors } = await supabase
        .from('supervisor_posts')
        .select('supervisor_id')
        .eq('post_id', postId);

      if (supervisors) {
        for (const sp of supervisors) {
          await supabase.from('alert_log').insert({
            company_id: companyId,
            type: 'sos',
            target_user_id: sp.supervisor_id,
            post_id: postId,
            occurrence_id: data.id,
            payload: { message: 'SOS disparado (sync offline)' },
            channel: 'system',
            status: 'sent',
          });
        }
      }
    }

    await supabase.from('audit_logs').insert({
      company_id: requiredString(payload, 'company_id'),
      action: `offline_sync_${type}`,
      entity: table,
      entity_id: data.id,
      metadata: { idempotency_key: idempotencyKey, offline: true },
    });

    return jsonResponse({
      success: true,
      id: data.id,
      type,
    });
  } catch (error) {
    return handleEdgeError(error);
  }
});
