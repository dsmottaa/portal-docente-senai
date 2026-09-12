/**
 * CENTRAL.JS - Central da Coordenação (acesso restrito à role "coordenacao")
 * Depende de data.js e auth.js.
 */
(function () {
  if (!window.SENAI_loadMateriais) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();
  const session = SENAI_getSession() || {};
  if (session.role !== 'coordenacao') {
    showToastMsg('Acesso restrito à coordenação.', 'error', 2500);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    return;
  }

  // Exibe link da Central no menu
  const navCentral = document.getElementById('navCentralCoord');
  if (navCentral) navCentral.closest('li').style.display = '';

  const toastC = document.getElementById('toastContainer');
  function showToastMsg(message, type = 'info', duration = 3000) {
    if (!toastC) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-msg">${message}</span><button class="toast-close" aria-label="Fechar">&times;</button>`;
    t.querySelector('.toast-close').addEventListener('click', () => { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); });
    toastC.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hiding'); setTimeout(() => t.remove(), 250); }, duration);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtData(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 && iso.includes('-') ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // KPIs
  const aguardando = SENAI_loadMateriais().filter(m => m.status === 'aguardando');
  const justPendentes = SENAI_pendingJustificativas().length;
  document.getElementById('kpiMateriaisAguardando').textContent = aguardando.length;
  document.getElementById('kpiJustPendentes').textContent = justPendentes;

  // Unidades conectadas
  const unidades = new Set();
  try {
    Object.keys(localStorage).forEach(k => {
      const m = k.match(/__u-([^_]+)/);
      if (m) unidades.add('u-' + m[1]);
    });
  } catch (e) {}
  document.getElementById('kpiTotalUnidades').textContent = Math.max(1, unidades.size);

  // Materiais pendentes
  const pendEl = document.getElementById('materiaisPendentes');
  if (aguardando.length === 0) {
    pendEl.innerHTML = '<div class="central-list-empty">Nenhum material aguardando aprovação no momento. O catálogo está atualizado.</div>';
  } else {
    pendEl.innerHTML = `<div class="central-table-wrap"><table class="central-table">
      <thead><tr><th>Título</th><th>Tipo</th><th>Disciplina</th><th>Autor</th><th>Origem</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>
      ${aguardando.map(m => `<tr>
        <td class="central-td-title">${esc(m.titulo)}</td>
        <td>${esc(SENAI_materiaisTipoLabel(m.tipo))}</td>
        <td>${esc(m.disciplina)}</td>
        <td>${esc(m.autor)}</td>
        <td>${esc(m.unidadeNome || m.unidadeOrigem)}</td>
        <td>${fmtData(m.criadoEm)}</td>
        <td class="central-td-actions">
          <button type="button" class="central-btn-ok" data-aprovar="${esc(m.id)}">Aprovar</button>
          <button type="button" class="central-btn-ko" data-rejeitar="${esc(m.id)}">Rejeitar</button>
          ${m.url ? `<a class="central-btn-link" href="${esc(m.url)}" target="_blank">Abrir</a>` : ''}
        </td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }

  // Auditoria
  fetch('/api/log?limit=50').then(r => r.json()).catch(() => ({ logs: [] })).then(res => {
    const logs = (res && res.logs) || [];
    const el = document.getElementById('auditTrail');
    if (logs.length === 0) {
      el.innerHTML = '<div class="central-list-empty">Nenhum registro de auditoria ainda.</div>';
      return;
    }
    el.innerHTML = `<div class="central-table-wrap"><table class="central-table">
      <thead><tr><th>Data/Hora</th><th>Ação</th><th>Detalhes</th></tr></thead>
      <tbody>
      ${logs.map(l => `<tr>
        <td>${fmtData(l.ts || l.date)}</td>
        <td><span class="central-audit-badge">${esc(l.acao || l.verb || l.action || '—')}</span></td>
        <td class="central-td-title">${esc(typeof l.detalhe === 'string' ? l.detalhe : (l.mensagem || JSON.stringify(l).slice(0, 140)))}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
  });

  // Backup
  Promise.all([
    fetch('/api/data/backups').then(r => r.json()).catch(() => ({ backups: [] })),
    fetch('/api/health').then(r => r.json()).catch(() => ({ ok: false }))
  ]).then(([backupsRes, health]) => {
    const backups = (backupsRes && backupsRes.backups) || [];
    document.getElementById('kpiBackupStatus').textContent = health.ok ? 'ON' : 'OFF';
    const row = document.getElementById('backupRow');
    row.innerHTML = `
      <div class="central-backup-info">
        <p>${backups.length} backup(s) no servidor</p>
        <div class="central-backup-actions">
          <button type="button" class="btn-red-primary btn-sm-inline" id="btnCoordBackup">Gerar backup agora</button>
          <a class="btn-outline btn-sm-inline" href="/api/data/download">Baixar último backup (.sqlite)</a>
        </div>
      </div>
      <div class="central-backup-list">
        ${backups.slice(0, 5).map(b => `<div class="central-backup-item">📦 ${esc(b.nome)} — ${(b.tamanho / 1024 / 1024).toFixed(2)} MB</div>`).join('')}
      </div>`;
    const bb = document.getElementById('btnCoordBackup');
    if (bb) bb.addEventListener('click', () => {
      bb.disabled = true;
      fetch('/api/data/backup', { method: 'POST' }).then(r => r.json()).then(r => {
        if (r.ok) showToastMsg('Backup gerado com sucesso.', 'success');
        else showToastMsg('Falha ao gerar backup.', 'error');
      }).catch(() => showToastMsg('Servidor indisponível.', 'error')).finally(() => { bb.disabled = false; });
    });
  });

  // Calendário nacional resumo
  const calendario = SENAI_jsonGet('senai_calendario_data');
  const calEl = document.getElementById('calendarioResumo');
  if (!Array.isArray(calendario) || calendario.length === 0) {
    calEl.innerHTML = '<div class="central-list-empty">Nenhum evento acadêmico cadastrado. Acesse <a href="calendario.html">Calendário</a> para registrar feriados, provas e eventos nacionais.</div>';
  } else {
    const proximos = calendario.filter(e => e.data && e.data >= SENAI_todayKey()).slice(0, 6);
    calEl.innerHTML = proximos.length
      ? proximos.map(e => `<div class="central-cal-item">
          <span class="central-cal-data">${fmtData(e.data)}</span>
          <span class="central-cal-tipo central-cal-${e.tipo || 'evento'}">${esc(e.tipo || 'Evento')}</span>
          <span class="central-cal-titulo">${esc(e.titulo)}</span>
        </div>`).join('')
      : '<div class="central-list-empty">Nenhum evento futuro cadastrado no calendário nacional.</div>';
  }

  // Delegação de aprovação/rejeição
  document.getElementById('materiaisPendentes').addEventListener('click', e => {
    const apr = e.target.closest('[data-aprovar]');
    if (apr) {
      SENAI_setMaterialStatus(apr.getAttribute('data-aprovar'), 'aprovado');
      showToastMsg('Material aprovado.', 'success');
      location.reload();
      return;
    }
    const rej = e.target.closest('[data-rejeitar]');
    if (rej) {
      const motivo = prompt('Informe o motivo da rejeição:');
      if (motivo === null || !motivo.trim()) return;
      SENAI_setMaterialStatus(rej.getAttribute('data-rejeitar'), 'rejeitado', motivo.trim());
      showToastMsg('Material rejeitado.', 'info');
      location.reload();
    }
  });

  // Justificativas pendentes
  const justEl = document.getElementById('justificativasPendentes');
  const justPend = SENAI_pendingJustificativas();
  if (justPend.length === 0) {
    justEl.innerHTML = '<div class="central-list-empty">Nenhuma justificativa aguardando revisão.</div>';
  } else {
    justEl.innerHTML = `<div class="central-table-wrap"><table class="central-table">
      <thead><tr><th>Aluno</th><th>Data da falta</th><th>Motivo</th><th>Anexo</th><th>Ações</th></tr></thead>
      <tbody>
      ${justPend.map(j => `<tr>
        <td class="central-td-title">${esc(j.alunoNome)}</td>
        <td>${fmtData(j.dataAula)}</td>
        <td class="central-td-title">${esc(j.motivo)}</td>
        <td>${j.anexoNome ? `<span title="Anexo disponível">📎 ${esc(j.anexoNome)}</span>` : '—'}</td>
        <td class="central-td-actions">
          <button type="button" class="central-btn-ok" data-j-aprovar="${esc(j.alunoId)}" data-j-id="${esc(j.id)}">Aprovar (abonar)</button>
          <button type="button" class="central-btn-ko" data-j-rejeitar="${esc(j.alunoId)}" data-j-id="${esc(j.id)}">Rejeitar</button>
        </td>
      </tr>`).join('')}
      </tbody></table></div>`;
    justEl.addEventListener('click', e => {
      const apr = e.target.closest('[data-j-aprovar]');
      if (apr) {
        SENAI_revisarJustificativa(apr.getAttribute('data-j-aprovar'), apr.getAttribute('data-j-id'), 'aprovado');
        showToastMsg('Falta abonada.', 'success');
        location.reload();
        return;
      }
      const rej = e.target.closest('[data-j-rejeitar]');
      if (rej) {
        const motivo = prompt('Informe o motivo da rejeição:');
        if (motivo === null) return;
        SENAI_revisarJustificativa(rej.getAttribute('data-j-rejeitar'), rej.getAttribute('data-j-id'), 'negado');
        showToastMsg('Justificativa rejeitada.', 'info');
        location.reload();
      }
    });
  }
})();