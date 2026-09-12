/**
 * DASHBOARD - PORTAL DO DOCENTE SENAI
 * Central da Aula: contexto da turma, gráficos de notas/presença,
 * calendário de aulas e reservas, e Turma Virtual (avisos/tarefas simulados).
 */

document.addEventListener('DOMContentLoaded', () => {

  SENAI_requireAuth();

  // --- DADOS BÁSICOS ---
  let students = SENAI_loadStudents();
  const config = SENAI_loadConfig();

  // --- AUDIO SYNTHESIS (Web Audio API) ---
  let audioCtx = null;
  function playTone(freq = 440, type = 'sine', duration = 0.08, gainVal = 0.04) {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
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

  // --- TOAST SYSTEM ---
  const toastContainer = document.getElementById('toastContainer');
  function showToast(message, type = 'info', duration = 3000) {
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
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  function escHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- ATUALIZAR SESSÃO DO USUÁRIO LOGADO ---
  try {
    const sessionData = localStorage.getItem('senai_user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      const teacherNameDisplay = document.getElementById('teacherNameDisplay');
      const sidebarName = document.querySelector('.profile-name');
      const avatarLN = document.querySelector('.avatar-ln');

      if (user.name) {
        if (teacherNameDisplay) teacherNameDisplay.textContent = `Prof. ${user.name}`;
        if (sidebarName) sidebarName.textContent = `Prof. ${user.name}`;
        if (avatarLN) avatarLN.textContent = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      }
    }
  } catch (e) {}

  // Data atual
  const dateEl = document.getElementById('currentDateDisplay');
  if (dateEl) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    dateEl.textContent = `Hoje, ${day}/${month}/${year}`;
  }

  // Contexto da turma (turno/carga/oficina) vem do config
  const cfg = SENAI_loadConfig();
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('configTurnoTag', cfg.turno || 'MANHÃ');
  setText('configCargaTag', cfg.cargaHoraria || '04H');
  setText('oficinaNome', cfg.oficina || 'Oficina 2 (Bancada A)');
  setText('turnoNome', cfg.turno || 'MANHÃ');
  setText('turmaNome', cfg.turma || 'TEC-MEC-21');
  setText('disciplinaNome', cfg.disciplina || 'Automação Industrial');

  // --- GRÁFICOS DA CENTRAL (SVG inline + barras pedagógicas) ---
  let chartSerie = 'final';
  let dashboardSubId = null;

  function displayStudents() {
    if (!dashboardSubId) return students;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(dashboardSubId));
    if (!sub) return students;
    return SENAI_studentsOfSubTurma(sub);
  }

  function grupoLabel() {
    if (!dashboardSubId) return 'classe toda';
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(dashboardSubId));
    return sub ? `Sub ${sub.nome}` : 'classe toda';
  }

  function serieNotas() {
    const vis = displayStudents();
    if (chartSerie === 'final') return vis.map(s => Number(s.nota) || 0);
    return vis.map(s => {
      const av = (s.avaliacoes || []).find(a => String(a.nome) === chartSerie);
      return av ? SENAI_clamp(Number(av.nota) || 0, 0, 100) : 0;
    });
  }

  function renderNotaSerie() {
    const el = document.getElementById('notaChartCard');
    if (!el) return;

    const vis = displayStudents();
    const total = vis.length || 1;
    const notas = serieNotas();
    const media = notas.reduce((a, b) => a + b, 0) / total;
    const mediaStr = media.toFixed(1).replace('.', ',');
    const mediaPos = Math.max(0, Math.min(100, media));
    const flattenChip = media > 78;

    const acimaMedia = notas.filter(n => n >= media).length;
    const abaixo70 = notas.filter(n => n < 70).length;

    const faixas = [
      { label: 'Reprovação', faixa: '< 60', inicio: 0, fim: 60, cor: '#dc2626' },
      { label: 'Recuperação', faixa: '60-69', inicio: 60, fim: 70, cor: '#f59e0b' },
      { label: 'Adequado', faixa: '70-89', inicio: 70, fim: 90, cor: '#3b82f6' },
      { label: 'Excelente', faixa: '90-100', inicio: 90, fim: 101, cor: '#059669' }
    ];

    const maxQtd = Math.max(1, ...faixas.map(f =>
      notas.filter(n => n >= f.inicio && n < f.fim).length
    ));

    const cols = faixas.map(f => {
      const qtd = notas.filter(n => n >= f.inicio && n < f.fim).length;
      const pctNotas = Math.round((qtd / total) * 100);
      const h = Math.max(4, (qtd / maxQtd) * 100);
      return `
        <div class="nota-col" style="left:${f.inicio}%;width:${f.fim - f.inicio}%" title="${f.label} (${f.faixa}): ${qtd} aluno(s) (${pctNotas}%)">
          <div class="nota-val" style="bottom:calc(${h}% + 8px)">${qtd}</div>
          <div class="nota-bar" style="height:${h}%;background:${f.cor}"></div>
          <div class="nota-lbl"><span class="nota-lbl-name">${f.label}</span><span class="nota-lbl-range">${f.faixa}</span></div>
        </div>`;
    }).join('');

    const tabs = ['final'].concat((SENAI_loadConfig().avaliacoesTemplate || []).map(a => a.nome))
      .map(name => `
        <button type="button" class="nota-tab ${chartSerie === name ? 'active' : ''}" data-serie="${escHtml(name)}">
          ${name === 'final' ? 'Final' : escHtml(name)}
        </button>`)
      .join('');

    const serieLabel = chartSerie === 'final' ? 'nota final' : chartSerie;

    el.innerHTML = `
      <div class="nota-chart-tabs">${tabs}</div>
      <h3>Distribuição de Notas <small class="nota-series-label">&middot; ${escHtml(serieLabel)}</small></h3>
      <span class="chart-sub">Média da turma: <strong class="nota-mean-highlight">${mediaStr}</strong> &middot; ${total} alunos</span>
      <div class="nota-chart">
        ${cols}
        <div class="nota-mean-line${flattenChip ? ' flip' : ''}" style="left:${mediaPos.toFixed(1)}%">
          <span class="nota-mean-chip">Média ${mediaStr}</span>
        </div>
      </div>
      <div class="nota-footer">
        <span class="nota-foot-chip good">Acima da média: <b>${acimaMedia}</b></span>
        <span class="nota-foot-chip warn">Abaixo de 70: <b>${abaixo70}</b></span>
      </div>
      <div class="chart-legend">
        <span><i style="background:#dc2626"></i> <60</span>
        <span><i style="background:#f59e0b"></i> 60-69</span>
        <span><i style="background:#3b82f6"></i> 70-89</span>
        <span><i style="background:#059669"></i> 90-100</span>
      </div>`;

    el.querySelectorAll('.nota-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        chartSerie = tab.dataset.serie;
        playTone(500, 'sine', 0.05, 0.02);
        renderNotaSerie();
      });
    });
  }

  function renderCharts() {
    const row = document.getElementById('chartsRow');
    if (!row) return;

    const vis = displayStudents();
    const total = vis.length || 1;
    const compareceram = vis.filter(s => s.status !== 'absent').length;
    const atrasados = vis.filter(s => s.status === 'late').length;
    const ausentes = total - compareceram;
    const presentPct = Math.round((compareceram / total) * 100);

    const C = 2 * Math.PI * 42;
    const dashPresent = (presentPct / 100) * C;

    row.innerHTML = `
      <div class="chart-card" id="notaChartCard"></div>
      <div class="chart-card">
        <h3>Presença de Hoje</h3>
        <span class="chart-sub">${compareceram} compareceram &middot; ${atrasados} atrasado(s) &middot; ${ausentes} ausente(s) &middot; ${grupoLabel()}</span>
        <svg viewBox="0 0 120 120" width="110" height="110" style="margin:0 auto;display:block;width:110px;max-width:110px">
          <circle cx="60" cy="60" r="42" fill="none" stroke="#E2E8F0" stroke-width="14"></circle>
          <circle cx="60" cy="60" r="42" fill="none" stroke="#059669" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="${dashPresent.toFixed(1)} ${C.toFixed(1)}"
            transform="rotate(-90 60 60)"></circle>
          <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="800" fill="#0F172A">${presentPct}%</text>
          <text x="60" y="76" text-anchor="middle" font-size="10" fill="#64748B">presentes</text>
        </svg>
        <div class="chart-legend">
          <span><i style="background:#059669"></i> Presentes (${compareceram})</span>
          <span><i style="background:#D97706"></i> Atrasados (${atrasados})</span>
          <span><i style="background:#E2E8F0"></i> Ausentes (${ausentes})</span>
        </div>
      </div>`;

    renderNotaSerie();
  }

  // --- ATUALIZAR CONTADORES DO MODAL DE CHAMADA ---
  function updateCounters() {
    const total = students.length;
    const presentCount = students.filter(s => s.status !== 'absent').length;
    const absentCount = students.filter(s => s.status === 'absent').length;

    const modalTotal = document.getElementById('modalTotalAlunos');
    const modalPresent = document.getElementById('modalTotalPresentes');
    const modalAbsent = document.getElementById('modalTotalAusentes');
    if (modalTotal) modalTotal.textContent = total;
    if (modalPresent) modalPresent.textContent = presentCount;
    if (modalAbsent) modalAbsent.textContent = absentCount;

    const chip = document.getElementById('chamadaAbsentCount');
    if (chip) {
      chip.textContent = absentCount;
      chip.style.display = absentCount > 0 ? 'inline-flex' : 'none';
    }
  }

  // --- MODAL: CONFIRMAR / ENCERRAR CHAMADA (TOPO) ---
  const modalConfirmarChamada = document.getElementById('modalConfirmarChamada');
  const btnConfirmarChamadaTopo = document.getElementById('btnConfirmarChamadaTopo');
  const modalAusentesList = document.getElementById('modalAusentesList');
  const btnSalvarSGE = document.getElementById('btnSalvarSGE');

  function prefillChamada() {
    const hoje = SENAI_todayKey();
    const aula = (SENAI_loadAulas() || []).find(a => a.date === hoje);
    const temaEl = document.getElementById('chamadaTemaAula');
    const compEl = document.getElementById('chamadaCompetencias');
    if (temaEl && temaEl.value && temaEl.value.trim()) return;
    if (aula) {
      if (temaEl) temaEl.value = aula.tema || '';
      if (compEl) compEl.value = aula.competencias || '';
    }
  }

  function openConfirmarChamadaModal() {
    if (!modalConfirmarChamada) return;
    updateCounters();
    prefillChamada();

    const absents = students.filter(s => s.status === 'absent');
    if (absents.length === 0) {
      modalAusentesList.innerHTML = `
        <div class="all-present-msg">
          <p>100% de Presença! Nenhum aluno ausente nesta aula.</p>
        </div>
      `;
    } else {
      modalAusentesList.innerHTML = `
        <div class="absent-header-title">Alunos com falta registrada (${absents.length}):</div>
        <div class="absent-chips">
          ${absents.map(a => `
            <div class="absent-chip">
              <strong>Bancada ${a.bancada}</strong> &bull; ${a.name} (${a.matricula})
            </div>
          `).join('')}
        </div>
      `;
    }

    openModal(modalConfirmarChamada);
  }

  if (btnConfirmarChamadaTopo) {
    btnConfirmarChamadaTopo.addEventListener('click', openConfirmarChamadaModal);
  }

  if (btnSalvarSGE) {
    btnSalvarSGE.addEventListener('click', () => {
      btnSalvarSGE.disabled = true;
      btnSalvarSGE.innerHTML = '<span>Sincronizando com SGE...</span>';

      setTimeout(() => {
        const temaEl = document.getElementById('chamadaTemaAula');
        const compEl = document.getElementById('chamadaCompetencias');
        const cfgNow = SENAI_loadConfig();
        const res = SENAI_closeCall({
          tema: temaEl ? temaEl.value.trim() : '',
          competencias: compEl ? compEl.value.trim() : '',
          disciplina: cfgNow.disciplina,
          aulaCount: parseInt(cfgNow.cargaHoraria) || 4
        });

        students = SENAI_loadStudents();
        renderCharts();

        btnSalvarSGE.disabled = false;
        btnSalvarSGE.innerHTML = '<span>Confirmar e Sincronizar SGE</span>';
        closeModal(modalConfirmarChamada);

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const sgeTime = document.getElementById('sgeSyncTime');
        if (sgeTime) sgeTime.textContent = `Último envio automático às ${timeStr}`;

        playTone(987, 'sine', 0.2, 0.05);
        const occMsg = res.ocorrenciasCriadas > 0 ? ` · ${res.ocorrenciasCriadas} ocorrência(s) de falta criada(s).` : '';
        showToast(`Chamada sincronizada com o SGE! Faltas registradas: ${res.ausentes} · Atrasados: ${res.atrasados || 0}.${occMsg}`, 'success', 4500);
      }, 1000);
    });
  }

  // --- MODAL: TROCAR TURMA / MATÉRIA ---
  const modalTrocarTurma = document.getElementById('modalTrocarTurma');
  const btnTrocarTurma = document.getElementById('btnTrocarTurma');
  const turmasListSelect = document.getElementById('turmasListSelect');

  if (btnTrocarTurma) btnTrocarTurma.addEventListener('click', () => openModal(modalTrocarTurma));

  function renderTurmas() {
    if (!turmasListSelect) return;
    const ativa = String(SENAI_loadConfig().turma || '').trim().toLowerCase();
    const catalogo = (window.SENAI_loadCatalogoTurmas ? SENAI_loadCatalogoTurmas() : SENAI_MATERIAS) || [];
    turmasListSelect.innerHTML = catalogo.map(m => {
      const isAtiva = ativa === String(m.turma || '').trim().toLowerCase();
      return `
        <button type="button" class="turma-option-btn ${isAtiva ? 'active' : ''}"
          data-turma="${escHtml(m.turma)}" data-disc="${escHtml(m.disciplina)}"
          data-oficina="${escHtml(m.oficina)}" data-turno="${escHtml(m.turno)}" data-curso="${escHtml(m.curso)}">
          <strong>${escHtml(m.turma)} &mdash; ${escHtml(m.disciplina)}</strong>
          <span>${escHtml(m.oficina)} &middot; Turno ${escHtml(m.turno)} (${m.alunos || ''} alunos)</span>
        </button>`;
    }).join('');

    turmasListSelect.querySelectorAll('.turma-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SENAI_switchTurma({
          turma: btn.dataset.turma,
          disciplina: btn.dataset.disc,
          oficina: btn.dataset.oficina,
          turno: btn.dataset.turno,
          curso: btn.dataset.curso
        });

        closeModal(modalTrocarTurma);
        playTone(700, 'sine', 0.1, 0.04);
        showToast(`Matéria alterada para ${btn.dataset.turma}! Recarregando...`, 'success', 2500);
        setTimeout(() => window.location.reload(), 900);
      });
    });
  }

  // --- BOTÃO: RELATÓRIOS & EXPORTAÇÕES ---
  const btnExportarDiario = document.getElementById('btnExportarDiario');

  if (btnExportarDiario) {
    btnExportarDiario.addEventListener('click', () => {
      playTone(550, 'sine', 0.1, 0.04);
      window.location.href = 'relatorios.html';
    });
  }

  // --- CALENDÁRIO (AULAS + RESERVAS) ---
  const calGrid = document.getElementById('calGrid');
  const calDayEvents = document.getElementById('calDayEvents');
  const calMonthTitle = document.getElementById('calMonthTitle');
  const btnCalPrev = document.getElementById('btnCalPrev');
  const btnCalNext = document.getElementById('btnCalNext');
  const btnCalToday = document.getElementById('btnCalToday');

  const calendarEvents = SENAI_calendarEvents();
  const todayKey = SENAI_todayKey();
  let calCursor = new Date();
  let selectedDate = todayKey;

  function dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function renderCalendar() {
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();

    calMonthTitle.textContent = new Date(year, month, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const byDate = {};
    calendarEvents.forEach(ev => {
      if (!ev.date) return;
      (byDate[ev.date] = byDate[ev.date] || []).push(ev);
    });

    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell cal-empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(year, month, day);
      const evs = byDate[key] || [];
      const hasAula = evs.some(e => e.tipo === 'aula');
      const hasReserva = evs.some(e => e.tipo === 'reserva');
      const isToday = key === todayKey;
      const isSel = key === selectedDate;
      html += `
        <div class="cal-cell ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''} ${evs.length ? 'has-events' : ''}" data-date="${key}">
          <span class="cal-day-num">${day}</span>
          <span class="cal-dots">
            ${hasAula ? '<span class="cal-dot dot-aula" title="Aula"></span>' : ''}
            ${hasReserva ? '<span class="cal-dot dot-reserva" title="Reserva"></span>' : ''}
          </span>
        </div>`;
    }
    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        selectedDate = cell.dataset.date;
        renderCalendar();
        renderDayEvents();
      });
    });

    renderDayEvents();
  }

  function renderDayEvents() {
    const evs = calendarEvents.filter(e => e.date === selectedDate);
    if (evs.length === 0) {
      calDayEvents.innerHTML = `<div class="cal-day-events-empty">Sem aulas ou reservas em ${SENAI_formatDateKey(selectedDate)}.</div>`;
      return;
    }
    calDayEvents.innerHTML = `
      <div class="cal-day-events-title">Eventos de ${SENAI_formatDateKey(selectedDate)} (${evs.length})</div>
      ${evs.map(e => `
        <div class="cal-event-item ev-${e.tipo}">
          <span class="cal-event-badge ${e.tipo}">${e.tipo === 'aula' ? 'AULA' : 'RESERVA'}</span>
          <div class="cal-event-body">
            <strong>${escHtml(e.titulo)}</strong>
            ${e.hora ? `<span class="cal-event-hora">${escHtml(e.hora)}</span>` : ''}
            ${e.detalhe ? `<span class="cal-event-det">${escHtml(e.detalhe)}</span>` : ''}
          </div>
        </div>`).join('')}`;
  }

  if (btnCalPrev) btnCalPrev.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  if (btnCalNext) btnCalNext.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });
  if (btnCalToday) btnCalToday.addEventListener('click', () => {
    calCursor = new Date();
    selectedDate = todayKey;
    renderCalendar();
  });

  // --- TURMA VIRTUAL (SIMULADO) ---
  const classroomFeed = document.getElementById('classroomFeed');
  const newPostForm = document.getElementById('newPostForm');
  const btnNewPost = document.getElementById('btnNewPost');
  const btnCancelPost = document.getElementById('btnCancelPost');
  const postTipo = document.getElementById('postTipo');
  const postEntregaGroup = document.getElementById('postEntregaGroup');

  function renderClassroom() {
    const posts = SENAI_ensureClassroom();
    if (!classroomFeed) return;

    if (posts.length === 0) {
      classroomFeed.innerHTML = '<div class="classroom-empty">Nenhuma postagem ainda. Crie o primeiro aviso ou tarefa.</div>';
      return;
    }

    classroomFeed.innerHTML = posts.map(p => `
      <article class="classroom-post ${p.tipo === 'tarefa' ? 'is-tarefa' : 'is-aviso'}">
        <div class="post-head">
          <span class="post-tipo ${p.tipo}">${p.tipo === 'tarefa' ? 'TAREFA' : 'AVISO'}</span>
          ${p.entrega ? `<span class="post-entrega">Entrega: ${SENAI_formatDateKey(p.entrega)}</span>` : ''}
        </div>
        <h4 class="post-titulo">${escHtml(p.titulo)}</h4>
        ${p.conteudo ? `<p class="post-conteudo">${escHtml(p.conteudo)}</p>` : ''}
        <div class="post-foot">
          <span class="post-autor">${escHtml(p.autor)} &middot; ${SENAI_formatDateKey(p.criadoEm)}</span>
          <div class="post-actions">
            ${p.tipo === 'tarefa' ? `
              <button type="button" class="post-btn toggle-entrega ${p.entregue ? 'done' : ''}" data-id="${p.id}">
                ${p.entregue ? '&#10003; Entregue' : 'Marcar entregue'}
              </button>` : ''}
            <button type="button" class="post-btn del-post" data-id="${p.id}">Excluir</button>
          </div>
        </div>
      </article>`).join('');

    classroomFeed.querySelectorAll('.toggle-entrega').forEach(btn => {
      btn.addEventListener('click', () => {
        const entregue = SENAI_toggleEntrega(btn.dataset.id);
        playTone(entregue ? 660 : 420, 'sine', 0.07, 0.03);
        showToast(entregue ? 'Tarefa marcada como entregue.' : 'Tarefa marcada como pendente.', entregue ? 'success' : 'info', 2200);
        renderClassroom();
      });
    });

    classroomFeed.querySelectorAll('.del-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const post = posts.find(x => x.id === btn.dataset.id);
        if (!post) return;
        if (!confirm(`Excluir a postagem "${post.titulo}"?`)) return;
        SENAI_deleteClassroomPost(post.id);
        playTone(240, 'square', 0.1, 0.04);
        showToast('Postagem excluída.', 'info', 2200);
        renderClassroom();
      });
    });
  }

  if (btnNewPost) {
    btnNewPost.addEventListener('click', () => {
      btnNewPost.classList.add('hidden');
      newPostForm.classList.remove('hidden');
      document.getElementById('postTitulo').focus();
    });
  }

  if (btnCancelPost) {
    btnCancelPost.addEventListener('click', () => {
      newPostForm.classList.add('hidden');
      btnNewPost.classList.remove('hidden');
      newPostForm.reset();
      postEntregaGroup.style.display = 'none';
    });
  }

  if (postTipo) {
    postTipo.addEventListener('change', () => {
      postEntregaGroup.style.display = postTipo.value === 'tarefa' ? 'block' : 'none';
    });
  }

  if (newPostForm) {
    newPostForm.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const post = SENAI_addClassroomPost({
          tipo: postTipo.value,
          titulo: document.getElementById('postTitulo').value.trim(),
          conteudo: document.getElementById('postConteudo').value.trim(),
          entrega: document.getElementById('postEntrega').value
        });
        playTone(700, 'sine', 0.1, 0.04);
        showToast(`Postagem "${post.titulo}" publicada na Turma Virtual!`, 'success', 3000);
        newPostForm.reset();
        newPostForm.classList.add('hidden');
        postEntregaGroup.style.display = 'none';
        btnNewPost.classList.remove('hidden');
        renderClassroom();
      } catch (err) {
        showToast(err.message || 'Erro ao publicar.', 'error', 4000);
      }
    });
  }

  // --- GOOGLE CLASSROOM (modo real, via proxy local) ---
  const classroomBanner = document.getElementById('classroomBanner');
  const classroomBannerMsg = document.getElementById('classroomBannerMsg');
  const classroomCourseSelect = document.getElementById('classroomCourseSelect');
  const btnConnectClassroom = document.getElementById('btnConnectClassroom');
  const classroomMode = document.getElementById('classroomMode');

  const noClassroom = () => !window.SENAI_Classroom;

  function hideClassroomBanner() {
    if (classroomBanner) classroomBanner.classList.add('hidden');
    if (classroomMode) classroomMode.textContent = '';
  }

  async function initClassroomReal() {
    if (noClassroom()) return;
    const cfg = SENAI_loadConfig() || {};
    const turmaCode = cfg.turma || '';
    const cursoNome = cfg.curso || '';
    const bannerText = classroomBannerMsg || null;
    if (!classroomBanner || !bannerText) return;

    let st;
    try {
      st = await SENAI_Classroom.status();
    } catch (e) {
      st = { configured: false, connected: false };
    }

    if (!st.configured) return;

    classroomBanner.classList.remove('hidden');

    if (!st.connected) {
      bannerText.textContent = 'Google Classroom configurado, mas ainda não conectado.';
      if (btnConnectClassroom) {
        btnConnectClassroom.classList.remove('hidden');
        btnConnectClassroom.addEventListener('click', async () => {
          const url = await SENAI_Classroom.authUrl();
          if (url) window.location.href = url;
          else showToast('Não foi possível gerar o link de conexão.', 'error', 4000);
        });
      }
      return;
    }

    if (classroomMode) classroomMode.textContent = '· conectado';
    if (btnNewPost) btnNewPost.classList.add('hidden');
    bannerText.textContent = 'Carregando atividades do Google Classroom...';

    const list = await SENAI_Classroom.courses();
    const auto = await SENAI_Classroom.effectiveCourse(turmaCode, cursoNome);
    const mapped = SENAI_Classroom.mappingFor(turmaCode);

    if (list.length === 0) {
      bannerText.innerHTML = 'Nenhum curso encontrado na sua conta. Crie no Classroom um curso com o nome da turma (<b>' + escHtml(turmaCode || '-') + '</b>).';
      return;
    }

    // Seletor de curso (sempre disponível no modo real, para trocar manualmente)
    if (classroomCourseSelect) {
      classroomCourseSelect.classList.remove('hidden');
      classroomCourseSelect.innerHTML = list
        .map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`)
        .join('');
      const chosen = (mapped && mapped.id) || (auto && auto.id) || list[0].id;
      classroomCourseSelect.value = chosen;
      classroomCourseSelect.addEventListener('change', () => {
        const c = list.find(x => String(x.id) === String(classroomCourseSelect.value));
        if (!c) return;
        SENAI_Classroom.setMapping(turmaCode, { id: c.id, name: c.name });
        renderClassroomReal(c.id, c.name);
      });
    }

    const course = (mapped && mapped.id) || (auto && auto.id) ? (mapped || auto) : list[0];
    renderClassroomReal(course.id, course.name, turmaCode, list);
  }

  async function renderClassroomReal(courseId, courseName, turmaCode, list) {
    if (noClassroom()) return;
    const bannerText = classroomBannerMsg || null;
    try {
      const posts = await SENAI_Classroom.feed(courseId);
      if (bannerText) {
        bannerText.innerHTML = courseName
          ? 'Atividades reais de <b>' + escHtml(courseName) + '</b>'
          : 'Atividades do Google Classroom:';
      }
      if (!classroomFeed) return;
      if (!posts.length) {
        classroomFeed.innerHTML = '<div class="classroom-empty">Nenhuma atividade publicada neste curso ainda.</div>';
        return;
      }
      classroomFeed.innerHTML = posts.map(p => {
        const totalAssigned = p.missing != null ? p.submitted + p.missing : p.submitted;
        return `
        <article class="classroom-post is-tarefa classroom-real">
          <div class="post-head">
            <span class="post-tipo tarefa">ATIVIDADE</span>
            ${p.dueDate ? `<span class="post-entrega">Entrega: ${SENAI_formatDateKey(p.dueDate)}</span>` : ''}
          </div>
          <h4 class="post-titulo">${escHtml(p.title)}</h4>
          ${p.description ? `<p class="post-conteudo">${escHtml(p.description)}</p>` : ''}
          <div class="post-foot">
            <span class="post-autor"><strong>${p.submitted}</strong> de ${totalAssigned} entregues no Google Classroom</span>
          </div>
        </article>`;
      }).join('');
    } catch (err) {
      hideClassroomBanner();
      if (btnNewPost) btnNewPost.classList.remove('hidden');
      renderClassroom();
      showToast('Não foi possível carregar o Google Classroom: ' + err.message, 'error', 4000);
    }
  }

  // --- MODAL UTILITIES ---
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('modal-active');
    modal.setAttribute('aria-hidden', 'false');
    playTone(400, 'sine', 0.06, 0.03);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('modal-active');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => closeModal(m));
    }
  });

  // --- FILTRO POR SUBTURMA (gráficos da Central) ---
  const subWrap = document.getElementById('subTurmaFilterWrap');
  const subSelect = document.getElementById('subTurmaFilter');
  if (subWrap && subSelect && window.SENAI_loadSubTurmas) {
    const subs = SENAI_loadSubTurmas() || [];
    if (subs.length) {
      subSelect.innerHTML = '<option value="">Turma inteira</option>' +
        subs.map(s => `<option value="${escHtml(s.id)}">Sub ${escHtml(s.nome)} (${(s.alunoIds || []).length})</option>`).join('');
      const ativo = SENAI_activeSubTurmaId();
      if (ativo && subs.some(s => String(s.id) === String(ativo))) {
        dashboardSubId = String(ativo);
        subSelect.value = String(ativo);
      }
      subWrap.style.display = 'flex';
      subSelect.addEventListener('change', () => {
        dashboardSubId = subSelect.value || null;
        playTone(500, 'sine', 0.05, 0.02);
        renderCharts();
      });
    }
  }

  // --- PRÉ-AULA: ALERTAS E PROJEÇÃO ---
  function renderAlertas() {
    const alertaList = document.getElementById('alertaList');
    if (!alertaList) return;
    const vis = displayStudents();
    const hoje = SENAI_todayKey();
    const aulas = SENAI_loadAulas() || [];
    const ocorrencias = SENAI_loadOcorrencias() || [];
    const reservas = SENAI_loadReservas() || [];

    const alto = vis.filter(s => s.risk === 'high');
    const medio = vis.filter(s => s.risk === 'medium');
    const baixaNota = vis.filter(s => Number(s.nota || 0) < 60);
    const crit = ocorrencias.filter(o => (o.severidade === 'alta' || o.severidade === 'critica') && o.status !== 'resolvida');
    const aulaHoje = aulas.find(a => a.date === hoje);
    const reservaHoje = reservas.find(r => r.data === hoje);
    const session2 = SENAI_getSession() || {};
    const isCoordDashboard = session2.role === 'coordenacao';
    const pendMateriais = isCoordDashboard ? (SENAI_loadMateriais() || []).filter(m => m.status === 'aguardando').length : 0;

    const alerts = [];

    if (pendMateriais > 0) {
      alerts.push({
        tipo: 'admin',
        html: `<strong>${pendMateriais} material(is) aguardando aprovação</strong> no repositório nacional. <a href="materiais.html#pendentes">Revisar agora</a>.`
      });
    }

    if (aulaHoje && aulaHoje.rascunho) {
      alerts.push({
        tipo: 'rascunho',
        html: `A chamada de <strong>${aulaHoje.tema || 'hoje'}</strong> ainda é rascunho (${(aulaHoje.presenteIds || []).length} presentes). <a href="diario.html">Finalizar</a>.`
      });
    } else if (!aulaHoje) {
      alerts.push({
        tipo: 'hoje',
        html: 'Nenhuma aula registrada hoje ainda. <a href="diario.html">Abrir a chamada</a>.'
      });
    }

    if (alto.length > 0) {
      const nomes = alto.slice(0, 4).map(s => s.name.split(' ')[0]).join(', ');
      alerts.push({
        tipo: 'alto',
        html: `<strong>${alto.length} aluno(s) em risco alto</strong>: ${escHtml(nomes)}${alto.length > 4 ? ' entre outros.' : ''}. Frequência e nota abaixo da meta.`
      });
    }
    if (baixaNota.length > 0) {
      const nomes = baixaNota.slice(0, 4).map(s => s.name.split(' ')[0]).join(', ');
      alerts.push({
        tipo: 'nota',
        html: `<strong>${baixaNota.length} aluno(s) com nota &lt; 60</strong> na média: ${escHtml(nomes)}. Projeção de recuperação em andamento.`
      });
    }
    if (crit.length > 0) {
      const nomes = crit.slice(0, 3).map(o => o.alunoName).join(', ');
      alerts.push({
        tipo: 'ocorrencia',
        html: `<strong>${crit.length} ocorrência(s) grave(s)/alta(s) abertas</strong>: ${escHtml(nomes)}. <a href="ocorrencias.html">Ver ocorrências</a>.`
      });
    }
    if (reservaHoje) {
      alerts.push({
        tipo: 'reserva',
        html: `Reserva da sala hoje: <strong>${escHtml(reservaHoje.titulo || reservaHoje.motivo || 'reserva')}</strong> (${reservaHoje.inicio || ''}-${reservaHoje.fim || ''}).`
      });
    }

    const media = vis.length ? Math.round(vis.reduce((a, s) => a + Number(s.nota || 0), 0) / vis.length * 10) / 10 : 0;
    const freqMed = vis.length ? Math.round(vis.reduce((a, s) => a + Number(s.freq || 0), 0) / vis.length) : 0;

    const projHtml = `
      <div class="alerta-projecao">
        <span><strong>${vis.length}</strong> alunos</span>
        <span class="proj-sep">&bull;</span>
        <span>Média <strong>${media || 0}</strong></span>
        <span class="proj-sep">&bull;</span>
        <span>Freq. <strong>${freqMed}%</strong></span>
        <span class="proj-sep">&bull;</span>
        <span>Risco <strong>${alto.length}</strong></span>
        <span class="proj-sep">&bull;</span>
        <span>&lt;60 <strong>${baixaNota.length}</strong></span>
      </div>`;

    if (alerts.length === 0) {
      alertaList.innerHTML = projHtml + `<p class="alerta-empty">Nenhum alerta em aberto. Turma dentro do esperado.</p>`;
      return;
    }
    alertaList.innerHTML = projHtml + alerts.map(a => `
      <div class="alerta-item alerta-${a.tipo}">
        <span class="alerta-ico"></span>
        <p>${a.html}</p>
      </div>`).join('');
  }

  // --- PAINEL DE SINCRONIZAÇÃO & BACKUP ---
  function fmtHora(d) {
    if (!d) return 'nunca';
    const t = new Date(d);
    if (isNaN(t)) return '—';
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
  }

  function renderSyncPanel() {
    const panel = document.getElementById('syncPanel');
    if (!panel) return;
    const st = (window.SENAI_sync && SENAI_sync.status()) || { connected: null, lastSync: null, pending: false };
    const dot = st.connected === false ? 'sync-off' : (st.pending ? 'sync-pending' : 'sync-on');
    const label = st.connected === false ? 'Offline — dados seguros no navegador' : (st.pending ? 'Sincronizando pendências...' : 'Servidor conectado');

    fetch('/api/data/backups').then(r => r.json()).catch(() => ({ backups: [] })).then(res => {
      const backups = (res && res.backups) || [];
      const lista = backups.length
        ? `<div class="sync-backups">
             <p class="sync-backup-title">Backups automáticos (últimos ${Math.min(backups.length, 3)}):</p>
             ${backups.slice(0, 3).map(b => `<span class="sync-backup-item">📦 ${escHtml(b.nome)} · ${fmtTamanhoBytes(b.tamanho)}</span>`).join('')}
           </div>`
        : '<p class="sync-backup-title">Nenhum backup ainda (o primeiro é gerado em ~2h ou manualmente).</p>';

      panel.innerHTML = `
        <div class="sync-status-line">
          <span class="sync-dot ${dot}"></span>
          <span><strong>${label}</strong></span>
        </div>
        <div class="sync-meta">
          <span>Última sincronização: <strong>${fmtHora(st.lastSync)}</strong></span>
          ${st.pending ? '<span class="sync-badge-warn">alterações locais aguardando envio</span>' : '<span class="sync-badge-ok">dados em dia</span>'}
        </div>
        ${lista}
        <div class="sync-actions">
          <button type="button" class="btn-outline btn-sm-inline" id="btnSyncAgora">Sincronizar agora</button>
          <button type="button" class="btn-outline btn-sm-inline" id="btnBackupAgora">Gerar backup</button>
          <a class="btn-outline btn-sm-inline" href="/api/data/download">Baixar backup</a>
        </div>`;
      const b1 = document.getElementById('btnSyncAgora');
      if (b1) b1.addEventListener('click', () => { if (window.SENAI_sync) SENAI_sync.push(); showToast('Sincronizando alterações...', 'info'); setTimeout(renderSyncPanel, 900); });
      const b2 = document.getElementById('btnBackupAgora');
      if (b2) b2.addEventListener('click', () => {
        b2.disabled = true;
        fetch('/api/data/backup', { method: 'POST' }).then(r => r.json()).then(r => {
          if (r.ok) { showToast('Backup gerado com sucesso.', 'success'); setTimeout(renderSyncPanel, 600); }
          else showToast('Falha ao gerar backup.', 'error');
        }).catch(() => showToast('Servidor indisponível.', 'error')).finally(() => { b2.disabled = false; });
      });
    });
  }

  function fmtTamanhoBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // --- INIT ---
  renderCharts();
  renderTurmas();
  renderCalendar();
  renderClassroom();
  initClassroomReal();
  renderAlertas();
  renderSyncPanel();
  window.addEventListener('senai:synced', () => setTimeout(renderSyncPanel, 600));
  window.addEventListener('online', () => setTimeout(renderSyncPanel, 1200));

  // Atualiza o chip de ausentes no topo já no carregamento.
  setTimeout(updateCounters, 400);

  // Abertura direta do fluxo de chamada (ex.: vindo do Diário).
  const queryAcao = new URLSearchParams(window.location.search).get('acao');
  if (queryAcao === 'chamada') {
    setTimeout(openConfirmarChamadaModal, 600);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }
});