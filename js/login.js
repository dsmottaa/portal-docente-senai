/**
 * PORTAL DO DOCENTE - SENAI
 * Autenticação (servidor com fallback offline), Micro-Interactions, HUD Canvas & Accessibility
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (SENAI_isLogged()) {
    window.location.href = 'dashboard.html';
    return;
  }
  const temaLogin = localStorage.getItem('senai_tema');
  if (temaLogin === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  try { await SENAI_ensureUsers(); } catch (e) { console.error('Falha ao preparar usuários:', e); }

  // Elements
  const loginForm = document.getElementById('loginForm');
  const usuarioInput = document.getElementById('usuario');
  const senhaInput = document.getElementById('senha');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnTogglePass = document.getElementById('btnTogglePass');
  const capsLockIndicator = document.getElementById('capsLockIndicator');
  const btnQuickDemo = document.getElementById('btnQuickDemo');
  const toastContainer = document.getElementById('toastContainer');

  // Modal elements
  const forgotModal = document.getElementById('forgotModal');
  const btnOpenForgot = document.getElementById('btnOpenForgot');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const forgotForm = document.getElementById('forgotForm');
  const recoveryInput = document.getElementById('recoveryInput');
  const recoveryFeedback = document.getElementById('recoveryFeedback');
  const btnFinishModal = document.getElementById('btnFinishModal');

  // Audio synthesis for rich tactile micro-interactions (Web Audio API)
  let audioCtx = null;
  function playBeep(freq = 440, type = 'sine', duration = 0.08, gainVal = 0.04) {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted by browser policy before first gesture
    }
  }

  // --- CPF / USER AUTO-FORMATTER ---
  usuarioInput.addEventListener('input', (e) => {
    let value = e.target.value;
    // Check if input consists only of digits (CPF attempt)
    const digitsOnly = value.replace(/\D/g, '');
    
    if (digitsOnly.length > 0 && /^\d+$/.test(value.replace(/[\.\-]/g, ''))) {
      if (digitsOnly.length <= 11) {
        let formatted = digitsOnly;
        if (digitsOnly.length > 9) {
          formatted = `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6, 9)}-${digitsOnly.slice(9, 11)}`;
        } else if (digitsOnly.length > 6) {
          formatted = `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6)}`;
        } else if (digitsOnly.length > 3) {
          formatted = `${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3)}`;
        }
        e.target.value = formatted;
      }
    }
  });

  // --- PASSWORD VISIBILITY TOGGLE ---
  let isPasswordVisible = false;
  btnTogglePass.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    senhaInput.type = isPasswordVisible ? 'text' : 'password';
    btnTogglePass.classList.toggle('active', isPasswordVisible);
    playBeep(isPasswordVisible ? 620 : 420, 'sine', 0.05, 0.03);
    senhaInput.focus();
  });

  // --- CAPS LOCK INDICATOR ---
  function checkCapsLock(e) {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      capsLockIndicator.classList.add('visible');
    } else {
      capsLockIndicator.classList.remove('visible');
    }
  }

  senhaInput.addEventListener('keydown', checkCapsLock);
  senhaInput.addEventListener('keyup', checkCapsLock);
  senhaInput.addEventListener('blur', () => {
    capsLockIndicator.classList.remove('visible');
  });

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <span class="toast-msg">${message}</span>
      <button class="toast-close" aria-label="Fechar">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 250);
    });

    toastContainer.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  // --- QUICK DEMO ACCESS ---
  btnQuickDemo.addEventListener('click', () => {
    playBeep(880, 'sine', 0.1, 0.05);
    usuarioInput.value = '123.456.789-00';
    senhaInput.value = 'senai2026';
    
    usuarioInput.classList.add('highlight-glow');
    senhaInput.classList.add('highlight-glow');
    setTimeout(() => {
      usuarioInput.classList.remove('highlight-glow');
      senhaInput.classList.remove('highlight-glow');
    }, 800);

    showToast('Credenciais de demonstração preenchidas!', 'success', 2500);
  });

  // Keyboard shortcut Ctrl+D for demo fill
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      btnQuickDemo.click();
    }
  });

  // --- FORM SUBMISSION & AUTH REAL ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = usuarioInput.value.trim();
    const senha = senhaInput.value.trim();

    // Validation
    if (!usuario) {
      playBeep(220, 'square', 0.12, 0.06);
      showToast('Por favor, informe seu Usuário ou CPF.', 'error');
      usuarioInput.focus();
      usuarioInput.classList.add('input-error');
      setTimeout(() => usuarioInput.classList.remove('input-error'), 1200);
      return;
    }

    if (!senha) {
      playBeep(220, 'square', 0.12, 0.06);
      showToast('Por favor, digite sua senha de acesso.', 'error');
      senhaInput.focus();
      senhaInput.classList.add('input-error');
      setTimeout(() => senhaInput.classList.remove('input-error'), 1200);
      return;
    }

    // Loading State
    btnSubmit.disabled = true;
    btnSubmit.classList.add('btn-loading');
    playBeep(520, 'triangle', 0.08, 0.04);

    const server = await SENAI_loginServer(usuario, senha);
    let session = null;

    if (server.ok && server.user) {
      session = {
        id: server.user.id,
        name: server.user.name,
        login: server.user.login,
        role: server.user.role,
        matricula: server.user.matricula,
        curso: server.user.curso,
        unidade: server.user.unidade,
        unidadeId: server.user.unidadeId || '',
        loggedAt: new Date().toISOString()
      };
      SENAI_setSession(session);
      setTimeout(() => { SENAI_sync.pull(); }, 300);
    } else if (server.offline) {
      // Sem servidor: tenta a base local (modo offline).
      session = await SENAI_authenticate(usuario, senha);
      if (session) {
        showToast('Servidor indisponível — você entrou em modo offline (dados locais).', 'info', 4000);
      }
    } else {
      // Servidor respondeu e rejeitou: garante sessão limpa.
      SENAI_clearSession();
    }

    if (!session) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('btn-loading');
      playBeep(220, 'square', 0.14, 0.06);
      showToast('Usuário ou senha inválidos. Tente novamente.', 'error', 3500);
      senhaInput.select();
      return;
    }

    // Autenticado! (a sessão já foi gravada acima)
    setTimeout(() => {
      playBeep(784, 'sine', 0.15, 0.05);
      showToast(`Autenticação realizada! Bem-vindo(a), ${session.name.split(' ')[0]}.`, 'success', 2000);

      // Smooth page transition
      document.body.classList.add('page-exit');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);
    }, 700);
  });

  // --- FORGOT PASSWORD MODAL ---
  function openModal() {
    playBeep(480, 'sine', 0.06, 0.03);
    forgotModal.classList.add('modal-active');
    forgotModal.setAttribute('aria-hidden', 'false');
    recoveryFeedback.classList.add('hidden');
    forgotForm.classList.remove('hidden');
    recoveryInput.value = usuarioInput.value || '';
    setTimeout(() => recoveryInput.focus(), 150);
  }

  function closeModal() {
    forgotModal.classList.remove('modal-active');
    forgotModal.setAttribute('aria-hidden', 'true');
  }

  btnOpenForgot.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnFinishModal.addEventListener('click', closeModal);

  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && forgotModal.classList.contains('modal-active')) {
      closeModal();
    }
  });

  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = recoveryInput.value.trim();
    if (!query) {
      showToast('Digite um CPF ou e-mail válido.', 'error');
      recoveryInput.focus();
      return;
    }

    const btn = document.getElementById('btnSendRecovery');
    btn.disabled = true;
    btn.innerHTML = '<span>ENVIANDO...</span>';

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span>ENVIAR INSTRUÇÕES</span>';
      forgotForm.classList.add('hidden');
      recoveryFeedback.classList.remove('hidden');
      playBeep(659, 'sine', 0.12, 0.04);
    }, 800);
  });

  // --- TECH AMBIENT CANVAS (Particles + HUD effects) ---
  const canvas = document.getElementById('techCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const particleCount = 28;

    function resizeCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 0.5;
        this.alpha = Math.random() * 0.35 + 0.1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
          this.reset();
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let radarAngle = 0;

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Particles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      // Subtle radar pulse over bottom right concentric circles (if viewport is wide)
      if (width > 900) {
        const radarCenterX = width * 0.88;
        const radarCenterY = height * 0.80;
        const radarRadius = Math.min(width, height) * 0.16;

        radarAngle += 0.015;
        const sweepX = radarCenterX + Math.cos(radarAngle) * radarRadius;
        const sweepY = radarCenterY + Math.sin(radarAngle) * radarRadius;

        // Draw faint sweeping line
        const grad = ctx.createLinearGradient(radarCenterX, radarCenterY, sweepX, sweepY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.moveTo(radarCenterX, radarCenterY);
        ctx.arc(radarCenterX, radarCenterY, radarRadius, radarAngle - 0.25, radarAngle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    animate();
  }
});
