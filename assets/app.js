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

  // Links de serviço pré-selecionam o serviço no formulário
  var selServico = document.getElementById("servico");
  document.querySelectorAll("[data-servico]").forEach(function (a) {
    a.addEventListener("click", function () {
      if (selServico) selServico.value = a.dataset.servico;
    });
  });

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
    var invalidos = [];
    form.querySelectorAll(".invalido").forEach(function (el) {
      el.classList.remove("invalido");
      el.removeAttribute("aria-invalid");
    });
    ["nome", "servico"].forEach(function (id) {
      var el = form.querySelector("#" + id);
      if (!el.value.trim()) invalidos.push(el);
    });
    if (tel.value.replace(/\D/g, "").length < 10) invalidos.push(tel);
    var email = form.querySelector("#email");
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) invalidos.push(email);
    invalidos.forEach(function (el) {
      el.classList.add("invalido");
      el.setAttribute("aria-invalid", "true");
    });
    if (invalidos.length) {
      msgStatus("Confira os campos destacados.", "erro");
      invalidos[0].focus();
      return false;
    }
    if (!form.aceite.checked) {
      msgStatus("Marque o aceite da Política de Privacidade para continuar.", "erro");
      form.aceite.focus();
      return false;
    }
    return true;
  }

  function textoWhats(d) {
    return "Olá, BD2 Tech! Sou " + d.nome + (d.empresa ? " (" + d.empresa + ")" : "") +
      ". Tenho interesse em: " + d.servico + "." + (d.mensagem ? " " + d.mensagem : "");
  }

  function sucesso(d) {
    track("generate_lead", { servico: d.servico });
    form.innerHTML =
      '<div class="sucesso" role="status">' +
      '<h3 tabindex="-1">Recebemos o seu contato!</h3>' +
      "<p>Obrigado, " + escapeHtml(d.nome.split(" ")[0]) + ". Vamos responder em até 24h para marcar o seu diagnóstico gratuito.</p>" +
      '<a class="btn btn--lg" target="_blank" rel="noopener" href="' + linkWhats(textoWhats(d)) + '">Adiantar pelo WhatsApp</a>' +
      "</div>";
    form.querySelector(".sucesso h3").focus();
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
        // Se o envio falhar, o lead não se perde: oferece o WhatsApp com os dados preenchidos.
        // Link em vez de window.open, que o navegador bloqueia fora do clique.
        botao.disabled = false;
        status.className = "form__status erro";
        status.innerHTML =
          "Não conseguimos enviar agora. Mande pelo WhatsApp, a mensagem já vai preenchida: " +
          '<a class="btn btn--sm" target="_blank" rel="noopener" href="' + linkWhats(textoWhats(d)) + '">Enviar pelo WhatsApp</a>';
        track("lead_fallback_whatsapp");
      });
  });
})();
