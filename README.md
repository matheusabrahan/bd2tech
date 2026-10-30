# Site BD2 Tech (bd2tech.com.br)

Site estático de captação de leads da BD2 Tech, parceria entre a DBC Tech e Matheus Abrahan.
Sem build: HTML, CSS e JS puros + uma Cloudflare Pages Function para receber o formulário.

## Estrutura

```
index.html              página única (hero, serviços, setores, cases, processo, sócios, FAQ, formulário)
privacidade/index.html  política de privacidade (LGPD)
404.html                página de erro
assets/style.css        identidade visual e layout
assets/app.js           menu, WhatsApp, máscara, envio do formulário
assets/brand/           logo (fundo escuro e claro) e símbolo em SVG
assets/og.png           imagem de compartilhamento (1200x630)
functions/api/lead.js   POST /api/lead, recebe e entrega os leads
_headers                cabeçalhos de segurança e cache
robots.txt, sitemap.xml SEO
```

## Deploy na Cloudflare Pages

1. Suba esta pasta para um repositório no GitHub.
2. No painel da Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
   - Framework preset: **None**
   - Build command: *(vazio)*
   - Build output directory: `/`
3. Em **Custom domains**, adicione `bd2tech.com.br` e `www.bd2tech.com.br`.
   Para mandar o `www` para o domínio principal, crie uma regra em **Rules → Redirect Rules** (ou Bulk Redirects): `www.bd2tech.com.br/*` → `https://bd2tech.com.br/${1}` (301).
4. Configure pelo menos **um** canal de entrega de leads (Settings → Variables and Secrets / Bindings):

| Variável / binding | Para quê |
|---|---|
| `LEADS` (binding KV) | Guarda cada lead no Workers KV. Crie um namespace KV `bd2tech-leads` e vincule com o nome `LEADS`. |
| `RESEND_API_KEY` (secret) + `LEAD_TO_EMAIL` | Envia um e-mail a cada lead via [Resend](https://resend.com). `LEAD_TO_EMAIL` aceita vários e-mails separados por vírgula (ex.: os dois sócios). Verifique o domínio bd2tech.com.br no Resend. |
| `LEAD_FROM_EMAIL` (opcional) | Remetente. Padrão: `BD2 Tech <site@bd2tech.com.br>`. |
| `LEAD_WEBHOOK_URL` (opcional) | Envia o lead em JSON para n8n, Make, Zapier, CRM (ex.: ProSky) ou Slack. |
| `ALLOWED_ORIGIN` (opcional) | Ex.: `https://bd2tech.com.br,https://www.bd2tech.com.br`. Bloqueia envios de outros sites. |

Se nenhum canal estiver configurado ou todos falharem, o formulário abre o WhatsApp com a mensagem já preenchida, então o lead nunca se perde.

5. **E-mail contato@bd2tech.com.br**: ative o **Email Routing** da Cloudflare e encaminhe para os e-mails dos sócios.

## Ajustes rápidos

- **Ao alterar `assets/style.css` ou `assets/app.js`, troque o `?v=` nos links das três páginas** (index, privacidade, 404). O `_headers` guarda `/assets/*` por 7 dias no navegador; sem trocar a versão, quem já visitou o site continua vendo o CSS/JS antigo.

- Número do WhatsApp: `WHATSAPP` no topo de `assets/app.js` (hoje +55 61 99667-6667) e `telephone` no JSON-LD de `index.html`.
- Google Analytics / Ads: cole o snippet do gtag no `<head>`. O site já dispara os eventos `generate_lead`, `whatsapp_click` e `lead_fallback_whatsapp`. O `_headers` já libera o googletagmanager no CSP.
- UTMs (`utm_source`, `gclid`, `fbclid`...) da URL são enviados junto com o lead.

## Teste local

```
npx wrangler pages dev . --kv LEADS
```

## Identidade visual

**Conceito do símbolo:** um "b" e um "d" espelhados, um de cada sócio, cujos bojos se entrelaçam no centro. Duas operações que se encontram e viram uma só. O "2" do nome aparece em teal.

| Token | Cor | Origem |
|---|---|---|
| Tinta (fundo) | `#0B0F14` | cor de tema do site do Matheus |
| Teal | `#2DD4BF` / `#0D9488` | cor de tema da DBC Tech |
| Ciano / Azul | `#67E8F9` / `#0EA5E9` | ponte entre as duas, usada no degradê |
| Texto | `#E6EDF3` | |
| Texto suave | `#9AA8B6` | |
| Degradê de marca | `linear-gradient(135deg, #2DD4BF, #0EA5E9)` | botões, números, destaques |

- Tipografia: **Space Grotesk** (títulos) + **Inter** (textos), ambas do Google Fonts.
- Tom de voz: direto, em "a gente", sem jargão; promessas concretas (em produção, preço fechado, resposta em 24h).
- Arquivos: `assets/brand/logo-escuro.svg` (para fundos escuros), `logo-claro.svg` (fundos claros), `simbolo.svg` (avatar, favicon).
