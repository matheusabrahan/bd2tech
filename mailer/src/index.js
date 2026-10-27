// Worker bd2tech-mailer: envia o e-mail de cada lead pelo Email Routing da Cloudflare.
// Só é chamado pela Pages Function /api/lead (service binding MAILER); não tem rota pública.
// O destino fica fixo no binding SEND_EMAIL (wrangler.toml) e precisa estar verificado no Email Routing.
import { EmailMessage } from "cloudflare:email";

const REMETENTE = "site@bd2tech.com.br";

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const cabecalho = (s) => `=?UTF-8?B?${b64(s)}?=`;
const semQuebra = (s) => String(s ?? "").replace(/[\r\n]+/g, " ");

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("metodo", { status: 405 });
    const { assunto, html, responder_para } = await request.json();

    const linhas = [
      `From: ${cabecalho("Site BD2 Tech")} <${REMETENTE}>`,
      `To: ${env.DESTINO}`,
      `Subject: ${cabecalho(semQuebra(assunto))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@bd2tech.com.br>`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
    ];
    const resp = semQuebra(responder_para);
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(resp)) linhas.push(`Reply-To: ${resp}`);

    const corpo = b64(String(html ?? "")).replace(/.{76}/g, "$&\r\n");
    const bruto = linhas.join("\r\n") + "\r\n\r\n" + corpo;

    await env.SEND_EMAIL.send(new EmailMessage(REMETENTE, env.DESTINO, bruto));
    return new Response("ok");
  },
};
