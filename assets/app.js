// BD2 Tech, interações do site
(function () {
  "use strict";

  // Número que recebe os contatos pelo WhatsApp (DDI + DDD + número, só dígitos)
  var WHATSAPP = "5561982021300";

  function linkWhats(msg) {
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg);
  }

  // Botões de WhatsApp
  document.querySelectorAll(".js-wa").forEach(function (a) {
    a.href = linkWhats(a.dataset.msg || "Olá, BD2 Tech! Vim pelo site.");
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () { track("whatsapp_click"); });
  });

  // Menu mobile
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var aberto = menu.classList.toggle("aberto");
      burger.setAttribute("aria-expanded", aberto);
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("aberto");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Borda do topo ao rolar
  var topo = document.getElementById("topo");
  if (topo) {
    var onScroll = function () { topo.classList.toggle("rolou", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();

  // Cards de serviço pré-selecionam o serviço no formulário
  var selServico = document.getElementById("servico");
  document.querySelectorAll("[data-servico]").forEach(function (a) {
    a.addEventListener("click", function () {
      if (selServico) selServico.value = a.dataset.servico;
    });
  });

  // Animação de entrada
  if ("IntersectionObserver" in window) {
    var alvos = document.querySelectorAll(".card, .case, .passos li, .setores li, .socio, .numeros li, .sec__head");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    alvos.forEach(function (el) { el.classList.add("revela"); io.observe(el); });
  }

  // Eventos de conversão (funciona com GA4/gtag se for instalado depois)
  function track(nome, dados) {
    try { if (typeof window.gtag === "function") window.gtag("event", nome, dados || {}); } catch (e) {}
  }

  // UTM e origem, enviados junto com o lead
  function origem() {
    var p = new URLSearchParams(location.search);
    var o = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(function (k) {
      if (p.get(k)) o[k] = p.get(k);
    });
    o.referrer = document.referrer || "";
    o.pagina = location.pathname;
    return o;
  }

  // Formulário de lead
  var form = document.getElementById("lead-form");
  if (!form) return;
  var status = form.querySelector(".form__status");
  var botao = form.querySelector("button[type=submit]");
  var tel = form.querySelector("#whatsapp");

  // Máscara simples de telefone
  tel.addEventListener("input", function () {
    var d = tel.value.replace(/\D/g, "").slice(0, 11);
    if (d.length > 6) tel.value = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
    else if (d.length > 2) tel.value = "(" + d.slice(0, 2) + ") " + d.slice(2);
    else tel.value = d;
  });

  function msgStatus(txt, tipo) {
    status.textContent = txt;
    status.className = "form__status " + (tipo || "");
  }

  function validar() {
    var ok = true;
    form.querySelectorAll(".invalido").forEach(function (el) { el.classList.remove("invalido"); });
    ["nome", "servico"].forEach(function (id) {
      var el = form.querySelector("#" + id);
      if (!el.value.trim()) { el.classList.add("invalido"); ok = false; }
    });
    if (tel.value.replace(/\D/g, "").length < 10) { tel.classList.add("invalido"); ok = false; }
    var email = form.querySelector("#email");
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { email.classList.add("invalido"); ok = false; }
    if (!form.aceite.checked) { ok = false; msgStatus("Marque o aceite da Política de Privacidade para continuar.", "erro"); return false; }
    if (!ok) msgStatus("Confira os campos destacados.", "erro");
    return ok;
  }

  function textoWhats(d) {
    return "Olá, BD2 Tech! Sou " + d.nome + (d.empresa ? " (" + d.empresa + ")" : "") +
      ". Tenho interesse em: " + d.servico + "." + (d.mensagem ? " " + d.mensagem : "");
  }

  function sucesso(d) {
    track("generate_lead", { servico: d.servico });
    form.innerHTML =
      '<div class="sucesso">' +
      "<h3>Recebemos o seu contato!</h3>" +
      "<p>Obrigado, " + escapeHtml(d.nome.split(" ")[0]) + ". Vamos responder em até 24h para marcar o seu diagnóstico gratuito.</p>" +
      '<a class="btn btn--lg" target="_blank" rel="noopener" href="' + linkWhats(textoWhats(d)) + '">Adiantar pelo WhatsApp</a>' +
      "</div>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!validar()) return;

    var d = {};
    new FormData(form).forEach(function (v, k) { d[k] = typeof v === "string" ? v.trim() : v; });
    d.origem = origem();

    botao.disabled = true;
    msgStatus("Enviando...");

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) return sucesso(d);
        throw new Error(res.j.erro || "falha");
      })
      .catch(function () {
        // Se o envio falhar, o lead não se perde: abre o WhatsApp com os dados preenchidos
        botao.disabled = false;
        msgStatus("Não conseguimos enviar agora. Abrindo o WhatsApp com a sua mensagem...", "erro");
        track("lead_fallback_whatsapp");
        window.open(linkWhats(textoWhats(d)), "_blank", "noopener");
      });
  });
})();
