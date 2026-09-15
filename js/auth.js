/**
 * AUTH.JS - PROTEÇÃO DE PÁGINAS INTERNAS + BINDER DO SIDEBAR
 * Carregado em todas as páginas após login. Verifica a sessão e
 * atualiza nome/avatar/cargo do usuário logado na sidebar.
 */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (!SENAI_requireAuth()) return;

    const session = SENAI_getSession();

    const initials = (session.name || '? ?')
      .split(/\s+/)
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();

    const nameEl = document.getElementById('sidebarName');
    if (nameEl) nameEl.textContent = `Prof. ${session.name}`;

    const avEl = document.getElementById('avatarLN');
    if (avEl) avEl.textContent = initials;

    const roleEl = document.getElementById('sidebarRole');
    if (roleEl) {
      roleEl.textContent = session.role === 'coordenacao'
        ? `COORDENAÇÃO · ${session.matricula || 'SENAI'}`
        : `${session.matricula || 'SENAI'} · SENAI`;
    }

    const sessBadge = document.querySelector('[data-session-role]');
    if (session.role === 'coordenacao' && sessBadge) {
      sessBadge.classList.add('is-coord');
    }

    const navCentralCoord = document.getElementById('navCentralCoord');
    if (navCentralCoord) {
      const li = navCentralCoord.closest('li');
      if (li) li.style.display = session.role === 'coordenacao' ? '' : 'none';
    }
    const linksCentral = document.querySelectorAll('a[href="central.html"]');
    linksCentral.forEach(a => {
      const li = a.closest('li');
      if (li && li !== (navCentralCoord && navCentralCoord.closest('li'))) {
        li.style.display = session.role === 'coordenacao' ? '' : 'none';
      }
    });

    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.SENAI_logoutServer) SENAI_logoutServer();
        SENAI_clearSession();
        window.location.href = 'index.html';
      });
    });

    // Tema escuro + cor de destaque (gerenciados por js/theme.js)
    if (window.SENAI_aplicarTemaCompleto) {
      window.SENAI_aplicarTemaCompleto();
    } else {
      const pref = localStorage.getItem('senai_tema') || 'light';
      document.documentElement.setAttribute('data-theme', pref === 'dark' ? 'dark' : 'light');
    }

    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => {
          m.classList.remove('modal-active');
          m.setAttribute('aria-hidden', 'true');
        });
        return;
      }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        window.SENAI_toggleTema();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); window.location.href = 'dashboard.html'; }
    });

    // Banner LGPD (consentimento após o 1º login)
    const consentido = localStorage.getItem('senai_lgpd_ok');
    if (!consentido && !document.querySelector('.lgpd-banner')) {
      const b = document.createElement('div');
      b.className = 'lgpd-banner';
      b.innerHTML = `<p>Seus dados são tratados com privacidade e segurança pelo Portal do Docente SENAI, em conformidade com a <b>LGPD (Lei 13.709/2018)</b>. O armazenamento é local no seu dispositivo e sincronizado de forma criptografada ao servidor institucional.</p>
        <button type="button">Entendi</button>`;
      b.querySelector('button').addEventListener('click', () => {
        localStorage.setItem('senai_lgpd_ok', '1');
        b.remove();
      });
      document.body.appendChild(b);
    }

    // Foco inicial acessível
    setTimeout(() => {
      const focavel = document.querySelector('h1.feature-page-title') || document.querySelector('main input');
      if (focavel && focavel.setAttribute) focavel.setAttribute('tabindex', '-1');
    }, 0);

    const renderSync = () => {
      const el = document.getElementById('syncStatus');
      if (el && typeof SENAI_syncStatusHTML === 'function') {
        el.innerHTML = SENAI_syncStatusHTML();
      }
    };
    renderSync();
    window.addEventListener('senai:synced', renderSync);
    setInterval(renderSync, 5000);
  });
})();