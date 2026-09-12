/**
 * ASSISTENTE IA - CHAT COM DADOS DA TURMA
 *  - Respostas locais rápidas para consultas estruturadas (offline-safe)
 *  - Perguntas livres respondidas pelo Ollama (qwen2.5:3b) via proxy /api/ai/chat
 *  - Memória de conversa, consultas de observações/ocorrências/reservas
 * Depende de data.js e auth.js.
 */
document.addEventListener('DOMContentLoaded', () => {
  SENAI_requireAuth();

  const students  = SENAI_loadStudents();
  const chatEl    = document.getElementById('chatMessages');
  const input     = document.getElementById('chatInput');
  const btnSend   = document.getElementById('btnChatSend');
  const chips     = document.querySelectorAll('.chat-chip');
  const wrapper   = document.querySelector('.chat-wrapper');
  const btnLimpar = document.getElementById('btnLimparChat');
  const btnPull   = document.getElementById('btnPullModel');

  const MAX_HISTORY = 16;
  const DEFAULT_MODEL = 'qwen2.5:3b';
  const AI_MODEL_KEY = 'senai_ai_model';
  let history = [];
  let busy = false;
  let iaSubId = null;

  function iaStudents() {
    if (!iaSubId) return students;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(iaSubId));
    return sub ? SENAI_studentsOfSubTurma(sub) : students;
  }

  function iaSubLabel() {
    if (!iaSubId) return null;
    const sub = (SENAI_loadSubTurmas() || []).find(x => String(x.id) === String(iaSubId));
    return sub ? `Sub ${sub.nome}` : null;
  }

  // --- Seletor de modelo ---
  const modelSelect = document.getElementById('modelSelect');
  function populateModelSelect(models) {
    if (!modelSelect) return;
    const list = (Array.isArray(models) && models.length > 0) ? models : [DEFAULT_MODEL];
    const pref = localStorage.getItem(AI_MODEL_KEY);
    modelSelect.innerHTML = '<option value="">IA local...</option>' +
      list.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
    if (pref && list.includes(pref)) modelSelect.value = pref;
    else modelSelect.value = list.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : (list[0] || '');
  }
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value) localStorage.setItem(AI_MODEL_KEY, modelSelect.value);
    });
  }

  // --- Status do Ollama (chip no topo) ---
  const statusChip = document.createElement('div');
  statusChip.className = 'chat-status-chip offline';
  statusChip.innerHTML = 'Verificando IA local...';
  if (wrapper) wrapper.insertBefore(statusChip, chatEl);

  function checkStatus() {
    fetch('/api/ollama/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        populateModelSelect(d.models);
        if (d.ok && d.ollama && d.modelReady) {
          setChip('online', `IA local conectada (${d.model}) &middot; ${d.latencyMs}ms`, d.models);
        } else if (d.ok && d.ollama) {
          setChip('warn', 'Ollama no ar, mas modelo qwen2.5:3b não baixado. Use "Baixar modelo IA".', d.models);
        } else {
          setChip('offline', 'IA local offline - usando apenas respostas rápidas', d.models);
        }
      })
      .catch(() => setChip('offline', 'Servidor de IA não disponível - respostas rápidas'));
  }

  function setChip(clazz, text, models) {
    statusChip.className = 'chat-status-chip ' + clazz;
    statusChip.innerHTML = text;
    statusChip.title = Array.isArray(models) ? models.join(', ') : '';
    if (btnPull) btnPull.style.display = clazz === 'online' ? 'none' : 'inline-flex';
  }

  checkStatus();

  // --- Seletor de contexto (sub turma) ---
  const iaSubWrap = document.getElementById('iaSubWrap');
  const iaSubSelect = document.getElementById('iaSubFilter');
  if (iaSubWrap && iaSubSelect && window.SENAI_loadSubTurmas) {
    const subs = SENAI_loadSubTurmas() || [];
    if (subs.length) {
      iaSubSelect.innerHTML = '<option value="">Turma toda</option>' +
        subs.map(s => `<option value="${escHtml(s.id)}">Sub ${escHtml(s.nome)} (${(s.alunoIds || []).length})</option>`).join('');
      const ativo = SENAI_activeSubTurmaId();
      if (ativo && subs.some(s => String(s.id) === String(ativo))) {
        iaSubId = String(ativo);
        iaSubSelect.value = String(ativo);
      }
      iaSubWrap.style.display = 'inline-flex';
      iaSubSelect.addEventListener('change', () => {
        iaSubId = iaSubSelect.value || null;
      });
    }
  }

  addBotMsg('Olá! Sou o assistente inteligente do Portal do Docente SENAI. Pergunte sobre a turma, frequência, notas, observações ou riscos. Como posso ajudar?');

  chips.forEach(chip => {
    chip.addEventListener('click', () => { input.value = chip.dataset.q; sendMessage(); });
  });
  btnSend.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

  // --- LIMPAR CONVERSA ---
  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      history = [];
      chatEl.innerHTML = '';
      addBotMsg('Conversa reiniciada. Pergunte sobre a turma, frequência, notas, observações ou riscos.');
    });
  }

  // --- BAIXAR MODELO (Ollama) ---
  if (btnPull) {
    btnPull.addEventListener('click', () => {
      btnPull.disabled = true;
      const original = btnPull.innerHTML;
      btnPull.innerHTML = '<span>Baixando modelo...</span>';
      addUserMsg('Baixar o modelo de IA local (qwen2.5:3b)');
      const bubble = addBotMsg('<span class="chat-stream">Iniciando download do modelo. Isso pode levar alguns minutos...</span>');
      const bubbleEl = bubble.querySelector('.chat-msg-bubble');

      fetch('/api/ai/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(async res => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            bubbleEl.innerHTML = 'Não foi possível baixar o modelo: ' + (data.error || 'erro desconhecido') + '. Verifique se o Ollama está em execução (iniciar-sistema.bat).';
            return;
          }
          bubbleEl.innerHTML = 'Modelo <strong>qwen2.5:3b</strong> baixado com sucesso! A IA local já está pronta para consultas livres.';
          checkStatus();
        })
        .catch(() => {
          bubbleEl.innerHTML = 'Erro de conexão ao baixar o modelo. Verifique se o servidor está ativo (iniciar-sistema.bat).';
        })
        .finally(() => {
          btnPull.disabled = false;
          btnPull.innerHTML = original;
        });
    });
  }

  function sendMessage() {
    if (busy) return;
    const q = input.value.trim();
    if (!q) return;
    addUserMsg(q);
    history.push({ role: 'user', content: q });
    history = history.slice(-MAX_HISTORY);
    input.value = '';
    const typing = showTyping();
    setTimeout(() => { removeTyping(typing); processQuery(q); }, 450 + Math.random() * 300);
  }

  function addUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.innerHTML = `<div class="chat-msg-avatar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><div class="chat-msg-bubble">${escHtml(text)}</div>`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addBotMsg(html) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.innerHTML = `<div class="chat-msg-avatar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg></div><div class="chat-msg-bubble">${html}</div>`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function recordLastBot() {
    const last = chatEl.querySelector('.chat-msg.bot:last-child .chat-msg-bubble');
    if (last) {
      history.push({ role: 'assistant', content: last.textContent, summary: true });
      history = history.slice(-MAX_HISTORY);
    }
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'chat-msg bot typing-row';
    t.innerHTML = `<div class="chat-msg-avatar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg></div><div class="chat-typing"><span></span><span></span><span></span></div>`;
    chatEl.appendChild(t);
    chatEl.scrollTop = chatEl.scrollHeight;
    return t;
  }

  function removeTyping(typing) { if (typing && typing.parentNode) typing.remove(); }

  // --- Consultas locais rápidas ---
  function localIntent(q) {
    const lower = q.toLowerCase();
    const students = iaStudents();
    const total = students.length;
    const pres  = students.filter(s => s.status !== 'absent').length;
    const abs   = students.filter(s => s.status === 'absent');
    const media = SENAI_avgNota(students);
    const risco = students.filter(s => s.risk === 'high');
    const riscoMedium = students.filter(s => s.risk === 'medium');
    const atrasos = students.filter(s => s.status === 'late').length;
    const esc = (v) => escHtml(v);
    const grupo = iaSubLabel() ? ` (grupo ${iaSubLabel()})` : '';

    // Extrai limite de faixa numérica (ex.: "abaixo de 70", "maior que 80")
    const parseLimit = (text) => {
      const m = text.match(/(abaixo|menor|inferior|menos|maior|acima|igual|>=|<=|>|<)[^0-9]*(\d{1,3})/);
      if (!m) return null;
      const dir = m[1];
      const val = parseInt(m[2], 10);
      if (isNaN(val) || val < 0 || val > 100) return null;
      let op = 'eq';
      if (/abaixo|menor|inferior|menos|<=|</.test(dir)) op = 'lt';
      else if (/maior|acima|>=|>/.test(dir)) op = 'gt';
      return { val: val, op: op };
    };

    const notaMenu = /notas?/.test(lower);
    const freqMenu = /freq/.test(lower);
    const nLim = notaMenu ? parseLimit(lower) : null;
    let fLim = freqMenu ? parseLimit(lower) : null;
    if (!fLim) {
      const pct = lower.match(/(\d{1,3})\s*%/);
      if (pct) fLim = { val: parseInt(pct[1], 10), op: 'lt' };
    }

    // --- Bancada (individual) ---
    if (lower.includes('bancada')) {
      const num = lower.match(/\d+/);
      if (num) {
        const s = students.find(x => x.bancada === num[0].padStart(2, '0'));
        if (s) {
          addBotMsg(`<strong>Bancada ${s.bancada}</strong><br><br>` +
            `Aluno: <strong>${esc(s.name)}</strong><br>` +
            `Matrícula: ${s.matricula}<br>` +
            `Frequência: ${s.freq}%<br>` +
            `Nota: ${s.nota} (0-100)<br>` +
            `Status: <strong>${s.status === 'absent' ? 'Ausente' : (s.status === 'late' ? 'Atrasado' : 'Presente')}</strong><br>` +
            `Risco: ${s.riskLabel}`);
        } else {
          addBotMsg(`Não encontrei aluno na bancada ${num[0]}.`);
        }
      } else {
        addBotMsg('Informe o número da bancada, ex: "bancada 04".');
      }
      return true;
    }

    // --- Lista por faixa de nota (rápido) ---
    if (nLim) {
      const dirLabel = nLim.op === 'lt' ? `abaixo de ${nLim.val}` : nLim.op === 'gt' ? `acima de ${nLim.val}` : `igual a ${nLim.val}`;
      const alunos = students.filter(s => nLim.op === 'lt' ? Number(s.nota) < nLim.val : nLim.op === 'gt' ? Number(s.nota) > nLim.val : Number(s.nota) === nLim.val);
      if (alunos.length === 0) {
        addBotMsg(`<strong>Notas ${dirLabel}</strong><br><br>Nenhum aluno com nota ${dirLabel} (${total} alunos na turma, média ${media.toFixed(1)}).`);
      } else {
        const rows = alunos.map(s => `<tr><td>${esc(s.name)}</td><td>${s.matricula}</td><td>${s.nota}</td><td>${s.freq}%</td><td>${esc(s.riskLabel)}</td></tr>`).join('');
        addBotMsg(`<strong>Alunos com nota ${dirLabel} (${alunos.length})</strong>` +
          `<table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Nota</th><th>Freq.</th><th>Risco</th></tr></thead><tbody>${rows}</tbody></table>` +
          `<p style="margin-top:8px">Média da turma: <strong>${media.toFixed(1)}</strong> &middot; Total: ${total} alunos.</p>`);
      }
      return true;
    }

    // --- Lista por faixa de frequência (rápido) ---
    if (fLim) {
      const dirLabel = fLim.op === 'lt' ? `abaixo de ${fLim.val}%` : fLim.op === 'gt' ? `acima de ${fLim.val}%` : `igual a ${fLim.val}%`;
      const alunos = students.filter(s => fLim.op === 'lt' ? Number(s.freq) < fLim.val : fLim.op === 'gt' ? Number(s.freq) > fLim.val : Number(s.freq) === fLim.val);
      if (alunos.length === 0) {
        addBotMsg(`<strong>Frequência ${dirLabel}</strong><br><br>Nenhum aluno com frequência ${dirLabel} (${total} alunos na turma).`);
      } else {
        const rows = alunos.map(s => `<tr><td>${esc(s.name)}</td><td>${s.matricula}</td><td>${s.freq}%</td><td>${s.nota}</td><td>${esc(s.riskLabel)}</td></tr>`).join('');
        addBotMsg(`<strong>Alunos com frequência ${dirLabel} (${alunos.length})</strong>` +
          `<table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Freq.</th><th>Nota</th><th>Risco</th></tr></thead><tbody>${rows}</tbody></table>` +
          `<p style="margin-top:8px">Frequência considerada até o momento &middot; Total: ${total} alunos.</p>`);
      }
      return true;
    }

    if (lower.includes('risco')) {
      const rows = risco.map(s => `<tr><td>${escHtml(s.name)}</td><td>${s.matricula}</td><td>${s.freq}%</td><td>${s.nota}</td><td style="color:#DC2626">Alto</td></tr>`).join('');
      const medRows = riscoMedium.map(s => `<tr><td>${escHtml(s.name)}</td><td>${s.matricula}</td><td>${s.freq}%</td><td>${s.nota}</td><td style="color:#D97706">Médio</td></tr>`).join('');
      addBotMsg(`<strong>Alunos em Risco</strong><br><br>` +
        `<strong style="color:#DC2626">Risco Alto (${risco.length}):</strong>` +
        (rows ? `<table><thead><tr><th>Aluno</th><th>Matr.</th><th>Freq.</th><th>Nota</th><th>Risco</th></tr></thead><tbody>${rows}</tbody></table>` : '<br>Nenhum.') +
        `<br><strong style="color:#D97706">Risco Médio (${riscoMedium.length}):</strong>` +
        (medRows ? `<table><thead><tr><th>Aluno</th><th>Matr.</th><th>Freq.</th><th>Nota</th><th>Risco</th></tr></thead><tbody>${medRows}</tbody></table>` : '<br>Nenhum.'));
      return true;
    }
    if (lower.includes('ausente') || lower.includes('falta') || lower.includes('faltam')) {
      if (abs.length === 0) {
        addBotMsg('Todos os alunos estão presentes hoje!');
      } else {
        const rows = abs.map(s => `<tr><td>${escHtml(s.name)}</td><td>${s.matricula}</td><td>Bancada ${s.bancada}</td><td>${s.freq}%</td></tr>`).join('');
        addBotMsg(`<strong>Alunos Ausentes Hoje (${abs.length})</strong><table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Bancada</th><th>Freq.</th></tr></thead><tbody>${rows}</tbody></table>`);
      }
      return true;
    }
    if (lower.includes('observa')) {
      const comObs = students.filter(s => s.observacoes && s.observacoes.trim());
      if (comObs.length === 0) {
        addBotMsg('Nenhum aluno possui observações registradas. Toque no cartão de um aluno no carômetro e escreva uma observação.');
      } else {
        const rows = comObs.map(s => `<tr><td>${escHtml(s.name)}</td><td>${s.matricula}</td><td>Bancada ${s.bancada}</td><td>${escHtml(s.observacoes)}</td></tr>`).join('');
        addBotMsg(`<strong>Alunos com Observações (${comObs.length})</strong><table><thead><tr><th>Aluno</th><th>Matrícula</th><th>Bancada</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>`);
      }
      return true;
    }
    if (lower.includes('ocorr')) {
      const occ = SENAI_loadOcorrencias()
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 8);
      if (occ.length === 0) {
        addBotMsg('Nenhuma ocorrência registrada para esta turma ainda.');
      } else {
        const rows = occ.map(o => `<tr><td>${escHtml(String(o.date || '').slice(0, 10))}</td><td>${escHtml(o.alunoName || '-')}</td><td>${escHtml(o.tipo || '-')}</td><td>${escHtml(o.severidade || '-')}</td><td>${escHtml(o.status || '-')}</td></tr>`).join('');
        addBotMsg(`<strong>Ocorrências Recentes (últimas ${occ.length})</strong><table><thead><tr><th>Data</th><th>Aluno</th><th>Tipo</th><th>Severidade</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
      }
      return true;
    }
    if (lower.includes('reserva') || (lower.includes('sala') && lower.includes('dispon')) || lower.includes('próximas reservas')) {
      const reservas = SENAI_loadReservas()
        .slice()
        .sort(SENAI_sortReserva)
        .filter(r => String(r.data || '').length === 10 && r.data >= SENAI_todayKey())
        .slice(0, 6);
      if (reservas.length === 0) {
        addBotMsg('Não há reservas futuras da sala para esta turma.');
      } else {
        const rows = reservas.map(r => `<tr><td>${r.data}</td><td>${r.inicio || ''} - ${r.fim || ''}</td><td>${escHtml(r.titulo || r.motivo || '-')}</td></tr>`).join('');
        addBotMsg(`<strong>Próximas Reservas da Sala</strong><table><thead><tr><th>Data</th><th>Horário</th><th>Título</th></tr></thead><tbody>${rows}</tbody></table>`);
      }
      return true;
    }
    if (lower.includes('melhor')) {
      const melhor = students.reduce((a, b) => a.nota > b.nota ? a : b, students[0]);
      addBotMsg(`<strong>Melhor aluno da turma</strong><br><br>` +
        `${escHtml(melhor ? melhor.name : '-')} tem a maior nota: <strong>${melhor ? melhor.nota : '-'}</strong> (frequência ${melhor ? melhor.freq : '-'}%).`);
      return true;
    }
    if (lower.includes('pior') || lower.includes('menor nota')) {
      const pior = students.reduce((a, b) => a.nota < b.nota ? a : b, students[0]);
      addBotMsg(`<strong>Aluno com menor nota</strong><br><br>` +
        `${escHtml(pior ? pior.name : '-')} está com <strong>${pior ? pior.nota : '-'}</strong> (frequência ${pior ? pior.freq : '-'}%).` +
        `${pior && pior.risk === 'high' ? '<br><span style="color:#DC2626">Classificado como risco alto — considere registrar uma ocorrência.</span>' : ''}`);
      return true;
    }
    if (lower.includes('destaque')) {
      const melhorNota = students.reduce((a, b) => a.nota > b.nota ? a : b, students[0]);
      const maisFreq = students.reduce((a, b) => a.freq > b.freq ? a : b, students[0]);
      addBotMsg(`<strong>Destaques da Turma</strong><br><br>` +
        `Melhor nota: <strong>${escHtml(melhorNota ? melhorNota.name : '-')}</strong> (${melhorNota ? melhorNota.nota : '-'})<br>` +
        `Maior frequência: <strong>${escHtml(maisFreq ? maisFreq.name : '-')}</strong> (${maisFreq ? maisFreq.freq : '-'}%)<br><br>` +
        `Presentes hoje: <strong>${pres}</strong> de ${total} alunos.`);
      return true;
    }
    if (lower.includes('unidade')) {
      const ctx = SENAI_ctx();
      const label = SENAI_unidadeLabel(ctx.unidadeId) || 'Não definida';
      addBotMsg(`<strong>Unidade em uso</strong><br><br>` +
        `Você está operando na unidade <strong>${escHtml(label)}</strong>.<br>` +
        `Todos os registros (alunos, chamadas, ocorrências e reservas) são isolados por unidade e turma.`);
      return true;
    }
    if (lower.includes('ajuda') || lower.includes('comandos') || lower.includes('o que posso') || lower.includes('sugestões')) {
      addBotMsg(`<strong>Comandos disponíveis:</strong><br><br>` +
        `&#8226; <em>Resumo geral da turma</em><br>` +
        `&#8226; <em>Quais alunos estão em risco?</em><br>` +
        `&#8226; <em>Quais alunos estão ausentes hoje?</em><br>` +
        `&#8226; <em>Liste os alunos com nota abaixo de 70</em><br>` +
        `&#8226; <em>Alunos com frequência abaixo de 80%</em><br>` +
        `&#8226; <em>Alunos com observações registradas</em><br>` +
        `&#8226; <em>Quais as ocorrências recentes?</em><br>` +
        `&#8226; <em>Próximas reservas da sala</em><br>` +
        `&#8226; <em>Destaques da turma</em> (melhor nota e frequência)<br>` +
        `&#8226; <em>Bancada 04</em> (consulta individual)<br><br>` +
        `Plano de ação, média e análises são gerados pela <em>IA local (Ollama)</em> &mdash; pergunte em linguagem natural, ex.: "monte um plano de ação" ou "qual a média da turma?".`);
      return true;
    }
    if (lower.includes('resumo') || lower.includes('geral') || lower.includes('andamento geral')) {
      addBotMsg(`<strong>Resumo da Turma${grupo}</strong><br><br>` +
        `${iaSubLabel() ? `<span style="color:#64748B">Analisando <strong>${escHtml(iaSubLabel())}</strong> (${total} alunos)</span><br><br>` : ''}` +
        `Total de alunos: <strong>${total}</strong><br>` +
        `Presentes hoje: <strong style="color:#059669">${pres}</strong><br>` +
        `Atrasados hoje: <strong style="color:#D97706">${atrasos}</strong><br>` +
        `Ausentes hoje: <strong style="color:#DC2626">${abs.length}</strong><br>` +
        `Média da turma: <strong>${media.toFixed(1)}</strong> (escala 0-100)<br>` +
        `Alunos em risco alto: <strong style="color:#DC2626">${risco.length}</strong><br>` +
        `Alunos em risco médio: <strong style="color:#D97706">${riscoMedium.length}</strong>`);
      return true;
    }
    return false;
  }

  // --- IA livre via Ollama (streaming, com memória) ---
  function askOllama(q) {
    busy = true;
    if (btnSend) btnSend.disabled = true;
    const lista = iaStudents();
    const pres  = lista.filter(s => s.status !== 'absent').length;
    const config = SENAI_loadConfig();
    const aulas = SENAI_loadAulas().slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    const ocorrencias = SENAI_loadOcorrencias().slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
    const reservas = SENAI_loadReservas().slice().sort(SENAI_sortReserva).slice(0, 10);
    const hoje = SENAI_todayKey();
    const ctx = SENAI_ctx();
    const discDisciplina = config.disciplina || '';
    const todosMateriais = SENAI_loadMateriais().filter(m => m.status === 'aprovado');
    const materiaisIa = todosMateriais
      .filter(m => discDisciplina && String(m.disciplina || '').toLowerCase() === String(discDisciplina).toLowerCase())
      .concat(todosMateriais.filter(m => !(String(m.disciplina || '').toLowerCase() === String(discDisciplina).toLowerCase())))
      .slice(0, 5)
      .map(m => ({
        titulo: m.titulo,
        tipo: SENAI_materiaisTipoLabel(m.tipo),
        disciplina: m.disciplina || 'Geral',
        curso: m.curso || '',
        autor: m.autor || '',
        unidade: m.unidadeNome || ''
      }));

    const context = {
      unidade: SENAI_unidadeLabel(ctx.unidadeId),
      turma: config.turma,
      turmaAtual: true,
      disciplina: config.disciplina,
      curso: config.curso,
      turno: config.turno,
      cargaHoraria: config.cargaHoraria,
      oficina: config.oficina,
      professor: (SENAI_getSession() || {}).name,
      total: lista.length,
      presentes: pres,
      atrasados: lista.filter(s => s.status === 'late').length,
      ausentes: lista.length - pres,
      media: SENAI_avgNota(lista),
      mediaPorAvaliacao: (config.avaliacoesTemplate || []).map(t => {
        const notas = lista.map(s => {
          const av = (s.avaliacoes || []).find(a => String(a.nome) === String(t.nome));
          return av ? SENAI_clamp(Number(av.nota) || 0, 0, 100) : null;
        }).filter(n => n !== null);
        return {
          nome: t.nome,
          peso: Number(t.peso) || 0,
          media: notas.length > 0 ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length * 10) / 10 : null
        };
      }),
      riscoAlto: lista.filter(s => s.risk === 'high').length,
      riscoMedio: lista.filter(s => s.risk === 'medium').length,
      subturma: iaSubLabel(),
      subturmaAtiva: !!iaSubId,
      alunosNaSubturma: iaSubId ? lista.length : null,
      aulaHoje: aulas.find(a => a.date === hoje) || null,
      aulasRecentes: aulas
        .filter(a => a.date !== hoje)
        .map(a => ({
          date: a.date,
          tema: a.tema,
          presentes: (a.presenteIds || []).length,
          ausentes: (a.ausenteIds || []).length,
          rascunho: !!a.rascunho
        })),
      ocorrenciasRecentes: ocorrencias.map(o => ({
        date: o.date,
        aluno: o.alunoName,
        tipo: o.tipo,
        severidade: o.severidade,
        status: o.status
      })),
      proximasReservas: reservas
        .filter(r => (r.data || '').length === 10 && r.data >= hoje)
        .map(r => ({
          date: r.data,
          inicio: r.inicio,
          fim: r.fim,
          titulo: r.titulo || r.motivo || ''
        })),
      materiais: materiaisIa,
      students: lista.slice(0, 20).map(s => ({
        name: s.name,
        matricula: s.matricula,
        bancada: s.bancada,
        freq: s.freq,
        nota: s.nota,
        status: s.status,
        riskLabel: s.riskLabel,
        observacoes: typeof s.observacoes === 'string' && s.observacoes.trim() ? s.observacoes.trim().slice(0, 60) : ''
      }))
    };

    const bubble = addBotMsg('<span class="chat-stream">Pensando...</span>');
    const bubbleEl = bubble.querySelector('.chat-msg-bubble');

    const selectedModel = (modelSelect && modelSelect.value) || DEFAULT_MODEL;
    const t0 = Date.now();

    const lastMessages = history
      .slice(-6)
      .filter(m => !m.summary)
      .map(m => ({ role: m.role, content: m.content }));

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        context: context,
        messages: lastMessages.length > 0 ? lastMessages : [{ role: 'user', content: q }]
      })
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 503) {
          bubbleEl.innerHTML = '<span style="color:#DC2626">Ollama não está em execução.</span> Para consultas livres, inicie o servidor com o <b>iniciar-sistema.bat</b>. Enquanto isso, use: resumo, risco, ausentes, observações, ocorrências, reservas, destaques ou ajuda.';
        } else {
          bubbleEl.innerHTML = 'Ocorreu um erro ao consultar a IA local: ' + escHtml(err.error || res.status) + '<br>Tente novamente ou use uma das consultas rápidas (ex.: "resumo geral").';
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let acc = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.text) acc += data.text;
            bubbleEl.textContent = acc;
            chatEl.scrollTop = chatEl.scrollHeight;
          } catch (e) { /* chunk parcial */ }
        }
      }
      if (acc.trim()) {
        const resumo = acc.trim();
        const curto = resumo.length > 140 ? resumo.slice(0, 137) + '…' : resumo;
        history.push({ role: 'assistant', content: curto, summary: true });
        history = history.slice(-MAX_HISTORY);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const meta = document.createElement('div');
        meta.className = 'chat-stream-meta';
        meta.textContent = `Respondido em ${elapsed}s · ${selectedModel}`;
        bubbleEl.appendChild(meta);
        chatEl.scrollTop = chatEl.scrollHeight;
      } else {
        bubbleEl.innerHTML = 'A IA não retornou texto. Tente reformular a pergunta.';
      }
    }).catch(() => {
      bubbleEl.innerHTML = 'Não foi possível acessar a IA local. Verifique se o servidor está ativo (iniciar-sistema.bat) ou use as consultas rápidas: resumo, risco, ausentes, observações, ocorrências, reservas, destaque, ajuda.';
    }).finally(() => {
      busy = false;
      if (btnSend) btnSend.disabled = false;
    });
  }

  function processQuery(q) {
    if (localIntent(q)) {
      recordLastBot();
      return;
    }
    askOllama(q);
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});