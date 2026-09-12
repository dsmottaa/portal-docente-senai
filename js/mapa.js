/**
 * RESERVA DA SALA - AGENDA DE RESERVAS DA SALA/OFICINA
 * - Agenda por data: criar/editar/excluir reservas e detectar conflitos de horário
 */
document.addEventListener('DOMContentLoaded', () => {
  SENAI_requireAuth();

  const config  = SENAI_loadConfig();
  const reservas = SENAI_ensureReservas();
  let selectedDate = SENAI_todayKey();

  const agendaEl = document.getElementById('agendaList');
  const dateInput = document.getElementById('reservaData');
  const dayInfo  = document.getElementById('reservaDayInfo');

  const modal      = document.getElementById('reservaModal');
  const conflictEl = document.getElementById('reservaConflict');

  // ───────────────────────── Agenda ─────────────────────────
  function reservasDoDia() {
    return reservas
      .filter(r => r.data === selectedDate)
      .slice()
      .sort(SENAI_sortReserva);
  }

  function temConflito(r) {
    return SENAI_conflitoReserva(reservas, r) !== null;
  }

  function statusReserva(r) {
    if (temConflito(r)) return { cls: 'badge-conflict', label: 'Conflito' };
    if (r.data < SENAI_todayKey()) return { cls: 'badge-past', label: 'Passada' };
    if (r.data === SENAI_todayKey()) return { cls: 'badge-today', label: 'Hoje' };
    return { cls: 'badge-next', label: 'Agendada' };
  }

  function fmtDur(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h` + (m ? `${m}min` : '');
    return `${m}min`;
  }

  function renderAgenda() {
    const dia = reservasDoDia();

    dayInfo.textContent = SENAI_portuguesDate(new Date(selectedDate + 'T12:00:00'));

    if (dia.length === 0) {
      agendaEl.innerHTML = `<div class="reserva-empty">Nenhuma reserva para este dia. <b>Nova Reserva</b> para agendar a sala.</div>`;
      return;
    }

    agendaEl.innerHTML = dia.map(r => {
      const st = statusReserva(r);
      const obs = r.observacoes ? `<div class="reserva-obs">${escHtml(r.observacoes)}</div>` : '';
      const cfl = st.cls === 'badge-conflict' ? ' conflict' : '';
      return `
        <div class="reserva-item${cfl}" data-id="${r.id}">
          <div class="reserva-time">
            <span class="reserva-time-range">${escHtml(r.inicio)} &ndash; ${escHtml(r.fim)}</span>
            <span class="reserva-dur">${fmtDur(SENAI_minuto(r.fim) - SENAI_minuto(r.inicio))}</span>
          </div>
          <div class="reserva-body">
            <div class="reserva-title">${escHtml(r.turma)} &middot; ${escHtml(r.disciplina)}</div>
            <div class="reserva-meta">Oficina: ${escHtml(r.oficina)}</div>
            ${obs}
          </div>
          <div class="reserva-side">
            <span class="reserva-badge ${st.cls}">${st.label}</span>
            <button type="button" class="reserva-edit" data-edit="${r.id}" title="Editar reserva">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    agendaEl.querySelectorAll('.reserva-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(Number(btn.dataset.edit) || btn.dataset.edit);
      });
    });
  }

  // ───────────────────────── Modal reserva ─────────────────────────
  function openModal(r) {
    conflictEl.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    if (r) {
      document.getElementById('reservaModalTitle').textContent = 'Editar Reserva';
      document.getElementById('rvId').value = r.id;
      document.getElementById('rvOficina').value = r.oficina || '';
      document.getElementById('rvData').value = r.data || '';
      document.getElementById('rvInicio').value = r.inicio || '';
      document.getElementById('rvFim').value = r.fim || '';
      document.getElementById('rvTurma').value = r.turma || '';
      document.getElementById('rvDisciplina').value = r.disciplina || '';
      document.getElementById('rvObservacoes').value = r.observacoes || '';
      document.getElementById('btnDeleteReserva').hidden = false;
    } else {
      document.getElementById('reservaModalTitle').textContent = 'Nova Reserva';
      document.getElementById('rvId').value = '';
      document.getElementById('rvOficina').value = config.oficina || '';
      document.getElementById('rvData').value = selectedDate;
      document.getElementById('rvInicio').value = '07:30';
      document.getElementById('rvFim').value = '11:30';
      document.getElementById('rvTurma').value = config.turma || '';
      document.getElementById('rvDisciplina').value = config.disciplina || '';
      document.getElementById('rvObservacoes').value = '';
      document.getElementById('btnDeleteReserva').hidden = true;
    }
    setTimeout(() => document.getElementById('rvData').focus(), 100);
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('btnCloseReservaModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelReserva').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  document.getElementById('btnDeleteReserva').addEventListener('click', () => {
    const id = Number(document.getElementById('rvId').value) || document.getElementById('rvId').value;
    const r = reservas.find(x => x.id === id);
    if (r && confirm(`Excluir a reserva de ${r.turma} (${r.inicio}–${r.fim})?`)) {
      SENAI_deleteReserva(id);
      reservas.splice(reservas.findIndex(x => x.id === id), 1);
      showToast('Reserva excluída.', 'info');
      closeModal();
      renderAgenda();
    }
  });

  document.getElementById('btnSaveReserva').addEventListener('click', () => {
    const rvId = Number(document.getElementById('rvId').value) || document.getElementById('rvId').value;
    const rv = {
      id: rvId || 'novo',
      oficina: document.getElementById('rvOficina').value.trim(),
      data: document.getElementById('rvData').value,
      inicio: document.getElementById('rvInicio').value,
      fim: document.getElementById('rvFim').value,
      turma: document.getElementById('rvTurma').value.trim(),
      disciplina: document.getElementById('rvDisciplina').value.trim(),
      observacoes: document.getElementById('rvObservacoes').value.trim()
    };

    if (!rv.data || !rv.inicio || !rv.fim) { showToast('Preencha data e horários.', 'error'); return; }
    if (!rv.turma || !rv.disciplina) { showToast('Preencha turma e disciplina.', 'error'); return; }
    if (SENAI_minuto(rv.fim) <= SENAI_minuto(rv.inicio)) {
      showToast('O horário final deve ser depois do inicial.', 'error');
      return;
    }

    const conflito = SENAI_conflitoReserva(reservas, rv);
    if (conflito) {
      conflictEl.classList.remove('hidden');
      conflictEl.innerHTML = `Conflito com a reserva de <b>${escHtml(conflito.turma)}</b> (${escHtml(conflito.inicio)}&ndash;${escHtml(conflito.fim)}) neste horário. Ajuste os horários.`;
      showToast('Já existe reserva neste horário.', 'error');
      return;
    }

    if (rvId) {
      SENAI_updateReserva(rvId, rv);
      Object.assign(reservas.find(x => x.id === rvId), rv);
      showToast('Reserva atualizada!', 'success');
    } else {
      const nova = SENAI_addReserva(rv);
      reservas.push(nova);
      showToast('Reserva criada!', 'success');
    }
    closeModal();
    renderAgenda();
  });

  dateInput.addEventListener('change', () => {
    selectedDate = dateInput.value || SENAI_todayKey();
    renderAgenda();
  });

  document.getElementById('btnNovaReserva').addEventListener('click', () => openModal(null));

  function showToast(message, type = 'info', duration = 2500) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-msg">${message}</span><button class="toast-close" aria-label="Fechar">&times;</button>`;
    t.querySelector('.toast-close').addEventListener('click', () => { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); });
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-visible'));
    setTimeout(() => { if (t.parentElement) { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); } }, duration);
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ───────────────────────── Init ─────────────────────────
  dateInput.value = selectedDate;
  renderAgenda();
});