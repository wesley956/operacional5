// OPERACIONAL5 — Edge Function: generate-daily-report
// Stub preparado para produção Supabase com validação de payload.

import {
  assertIsoDateString,
  handleEdgeError,
  jsonResponse,
  optionalString,
  readJsonObject,
  requiredString,
} from '../_shared/validation.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

Deno.serve(async (req) => {
  try {
    enforceRateLimit(req, {
      keyPrefix: 'generate-daily-report',
      maxRequests: 10,
      windowMs: 60000,
    });

    const body = await readJsonObject(req);

    const companyId = requiredString(body, 'company_id');
    const date = optionalString(body, 'date') ?? new Date().toISOString().slice(0, 10);

    assertIsoDateString(date, 'date');

    return jsonResponse({
      ok: true,
      function: 'generate-daily-report',
      mode: 'stub',
      date,
      company_id: companyId,
      summary: {
        posts_operated: 0,
        occurrences: 0,
        critical_occurrences: 0,
        ft_opened: 0,
        ronda_completion: 0,
      },
      note: 'Conectar queries reais na etapa Supabase final.',
    });
  } catch (error) {
    return handleEdgeError(error);
  }
});
