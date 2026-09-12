/**
 * MATERIAIS.JS - Repositório Nacional de Materiais Didáticos
 * Depende de data.js e auth.js.
 * Fluxo: docente publica (aguardando) -> coordenação aprova/rejeita -> catálogo nacional.
 */
(function () {
  if (!window.SENAI_loadMateriais) { console.error('data.js não carregado'); return; }

  SENAI_requireAuth();

  const toastContainer = document.getElementById('toastContainer');
  function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-msg">${message}</span><button class="toast-close" aria-label="Fechar">&times;</button>`;
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 250);
    });
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const session = SENAI_getSession() || {};
  const isCoord = session.role === 'coordenacao';
  const ctx = SENAI_ctx();
  const grid = document.getElementById('materiaisGrid');
  const countEl = document.getElementById('matCount');

  const state = { status: '', disciplina: '', tipo: '', busca: '' };

  const TIPO_ICONS = {
    pdf: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>',
    apresentacao: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    video: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect></svg>',
    link: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    plano_de_aula: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    exercicio: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>'
  };

  function fmtData(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 && iso.includes('-') ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  function statusBadge(s) {
    const base = { aprovado: 'mat-badge mat-badge-ok', aguardando: 'mat-badge mat-badge-wait', rejeitado: 'mat-badge mat-badge-ko' };
    const label = { aprovado: 'Aprovado', aguardando: 'Aguardando aprovação', rejeitado: 'Rejeitado' };
    return `<span class="${base[s] || base.aguardando}">${label[s] || 'Aguardando'}</span>`;
  }

  function isAutor(m) {
    const me = session.name || session.matricula || '';
    return !!m && me !== '' && String(m.autor || '').trim() === String(me).trim();
  }

  function autorNome(m) {
    const n = String(m.autor || '');
    return n || 'Docente';
  }

  function fmtTamanho(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function autorMatches(m) {
    const me = session.name || session.matricula || '';
    if (me === '') return true;
    return String(m.autor || '').trim() === String(me).trim();
  }

  function render() {
    const todos = SENAI_loadMateriais();
    let items;
    if (state.status === 'meus') {
      items = SENAI_materiaisFilter(state.busca, state.disciplina, state.tipo, '')
        .filter(autorMatches);
    } else {
      items = SENAI_materiaisFilter(state.busca, state.disciplina, state.tipo, state.status || '');
    }
    items = items.slice().sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')));

    const me = session.name || session.matricula || '';
    const tabCounts = {};
    tabCounts[''] = todos.length;
    tabCounts.aprovado = todos.filter(m => m.status === 'aprovado').length;
    tabCounts.aguardando = todos.filter(m => m.status === 'aguardando').length;
    tabCounts.rejeitado = todos.filter(m => m.status === 'rejeitado').length;
    tabCounts.meus = me ? todos.filter(m => String(m.autor || '').trim() === String(me).trim()).length : todos.length;

    document.querySelectorAll('#matStatusTabs .chip').forEach(ch => {
      const s = ch.getAttribute('data-status');
      ch.classList.toggle('chip-active', s === state.status);
    });
    countEl.textContent = tabCounts[state.status] != null ? ` (${tabCounts[state.status]})` : '';

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="mat-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <p><strong>Nenhum material aqui.</strong></p>
          <p>${state.status === 'meus' ? 'Você ainda não publicou materiais no repositório.' : 'Ajuste os filtros ou publique o primeiro material do catálogo nacional.'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(m => {
      const canModerate = isCoord && m.status === 'aguardando';
      const canDelete = isCoord || isAutor(m);
      const acoes = [];
      if (m.url) {
        acoes.push(`<a class="mat-btn mat-btn-primary" href="${escHtml(m.url)}" target="_blank" rel="noopener">Abrir</a>`);
      }
      if (m.anexoNome) {
        acoes.push(`<button type="button" class="mat-btn mat-btn-primary" data-download="${escHtml(m.id)}">Baixar (${fmtTamanho(m.tamanho)})</button>`);
      }
      if (canModerate) {
        acoes.push(`<button type="button" class="mat-btn mat-btn-ok" data-aprovar="${escHtml(m.id)}">Aprovar</button>`);
        acoes.push(`<button type="button" class="mat-btn mat-btn-ko" data-rejeitar="${escHtml(m.id)}">Rejeitar</button>`);
      }
      if (canDelete) {
        acoes.push(`<button type="button" class="mat-btn mat-btn-ghost" data-excluir="${escHtml(m.id)}" title="Excluir">Excluir</button>`);
      }

      const extra = [];
      if (m.curso) extra.push(`<span class="mat-meta">${escHtml(m.curso)}</span>`);
      if (m.unidadeNome) extra.push(`<span class="mat-meta mat-meta-unit">${escHtml(m.unidadeNome)}</span>`);

      let motivo = '';
      if (m.status === 'rejeitado' && m.motivoRejeicao) {
        motivo = `<p class="mat-motivo">Motivo: ${escHtml(m.motivoRejeicao)}</p>`;
      }

      return `
      <article class="mat-card">
        <div class="mat-card-top">
          <div class="mat-card-icon">${TIPO_ICONS[m.tipo] || TIPO_ICONS.pdf}</div>
          <div class="mat-card-head">
            <h3 class="mat-card-title">${escHtml(m.titulo)}</h3>
            <p class="mat-card-sub">${escHtml(SENAI_materiaisTipoLabel(m.tipo))} · ${escHtml(m.disciplina || 'Geral')} · ${fmtData(m.atualizadoEm)}</p>
          </div>
          ${statusBadge(m.status)}
        </div>
        <p class="mat-tags">${m.tags ? escHtml(m.tags) : 'Sem palavras-chave'}</p>
        <div class="mat-meta-row">${extra.join('')}<span class="mat-meta mat-meta-autor">${escHtml(autorNome(m))}</span></div>
        ${motivo}
        <div class="mat-actions">${acoes.join('')}</div>
      </article>`;
    }).join('');
  }

  function lerDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  // Serviço de download de anexo (Bytes armazenados no servidor)
  function baixarAnexo(id) {
    fetch('/api/materiais/' + encodeURIComponent(id) + '/download')
      .then(res => {
        if (!res.ok) throw new Error('Anexo não encontrado neste servidor (' + res.status + ')');
        return res.blob();
      })
      .then(blob => {
        const item = SENAI_getMaterial(id);
        const nome = (item && item.anexoNome) || 'material';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 800);
      })
      .catch(e => showToast(escHtml(e.message), 'error'));
  }

  // Publicação com anexo: bytes vão ao servidor; o catálogo guarda só metadados
  function publicarComArquivo(item, file, dataUrl) {
    const body = {
      id: item.id,
      titulo: item.titulo,
      tipo: item.tipo,
      disciplina: item.disciplina,
      curso: item.curso,
      unidadeOrigem: item.unidadeOrigem,
      unidadeNome: item.unidadeNome,
      autor: item.autor,
      anexo: dataUrl,
      anexoNome: file.name,
      anexoMime: file.type || 'application/octet-stream'
    };
    return fetch('/api/materiais', {
      method: 'POST',
      headers: SENAI_authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    }).then(async (res) => {
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.ok) throw new Error((r.error || 'falha ao enviar o arquivo') + ' (' + res.status + ')');
      return r;
    });
  }

  function excluirMaterial(id) {
    const item = SENAI_getMaterial(id);
    if (!item) return;
    const ret = SENAI_deleteMaterial(id);
    if (!ret) return;
    if (item.anexoNome) {
      fetch('/api/materiais/' + encodeURIComponent(id), SENAI_authHeaders({ method: 'DELETE' })).catch(() => {});
    }
    render();
    showToast('Material excluído.', 'success');
  }

  /* ── Filtros ── */
  document.querySelectorAll('#matStatusTabs .chip').forEach(ch => {
    ch.addEventListener('click', () => {
      state.status = ch.getAttribute('data-status');
      render();
    });
  });
  document.getElementById('matDisciplina').addEventListener('change', e => {
    state.disciplina = e.target.value;
    render();
  });
  document.getElementById('matTipo').addEventListener('change', e => {
    state.tipo = e.target.value;
    render();
  });

  function preencherFiltros() {
    const config = SENAI_loadConfig() || {};
    const dc = document.getElementById('matDisciplina');
    const tp = document.getElementById('matTipo');
    const disci = new Set();
    const tipos = new Set();
    SENAI_loadMateriais().forEach(m => {
      if (m.disciplina) disci.add(m.disciplina);
      if (m.tipo) tipos.add(m.tipo);
    });
    if (config.disciplina) disci.add(config.disciplina);
    dc.innerHTML = '<option value="">Todas as disciplinas</option>' +
      Array.from(disci).sort().map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');
    tp.innerHTML = '<option value="">Todos os tipos</option>' +
      Array.from(tipos).map(t => `<option value="${escHtml(t)}">${escHtml(SENAI_materiaisTipoLabel(t))}</option>`).sort().join('');
    // preenche disciplinas do datalist do formulário
    const dl = document.getElementById('matDclist');
    dl.innerHTML = Array.from(disci).sort().map(d => `<option value="${escHtml(d)}"></option>`).join('');
  }

  /* ── Modal: novo material ── */
  const modalNovo = document.getElementById('modalNovoMaterial');
  const tipoSel = document.getElementById('matTipoSel');
  tipoSel.innerHTML = SENAI_MATERIAIS_TIPOS.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  const form = document.getElementById('matDisciplinaInput') ? {} : {};

  let modoArquivo = false;
  let fileData = null;

  document.getElementById('btnNovoMaterial').addEventListener('click', () => {
    const config = SENAI_loadConfig() || {};
    if (config.disciplina && !document.getElementById('matDisciplinaInput').value) {
      document.getElementById('matDisciplinaInput').value = config.disciplina;
    }
    if (config.curso && !document.getElementById('matCurso').value) {
      document.getElementById('matCurso').value = config.curso;
    }
    fileData = null;
    document.getElementById('matArquivo').value = '';
    document.getElementById('matFileInfo').textContent = 'Clique para escolher um arquivo (até 90 MB)';
    modalNovo.classList.add('modal-active');
    modalNovo.setAttribute('aria-hidden', 'false');
    document.getElementById('matTitulo').focus();
  });

  function setModo(m) {
    modoArquivo = m === 'arquivo';
    document.getElementById('tabLink').classList.toggle('mat-upload-tab-active', !modoArquivo);
    document.getElementById('tabArquivo').classList.toggle('mat-upload-tab-active', modoArquivo);
    document.getElementById('matUrlRow').style.display = modoArquivo ? 'none' : '';
    document.getElementById('matArquivoRow').style.display = modoArquivo ? '' : 'none';
  }
  document.getElementById('tabLink').addEventListener('click', () => setModo('link'));
  document.getElementById('tabArquivo').addEventListener('click', () => setModo('arquivo'));

  document.getElementById('matArquivo').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) { fileData = null; return; }
    if (f.size > 95 * 1024 * 1024) {
      showToast('O arquivo excede o limite de 90 MB.', 'error');
      e.target.value = '';
      fileData = null;
      return;
    }
    fileData = { file: f, dataUrl: null };
    document.getElementById('matFileInfo').textContent = `${f.name} · ${fmtTamanho(f.size)}`;
  });

  async function salvarNovo() {
    const btn = document.getElementById('btnMatSalvar');
    const titulo = document.getElementById('matTitulo').value.trim();
    const disciplina = document.getElementById('matDisciplinaInput').value.trim();
    const curso = document.getElementById('matCurso').value.trim();
    const tags = document.getElementById('matTags').value.trim();
    const tipo = tipoSel.value;
    const url = document.getElementById('matUrl').value.trim();

    if (!titulo) { showToast('Informe o título do material.', 'error'); return; }
    if (modoArquivo && !fileData) { showToast('Escolha o arquivo a ser anexado.', 'error'); return; }
    if (!modoArquivo && !url) { showToast('Informe a URL do material (ou troque para "Anexar arquivo").', 'error'); return; }

    let dataUrl, f;
    if (modoArquivo && fileData) {
      if (!fileData.dataUrl) {
        dataUrl = await lerDataUrl(fileData.file).catch(() => null);
        if (!dataUrl) {
          showToast('Não foi possível ler o arquivo.', 'error');
          return;
        }
        fileData.dataUrl = dataUrl;
      }
      dataUrl = fileData.dataUrl;
      f = fileData.file;
    }

    btn.disabled = true;
    btn.textContent = 'Publicando...';
    try {
      const item = SENAI_addMaterial({
        titulo, tipo, disciplina, curso, tags, url,
        anexoNome: modoArquivo ? f.name : '',
        anexoMime: modoArquivo ? (f.type || 'application/octet-stream') : '',
        tamanho: modoArquivo ? f.size : 0,
        anexo: null
      });
      if (modoArquivo && dataUrl && f) {
        try {
          await publicarComArquivo(item, f, dataUrl);
        } catch (e) {
          SENAI_deleteMaterial(item.id);
          throw e;
        }
      }
      modalNovo.classList.remove('modal-active');
      modalNovo.setAttribute('aria-hidden', 'true');
      preencherFiltros();
      render();
      const msg = isCoord ? 'Material publicado. Como coordenação, aprove ou rejeite agora mesmo.' : 'Material enviado para aprovação da coordenação.';
      showToast(msg, 'success');
    } catch (e) {
      showToast(escHtml(e.message || 'Falha ao publicar.'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publicar material';
    }
  }
  document.getElementById('btnMatSalvar').addEventListener('click', salvarNovo);

  /* ── Ações da grade (delegação) ── */
  grid.addEventListener('click', e => {
    const btnDown = e.target.closest('[data-download]');
    if (btnDown) { baixarAnexo(btnDown.getAttribute('data-download')); return; }
    const btnApr = e.target.closest('[data-aprovar]');
    if (btnApr) {
      SENAI_setMaterialStatus(btnApr.getAttribute('data-aprovar'), 'aprovado');
      render();
      showToast('Material aprovado e disponível no catálogo nacional.', 'success');
      return;
    }
    const btnRej = e.target.closest('[data-rejeitar]');
    if (btnRej) {
      estadoRejeicao = btnRej.getAttribute('data-rejeitar');
      document.getElementById('matMotivo').value = '';
      modalRejeitar.classList.add('modal-active');
      modalRejeitar.setAttribute('aria-hidden', 'false');
      document.getElementById('matMotivo').focus();
      return;
    }
    const btnExc = e.target.closest('[data-excluir]');
    if (btnExc) { excluirMaterial(btnExc.getAttribute('data-excluir')); return; }
  });

  let estadoRejeicao = null;
  const modalRejeitar = document.getElementById('modalRejeitar');
  document.getElementById('btnMatRejeitar').addEventListener('click', () => {
    const motivo = document.getElementById('matMotivo').value.trim();
    if (!motivo) { showToast('Informe o motivo da rejeição.', 'error'); return; }
    if (estadoRejeicao) {
      SENAI_setMaterialStatus(estadoRejeicao, 'rejeitado', motivo);
      modalRejeitar.classList.remove('modal-active');
      modalRejeitar.setAttribute('aria-hidden', 'true');
      estadoRejeicao = null;
      render();
      showToast('Material rejeitado e retornado ao autor.', 'info');
    }
  });

  // Fechamento genérico de modais
  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => {
      const modal = b.closest('.modal-backdrop');
      if (modal) {
        modal.classList.remove('modal-active');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) {
        m.classList.remove('modal-active');
        m.setAttribute('aria-hidden', 'true');
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => {
        m.classList.remove('modal-active');
        m.setAttribute('aria-hidden', 'true');
      });
    }
  });

  /* ── Busca no header ── */
  const buscaInput = document.getElementById('inputSearch');
  if (buscaInput) {
    buscaInput.placeholder = 'Buscar material, disciplina, tag...';
    let t;
    buscaInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.busca = buscaInput.value.trim();
        render();
      }, 250);
    });
  }

  preencherFiltros();
  render();
})();