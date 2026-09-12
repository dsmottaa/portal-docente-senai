/**
 * CARÔMETRO & FREQUÊNCIA - VISUALIZAÇÃO FOTOGRÁFICA DA TURMA
 *  - Grade de alunos com status, frequência e observações
 *  - Modal completo por aluno: presença, observações e notas
 */
document.addEventListener('DOMContentLoaded', () => {
  SENAI_requireAuth();

  let students      = SENAI_loadStudents();
  let currentAlunoId = null;
  const grid        = document.getElementById('carometroGrid');
  const statsRow    = document.getElementById('statsRow');
  const inputS      = document.getElementById('inputSearch');
  const modalAluno  = document.getElementById('modalAluno');
  let search = '';
  let carometroSubId = null;

  function displayStudents() {
    if (!carometroSubId) return students;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(carometroSubId));
    return sub ? SENAI_studentsOfSubTurma(sub) : students;
  }

  inputS.addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); renderGrid(); });

  // ── MODAL UTILITIES ──
  function openModal(modal) { if (modal) { modal.classList.add('modal-active'); modal.setAttribute('aria-hidden', 'false'); } }
  function closeModal(modal) { if (modal) { modal.classList.remove('modal-active'); modal.setAttribute('aria-hidden', 'true'); } }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-backdrop')));
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => closeModal(m));
  });

  // ── STATS ──
  function renderStats() {
    const vis = displayStudents();
    const total = vis.length;
    const compareceram = vis.filter(s => s.status !== 'absent').length;
    const atrasados = vis.filter(s => s.status === 'late').length;
    const ausentes = total - compareceram;
    const obs   = vis.filter(s => s.observacoes && s.observacoes.trim()).length;
    const media = SENAI_avgNota(vis);
    statsRow.innerHTML = `
      <div class="stats-box"><div class="stats-box-icon red"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></div><div><div class="stats-box-label">Total</div><div class="stats-box-val">${total}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon green"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div><div><div class="stats-box-label">Compareceram</div><div class="stats-box-val">${compareceram}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon amber"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div><div class="stats-box-label">Atrasados</div><div class="stats-box-val">${atrasados}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon red"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div><div><div class="stats-box-label">Ausentes</div><div class="stats-box-val">${ausentes}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon amber"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div><div><div class="stats-box-label">Com observação</div><div class="stats-box-val">${obs}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon blue"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div><div><div class="stats-box-label">Média Nota</div><div class="stats-box-val">${media.toFixed(1)}</div></div></div>`;
  }

  // ── GRID ──
  function renderGrid() {
    const vis = displayStudents();
    const filtered = vis.filter(s => {
      if (!search) return true;
      const obsMatch = s.observacoes && s.observacoes.toLowerCase().includes(search);
      return s.name.toLowerCase().includes(search) || s.bancada.includes(search) || obsMatch;
    });
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="diario-empty" style="grid-column:1/-1"><h3>Nenhum aluno encontrado</h3></div>';
      return;
    }
    grid.innerHTML = '';
    filtered.forEach(s => {
      const st = s.status;
      const cls = st === 'absent' ? 'is-absent' : (st === 'late' ? 'is-late' : 'is-present');
      const freqColor = s.freq < 75 ? 'red' : s.freq < 90 ? 'amber' : 'green';
      const shortName = s.name.length > 18 ? s.name.slice(0,16)+'...' : s.name;
      const obs = s.observacoes && s.observacoes.trim();
      const obsShort = obs ? (obs.length > 60 ? obs.slice(0, 57)+'...' : obs) : '';
      const avatarHtml = s.photo
        ? `<img class="carometro-avatar carometro-foto" src="${escHtml(s.photo)}" alt="">`
        : `<div class="carometro-avatar">${escHtml(s.avatar)}</div>`;
      const card = document.createElement('div');
      card.className = `carometro-card ${cls}`;
      card.innerHTML = `
        ${avatarHtml}
        <div class="carometro-name" title="${escHtml(s.name)}">${escHtml(shortName)}</div>
        <div class="carometro-meta">Bancada ${s.bancada} &bull; ${s.matricula}</div>
        ${obs ? `<div class="carometro-obs" title="${escHtml(obs)}"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> ${escHtml(obsShort)}</div>` : ''}
        <div class="carometro-bar-wrap">
          <div class="carometro-bar-label"><span>Frequência</span><span>${s.freq}%</span></div>
          <div class="carometro-bar"><div class="carometro-bar-fill ${freqColor}" style="width:${s.freq}%"></div></div>
        </div>
        <span class="carometro-status ${st === 'absent' ? 'ausente' : st === 'late' ? 'atrasado' : 'presente'}">${st === 'absent' ? 'Ausente' : st === 'late' ? 'Atrasado' : 'Presente'}</span>`;
      card.addEventListener('click', () => openAlunoModal(s.id));
      grid.appendChild(card);
    });
  }

  // ── MODAL COMPLETO POR ALUNO ──
  function escHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getAluno() {
    return students.find(x => x.id === currentAlunoId) || null;
  }

  function notaTemplate() {
    return (SENAI_loadConfig().avaliacoesTemplate || [
      { nome: 'AV1', peso: 0.3 }, { nome: 'AV2', peso: 0.3 }, { nome: 'PRÁTICA', peso: 0.4 }
    ]);
  }

  function renderNotaPreview() {
    const template = notaTemplate();
    const inputs = document.querySelectorAll('#alunoModalNotas input[data-idx]');
    let soma = 0, tPeso = 0;
    template.forEach((t, i) => {
      const inp = inputs[i];
      const nota = inp ? SENAI_clamp(parseFloat(inp.value) || 0, 0, 100) : 0;
      soma += nota * (Number(t.peso) || 0);
      tPeso += (Number(t.peso) || 0);
    });
    const final = Math.round(soma / (tPeso || 1) * 10) / 10;
    const el = document.getElementById('alunoModalPreview');
    if (el) {
      el.textContent = `Média ponderada: ${final.toFixed(1)} / 100`;
      el.className = 'avaliacao-preview ' + (final < 60 ? 'aval-bad' : final < 80 ? 'aval-warn' : 'aval-good');
    }
    return final;
  }

  function fmtDataBR(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 && iso.includes('-') ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderJustificativas() {
    const s = getAluno();
    const list = document.getElementById('alunoModalJustif');
    if (!list) return;
    const session = SENAI_getSession() || {};
    const isCoord = session.role === 'coordenacao';
    const justs = (s && Array.isArray(s.justificativas)) ? s.justificativas.slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')) : [];
    if (justs.length === 0) {
      list.innerHTML = '<p class="justif-empty">Nenhuma justificativa registrada para este aluno.</p>';
      return;
    }
    list.innerHTML = justs.map((j, idx) => {
      const st = j.status || 'aguardando';
      const badge = st === 'aprovado' ? 'justif-ok' : st === 'negado' ? 'justif-ko' : 'justif-wait';
      const label = st === 'aprovado' ? 'Aprovado' : st === 'negado' ? 'Negado' : 'Aguardando';
      return `
      <div class="justif-item">
        <div class="justif-item-top">
          <span class="justif-date">${fmtDataBR(j.dataAula)}</span>
          <span class="justif-badge ${badge}">${label}</span>
        </div>
        <p class="justif-motivo">${escHtml(j.motivo)}</p>
        <div class="justif-item-sub">
          ${j.anexoNome ? `<span class="justif-anexo">📎 ${escHtml(j.anexoNome)}</span>` : ''}
          <span class="justif-meta">por ${escHtml(j.criadoPor || '—')} em ${fmtDataBR(j.criadoEm)}</span>
        </div>
        ${j.revisor ? `<div class="justif-revisor">Revisado por ${escHtml(j.revisor)} ${fmtDataBR(j.revisadoEm)}</div>` : ''}
        ${(st !== 'aprovado' && st !== 'negado') && !isCoord ? '<div class="justif-note">Aguardando análise da coordenação. Justificativas aprovadas é que abonam a falta.</div>' : ''}
        ${(st === 'aguardando' && isCoord) ? `
        <div class="justif-actions">
          <button type="button" class="btn-mat ok" data-justif-ok="${escHtml(j.id)}">Aprovar (abonar)</button>
          <button type="button" class="btn-mat ko" data-justif-ko="${escHtml(j.id)}">Rejeitar</button>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  // Delegação de ações de justificativa
  document.addEventListener('click', (e) => {
    const ok = e.target.closest('[data-justif-ok]');
    const ko = e.target.closest('[data-justif-ko]');
    if (!ok && !ko) return;
    const justId = (ok || ko).getAttribute(ok ? 'data-justif-ok' : 'data-justif-ko');
    const status = ok ? 'aprovado' : 'negado';
    const s = getAluno();
    if (!s) return;
    if (status === 'negado' && !window.confirm('Rejeitar esta justificativa do aluno?')) return;
    SENAI_revisarJustificativa(s.id, justId, status);
    students = SENAI_loadStudents();
    const aprovado = status === 'aprovado';
    showToast(`Justificativa ${aprovado ? 'aprovada, falta abonada' : 'rejeitada'}.`, aprovado ? 'success' : 'info');
    currentAlunoId = s.id;
    renderJustificativas();
    renderStats();
    renderGrid();
  });

  // Modal de nova justificativa
  const modalNovaJustif = document.getElementById('modalNovaJustif');
  const btnNovaJustificativa = document.getElementById('btnNovaJustificativa');
  let justifAnexoData = null;
  let justifAnexoNome = '';

  function lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  if (btnNovaJustificativa) btnNovaJustificativa.addEventListener('click', () => {
    const s = getAluno();
    if (!s) return;
    document.getElementById('justifData').value = SENAI_todayKey();
    document.getElementById('justifMotivo').value = '';
    justifAnexoData = null;
    justifAnexoNome = '';
    const info = document.getElementById('justifAnexoInfo');
    if (info) info.textContent = '';
    document.getElementById('justifAnexoLabel').textContent = 'Clique para anexar atestado / comprovante';
    openModal(modalNovaJustif);
  });

  const justifAnexoInput = document.getElementById('justifAnexo');
  const justifAnexoDrop = document.getElementById('justifAnexoDrop');
  if (justifAnexoDrop) {
    justifAnexoDrop.addEventListener('click', () => justifAnexoInput && justifAnexoInput.click());
  }
  if (justifAnexoInput) {
    justifAnexoInput.addEventListener('change', async () => {
      const file = justifAnexoInput.files && justifAnexoInput.files[0];
      const info = document.getElementById('justifAnexoInfo');
      if (!file) { if (info) info.textContent = ''; return; }
      if (file.size > 2 * 1024 * 1024) {
        if (info) info.textContent = 'Arquivo muito grande (máx. 2 MB).';
        justifAnexoInput.value = '';
        return;
      }
      try {
        justifAnexoData = await lerArquivo(file);
        justifAnexoNome = file.name;
        document.getElementById('justifAnexoLabel').textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
        if (info) info.textContent = '';
      } catch (err) {
        if (info) info.textContent = err.message;
        justifAnexoInput.value = '';
      }
    });
  }

  const btnSalvarJustificativa = document.getElementById('btnSalvarJustificativa');
  if (btnSalvarJustificativa) btnSalvarJustificativa.addEventListener('click', () => {
    const s = getAluno();
    if (!s) return;
    const dataAula = document.getElementById('justifData').value;
    const motivo = document.getElementById('justifMotivo').value.trim();
    if (!dataAula) { showToast('Informe a data da falta.', 'error'); return; }
    if (!motivo) { showToast('Descreva o motivo da justificativa.', 'error'); return; }
    try {
      SENAI_justificarFalta(s.id, { dataAula, motivo, anexoNome: justifAnexoNome, anexo: justifAnexoData });
      students = SENAI_loadStudents();
      closeModal(modalNovaJustif);
      renderJustificativas();
      showToast('Justificativa registrada e enviada à coordenação.', 'success');
    } catch (err) {
      showToast(err.message || 'Falha ao registrar.', 'error');
    }
  });

  function refreshAlunoView() {
    const s = getAluno();
    if (!s) return;

    const el = (id) => document.getElementById(id);
    const avatar = el('alunoModalAvatar');
    if (avatar) {
      avatar.className = 'aluno-modal-avatar ' + (s.status === 'absent' ? 'is-absent' : s.status === 'late' ? 'is-late' : 'is-present');
      avatar.innerHTML = s.photo ? `<img class="aluno-modal-foto" src="${escHtml(s.photo)}" alt="">` : s.avatar;
    }
    if (el('alunoModalName')) el('alunoModalName').textContent = s.name;
    if (el('alunoModalMeta')) el('alunoModalMeta').textContent = `Matrícula ${s.matricula} · Bancada ${s.bancada}`;

    const freqEl = el('alunoModalFreq'); if (freqEl) { freqEl.textContent = `Freq: ${s.freq}%`; freqEl.className = 'aluno-modal-chip ' + (s.freq < 80 ? 'chip-bad' : s.freq < 90 ? 'chip-warn' : 'chip-good'); }
    const notaEl = el('alunoModalNotaF'); if (notaEl) { notaEl.textContent = `Nota: ${s.nota}`; notaEl.className = 'aluno-modal-chip ' + (s.nota < 60 ? 'chip-bad' : s.nota < 80 ? 'chip-warn' : 'chip-good'); }
    const riscoEl = el('alunoModalRisco'); if (riscoEl) {
      riscoEl.textContent = s.riskLabel || 'Sem risco';
      riscoEl.className = 'aluno-modal-chip ' + (s.risk === 'high' ? 'chip-bad' : s.risk === 'medium' ? 'chip-warn' : 'chip-good');
    }

    const obsEl = el('alunoModalObs');
    if (obsEl && document.activeElement !== obsEl) obsEl.value = s.observacoes || '';

    const btn = el('btnAlunoTogglePresenca');
    if (btn) {
      const cls = s.status === 'absent' ? 'is-absent' : (s.status === 'late' ? 'is-late' : 'is-present');
      const txt = s.status === 'absent' ? 'Ausente' : (s.status === 'late' ? 'Atrasado' : 'Presente');
      btn.className = 'btn-aluno-presenca ' + cls;
      if (el('alunoPresencaText')) el('alunoPresencaText').textContent = txt;
    }

    const notasWrap = el('alunoModalNotas');
    if (notasWrap) {
      notasWrap.innerHTML = notaTemplate().map((t, i) => {
        const av = (s.avaliacoes || []).find(a => String(a.nome) === String(t.nome)) || { nome: t.nome, nota: 0 };
        const pct = Math.round((Number(t.peso) || 0) * 100);
        return `
          <div class="avaliacao-input">
            <label for="aluno-nota-in-${i}">${escHtml(t.nome)} <small>peso ${pct}%</small></label>
            <input id="aluno-nota-in-${i}" type="number" min="0" max="100" step="0.1" value="${av.nota}" data-idx="${i}">
          </div>`;
      }).join('');
      notasWrap.querySelectorAll('input').forEach(inp => inp.addEventListener('input', renderNotaPreview));
    }
    renderNotaPreview();
    renderJustificativas();
  }

  function openAlunoModal(id) {
    const s = students.find(x => x.id === id);
    if (!s) return;
    currentAlunoId = id;
    refreshAlunoView();
    openModal(modalAluno);
    const obsEl = document.getElementById('alunoModalObs');
    if (obsEl) setTimeout(() => obsEl.focus(), 60);
  }

  // Alterna presença pelo modal (cicla Presente → Atrasado → Ausente)
  function togglePresenca() {
    const s = getAluno();
    if (!s) return;
    const next = s.status === 'present' ? 'late' : (s.status === 'late' ? 'absent' : 'present');
    SENAI_setStatus(currentAlunoId, next);
    students = SENAI_loadStudents();
    const upd = getAluno();
    if (upd) {
      const label = next === 'present' ? 'PRESENTE' : (next === 'late' ? 'ATRASADO' : 'AUSENTE');
      showToast(`${upd.name} marcado como ${label}.`, next === 'present' ? 'success' : 'info');
    }
    refreshAlunoView();
    renderStats();
    renderGrid();
  }

  // Salva observações + notas
  function salvarAluno() {
    const s = getAluno();
    if (!s) return;
    const obs = document.getElementById('alunoModalObs');
    const template = notaTemplate();
    const notas = [];
    template.forEach((t, i) => {
      const inp = document.querySelector(`#alunoModalNotas input[data-idx="${i}"]`);
      notas.push({ nome: t.nome, peso: Number(t.peso) || 0, nota: inp ? SENAI_clamp(parseFloat(inp.value) || 0, 0, 100) : 0 });
    });
    SENAI_updateStudent(currentAlunoId, {
      observacoes: obs ? obs.value.trim() : '',
      avaliacoes: notas
    });
    students = SENAI_loadStudents();
    showToast(`${s.name}: observações e notas salvas!`, 'success');
    refreshAlunoView();
    renderStats();
    renderGrid();
  }

  const btnSalvar = document.getElementById('btnAlunoSalvar');
  if (btnSalvar) btnSalvar.addEventListener('click', salvarAluno);

  const btnPresenca = document.getElementById('btnAlunoTogglePresenca');
  if (btnPresenca) btnPresenca.addEventListener('click', togglePresenca);

  // ── AUDIO (toque sutil nas ações) ──
  let audioCtx = null;
  function playTone(freq = 440, type = 'sine', duration = 0.08, gainVal = 0.04) {
    try {
      if (!audioCtx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) audioCtx = new C();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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
    } catch (e) {}
  }

  // ── FILTRO POR SUBTURMA ──
  const subBar = document.getElementById('carometroSubBar');
  const subSelect = document.getElementById('carometroSubFilter');
  if (subBar && subSelect && window.SENAI_loadSubTurmas) {
    const subs = SENAI_loadSubTurmas() || [];
    if (subs.length) {
      subSelect.innerHTML = '<option value="">Turma inteira</option>' +
        subs.map(s => `<option value="${escHtml(s.id)}">Sub ${escHtml(s.nome)} (${(s.alunoIds || []).length})</option>`).join('');
      const ativo = SENAI_activeSubTurmaId();
      if (ativo && subs.some(s => String(s.id) === String(ativo))) {
        carometroSubId = String(ativo);
        subSelect.value = String(ativo);
      }
      subBar.style.display = 'flex';
      subSelect.addEventListener('change', () => {
        carometroSubId = subSelect.value || null;
        playTone(500, 'sine', 0.05, 0.02);
        renderStats();
        renderGrid();
      });
      document.getElementById('btnTodosPresSub').addEventListener('click', () => {
        const vis = displayStudents();
        if (carometroSubId && vis.length) {
          const ausentes = vis.filter(s => s.status === 'absent').length;
          SENAI_setPresencaGrupo(vis.map(m => m.id), 'present');
          playTone(650, 'sine', 0.08, 0.03);
          showToast(ausentes ? `${ausentes} aluno(s) marcado(s) como presente(s).` : 'Todos já estavam presentes no grupo.', 'success', 2800);
          students = SENAI_loadStudents();
          renderStats();
          renderGrid();
          return;
        }
        const totalAusentes = students.filter(s => s.status === 'absent').length;
        SENAI_setTodosPresentes();
        playTone(650, 'sine', 0.08, 0.03);
        showToast(totalAusentes ? `${totalAusentes} aluno(s) marcado(s) como presente(s).` : 'Todos já estavam presentes.', 'success', 2800);
        students = SENAI_loadStudents();
        renderStats();
        renderGrid();
      });
    }
  }

  renderStats();
  renderGrid();

  // ── TOAST ──
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
});