/**
 * RELATORIOS.JS - Página de relatórios (PDF, CSV e backup/restore)
 * Depende de data.js, auth.js e pdf.js.
 */

(function () {
  if (!window.SENAI_loadStudents) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

  let students = [];
  let config = {};
  let relSubId = null;

  function displayStudents() {
    if (!relSubId) return students;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(relSubId));
    return sub ? SENAI_studentsOfSubTurma(sub) : students;
  }

  function subLabel() {
    if (!relSubId) return null;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(relSubId));
    return sub ? `Sub ${sub.nome}` : null;
  }

  function escHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- AUDIO / TOAST ---
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

  function rel() {
    students = SENAI_loadStudents();
    config = SENAI_loadConfig();
  }

  function renderStats() {
    const box = document.getElementById('statsRow');
    const vis = displayStudents();
    const presentes = vis.filter(s => s.status !== 'absent').length;
    const media = vis.length ? SENAI_avgNota(vis) : 0;
    const cards = [
      { label: 'ALUNOS', val: String(vis.length) },
      { label: 'PRESENTES', val: `${presentes}` },
      { label: 'RISCO ALTO', val: String(vis.filter(s => s.risk === 'high').length) },
      { label: 'MÉDIA DA TURMA', val: media.toFixed(1) }
    ];
    box.innerHTML = cards.map(c => `
      <div class="stats-box">
        <div>
          <div class="stats-box-val">${c.val}</div>
          <div class="stats-box-label">${c.label}</div>
        </div>
      </div>`).join('');
  }

  function renderSelectFicha() {
    const sel = document.getElementById('selectAlunoFicha');
    const vis = displayStudents();
    sel.innerHTML = vis.map(s => `<option value="${s.id}">${s.name} — ${s.matricula} (Bancada ${s.bancada})</option>`).join('');
  }

  // --- AÇÕES ---
  function gerarPdfDiario() {
    rel();
    const vis = displayStudents();
    const res = SENAI_gerarPdfDiario(vis, { subturma: subLabel() });
    if (!res.ok) {
      if (res.error === 'pdf-offline') {
        showToast('Biblioteca de PDF não carregada. Verifique sua conexão com a internet.', 'error', 4500);
      } else {
        showToast('Erro ao gerar o PDF: ' + res.error, 'error', 4500);
      }
      return;
    }
    playTone(650, 'sine', 0.1, 0.04);
    showToast('PDF do diário de classe gerado com sucesso!', 'success', 3500);
  }

  function gerarPdfFicha() {
    rel();
    const id = Number(document.getElementById('selectAlunoFicha').value);
    const aluno = students.find(s => s.id === id);
    if (!aluno) { showToast('Selecione um aluno.', 'error'); return; }
    const res = SENAI_gerarPdfFicha(aluno, {
      ocorrencias: SENAI_loadOcorrencias().filter(o => o.alunoId === aluno.id),
      aulas: SENAI_loadAulas()
    });
    if (!res.ok) {
      showToast(res.error === 'pdf-offline' ? 'Biblioteca de PDF não carregada.' : 'Erro ao gerar ficha: ' + res.error, 'error', 4500);
      return;
    }
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Ficha do aluno gerada com sucesso!', 'success', 3500);
  }

  function gerarPdfAvaliacoes() {
    rel();
    const vis = displayStudents();
    const res = SENAI_gerarPdfAvaliacoes(vis, {
      turma: config.turma,
      disciplina: config.disciplina,
      aulaCount: parseInt(config.cargaHoraria) || 4,
      subturma: subLabel()
    });
    if (!res.ok) {
      showToast(res.error === 'pdf-offline' ? 'Biblioteca de PDF não carregada.' : 'Erro ao gerar relatório: ' + res.error, 'error', 4500);
      return;
    }
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Relatório pedagógico gerado com sucesso!', 'success', 3500);
  }

  function exportarCsv() {
    rel();
    const vis = displayStudents();
    const template = config.avaliacoesTemplate || [];
    const headers = ['Nome', 'Matrícula', 'Bancada'];
    template.forEach(t => headers.push(`Nota ${t.nome}`));
    headers.push('Média Final', 'Frequência %', 'Status', 'Risco');

    const lines = vis.map(s => {
      const row = [s.name, s.matricula, s.bancada];
      template.forEach(t => {
        const av = (s.avaliacoes || []).find(a => a.nome === t.nome);
        row.push(av ? av.nota : '');
      });
      row.push(s.nota, s.freq, s.status === 'present' ? 'Presente' : (s.status === 'late' ? 'Atrasado' : 'Ausente'), s.riskLabel);
      return row.map(SENAI_csvEscape).join(';');
    });

    const csv = '\ufeff' + headers.map(SENAI_csvEscape).join(';') + '\r\n' + lines.join('\r\n');
    const fecha = new Date();
    const subSeg = subLabel() ? '-' + String(subLabel()).toLowerCase().replace(/\s+/g, '-') : '';
    const name = `turma-${String(config.turma).toLowerCase().replace(/\s+/g, '-')}${subSeg}-${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}.csv`;
    SENAI_downloadFile(name, csv, 'text/csv;charset=utf-8');
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Planilha CSV exportada!', 'success', 3000);
  }

  function exportarCsvOcorrencias() {
    rel();
    const vis = displayStudents();
    const mapa = {};
    vis.forEach(s => { mapa[s.id] = s.name; });
    const ocorrencias = (window.SENAI_loadOcorrencias ? SENAI_loadOcorrencias() : []).filter(o => o && mapa[o.studentId]);
    const headers = ['Aluno', 'Tipo', 'Severidade', 'Descrição', 'Data', 'Status'];
    const lines = ocorrencias.map(o => {
      const row = [mapa[o.studentId], o.tipo, o.severidade, o.descricao, new Date(o.data || o.createdAt || Date.now()).toLocaleString('pt-BR'), o.status];
      return row.map(SENAI_csvEscape).join(';');
    });
    const csv = '\ufeff' + headers.map(SENAI_csvEscape).join(';') + '\r\n' + (lines.length ? lines.join('\r\n') : '');
    const fecha = new Date();
    const name = `ocorrencias-${String(config.turma).toLowerCase().replace(/\s+/g, '-')}-${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}.csv`;
    SENAI_downloadFile(name, csv, 'text/csv;charset=utf-8');
    playTone(650, 'sine', 0.1, 0.04);
    showToast(ocorrencias.length ? 'Ocorrências exportadas em CSV!' : 'Nenhuma ocorrência registrada para esta turma.', 'success', 3000);
  }

  function exportarCsvChamada() {
    rel();
    const vis = displayStudents();
    const hoje = SENAI_todayKey();
    const aulas = window.SENAI_loadAulas ? SENAI_loadAulas() : [];
    const aulaHoje = (aulas || []).find(a => a.date === hoje);
    const presenteIds = (aulaHoje && aulaHoje.presenteIds) || [];
    const headers = ['Matrícula', 'Nome', 'Bancada', 'Presente'];
    const lines = vis.map(s => {
      const row = [s.matricula, s.name, s.bancada, presenteIds.indexOf(s.id) !== -1 ? 'SIM' : 'NÃO'];
      return row.map(SENAI_csvEscape).join(';');
    });
    const csv = '\ufeff' + headers.map(SENAI_csvEscape).join(';') + '\r\n' + lines.join('\r\n');
    const name = `chamada-${hoje}-${String(config.turma).toLowerCase().replace(/\s+/g, '-')}.csv`;
    SENAI_downloadFile(name, csv, 'text/csv;charset=utf-8');
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Chamada do dia exportada (formato SGE/Excel).', 'success', 3000);
  }

  function baixarBackup() {
    rel();
    const bkp = SENAI_backup();
    const fecha = new Date();
    const name = `backup-portal-docente-${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}.json`;
    SENAI_downloadFile(name, JSON.stringify(bkp, null, 2), 'application/json');
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Backup baixado com sucesso!', 'success', 3000);
  }

  function aoSelecionarBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (!SENAI_restore(json)) {
          showToast('Arquivo inválido: formato de backup não reconhecido.', 'error', 4500);
          return;
        }
        rel();
        renderStats();
        renderSelectFicha();
        playTone(650, 'sine', 0.1, 0.04);
        showToast('Backup restaurado com sucesso! Dados atualizados.', 'success', 4000);
      } catch (err) {
        showToast('Não foi possível ler o arquivo JSON.', 'error', 4500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- BINDINGS ---
  document.getElementById('btnExportarPdfDiario').addEventListener('click', gerarPdfDiario);
  document.getElementById('btnExportarPdfFicha').addEventListener('click', gerarPdfFicha);
  document.getElementById('btnExportarPdfAvaliacoes').addEventListener('click', gerarPdfAvaliacoes);
  document.getElementById('btnExportarCsv').addEventListener('click', exportarCsv);
  document.getElementById('btnExportarCsvOcorrencias').addEventListener('click', exportarCsvOcorrencias);
  document.getElementById('btnExportarCsvChamada').addEventListener('click', exportarCsvChamada);
  document.getElementById('btnBackup').addEventListener('click', baixarBackup);
  document.getElementById('fileRestore').addEventListener('change', aoSelecionarBackup);

  // --- FILTRO POR SUBTURMA ---
  const relBar = document.getElementById('subTurmaRelBar');
  const relSelect = document.getElementById('subTurmaRelFilter');
  if (relBar && relSelect && window.SENAI_loadSubTurmas) {
    const subs = SENAI_loadSubTurmas() || [];
    if (subs.length) {
      relSelect.innerHTML = '<option value="">Todas (turma inteira)</option>' +
        subs.map(s => `<option value="${escHtml(s.id)}">Sub ${escHtml(s.nome)} (${(s.alunoIds || []).length})</option>`).join('');
      const ativo = SENAI_activeSubTurmaId();
      if (ativo && subs.some(s => String(s.id) === String(ativo))) {
        relSubId = String(ativo);
        relSelect.value = String(ativo);
      }
      relBar.style.display = 'flex';
      relSelect.addEventListener('change', () => {
        relSubId = relSelect.value || null;
        playTone(500, 'sine', 0.05, 0.02);
        renderStats();
        renderSelectFicha();
      });
    }
  }

  rel();
  renderStats();
  renderSelectFicha();
})();