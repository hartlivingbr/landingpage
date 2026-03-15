/* ============================================================
   HART — cadastro.js
   Scripts da página de criação de conta
   ============================================================ */

// Toggle password visibility (works for both fields)
function togglePwd(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// Password strength meter
const pwdInput     = document.getElementById('password');
const strengthFill = document.getElementById('strengthFill');
const strengthLabel = document.getElementById('strengthLabel');

const levels = [
  { label: '',       color: '',                   pct: 0   },
  { label: 'Fraca',  color: '#E5484D',            pct: 25  },
  { label: 'Média',  color: '#F76B15',            pct: 55  },
  { label: 'Boa',    color: '#30A46C',            pct: 80  },
  { label: 'Forte',  color: '#2D5A27',            pct: 100 },
];

function getStrength(pwd) {
  if (!pwd) return 0;
  let score = 1;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

pwdInput.addEventListener('input', () => {
  const level = getStrength(pwdInput.value);
  const { label, color, pct } = levels[level];
  strengthFill.style.width      = pct + '%';
  strengthFill.style.background = color;
  strengthLabel.textContent     = label;
  strengthLabel.style.color     = color;
});

// Confirm password match feedback
const pwd2 = document.getElementById('password2');
pwd2.addEventListener('input', () => {
  if (!pwd2.value) {
    pwd2.style.borderColor = '';
    pwd2.style.boxShadow   = '';
    return;
  }
  const match = pwd2.value === pwdInput.value;
  pwd2.style.borderColor = match ? '#30A46C' : '#E5484D';
  pwd2.style.boxShadow   = match
    ? '0 0 0 3px rgba(48,164,108,0.10)'
    : '0 0 0 3px rgba(229,72,77,0.10)';
});
