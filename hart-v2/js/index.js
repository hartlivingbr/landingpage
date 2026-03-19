/* ============================================================
   HART — index.js
   Scripts da página principal
   ============================================================ */

// ── Linha Slider — drag compare ──
  (function() {
    const outer  = document.getElementById('linhaSlider');
    const handle = document.getElementById('sliderHandle');

    if (outer && handle) {
      const std = outer.querySelector('.slider-std');
      const prm = outer.querySelector('.slider-prm');

      // Inject divider line
      const line = document.createElement('div');
      line.className = 'slider-line';
      outer.appendChild(line);

      let dragging = false;

      function setPosition(clientX) {
        const rect = outer.getBoundingClientRect();
        let pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Math.max(1, Math.min(99, pct));

        std.style.clipPath = `inset(0 ${(100 - pct).toFixed(2)}% 0 0)`;
        prm.style.clipPath = `inset(0 0 0 ${pct.toFixed(2)}%)`;
        handle.style.left      = pct + '%';
        handle.style.transform = 'translate(-50%, -50%)';
        line.style.left        = pct + '%';
      }

      // Initial center position
      requestAnimationFrame(() => {
        const rect = outer.getBoundingClientRect();
        setPosition(rect.left + rect.width * 0.5);
      });

      // Mouse events
      outer.addEventListener('mousedown', (e) => {
        dragging = true;
        setPosition(e.clientX);
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (dragging) setPosition(e.clientX);
      });
      window.addEventListener('mouseup', () => { dragging = false; });

      // Touch events
      outer.addEventListener('touchstart', (e) => {
        dragging = true;
        setPosition(e.touches[0].clientX);
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (dragging) {
          setPosition(e.touches[0].clientX);
          e.preventDefault();
        }
      }, { passive: false });
      window.addEventListener('touchend', () => { dragging = false; });
    }
  })();

  function toggleFaq(el) {
    const item = el.parentElement;
    item.classList.toggle('open');
  }

  const navbar = document.getElementById('navbar');
  const navWrapper = navbar.parentElement;
  const SCROLL_THRESHOLD = 50;
  function updateNav() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      navbar.classList.add('scrolled');
      navWrapper.style.padding = '0';
    } else {
      navbar.classList.remove('scrolled');
      navWrapper.style.padding = '0';
    }
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  // ── Hero Particles ──
  (function() {
    const canvas = document.getElementById('heroParticles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0;
    const particles = [];
    const COUNT = 65;
    const COLORS = ['rgba(216,219,142,', 'rgba(200,169,110,', 'rgba(240,235,160,'];

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
          x: rand(0, W),
          y: rand(0, H),
          size: rand(0.5, 1.5),
          alpha: rand(0.15, 0.55),
          vx: rand(-0.08, 0.08),
          vy: rand(-0.18, -0.04),
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

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -5)    p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        if (p.y < -5)    p.y = H + 5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.max(0, Math.min(1, p.alpha)).toFixed(2) + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => { resize(); });

    // Wait for layout to be ready
    requestAnimationFrame(() => {
      resize();
      initParticles();
      draw();
    });
  })();
  // ── Scroll animations — IntersectionObserver ──
  (function() {
    const els = document.querySelectorAll('[data-animate]');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => observer.observe(el));
  })();

  // ── FAQ smooth animation ──
  function toggleFaq(el) {
    const item = el.parentElement;
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    // Close all open items
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
    });

    // Open clicked if it was closed
    if (!isOpen) item.classList.add('open');
  }
