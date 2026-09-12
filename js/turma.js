/**
 * TURMA.JS - GESTÃO DA TURMA (CRUD de alunos + lançamento de avaliações)
 * Depende de data.js (usuários/alunos/avaliações/config) e auth.js (sessão).
 */

(function () {
  if (!window.SENAI_loadStudents) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

  let students = [];
  let config = {};
  let currentFilter = 'all';
  let currentSearch = '';
  let currentSearchId = null;
  let editingId = null;
  let editingAvaliacoesId = null;
  let activeSubTurmaId = SENAI_activeSubTurmaId();
  let editingSubTurmaId = null;

  // --- AUDIO / TOAST (padrão das demais páginas) ---
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
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  function rel() { students = SENAI_loadStudents(); }
  function notaClass(n) { return n < 60 ? 'aval-bad' : (n < 80 ? 'aval-warn' : 'aval-good'); }
  function escHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- MODAL UTIL ---
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('modal-active'); m.setAttribute('aria-hidden', 'false'); }
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('modal-active'); m.setAttribute('aria-hidden', 'true'); }
  }
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal-backdrop').id));
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => closeModal(m.id));
    }
  });

  // --- ESTATÍSTICAS ---
  function renderStats() {
    const box = document.getElementById('statsRow');
    const presentes = students.filter(s => s.status !== 'absent').length;
    const riskHigh = students.filter(s => s.risk === 'high').length;
    const media = students.length ? SENAI_avgNota(students) : 0;
    const cards = [
      { label: 'ALUNOS MATRICULADOS', val: String(students.length) },
      { label: 'PRESENTES HOJE', val: `${presentes}` },
      { label: 'MÉDIA DA TURMA', val: `Nota ${media.toFixed(1)}`, warn: media < 60 },
      { label: 'RISCO ALTO', val: String(riskHigh), danger: true }
    ];
    box.innerHTML = cards.map(c => `
      <div class="stats-box">
        <div>
          <div class="stats-box-val">${c.val}</div>
          <div class="stats-box-label">${c.label}</div>
        </div>
      </div>`).join('');
  }

  // --- SUBTURMAS ---
  const SUB_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

  // --- TABELA DE ALUNOS ---
  function renderTable() {
    const tbody = document.getElementById('alunoList');
    const empty = document.getElementById('turmaEmpty');
    const q = currentSearch.toLowerCase().trim();
    const subs = SENAI_loadSubTurmas() || [];
    const subsById = {};
    subs.forEach((s, i) => { subsById[String(s.id)] = s; s._cor = SUB_COLORS[i % SUB_COLORS.length]; });
    const subIdPorAluno = {};
    subs.forEach(sub => (sub.alunoIds || []).forEach(id => {
      const chave = String(id);
      if (!subIdPorAluno[chave]) subIdPorAluno[chave] = String(sub.id);
    }));

    const filtered = students.filter(s => {
      if (activeSubTurmaId) {
        const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(activeSubTurmaId));
        if (sub && !(sub.alunoIds || []).map(Number).includes(Number(s.id))) return false;
      }
      if (currentFilter === 'present' && s.status === 'absent') return false;
      if (currentFilter === 'late' && s.status !== 'late') return false;
      if (currentFilter === 'absent' && s.status !== 'absent') return false;
      if (currentFilter === 'risk' && s.risk !== 'high') return false;
      if (q) {
        const ok = (s.name + ' ' + s.matricula + ' ' + s.bancada).toLowerCase().includes(q);
        if (!ok) return false;
      }
      return true;
    });

    tbody.innerHTML = '';
    empty.style.display = filtered.length ? 'none' : 'block';

    filtered.forEach(s => {
      const avais = Array.isArray(s.avaliacoes) ? s.avaliacoes : [];
      const avalHtml = avais.length
        ? avais.map(a => `<span class="aval-mini" title="${a.nome} (peso ${Math.round((a.peso || 0) * 100)}%)"><b>${a.nome}</b> ${a.nota}</span>`).join('')
        : '<span class="aval-mini muted">sem notas</span>';

      const riscoClass = s.risk === 'high' ? 'risk-high' : (s.risk === 'medium' ? 'risk-medium' : 'risk-low');
      const statusClass = s.status === 'present' ? 'badge-present' : (s.status === 'late' ? 'badge-late' : 'badge-absent');
      const statusTxt = s.status === 'present' ? 'Presente' : (s.status === 'late' ? 'Atrasado' : 'Ausente');

      const tr = document.createElement('tr');
      const avatarHtml = s.photo
        ? `<img class="turma-avatar turma-foto" src="${escHtml(s.photo)}" alt="">`
        : `<span class="turma-avatar">${escHtml(s.avatar)}</span>`;
      tr.innerHTML = `
        <td>
          <div class="turma-aluno-cell">
            ${avatarHtml}
            <div>
              <div class="turma-aluno-nome">${s.name}</div>
              <div class="turma-aluno-matri">${s.matricula}</div>
              ${subIdPorAluno[String(s.id)]
                ? `<div class="turma-sub-line"><span class="subturma-chip" style="--sub:${subsById[subIdPorAluno[String(s.id)]]._cor}">Sub ${escHtml(subsById[subIdPorAluno[String(s.id)]].nome || '')}</span></div>`
                : ''}
            </div>
          </div>
        </td>
        <td><span class="turma-bancada">${s.bancada}</span></td>
        <td><div class="aval-cell">${avalHtml}</div></td>
        <td><span class="nota-pill ${notaClass(s.nota)}">${s.nota}</span></td>
        <td><span class="freq-cell ${s.freq < 80 ? 'aval-bad' : (s.freq < 90 ? 'aval-warn' : 'aval-good')}">${s.freq}%</span></td>
        <td><span class="status-badge ${statusClass}">${statusTxt}</span></td>
        <td class="td-actions">
          <button type="button" class="btn-sm acao-notas" title="Lançar avaliações">Notas</button>
          <button type="button" class="btn-sm acao-editar" title="Editar cadastro">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button type="button" class="btn-sm acao-excluir" title="Excluir aluno">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>`;

      tr.querySelector('.acao-notas').addEventListener('click', () => openAvaliacoes(s));
      tr.querySelector('.acao-editar').addEventListener('click', () => openAlunoForm(s));
      tr.querySelector('.acao-excluir').addEventListener('click', () => excluirAluno(s));
      tr.querySelector('.nota-pill').addEventListener('click', () => openAvaliacoes(s));
      tbody.appendChild(tr);
    });

    renderStats();
  }

  // --- SUBTURMA (pills de filtro A/B) ---
  function renderSubTurmaBar() {
    const bar = document.getElementById('subturmaBar');
    const pills = document.getElementById('subturmaPills');
    if (!bar || !pills) return;
    const subs = SENAI_loadSubTurmas() || [];
    pills.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'subturma-pill' + (activeSubTurmaId ? '' : ' active');
    allBtn.innerHTML = `<span>Todos</span><span class="pill-count">${students.length}</span>`;
    allBtn.addEventListener('click', () => {
      activeSubTurmaId = null;
      SENAI_switchSubTurma(null);
      renderAll();
    });
    pills.appendChild(allBtn);

    subs.forEach((sub, i) => {
      const count = (sub.alunoIds || []).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subturma-pill' + (String(activeSubTurmaId) === String(sub.id) ? ' active' : '');
      btn.style.setProperty('--sub', SUB_COLORS[i % SUB_COLORS.length]);
      btn.innerHTML = `<span>Sub ${escHtml(sub.nome || '')}</span><span class="pill-count">${count}</span>`;
      btn.addEventListener('click', () => {
        activeSubTurmaId = String(sub.id);
        SENAI_switchSubTurma(activeSubTurmaId);
        renderAll();
      });
      pills.appendChild(btn);
    });

    bar.style.display = subs.length ? 'flex' : 'none';
    currentFilter = 'all';
    document.querySelectorAll('#turmaFilters .ocorrencia-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
  }

  // --- SUBTURMA (cards de gestão) ---
  function renderSubTurmaCards() {
    const wrap = document.getElementById('subturmaCards');
    if (!wrap) return;
    const subs = SENAI_loadSubTurmas() || [];
    const alunos = students.length ? students : SENAI_loadStudents();
    const alunosById = {};
    alunos.forEach(a => { alunosById[Number(a.id)] = a; });

    if (!subs.length) {
      wrap.innerHTML = `
        <div class="subturma-empty">
          <p>Nenhuma sub turma criada ainda.</p>
          <span>Crie grupos (ex.: Sub A e Sub B) e associe os alunos para filtrar, lançar presença e gerar relatórios por grupo.</span>
        </div>`;
      return;
    }

    wrap.innerHTML = '';
    subs.forEach((sub, i) => {
      const color = SUB_COLORS[i % SUB_COLORS.length];
      const count = (sub.alunoIds || []).length;
      const members = (sub.alunoIds || []).map(Number).map(id => alunosById[id]).filter(Boolean);
      const chips = members.slice(0, 8).map(m =>
        `<span class="subturma-chip" style="--sub:${color}">${escHtml(m.name.split(' ')[0])}</span>`).join('');
      const extra = members.length > 8
        ? `<span class="subturma-chip more" style="--sub:${color}">+${members.length - 8}</span>` : '';

      const card = document.createElement('div');
      card.className = 'subturma-card';
      card.style.setProperty('--sub', color);
      card.innerHTML = `
        ${String(activeSubTurmaId) === String(sub.id)
          ? '<span class="subturma-card-active">Filtro ativo</span>' : ''}
        <div class="subturma-card-head">
          <strong>Sub ${escHtml(sub.nome || '')}</strong>
          <span class="pill-count">${count} aluno${count === 1 ? '' : 's'}</span>
        </div>
        ${sub.descricao ? `<p class="subturma-desc">${escHtml(sub.descricao)}</p>` : ''}
        <div class="subturma-chip-list">${chips}${extra}</div>
        <div class="subturma-card-actions">
          <button type="button" class="btn-sm btn-secondary subturma-edit">Editar</button>
          <button type="button" class="btn-sm btn-secondary subturma-del">Excluir</button>
        </div>`;
      wrap.appendChild(card);

      card.querySelector('.subturma-edit').addEventListener('click', () => openSubTurmaForm(sub));
      card.querySelector('.subturma-del').addEventListener('click', () => delSubTurma(sub));
    });
  }

  function renderSubTurmaPick(selected) {
    const pick = document.getElementById('subTurmaAlunosPick');
    if (!pick) return;
    const alunos = students.length ? students : SENAI_loadStudents();
    const sel = (selected || []).map(Number);
    const filtro = (document.getElementById('subTurmaSearch').value || '').toLowerCase().trim();
    const list = alunos.filter(a => {
      if (!filtro) return true;
      return (a.name + ' ' + a.matricula + ' ' + a.bancada).toLowerCase().includes(filtro);
    });

    if (!list.length) {
      pick.innerHTML = '<p class="subturma-empty">Nenhum aluno encontrado.</p>';
      return;
    }

    pick.innerHTML = list.map(a => {
      const checked = sel.includes(Number(a.id)) ? 'checked' : '';
      return `<label class="subturma-check-item">
        <input type="checkbox" class="subturma-aluno-check" value="${escHtml(a.id)}" ${checked}>
        <span>${escHtml(a.name)} <small>${escHtml(a.matricula)} &middot; B${escHtml(a.bancada)}</small></span>
      </label>`;
    }).join('');
  }

  function openSubTurmaForm(sub) {
    editingSubTurmaId = sub ? sub.id : null;
    document.getElementById('subTurmaModalTitle').textContent = sub ? `Editar Sub ${sub.nome}` : 'Nova Sub turma';
    document.getElementById('inputSubTurmaNome').value = sub ? sub.nome || '' : '';
    document.getElementById('inputSubTurmaDesc').value = sub ? sub.descricao || '' : '';
    document.getElementById('subTurmaSearch').value = '';
    renderSubTurmaPick(sub ? sub.alunoIds : []);
    openModal('modalSubTurma');
    setTimeout(() => document.getElementById('inputSubTurmaNome').focus(), 60);
  }

  function salvarSubTurma(e) {
    e.preventDefault();
    const nome = document.getElementById('inputSubTurmaNome').value.trim();
    if (!nome) { showToast('Informe um nome para a sub turma.', 'error'); return; }
    const descricao = document.getElementById('inputSubTurmaDesc').value.trim();
    const alunoIds = Array.from(document.querySelectorAll('#subTurmaAlunosPick .subturma-aluno-check:checked')).map(c => Number(c.value));
    const dados = { nome, descricao, alunoIds };

    try {
      if (editingSubTurmaId) {
        SENAI_updateSubTurma(editingSubTurmaId, dados);
        playTone(650, 'sine', 0.08, 0.03);
        showToast('Sub turma atualizada!', 'success', 2800);
      } else {
        SENAI_createSubTurma(dados);
        playTone(650, 'sine', 0.08, 0.03);
        showToast('Sub turma criada!', 'success', 2800);
      }
      closeModal('modalSubTurma');
      editingSubTurmaId = null;
      renderAll();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar.', 'error');
    }
  }

  function delSubTurma(sub) {
    if (!confirm(`Excluir a sub turma "Sub ${sub.nome}"? Os alunos NÃO serão removidos do cadastro.`)) return;
    SENAI_deleteSubTurma(sub.id);
    if (String(activeSubTurmaId) === String(sub.id)) {
      activeSubTurmaId = null;
      SENAI_switchSubTurma(null);
    }
    playTone(240, 'square', 0.1, 0.04);
    showToast('Sub turma excluída.', 'info', 2500);
    renderAll();
  }

  function renderAll() { rel(); renderSubTurmaBar(); renderSubTurmaCards(); renderTable(); }

  // --- FILTROS / BUSCA ---
  function bindFilters() {
    document.getElementById('turmaFilters').addEventListener('click', (e) => {
      const btn = e.target.closest('.ocorrencia-filter-btn');
      if (!btn) return;
      document.querySelectorAll('#turmaFilters .ocorrencia-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });

    document.getElementById('searchAluno').addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderTable();
    });
  }

  // --- FORM DE ALUNO (novo/editar) ---
  let fotoDataUrl = '';

  function setFotoPreview(url) {
    const preview = document.getElementById('fotoPreview');
    const remover = document.getElementById('btnFotoRemover');
    if (!preview || !remover) return;
    preview.style.display = url ? 'block' : 'none';
    remover.style.display = url ? 'inline-flex' : 'none';
    if (url) preview.src = url;
  }

  function openAlunoForm(student) {
    editingId = student ? student.id : null;
    const wrap = document.getElementById('alunoFormWrap');
    document.getElementById('alunoFormTitle').textContent = student ? 'Editar Aluno' : 'Novo Aluno';
    document.getElementById('inputNome').value = student ? student.name : '';
    document.getElementById('inputMatricula').value = student ? student.matricula : '';
    document.getElementById('inputBancada').value = student ? student.bancada : '';
    fotoDataUrl = student ? student.photo || '' : '';
    setFotoPreview(fotoDataUrl);
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('inputNome').focus();
    playTone(560, 'sine', 0.06, 0.03);
  }

  function fecharAlunoForm() {
    document.getElementById('alunoFormWrap').style.display = 'none';
    editingId = null;
    fotoDataUrl = '';
    setFotoPreview('');
    const input = document.getElementById('inputFoto');
    if (input) input.value = '';
  }

  function salvarAluno(e) {
    e.preventDefault();
    const nome = document.getElementById('inputNome').value.trim();
    if (!nome) { showToast('Informe o nome do aluno.', 'error'); return; }

    const dados = {
      name: nome,
      matricula: document.getElementById('inputMatricula').value.trim(),
      bancada: document.getElementById('inputBancada').value.trim(),
      photo: fotoDataUrl
    };

    try {
      if (editingId) {
        SENAI_updateStudent(editingId, dados);
        playTone(650, 'sine', 0.08, 0.03);
        showToast('Cadastro atualizado!', 'success');
      } else {
        SENAI_addStudent(dados);
        playTone(650, 'sine', 0.08, 0.03);
        showToast(`Aluno "${nome}" cadastrado com sucesso!`, 'success');
      }
      fecharAlunoForm();
      renderAll();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar.', 'error');
    }
  }

  function excluirAluno(student) {
    if (!confirm(`Excluir o aluno "${student.name}"? Essa ação não pode ser desfeita.`)) return;
    SENAI_deleteStudent(student.id);
    playTone(240, 'square', 0.1, 0.04);
    showToast('Aluno excluído.', 'info', 2500);
    renderAll();
  }

  // --- FORM DE AVALIAÇÕES ---
  function openAvaliacoes(student) {
    editingAvaliacoesId = student.id;
    const wrap = document.getElementById('avaliacaoFormWrap');
    document.getElementById('avaliacaoFormTitle').textContent = `Avaliações — ${student.name} (${student.matricula})`;

    const template = (config.avaliacoesTemplate || []).length ? config.avaliacoesTemplate : [{ nome: 'AV1', peso: 0.3 }, { nome: 'AV2', peso: 0.3 }, { nome: 'PRÁTICA', peso: 0.4 }];
    const grid = document.getElementById('avaliacaoNotas');
    grid.innerHTML = '';

    template.forEach((t, i) => {
      const av = (student.avaliacoes || []).find(a => a.nome === t.nome) || { nome: t.nome, nota: 0 };
      const div = document.createElement('div');
      div.className = 'avaliacao-input';
      div.innerHTML = `
        <label for="aval-input-${i}">${t.nome} <small>peso ${Math.round((Number(t.peso) || 0) * 100)}%</small></label>
        <input id="aval-input-${i}" type="number" min="0" max="100" step="0.1" value="${av.nota}" data-idx="${i}">
      `;
      grid.appendChild(div);
    });

    const preview = document.getElementById('avaliacaoPreview');
    const updatePreview = () => {
      const notas = template.map((t, i) => {
        const input = document.getElementById(`aval-input-${i}`);
        return { nome: t.nome, peso: Number(t.peso) || 0, nota: SENAI_clamp(input.value, 0, 100) };
      });
      const soma = notas.reduce((acc, n) => acc + n.nota * n.peso, 0);
      const totalPeso = notas.reduce((acc, n) => acc + n.peso, 0) || 1;
      const final = Math.round((soma / totalPeso) * 10) / 10;
      preview.textContent = `Média ponderada: ${final.toFixed(1)}`;
      preview.className = `avaliacao-preview ${notaClass(final)}`;
    };
    grid.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updatePreview));
    updatePreview();

    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    playTone(560, 'sine', 0.06, 0.03);
  }

  function salvarAvaliacoes() {
    if (!editingAvaliacoesId) return;
    const template = (config.avaliacoesTemplate || []).length ? config.avaliacoesTemplate : [];
    const notas = template.map((t, i) => {
      const input = document.getElementById(`aval-input-${i}`);
      return { nome: t.nome, peso: Number(t.peso) || 0, nota: SENAI_clamp(input ? input.value : 0, 0, 100) };
    });
    SENAI_updateStudent(editingAvaliacoesId, { avaliacoes: notas });
    playTone(650, 'sine', 0.08, 0.03);
    showToast('Notas lançadas e nota final recalculada!', 'success');
    editingAvaliacoesId = null;
    document.getElementById('avaliacaoFormWrap').style.display = 'none';
    renderAll();
  }

  // --- BINDINGS GERAIS ---
  document.getElementById('btnNovoAluno').addEventListener('click', () => openAlunoForm(null));
  document.getElementById('btnCancelarAluno').addEventListener('click', fecharAlunoForm);
  document.getElementById('formAluno').addEventListener('submit', salvarAluno);

  const btnFotoEscolher = document.getElementById('btnFotoEscolher');
  const inputFoto = document.getElementById('inputFoto');
  if (btnFotoEscolher && inputFoto) {
    btnFotoEscolher.addEventListener('click', () => inputFoto.click());
    inputFoto.addEventListener('change', async () => {
      const file = inputFoto.files && inputFoto.files[0];
      if (!file) return;
      try {
        const url = await SENAI_resizeImage(file, 300, 0.85);
        fotoDataUrl = url;
        setFotoPreview(url);
        playTone(650, 'sine', 0.08, 0.03);
      } catch (err) {
        showToast(err.message || 'Erro ao processar a foto.', 'error');
      }
      inputFoto.value = '';
    });
  }
  const btnFotoRemover = document.getElementById('btnFotoRemover');
  if (btnFotoRemover) {
    btnFotoRemover.addEventListener('click', () => {
      fotoDataUrl = '';
      setFotoPreview('');
    });
  }
  document.getElementById('btnCancelarAvaliacao').addEventListener('click', () => {
    editingAvaliacoesId = null;
    document.getElementById('avaliacaoFormWrap').style.display = 'none';
  });
  document.getElementById('btnSalvarAvaliacao').addEventListener('click', salvarAvaliacoes);
  document.getElementById('btnTodosPresentes').addEventListener('click', () => {
    rel();
    if (activeSubTurmaId) {
      const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(activeSubTurmaId));
      const membros = sub ? SENAI_studentsOfSubTurma(sub) : [];
      if (membros.length) {
        const ausentes = membros.filter(s => s.status === 'absent').length;
        SENAI_setPresencaGrupo(membros.map(m => m.id), 'present');
        playTone(650, 'sine', 0.08, 0.03);
        showToast(`${ausentes} aluno(s) da "Sub ${sub.nome}" marcado(s) como presente(s).`, 'success', 3000);
        renderAll();
        return;
      }
    }
    const ausentes = students.filter(s => s.status === 'absent').length;
    SENAI_setTodosPresentes();
    playTone(650, 'sine', 0.08, 0.03);
    showToast(ausentes ? `${ausentes} aluno(s) marcado(s) como presente(s).` : 'Todos já estavam presentes.', 'success', 2500);
    renderAll();
  });

  document.getElementById('btnNovaSubTurma').addEventListener('click', () => openSubTurmaForm(null));
  document.getElementById('formSubTurma').addEventListener('submit', salvarSubTurma);
  document.getElementById('subTurmaSearch').addEventListener('input', () => {
    const sub = editingSubTurmaId ? (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(editingSubTurmaId)) : null;
    renderSubTurmaPick(sub ? sub.alunoIds : []);
  });

  // --- TEMPLATE DE AVALIAÇÕES ---
  let template = [];

  function renderTemplate() {
    const list = document.getElementById('templateList');
    if (!list) return;
    list.innerHTML = '';
    template.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'avaliacao-input';
      div.innerHTML = `
        <label for="tpl-nome-${i}">Nome ${i + 1}</label>
        <input id="tpl-nome-${i}" class="tpl-nome" type="text" value="${t.nome}" data-idx="${i}" placeholder="Ex.: AV1">
        <button type="button" class="btn-sm acao-excluir tpl-remove" data-idx="${i}" title="Remover avaliação" style="margin-top:6px">Remover</button>
      `;
      list.appendChild(div);
    });
  }

  function readTemplate() {
    document.querySelectorAll('.tpl-nome').forEach(inp => {
      const i = Number(inp.dataset.idx);
      template[i].nome = inp.value.trim() || `AV${i + 1}`;
    });
  }

  function salvarTemplate() {
    readTemplate();
    const cfg = SENAI_loadConfig();
    cfg.avaliacoesTemplate = template.map((t, i, arr) => ({
      nome: t.nome,
      peso: arr.length > 0 ? 1 / arr.length : 0
    }));
    SENAI_saveConfig(cfg);
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Avaliações da disciplina salvas!', 'success', 3000);
  }

  // --- BINDINGS DO TEMPLATE ---
  document.getElementById('btnAddAvaliacao').addEventListener('click', () => {
    template.push({ nome: `AV${template.length + 1}` });
    renderTemplate();
  });
  document.getElementById('templateList').addEventListener('click', (e) => {
    const btn = e.target.closest('.tpl-remove');
    if (!btn) return;
    const i = Number(btn.dataset.idx);
    readTemplate();
    template.splice(i, 1);
    renderTemplate();
  });
  document.getElementById('templateList').addEventListener('input', () => readTemplate());
  document.getElementById('btnSalvarAvaliacoes').addEventListener('click', salvarTemplate);
  template = (SENAI_loadConfig().avaliacoesTemplate || [{ nome: 'AV1' }, { nome: 'AV2' }, { nome: 'PRÁTICA' }]).map(t => ({ nome: t.nome }));
  renderTemplate();

  bindFilters();
  renderAll();
})();