/* ============================================================
   HART — legal.js
   Scripts compartilhados das páginas legais
   ============================================================ */

// Navbar scroll behavior
const navbar = document.getElementById('navbar');
function updateNav() {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// Highlight active TOC link on scroll
const sections = document.querySelectorAll('.legal-content section[id]');
const tocLinks = document.querySelectorAll('.legal-toc a');

function updateToc() {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 140) {
      current = section.getAttribute('id');
    }
  });
  tocLinks.forEach(link => {
    link.style.background = '';
    link.style.color = '';
    if (link.getAttribute('href') === '#' + current) {
      link.style.background = 'rgba(45,90,39,0.09)';
      link.style.color = '#2D5A27';
      link.style.fontWeight = '600';
    } else {
      link.style.fontWeight = '';
    }
  });
}

window.addEventListener('scroll', updateToc, { passive: true });
updateToc();
