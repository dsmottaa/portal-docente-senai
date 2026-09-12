/**
 * CALENDARIO.JS - Calendário Acadêmico Nacional
 * Eventos de feriado/prova/recesso/evento, escopo nacional ou por unidade.
 * Depende de data.js e auth.js.
 */
(function () {
  if (!window.SENAI_loadCalendario) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

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

  const session = SENAI_getSession() || {};
  const ctx = SENAI_ctx();
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DIAS_SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  let ano = new Date().getFullYear();

  function eventosPorDia() {
    const out = {};
    SENAI_eventosVisiveis().forEach(e => {
      const k = String(e.data || '');
      if (!out[k]) out[k] = [];
      out[k].push(e);
    });
    return out;
  }

  function render() {
    document.getElementById('calYearTitle').textContent = String(ano);
    const mapa = eventosPorDia();
    const hoje = SENAI_todayKey() || '';
    const grid = document.getElementById('calYearGrid');
    let html = '';
    for (let m = 0; m < 12; m++) {
      const nDias = new Date(ano, m + 1, 0).getDate();
      const inis8 = new Date(ano, m, 1).getDay(); // dia da semana que começa o mês
      let cells = '';
      for (let w = 0; w < inis8; w++) cells += '<span class="cal-cell cal-empty"></span>';
      for (let d = 1; d <= nDias; d++) {
        const key = `${ano}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const evs = mapa[key] || [];
        const isHoje = key === hoje;
        cells += `<div class="cal-cell${isHoje ? ' cal-today' : ''}" data-data="${key}">
          <span class="cal-cell-num">${d}</span>
          ${evs.slice(0, 2).map(e => `<span class="cal-cell-flag cal-tipo-${esc(e.tipo)}" title="${esc(e.titulo)}"></span>`).join('')}
          ${evs.length > 2 ? `<span class="cal-cell-more">+${evs.length - 2}</span>` : ''}
        </div>`;
      }
      html += `<div class="cal-month">
        <h3>${MESES[m]}</h3>
        <div class="cal-mWeek">${DIAS_SEM.map(x => `<span>${x}</span>`).join('')}</div>
        <div class="cal-mGrid">${cells}</div>
        <div class="cal-mEventos" data-mes="${m}"></div>
      </div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-cell[data-data]').forEach(cell => {
      cell.addEventListener('click', () => {
        const key = cell.getAttribute('data-data');
        const parent = cell.closest('.cal-month').querySelector('.cal-mEventos');
        const evs = mapa[key] || [];
        if (!evs.length) { parent.innerHTML = `<div class="cal-day-empty">${key.slice(8, 10)}/${key.slice(5, 7)} — sem eventos</div>`; return; }
        parent.innerHTML = evs.map(e => `
          <div class="cal-day-event">
            <span class="cal-tipo-${esc(e.tipo)} cal-dot"></span>
            <div>
              <strong>${esc(e.titulo)}</strong>
              <span class="cal-day-sub">${key.slice(8, 10)}/${key.slice(5, 7)} · ${esc(e.tipo)} ${e.escopo === 'nacional' ? '· Nacional' : ''} ${e.unidadeNome ? '· ' + esc(e.unidadeNome) : ''} ${e.criadoPor ? '· por ' + esc(e.criadoPor) : ''}</span>
            </div>
            ${(session.role === 'coordenacao' || e.criadoPor === (session.name || '')) ? `<button type="button" class="cal-del-event" data-del="${esc(e.id)}" aria-label="Excluir">&times;</button>` : ''}
          </div>`).join('');
      });
    });
    grid.querySelectorAll('.cal-del-event').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (!window.confirm('Excluir este evento do calendário?')) return;
        SENAI_deleteEventoCalendario(b.getAttribute('data-del'));
        showToast('Evento excluído.', 'success');
        render();
      });
    });
  }

  document.getElementById('btnCalYearPrev').addEventListener('click', () => { ano--; render(); });
  document.getElementById('btnCalYearNext').addEventListener('click', () => { ano++; render(); });

  // Novo evento
  const modalEvento = document.getElementById('modalNovoEvento');
  document.getElementById('btnNovoEvento').addEventListener('click', () => {
    document.getElementById('calData').value = '';
    document.getElementById('calTitulo').value = '';
    document.getElementById('calTipo').value = 'evento';
    document.getElementById('calEscopo').value = 'nacional';
    modalEvento.classList.add('modal-active');
    modalEvento.setAttribute('aria-hidden', 'false');
    document.getElementById('calTitulo').focus();
  });

  document.getElementById('btnSalvarEvento').addEventListener('click', () => {
    const data = document.getElementById('calData').value;
    const titulo = document.getElementById('calTitulo').value.trim();
    const tipo = document.getElementById('calTipo').value;
    const escopo = document.getElementById('calEscopo').value;
    if (!data) { showToast('Informe a data.', 'error'); return; }
    if (!titulo) { showToast('Informe o título.', 'error'); return; }
    try {
      SENAI_addEventoCalendario({ data, titulo, tipo, escopo });
      modalEvento.classList.remove('modal-active');
      modalEvento.setAttribute('aria-hidden', 'true');
      ano = Number(data.slice(0, 4));
      render();
      showToast('Evento adicionado ao calendário.', 'success');
    } catch (err) {
      showToast(err.message || 'Falha ao salvar.', 'error');
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