/**
 * CONFIGURACAO.JS - Página de configurações do sistema
 * Depende de data.js e auth.js.
 */

(function () {
  if (!window.SENAI_loadConfig) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

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

  // --- CARREGAR ESTADO INICIAL ---
  function carregarCampos() {
    const cfg = SENAI_loadConfig();

    const dlUnidade = document.getElementById('unidadeList');
    const unidades = (window.SENAI_loadUnidades ? SENAI_loadUnidades() : SENAI_UNIDADES) || [];
    if (dlUnidade && Array.isArray(unidades)) {
      dlUnidade.innerHTML = unidades.map(u => `<option value="${u.nome}">`).join('');
    }

    document.getElementById('cfgUnidade').value = cfg.unidade || '';
    document.getElementById('cfgCurso').value = cfg.curso || '';
    document.getElementById('cfgTurma').value = cfg.turma || '';
    document.getElementById('cfgDisciplina').value = cfg.disciplina || '';
    document.getElementById('cfgTurno').value = cfg.turno || 'MANHÃ';
    document.getElementById('cfgCargaHoraria').value = cfg.cargaHoraria || '04H';
    document.getElementById('cfgOficina').value = cfg.oficina || '';
    const temaEl = document.getElementById('cfgTema');
    if (temaEl) temaEl.value = (localStorage.getItem('senai_tema') || 'light') === 'dark' ? 'dark' : 'light';
  }

  // --- SALVAR CONFIG ---
  function salvarConfig() {
    const cfg = SENAI_loadConfig();
    cfg.unidade = document.getElementById('cfgUnidade').value.trim();
    cfg.curso = document.getElementById('cfgCurso').value.trim();
    cfg.turma = document.getElementById('cfgTurma').value.trim();
    cfg.disciplina = document.getElementById('cfgDisciplina').value.trim();
    cfg.turno = document.getElementById('cfgTurno').value;
    cfg.cargaHoraria = document.getElementById('cfgCargaHoraria').value;
    cfg.oficina = document.getElementById('cfgOficina').value.trim();
    const temaEl = document.getElementById('cfgTema');
    if (temaEl) localStorage.setItem('senai_tema', temaEl.value === 'dark' ? 'dark' : 'light');
    if (window.SENAI_toggleTema) {
      const atual = localStorage.getItem('senai_tema') === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', atual);
    }

    const session = SENAI_getSession() || {};
    const unidadeEncontrada = Array.isArray(SENAI_UNIDADES)
      ? SENAI_UNIDADES.find(u => String(u.nome).toLowerCase() === String(cfg.unidade).toLowerCase())
      : null;
    cfg.unidadeId = (unidadeEncontrada && unidadeEncontrada.id) || session.unidadeId || cfg.unidadeId || '';

    SENAI_saveConfig(cfg);
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Configurações salvas com sucesso!', 'success', 3500);

    if (session) {
      session.curso = cfg.curso;
      session.unidade = cfg.unidade;
      session.unidadeId = cfg.unidadeId;
      session.matricula = document.getElementById('contaMatricula').value.trim() || session.matricula;
      session.name = document.getElementById('contaNome').value.trim() || session.name;
      SENAI_setSession(session);
    }
  }

  // --- CONTA ---
  async function salvarConta() {
    const session = SENAI_getSession();
    if (!session || !session.id) return;

    const novoNome = document.getElementById('contaNome').value.trim();
    const novaMatricula = document.getElementById('contaMatricula').value.trim();
    const senhaAtual = document.getElementById('contaSenhaAtual').value;
    const senhaNova = document.getElementById('contaSenhaNova').value;

    let users = SENAI_loadUsers();
    if (!Array.isArray(users)) users = await SENAI_ensureUsers();
    const user = users.find(u => u.id === session.id);

    if (senhaAtual || senhaNova) {
      if (!user) { showToast('Usuário não encontrado.', 'error'); return; }
      const hash = await SENAI_hashPassword(senhaAtual);
      if (hash !== user.passwordHash) {
        showToast('Senha atual incorreta. Nenhuma alteração foi feita.', 'error', 4000);
        return;
      }
      if (String(senhaNova).length < 6) {
        showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error', 4000);
        return;
      }
      await SENAI_resetPassword(user.id, senhaNova);
    }

    if (novoNome || novaMatricula) {
      if (novoNome) user.name = novoNome;
      if (novaMatricula) user.matricula = novaMatricula;
      SENAI_saveUsers(users);
    }

    if (session) {
      if (novoNome) session.name = novoNome;
      if (novaMatricula) session.matricula = novaMatricula;
      SENAI_setSession(session);
    }

    playTone(650, 'sine', 0.1, 0.04);
    showToast('Conta atualizada com sucesso!', 'success', 3500);
    document.getElementById('contaSenhaAtual').value = '';
    document.getElementById('contaSenhaNova').value = '';
  }

  // --- ZONA DE DADOS ---
  async function resetarDadosAmostra() {
    if (!confirm('Restaurar os dados de amostra? Alunos, avaliações, chamadas e ocorrências atuais serão substituídos.')) return;
    await fetch('/api/data/reset', { method: 'POST', headers: SENAI_authHeaders() }).catch(() => {});
    SENAI_clearAllData();
    playTone(650, 'sine', 0.1, 0.04);
    showToast('Dados de amostra restaurados!', 'success', 3000);
    setTimeout(() => window.location.reload(), 800);
  }

  async function apagarTudo() {
    if (!confirm('ISSO APAGARÁ TODOS OS DADOS do sistema, inclusive usuários. Deseja continuar?')) return;
    if (!confirm('Confirma a exclusão definitiva de TODOS os dados?')) return;
    await fetch('/api/data/reset', { method: 'POST', headers: SENAI_authHeaders() }).catch(() => {});
    [SENAI_USERS_KEY, SENAI_SESSION_KEY, SENAI_BACKUP_KEY].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    SENAI_clearAllData();
    window.location.href = 'index.html';
  }

  // --- BACKUP / RESTORE POR TURMA ---
  function exportarTurma() {
    const cfg = SENAI_loadConfig();
    const nome = `backup-${cfg.turma || 'turma'}-${SENAI_todayKey()}.json`;
    const json = JSON.stringify(SENAI_backup(), null, 2);
    SENAI_downloadFile(nome, json, 'application/json');
    showToast('Backup da turma exportado (JSON).', 'success', 3000);
  }

  function importarTurma(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!SENAI_restore(parsed)) {
          showToast('Arquivo inválido: nenhum dado reconhecido por turma.', 'error', 4000);
          return;
        }
        showToast('Backup importado com sucesso!', 'success', 3000);
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      } catch (e) {
        showToast('Falha ao ler o arquivo JSON.', 'error', 4000);
      }
    };
    reader.onerror = () => showToast('Falha ao ler o arquivo.', 'error', 4000);
    reader.readAsText(file);
  }

  // --- BINDINGS ---
  document.getElementById('btnSalvarConfig').addEventListener('click', salvarConfig);
  document.getElementById('formConta').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarConta();
  });
  document.getElementById('formConfig').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarConfig();
  });
  document.getElementById('btnResetDados').addEventListener('click', resetarDadosAmostra);
  document.getElementById('btnLimparTudo').addEventListener('click', apagarTudo);
  document.getElementById('btnExportarTurma').addEventListener('click', exportarTurma);
  document.getElementById('btnImportarTurma').addEventListener('click', () => document.getElementById('inputImportarTurma').click());
  document.getElementById('inputImportarTurma').addEventListener('change', (e) => importarTurma(e.target.files[0]));

  // --- GOOGLE CLASSROOM ---
  const cfgClassroomStatus = document.getElementById('cfgClassroomStatus');
  const btnCfgClassroomConnect = document.getElementById('btnCfgClassroomConnect');
  const btnCfgClassroomRevoke = document.getElementById('btnCfgClassroomRevoke');
  const cfgClassroomMsg = document.getElementById('cfgClassroomMsg');

  if (cfgClassroomStatus) {
    (async () => {
      if (!window.SENAI_Classroom) {
        cfgClassroomStatus.textContent = 'Integração indisponível (classroom.js não carregado)';
        return;
      }
      const st = await SENAI_Classroom.status();
      if (!st.configured) {
        cfgClassroomStatus.innerHTML = '<span style="color:var(--text-light)">Não configurado</span> — adicione <code>classroom-config.json</code> na raiz do projeto ou crie as variáveis de ambiente <code>GCLOUD_CLIENT_ID</code> e <code>GCLOUD_CLIENT_SECRET</code>.';
        btnCfgClassroomConnect.classList.add('hidden');
        btnCfgClassroomRevoke.classList.add('hidden');
        return;
      }
      if (st.connected) {
        cfgClassroomStatus.innerHTML = '<span style="color:var(--senai-green)">Conectado ao Google Classroom</span>';
        btnCfgClassroomConnect.classList.add('hidden');
        btnCfgClassroomRevoke.classList.remove('hidden');
      } else {
        cfgClassroomStatus.innerHTML = '<span style="color:var(--text-light)">Configurado, mas não conectado</span>';
        btnCfgClassroomConnect.classList.remove('hidden');
        btnCfgClassroomRevoke.classList.add('hidden');
      }
    })();
  }

  if (btnCfgClassroomConnect) {
    btnCfgClassroomConnect.addEventListener('click', async () => {
      if (!window.SENAI_Classroom) return;
      const url = await SENAI_Classroom.authUrl();
      if (url) window.location.href = url;
      else showToast('Não foi possível gerar o link de conexão.', 'error', 4000);
    });
  }

  if (btnCfgClassroomRevoke) {
    btnCfgClassroomRevoke.addEventListener('click', async () => {
      if (!window.SENAI_Classroom) return;
      if (!confirm('Desconectar do Google Classroom? As atividades reais deixarão de ser exibidas.')) return;
      await SENAI_Classroom.revoke();
      showToast('Google Classroom desconectado.', 'info', 2500);
      window.location.reload();
    });
  }

  if (cfgClassroomMsg) {
    const p = new URLSearchParams(window.location.search);
    if (p.get('classroom') === 'connected') {
      cfgClassroomMsg.classList.remove('hidden');
      cfgClassroomMsg.innerHTML = '<strong style="color:var(--senai-green)">Conectado com sucesso!</strong> Agora as atividades reais do Google Classroom poderão ser exibidas no dashboard.';
      setTimeout(() => cfgClassroomMsg.classList.add('hidden'), 8000);
    } else if (p.get('classroom') === 'error') {
      cfgClassroomMsg.classList.remove('hidden');
      cfgClassroomMsg.innerHTML = '<strong style="color:var(--senai-red)">Erro ao conectar.</strong> Verifique se as credenciais estão corretas e tente novamente.';
    }
  }

  // --- INIT ---
  carregarCampos();

  const session = SENAI_getSession();
  if (session) {
    document.getElementById('contaNome').value = session.name || '';
    document.getElementById('contaMatricula').value = session.matricula || '';
  }
})();