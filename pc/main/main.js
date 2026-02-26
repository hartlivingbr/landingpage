/* ============================================================
   HART — main.js
   Handles: scroll reveal, nav scroll state, linha slider
   ============================================================ */

(function () {
    'use strict';


    /* ----------------------------------------------------------
       1. NAV — add scrolled class on scroll
       ---------------------------------------------------------- */
    const nav = document.querySelector('.nav');
    if (nav) {
        const onScroll = () => {
            nav.classList.toggle('scrolled', window.scrollY > 40);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }


    /* ----------------------------------------------------------
       2. SCROLL REVEAL — IntersectionObserver
       ---------------------------------------------------------- */
    const revealEls = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window && revealEls.length) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        revealEls.forEach((el) => observer.observe(el));
    } else {
        // Fallback: show everything immediately
        revealEls.forEach((el) => el.classList.add('visible'));
    }


    /* ----------------------------------------------------------
       3. LINHA SLIDER — drag compare
       ---------------------------------------------------------- */
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


    /* ----------------------------------------------------------
       4. CHART TABS — basic tab switching (visual only)
       ---------------------------------------------------------- */
    const tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });


})();
