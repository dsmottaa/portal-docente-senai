/**
 * DIÁRIO DE CLASSE - HISTÓRICO DE AULAS E CHAMADAS
 * Depende de data.js (histórico de chamadas) e auth.js.
 */
document.addEventListener('DOMContentLoaded', () => {
  SENAI_requireAuth();

  const students = SENAI_loadStudents();
  let entries = SENAI_loadAulas();

  const diarioEntriesEl = document.getElementById('diarioEntries');
  const statsRow         = document.getElementById('statsRow');
  const btnNovoRegistro  = document.getElementById('btnNovoRegistro');
  const formNovoRegistro = document.getElementById('formNovoRegistro');

  renderStats();
  renderEntries();

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('modal-active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('modal-active');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal-backdrop'));
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  if (btnNovoRegistro) {
    btnNovoRegistro.addEventListener('click', () => {
      const dateInput = document.getElementById('inputNovoDate');
      if (dateInput) dateInput.value = SENAI_todayKey();
      openModal(document.getElementById('modalNovoRegistro'));
    });
  }

  if (formNovoRegistro) {
    formNovoRegistro.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateVal = document.getElementById('inputNovoDate').value;
      if (!dateVal) { showToast('Informe a data da aula.', 'error', 3000); return; }
      const temaVal = document.getElementById('inputNovoTema').value.trim();
      const compVal = document.getElementById('inputNovoCompetencias').value.trim();
      try {
        SENAI_registerAula({
          date: dateVal,
          tema: temaVal || 'Aula registrada manualmente',
          competencias: compVal
        });
        playTone(650, 'sine', 0.08, 0.03);
        closeModal(document.getElementById('modalNovoRegistro'));
        formNovoRegistro.reset();
        entries = SENAI_loadAulas();
        renderStats();
        renderEntries();
        showToast('Registro adicionado ao diário!', 'success', 2500);
      } catch (err) {
        showToast(err.message || 'Erro ao registrar a aula.', 'error', 3500);
      }
    });
  }

  function nomeAluno(id) {
    const s = students.find(x => x.id === id);
    return s ? s.name : 'Desconhecido';
  }

  function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderStats() {
    const hojeKey = SENAI_todayKey();
    const totalAulas = entries.reduce((a, e) => a + (Number(e.aulaCount) || 0), 0);
    const hoje = entries.find(e => e.date === hojeKey);

    const presencaLista = entries.filter(e => e.date !== hojeKey);
    const mediaPresenca = presencaLista.length > 0
      ? Math.round(presencaLista.reduce((acc, e) => acc + (((e.presenteIds || []).length / students.length) * 100), 0) / presencaLista.length)
      : 0;

    statsRow.innerHTML = `
      <div class="stats-box">
        <div class="stats-box-icon red">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        </div>
        <div><div class="stats-box-label">Aulas Registradas</div><div class="stats-box-val">${entries.length}</div></div>
      </div>
      <div class="stats-box">
        <div class="stats-box-icon amber">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div><div class="stats-box-label">Total Aulas Ministradas</div><div class="stats-box-val">${totalAulas}</div></div>
      </div>
      <div class="stats-box">
        <div class="stats-box-icon green">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
        </div>
        <div><div class="stats-box-label">Média Presença</div><div class="stats-box-val">${mediaPresenca}%</div></div>
      </div>
      <div class="stats-box">
        <div class="stats-box-icon blue">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div><div class="stats-box-label">Hoje</div><div class="stats-box-val">${hoje ? (hoje.presenteIds || []).length + '/' + students.length : '--'}</div></div>
      </div>
    `;
  }

  function renderEntries() {
    if (!entries || entries.length === 0) {
      diarioEntriesEl.innerHTML = `
        <div class="diario-empty">
          <h3>Nenhuma aula registrada</h3>
          <p>Confirme a chamada na Central da Aula para registrar o primeiro dia do diário.</p>
        </div>`;
      return;
    }

    diarioEntriesEl.innerHTML = '';
    const ordenadas = entries.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

    ordenadas.forEach(entry => {
      const presentes = (entry.presenteIds || []).length;
      const ausentes = students.length - presentes;
      const ausentesIds = students.filter(s => (entry.presenteIds || []).indexOf(s.id) === -1);
      const cfg = SENAI_loadConfig();

      const div = document.createElement('div');
      div.className = 'diario-entry';
      div.innerHTML = `
        <div class="diario-entry-header" data-id="${entry.id}">
          <div class="diario-date-badge">
            <span class="day">${SENAI_formatDateKey(entry.date).split('/')[0]}</span>
            <span class="month">${SENAI_formatDateKey(entry.date).split('/')[1]}</span>
          </div>
          <div class="diario-entry-info">
            <h4>${entry.tema || 'Aula prática'}</h4>
            <p>${entry.disciplina || cfg.disciplina} &bull; ${entry.aulaCount || 4} aula(s) &bull; ${entry.turma || cfg.turma}</p>
          </div>
          <div class="diario-entry-stats">
            <span class="diario-stat-chip green">${presentes}</span>
            <span class="diario-stat-chip red">${ausentes}</span>
          </div>
          <button type="button" class="diario-delete-btn" data-id="${entry.id}" title="Excluir registro">&times;</button>
        </div>
        <div class="diario-entry-body" style="display:none">
          ${entry.competencias ? `<p><span class="label">Competências / Conteúdo:</span><br>${escHtml(entry.competencias)}</p>` : ''}
          <p><span class="label">Presença:</span> ${presentes}/${students.length} (${Math.round((presentes / students.length) * 100)}%)</p>
          <p><span class="label">Ausentes:</span> ${ausentesIds.length ? ausentesIds.map(s => s.name + ' (' + s.matricula + ')').join(', ') : 'Nenhum'}</p>
        </div>`;

      div.querySelector('.diario-entry-header').addEventListener('click', (e) => {
        if (e.target.closest('.diario-delete-btn')) return;
        const body = div.querySelector('.diario-entry-body');
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
      });

      const delBtn = div.querySelector('.diario-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm(`Excluir o registro do dia ${SENAI_formatDateKey(entry.date)}?`)) return;
          SENAI_deleteAula(entry.id);
          playTone(240, 'square', 0.1, 0.04);
          entries = SENAI_loadAulas();
          renderStats();
          renderEntries();
          showToast('Registro excluído do diário.', 'info', 2200);
        });
      }

      diarioEntriesEl.appendChild(div);
    });
  }
});