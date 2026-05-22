// OPERACIONAL5 — Edge Function: send-alert
// Stub preparado para produção Supabase.

type AlertPayload = {
  alert_id?: string;
  company_id?: string;
  channel?: "system" | "push" | "sms" | "email";
  title?: string;
  message?: string;
};

Deno.serve(async (req) => {
  try {
    const payload = (await req.json().catch(() => ({}))) as AlertPayload;

    return new Response(
      JSON.stringify({
        ok: true,
        function: "send-alert",
        mode: "stub",
        received: payload,
        note: "Configurar FCM/SMS/E-mail na etapa final.",
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
