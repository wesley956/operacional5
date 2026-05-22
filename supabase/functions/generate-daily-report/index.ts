// OPERACIONAL5 — Edge Function: generate-daily-report
// Stub preparado para produção Supabase.

type ReportPayload = {
  company_id?: string;
  date?: string;
};

Deno.serve(async (req) => {
  try {
    const payload = (await req.json().catch(() => ({}))) as ReportPayload;
    const date = payload.date ?? new Date().toISOString().slice(0, 10);

    return new Response(
      JSON.stringify({
        ok: true,
        function: "generate-daily-report",
        mode: "stub",
        date,
        company_id: payload.company_id,
        summary: {
          posts_operated: 0,
          occurrences: 0,
          critical_occurrences: 0,
          ft_opened: 0,
          ronda_completion: 0,
        },
        note: "Conectar queries reais na etapa Supabase final.",
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
