// OPERACIONAL5 — Edge Function: send-alert
// Stub preparado para produção Supabase com validação de payload.

import {
  handleEdgeError,
  jsonResponse,
  optionalEnum,
  optionalString,
  readJsonObject,
  requiredString,
} from '../_shared/validation.ts';

const CHANNELS = ['system', 'push', 'sms', 'email'] as const;

Deno.serve(async (req) => {
  try {
    const body = await readJsonObject(req);

    const payload = {
      alert_id: optionalString(body, 'alert_id'),
      company_id: requiredString(body, 'company_id'),
      channel: optionalEnum(body, 'channel', CHANNELS) ?? 'system',
      title: requiredString(body, 'title'),
      message: requiredString(body, 'message'),
    };

    return jsonResponse({
      ok: true,
      function: 'send-alert',
      mode: 'stub',
      received: payload,
      note: 'Configurar FCM/SMS/E-mail na etapa final.',
    });
  } catch (error) {
    return handleEdgeError(error);
  }
});
