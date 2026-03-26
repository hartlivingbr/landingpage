/* ============================================================
   HART — parceiros.js
   ============================================================ */

// ── Navbar ──
const navbar = document.getElementById("navbar");
function updateNav() { navbar.classList.toggle("scrolled", window.scrollY > 50); }
window.addEventListener("scroll", updateNav, { passive: true });
updateNav();

// ── FAQ ──
function toggleFaq(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains("open");
  document.querySelectorAll(".p-faq-item.open").forEach(i => i.classList.remove("open"));
  if (!isOpen) item.classList.add("open");
}

// ── Cal.com links per tipo ──
const calLinks = {
  incorporadora: "https://cal.com/hartbr/parceria-com-incorporadora-hart",
  investidor:    "https://cal.com/hartbr/parceria-com-investidor",
};

// ── Tipo de parceiro ──
let tipoAtual = "incorporadora";

const empresaConfig = {
  incorporadora: { label: "Incorporadora", placeholder: "Nome da incorporadora" },
  investidor:    { label: "Empresa",       placeholder: "Empresa (opcional)"    },
};

function setTipo(btn, tipo) {
  tipoAtual = tipo;
  document.querySelectorAll(".p-tipo-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const label = document.getElementById("label-empresa");
  const input = document.getElementById("input-empresa");
  const cfg   = empresaConfig[tipo] || empresaConfig.incorporadora;
  if (label) label.textContent = cfg.label;
  if (input) input.placeholder = cfg.placeholder;

  // Update submit button label
  const submitBtn = document.getElementById("btn-submit");
  if (submitBtn) {
    const labelText = tipo === "incorporadora"
      ? "Agendar conversa — Incorporadora"
      : "Agendar conversa — Investidor";
    submitBtn.childNodes[0].textContent = labelText + " ";
  }
}

// ── Corretor fields (kept for potential future use, hidden) ──
function toggleCorretor(checkbox) {
  const fields = document.getElementById("corretor-fields");
  if (fields) fields.classList.toggle("open", checkbox.checked);
}

// ── Form submit → cal.com specific link with prefilled params ──
function submitForm() {
  const nome    = (document.getElementById("input-nome")?.value    || "").trim();
  const email   = (document.getElementById("input-email")?.value   || "").trim();
  const tel     = (document.getElementById("input-tel")?.value     || "").trim();
  const msg     = (document.getElementById("input-msg")?.value     || "").trim();
  const empresa = (document.getElementById("input-empresa")?.value || "").trim();

  let notes = "Tipo: " + tipoAtual;
  if (empresa) notes += " | Empresa: " + empresa;
  if (tel)     notes += " | Tel: " + tel;
  if (msg)     notes += " | " + msg;

  const base   = calLinks[tipoAtual] || calLinks.incorporadora;
  const params = new URLSearchParams();
  if (nome)  params.set("name",  nome);
  if (email) params.set("email", email);
  if (notes) params.set("notes", notes);

  window.open(base + "?" + params.toString(), "_blank", "noopener");
}

// ── Hero Particles ──
(function() {
  const canvas = document.getElementById("heroParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0;
  const particles = [];
  const COUNT = 65;
  const COLORS = ["rgba(216,219,142,", "rgba(200,169,110,", "rgba(240,235,160,"];

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width  = rect.width  || window.innerWidth;
    H = canvas.height = rect.height || window.innerHeight;
  }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: rand(0, W), y: rand(0, H),
        size: rand(0.5, 1.5),
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

  window.addEventListener("resize", resize);
  requestAnimationFrame(() => { resize(); initParticles(); draw(); });
})();

// ── Scroll animations ──
(function() {
  const els = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); observer.unobserve(e.target); }
    });
  }, { threshold: 0.10, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => observer.observe(el));
  // Hero visible immediately
  document.querySelectorAll(".p-hero [data-animate]").forEach(el => el.classList.add("in-view"));
})();

// ── Init ──
window.addEventListener("DOMContentLoaded", () => {
  // Hide corretor toggle (not used in this form)
  const ct = document.getElementById("corretor-toggle");
  if (ct) ct.style.display = "none";
  // Set initial button label
  const submitBtn = document.getElementById("btn-submit");
  if (submitBtn) submitBtn.childNodes[0].textContent = "Agendar conversa — Incorporadora ";
});
