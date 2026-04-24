/* ============================================================
   HART — websummit.js
   Navbar scroll, partículas, scroll reveal, FAQ, form → Cal.com
   ============================================================ */

(function () {
  "use strict";

  // ── Navbar scroll state ──
  const navbar = document.getElementById("navbar");
  function updateNav() {
    if (!navbar) return;
    navbar.classList.toggle("scrolled", window.scrollY > 50);
  }
  window.addEventListener("scroll", updateNav, { passive: true });
  updateNav();

  // ── Hero particles ──
  (function initParticles() {
    const canvas = document.getElementById("heroParticles");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    const particles = [];
    const COUNT = 70;
    const COLORS = [
      "rgba(216,219,142,",
      "rgba(200,169,110,",
      "rgba(240,235,160,",
    ];

    function rand(min, max) { return Math.random() * (max - min) + min; }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = canvas.width  = Math.max(rect.width,  window.innerWidth);
      H = canvas.height = Math.max(rect.height, window.innerHeight);
    }

    function seed() {
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: rand(0, W), y: rand(0, H),
          size: rand(0.5, 1.6),
          alpha: rand(0.15, 0.55),
          vx: rand(-0.08, 0.08), vy: rand(-0.18, -0.04),
          twinkleSpeed: rand(0.004, 0.015),
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.alpha += p.twinkleSpeed * p.twinkleDir;
        if (p.alpha > 0.65 || p.alpha < 0.05) p.twinkleDir *= -1;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -5)    p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        if (p.y < -5)    p.y = H + 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.max(0, Math.min(1, p.alpha)).toFixed(2) + ")";
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize, { passive: true });
    requestAnimationFrame(() => { resize(); seed(); draw(); });
  })();

  // ── Scroll reveal ──
  (function initReveal() {
    const els = document.querySelectorAll("[data-animate]");
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("in-view"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.10, rootMargin: "0px 0px -40px 0px" });
    els.forEach(el => observer.observe(el));
    // Hero revela imediatamente
    document.querySelectorAll(".ws-hero [data-animate]").forEach(el => el.classList.add("in-view"));
  })();

  // ── FAQ accordion ──
  document.querySelectorAll(".ws-faq-item").forEach(item => {
    const q = item.querySelector(".ws-faq-q");
    if (!q) return;
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".ws-faq-item.open").forEach(i => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });

  // ══════════════════════════════════════════
  // Formulário → redireciona para Cal.com com dados preenchidos
  // (mesmo padrão usado em parceiros.js)
  // ══════════════════════════════════════════
  const calLinks = {
    incorporadora: "https://cal.com/hartbr/parceria-com-incorporadora-hart",
    investidor:    "https://cal.com/hartbr/parceria-com-investidor",
    corretor:      "https://cal.com/hartbr/reuniao-de-alinhamento",
  };

  const tipoConfig = {
    incorporadora: {
      label: "Incorporadora",
      placeholder: "Nome da incorporadora",
      buttonText: "Agendar conversa — Incorporadora",
    },
    corretor: {
      label: "Imobiliária",
      placeholder: "Imobiliária em que atua",
      buttonText: "Agendar conversa — Corretor",
    },
    investidor: {
      label: "Empresa",
      placeholder: "Empresa (opcional)",
      buttonText: "Agendar conversa — Investidor",
    },
  };

  let tipoAtual = "incorporadora";

  const btnSubmit = document.getElementById("ws-submit-btn");
  const btnLabel  = btnSubmit ? btnSubmit.querySelector(".ws-btn-label") : null;

  function setTipo(novo) {
    tipoAtual = novo;
    const cfg = tipoConfig[novo] || tipoConfig.incorporadora;

    document.querySelectorAll(".ws-tipo-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tipo === novo);
    });

    const label    = document.getElementById("ws-label-empresa");
    const empresa  = document.getElementById("ws-empresa");
    if (label)   label.textContent = cfg.label;
    if (empresa) empresa.placeholder = cfg.placeholder;
  }

  document.querySelectorAll(".ws-tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => setTipo(btn.dataset.tipo));
  });

  function getVal(id) {
    const el = document.getElementById(id);
    return (el && typeof el.value === "string") ? el.value.trim() : "";
  }

  function showError(msg) {
    let err = document.getElementById("ws-form-error");
    if (!err) {
      err = document.createElement("div");
      err.id = "ws-form-error";
      err.className = "ws-form-error";
      const card = document.querySelector(".ws-form-card");
      if (card) card.appendChild(err);
    }
    err.textContent = msg;
    err.classList.add("visible");
  }

  function clearError() {
    const err = document.getElementById("ws-form-error");
    if (err) err.classList.remove("visible");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function submitForm() {
    if (!btnSubmit) return;
    clearError();

    const nome    = getVal("ws-nome");
    const email   = getVal("ws-email");
    const tel     = getVal("ws-tel");
    const empresa = getVal("ws-empresa");
    const estado  = getVal("ws-estado");

    if (!nome)   return showError("Informe o seu nome para continuar.");
    if (!email || !isValidEmail(email)) return showError("Informe um e-mail profissional válido.");

    const parts = ["Tipo: " + tipoAtual];
    if (empresa) parts.push("Empresa: " + empresa);
    if (estado)  parts.push("Estado: " + estado);
    if (tel)     parts.push("WhatsApp: " + tel);
    parts.push("Origem: Web Summit · Lista de espera");
    const notes = parts.join(" | ");

    const base   = calLinks[tipoAtual] || calLinks.incorporadora;
    const params = new URLSearchParams();
    params.set("name",  nome);
    params.set("email", email);
    params.set("notes", notes);

    // Feedback visual antes do redirect
    if (btnLabel) btnLabel.textContent = "Redirecionando…";
    btnSubmit.classList.add("ws-btn-success");
    btnSubmit.disabled = true;

    window.open(base + "?" + params.toString(), "_blank", "noopener");

    // Reset após janela abrir (com pequeno delay para o usuário perceber)
    setTimeout(() => {
      if (btnLabel) btnLabel.textContent = "Garantir acesso antecipado";
      btnSubmit.classList.remove("ws-btn-success");
      btnSubmit.disabled = false;
    }, 1800);
  }

  if (btnSubmit) btnSubmit.addEventListener("click", submitForm);

  // Permite submit via Enter em qualquer campo
  document.querySelectorAll(".ws-form-card input, .ws-form-card select").forEach(input => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.tagName !== "TEXTAREA") {
        e.preventDefault();
        submitForm();
      }
    });
  });

  // Init
  window.addEventListener("DOMContentLoaded", () => setTipo("incorporadora"));
  if (document.readyState !== "loading") setTipo("incorporadora");
})();
