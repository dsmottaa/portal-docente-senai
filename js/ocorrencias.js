/**
 * OCORRÊNCIAS - REGISTRO E ACOMPANHAMENTO
 */
document.addEventListener('DOMContentLoaded', () => {
  const students = SENAI_loadStudents();
  let ocorrencias = SENAI_loadOcorrencias();
  let currentFilter = 'all';

  const listEl          = document.getElementById('ocorrenciaList');
  const statsRow        = document.getElementById('statsRow');
  const formWrap        = document.getElementById('ocorrenciaFormWrap');
  const btnNovaOcorr    = document.getElementById('btnNovaOcorrencia');
  const btnCancelar     = document.getElementById('btnCancelarOcorrencia');
  const form            = document.getElementById('formOcorrencia');
  const selectAluno     = document.getElementById('selectAluno');
  const selectTipo      = document.getElementById('selectTipo');
  const selectSever     = document.getElementById('selectSeveridade');
  const inputDescricao  = document.getElementById('inputDescricao');

  const SEVERITY_MAP = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

  // Populate student select
  students.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.matricula}) - Bancada ${s.bancada}`;
    selectAluno.appendChild(opt);
  });

  updateSessionUI();
  renderStats();
  renderList();

  btnNovaOcorr.addEventListener('click', () => { formWrap.style.display = formWrap.style.display === 'none' ? 'block' : 'none'; });
  btnCancelar.addEventListener('click', () => { formWrap.style.display = 'none'; form.reset(); });

  document.querySelectorAll('.ocorrencia-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ocorrencia-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const aluno = students.find(s => s.id === Number(selectAluno.value));
    if (!aluno) return;
    const occ = {
      id: Date.now(),
      date: new Date().toISOString(),
      alunoId: aluno.id,
      alunoName: aluno.name,
      matricula: aluno.matricula,
      bancada: aluno.bancada,
      tipo: selectTipo.value,
      severidade: selectSever.value,
      descricao: inputDescricao.value.trim(),
      status: 'aberta',
      professor: SENAI_getSession().name
    };
    ocorrencias.unshift(occ);
    SENAI_saveOcorrencias(ocorrencias);
    formWrap.style.display = 'none';
    form.reset();
    showToast('Ocorrência registrada com sucesso!', 'success');
    renderStats();
    renderList();
  });

  function renderStats() {
    const total  = ocorrencias.length;
    const abertas = ocorrencias.filter(o => o.status === 'aberta').length;
    const resolvidas = ocorrencias.filter(o => o.status === 'resolvida').length;
    const criticas = ocorrencias.filter(o => o.severidade === 'critica' || o.severidade === 'alta').length;
    statsRow.innerHTML = `
      <div class="stats-box"><div class="stats-box-icon red"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg></div><div><div class="stats-box-label">Total</div><div class="stats-box-val">${total}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon amber"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div><div class="stats-box-label">Abertas</div><div class="stats-box-val">${abertas}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon green"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div><div><div class="stats-box-label">Resolvidas</div><div class="stats-box-val">${resolvidas}</div></div></div>
      <div class="stats-box"><div class="stats-box-icon red"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div><div><div class="stats-box-label">Alta/Crítica</div><div class="stats-box-val">${criticas}</div></div></div>`;
  }

  function renderList() {
    const filtered = currentFilter === 'all' ? ocorrencias : ocorrencias.filter(o => o.status === currentFilter);
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="ocorrencia-list-empty"><h3>Nenhuma ocorrência ${currentFilter === 'all' ? 'registrada' : currentFilter}</h3><p>Clique em "Nova Ocorrência" para registrar.</p></div>`;
      return;
    }
    listEl.innerHTML = '';
    filtered.forEach(o => {
      const d = new Date(o.date);
      const dateStr = SENAI_formatDate(d);
      const div = document.createElement('div');
      div.className = 'ocorrencia-item';
      div.innerHTML = `
        <div class="ocorrencia-severity-bar ${o.severidade}"></div>
        <div class="ocorrencia-body">
          <div class="ocorrencia-row-top">
            <h4>${escHtml(o.alunoName)} <span style="font-weight:400;color:var(--text-light);font-size:12px">(${o.matricula})</span></h4>
            <span class="status-badge ${o.status === 'aberta' ? 'amber' : 'green'}">${o.status === 'aberta' ? 'Aberta' : 'Resolvida'}</span>
          </div>
          <div class="ocorrencia-detail"><strong>Tipo:</strong> ${escHtml(o.tipo)} &bull; <strong>Severidade:</strong> ${SEVERITY_MAP[o.severidade] || o.severidade} &bull; <strong>Bancada:</strong> ${o.bancada}</div>
          <div class="ocorrencia-detail"><strong>Descrição:</strong> ${escHtml(o.descricao)}</div>
          <div class="ocorrencia-detail" style="color:var(--text-light)">Registrado em ${dateStr} por Prof. ${o.professor}</div>
          <div class="ocorrencia-actions">
            ${o.status === 'aberta'
              ? `<button class="btn-resolver" data-id="${o.id}">Resolver</button>`
              : `<button class="btn-resolver" data-id="${o.id}" style="color:var(--warning-amber);border-color:var(--warning-border)">Reabrir</button>`}
            <button class="btn-excluir" data-id="${o.id}">Excluir</button>
          </div>
        </div>`;

      div.querySelector('.btn-resolver').addEventListener('click', () => {
        const found = ocorrencias.find(x => x.id === o.id);
        if (found) {
          found.status = found.status === 'aberta' ? 'resolvida' : 'aberta';
          SENAI_saveOcorrencias(ocorrencias);
          showToast(`Ocorrência marcada como ${found.status === 'resolvida' ? 'RESOLVIDA' : 'ABERTA'}!`, 'success');
          renderStats();
          renderList();
        }
      });

      div.querySelector('.btn-excluir').addEventListener('click', () => {
        if (!confirm('Excluir esta ocorrência?')) return;
        ocorrencias = ocorrencias.filter(x => x.id !== o.id);
        SENAI_saveOcorrencias(ocorrencias);
        showToast('Ocorrência excluída.', 'info');
        renderStats();
        renderList();
      });

      listEl.appendChild(div);
    });
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function updateSessionUI() {
    try {
      const s = SENAI_getSession();
      const sbName = document.getElementById('sidebarName');
      const sbAv   = document.getElementById('avatarLN');
      if (sbName && s.name) sbName.textContent = `Prof. ${s.name}`;
      if (sbAv && s.name)   sbAv.textContent = s.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
    } catch(e) {}
  }

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