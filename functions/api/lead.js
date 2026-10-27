// Cloudflare Pages Function: POST /api/lead
// Recebe o formulário do site e entrega o lead por até três canais, conforme o que estiver configurado:
//   LEADS              binding de KV: guarda cada lead (consulta pelo painel da Cloudflare)
//   RESEND_API_KEY     + LEAD_TO_EMAIL (+ LEAD_FROM_EMAIL): envia e-mail via Resend
//   LEAD_WEBHOOK_URL   POST JSON para um webhook (n8n, Make, Zapier, CRM, Slack...)
// Se nenhum canal aceitar o lead, responde erro e o site abre o WhatsApp como alternativa.

const LIMITES = { nome: 120, empresa: 120, whatsapp: 20, email: 160, servico: 80, orcamento: 40, mensagem: 2000 };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && env.ALLOWED_ORIGIN && !env.ALLOWED_ORIGIN.split(",").map((s) => s.trim()).includes(origin)) {
    return json({ ok: false, erro: "origem" }, 403);
  }

  let dados;
  try {
    dados = await request.json();
  } catch {
    return json({ ok: false, erro: "json" }, 400);
  }
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return json({ ok: false, erro: "json" }, 400);
  }

  // Honeypot: robôs preenchem o campo escondido. Fingimos sucesso.
  if (dados.site) return json({ ok: true });

  const lead = {};
  for (const [campo, max] of Object.entries(LIMITES)) {
    // Remove caracteres de controle (evita quebra de linha no assunto do e-mail); só a mensagem mantém \n
    const controle = campo === "mensagem" ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
    lead[campo] = String(dados[campo] ?? "").replace(controle, " ").trim().slice(0, max);
  }
  const digitos = lead.whatsapp.replace(/\D/g, "").replace(/^0+/, "");
  if (!lead.nome || !lead.servico || digitos.length < 10) {
    return json({ ok: false, erro: "campos" }, 422);
  }
  if (!dados.aceite) {
    return json({ ok: false, erro: "aceite" }, 422);
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return json({ ok: false, erro: "email" }, 422);
  }

  const o = typeof dados.origem === "object" && dados.origem ? dados.origem : {};
  lead.origem = Object.fromEntries(Object.entries(o).slice(0, 10).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 300)]));
  lead.id = crypto.randomUUID();
  lead.recebido_em = new Date().toISOString();
  // Registro do consentimento (LGPD): o formulário só envia com o aceite da Política de Privacidade
  lead.consentimento = { aceite: true, em: lead.recebido_em, politica: "/privacidade/" };
  lead.ip_pais = request.cf?.country || "";
  lead.whatsapp_link = `https://wa.me/${digitos.length <= 11 ? "55" + digitos : digitos}`;

  const entregas = [];

  if (env.LEADS) {
    entregas.push(env.LEADS.put(`lead:${lead.recebido_em}:${lead.id}`, JSON.stringify(lead)));
  }

  if (env.RESEND_API_KEY && env.LEAD_TO_EMAIL) {
    const linhas = [
      ["Nome", lead.nome],
      ["Empresa", lead.empresa],
      ["WhatsApp", `<a href="${lead.whatsapp_link}">${esc(lead.whatsapp)}</a>`, true],
      ["E-mail", lead.email],
      ["Serviço", lead.servico],
      ["Investimento", lead.orcamento],
      ["Mensagem", lead.mensagem],
      ["Origem", Object.entries(lead.origem).map(([k, v]) => `${k}: ${v}`).join(" · ")],
    ];
    const html =
      `<h2>Novo lead pelo site BD2 Tech</h2><table cellpadding="6">` +
      linhas.filter(([, v]) => v).map(([k, v, cru]) => `<tr><td><b>${k}</b></td><td>${cru ? v : esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("") +
      `</table>`;
    entregas.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          from: env.LEAD_FROM_EMAIL || "BD2 Tech <site@bd2tech.com.br>",
          to: env.LEAD_TO_EMAIL.split(",").map((s) => s.trim()),
          reply_to: lead.email || undefined,
          subject: `Novo lead: ${lead.nome} · ${lead.servico}`,
          html,
        }),
      }).then((r) => { if (!r.ok) throw new Error(`resend ${r.status}`); })
    );
  }

  if (env.LEAD_WEBHOOK_URL) {
    entregas.push(
      fetch(env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(8000),
      }).then((r) => { if (!r.ok) throw new Error(`webhook ${r.status}`); })
    );
  }

  if (!entregas.length) {
    console.error("Nenhum canal de lead configurado (LEADS, RESEND_API_KEY ou LEAD_WEBHOOK_URL)");
    return json({ ok: false, erro: "sem_canal" }, 503);
  }

  const resultados = await Promise.allSettled(entregas);
  resultados.filter((r) => r.status === "rejected").forEach((r) => console.error("Falha ao entregar lead:", r.reason));
  if (!resultados.some((r) => r.status === "fulfilled")) {
    return json({ ok: false, erro: "entrega" }, 502);
  }
  return json({ ok: true, id: lead.id });
}

export const onRequest = () => json({ ok: false, erro: "metodo" }, 405);
