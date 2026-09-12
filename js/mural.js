/**
 * MURAL.JS - Mural de avisos / comunicados institucionais
 * Comunicados nacionais (todas as unidades) e locais (unidade do usuário).
 * Depende de data.js e auth.js.
 */
(function () {
  if (!window.SENAI_loadComunicados) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

  const session = SENAI_getSession() || {};
  const isCoord = session.role === 'coordenacao';
  const toastContainer = document.getElementById('toastContainer');

  function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-msg">${message}</span><button class="toast-close" aria-label="Fechar">&times;</button>`;
    t.querySelector('.toast-close').addEventListener('click', () => { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); });
    toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); }, duration);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDataBR(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 && iso.includes('-') ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const btnNovo = document.getElementById('btnNovoComunicado');
  if (!isCoord) {
    btnNovo.style.display = 'none';
    const vis = document.getElementById('comuVisibilidade');
    if (vis) {
      vis.innerHTML = '<option value="turma">Somente a minha unidade</option>';
      vis.setAttribute('disabled', 'disabled');
    }
  }

  function render() {
    const list = document.getElementById('muralList');
    const itens = SENAI_visibleComunicados();
    if (itens.length === 0) {
      list.innerHTML = '<div class="mat-empty"><p>Nenhum comunicado publicado até o momento.<br>Os avisos da coordenação nacional aparecerão aqui assim que forem publicados.</p></div>';
      return;
    }
    list.innerHTML = itens.map(c => `
      <article class="mural-card">
        <div class="mural-head">
          <span class="mural-badge ${c.visibilidade === 'todas_unidades' ? 'mural-badge-nac' : 'mural-badge-local'}">${c.visibilidade === 'todas_unidades' ? '🌎 Nacional' : '📍 ' + esc(c.unidadeNome) }</span>
          ${c.criadoEm ? `<span class="mural-date">${fmtDataBR(c.criadoEm)}</span>` : ''}
        </div>
        <h3 class="mural-titulo">${esc(c.titulo)}</h3>
        ${c.conteudo ? `<p class="mural-conteudo">${esc(c.conteudo)}</p>` : ''}
        <div class="mural-foot">
          <span class="mural-autor">Por ${esc(c.autor || 'Coordenação')}</span>
          ${(isCoord || c.autor === (session.name || '')) ? `<button type="button" class="mural-del" data-del="${esc(c.id)}" title="Excluir aviso">&times;</button>` : ''}
        </div>
      </article>`).join('');

    list.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => {
        if (!window.confirm('Excluir este comunicado do mural?')) return;
        SENAI_deleteComunicado(b.getAttribute('data-del'));
        showToast('Comunicado excluído.', 'success');
        render();
      });
    });
  }

  btnNovo.addEventListener('click', () => {
    document.getElementById('comuTitulo').value = '';
    document.getElementById('comuConteudo').value = '';
    const modal = document.getElementById('modalNovoComunicado');
    modal.classList.add('modal-active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('comuTitulo').focus();
  });

  document.getElementById('btnSalvarComunicado').addEventListener('click', () => {
    const titulo = document.getElementById('comuTitulo').value.trim();
    const conteudo = document.getElementById('comuConteudo').value.trim();
    const visibilidade = document.getElementById('comuVisibilidade').value;
    if (!titulo) { showToast('Informe o título do aviso.', 'error'); return; }
    try {
      SENAI_addComunicado({ titulo, conteudo, visibilidade });
      const modal = document.getElementById('modalNovoComunicado');
      modal.classList.remove('modal-active');
      modal.setAttribute('aria-hidden', 'true');
      render();
      showToast('Aviso publicado no mural.', 'success');
    } catch (err) {
      showToast(err.message || 'Falha ao publicar.', 'error');
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => {
      const m = b.closest('.modal-backdrop');
      if (m) { m.classList.remove('modal-active'); m.setAttribute('aria-hidden', 'true'); }
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) { m.classList.remove('modal-active'); m.setAttribute('aria-hidden', 'true'); } });
  });

  render();
})();