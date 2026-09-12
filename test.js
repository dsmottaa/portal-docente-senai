/**
 * TEST.JS - Smoke tests do Portal do Docente SENAI.
 * Sobe uma instância isolada (porta e banco temporários), valida os
 * principais contratos e encerra. Uso: node test.js
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8799;
const BASE = 'http://127.0.0.1:' + PORT;
const DB = path.join(os.tmpdir(), 'portal-test-' + process.pid + '.sqlite');
const SERVER = path.join(__dirname, 'server.js');

let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log('  PASS  ' + name); }
function fail(name, detail) { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }

async function req(pathUrl, opts) {
  const r = await fetch(BASE + pathUrl, opts || {});
  let body = null;
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('json')) { try { body = await r.json(); } catch (e) {} }
  return { status: r.status, headers: r.headers, body };
}

const PAGES = [
  'index', 'dashboard', 'turma', 'diario', 'carometro', 'ocorrencias',
  'materiais', 'mapa', 'ia', 'mural', 'calendario', 'central',
  'relatorios', 'configuracao', 'instalacao'
];

async function main() {
  if (fs.existsSync(DB)) fs.unlinkSync(DB);
  const child = spawn(process.execPath, [SERVER], {
    env: Object.assign({}, process.env, { PORT: String(PORT), DB_PATH: DB, CORS_ORIGIN: '' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let bootLog = '';
  child.stdout.on('data', d => bootLog += d);
  child.stderr.on('data', d => bootLog += d);

  const t0 = Date.now();
  async function waitUp() {
    while (Date.now() - t0 < 15000) {
      try {
        const r = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(1000) });
        if (r.ok) return true;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  try {
    if (!(await waitUp())) {
      throw new Error('Servidor não subiu. Log:\n' + bootLog);
    }
    console.log('Servidor isolado no ar (porta ' + PORT + ').\n');

    // 1) Health
    {
      const r = await req('/api/health');
      if (r.status === 200 && r.body && r.body.ok === true) ok('health /api/health');
      else fail('health /api/health', r.status + ' ' + JSON.stringify(r.body));
    }

    // 2) Páginas retornam 200 e servem os ativos novos
    for (const p of PAGES) {
      const r = await fetch(BASE + '/pages/' + p + '.html');
      const html = await r.text();
      const tags = p === 'index'
        ? (html.includes('sidebar') === false)
        : (html.includes('id="sidebarNav"') && html.includes('sidebar.js') && html.includes('data-active="' + p + '.html"'));
      if (r.status === 200 && tags) ok('pagina /pages/' + p + '.html (sidebar + data-active)');
      else fail('pagina /pages/' + p + '.html', 'status=' + r.status + ' tags=' + tags);
    }
    for (const a of ['/js/sidebar.js', '/js/vendor/jspdf.umd.min.js', '/js/vendor/jspdf.plugin.autotable.min.js', '/service-worker.js']) {
      const r = await fetch(BASE + a);
      if (r.status === 200) ok('ativo ' + a);
      else fail('ativo ' + a, 'status=' + r.status);
    }

    // 3) Endpoints protegidos exigem token
    {
      const r = await req('/api/data');
      if (r.status === 401) ok('GET /api/data sem token -> 401');
      else fail('GET /api/data sem token', 'status=' + r.status);
    }
    {
      const r = await req('/api/data/download');
      if (r.status === 401) ok('GET /api/data/download sem token -> 401');
      else fail('GET /api/data/download sem token', 'status=' + r.status);
    }
    {
      const r = await req('/api/data/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}' });
      if (r.status === 401) ok('POST /api/data/upload sem token -> 401');
      else fail('POST /api/data/upload sem token', 'status=' + r.status);
    }
    {
      const r = await req('/api/materiais/x', { method: 'DELETE' });
      if (r.status === 401) ok('DELETE /api/materiais sem token -> 401');
      else fail('DELETE /api/materiais sem token', 'status=' + r.status);
    }

    // 4) Login: senha errada -> 401
    {
      const r = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: '123.456.789-00', senha: 'errada' }) });
      if (r.status === 401) ok('login senha errada -> 401');
      else fail('login senha errada', 'status=' + r.status);
    }

    // 5) Login correto + isolamento por unidade na leitura
    let token = null;
    {
      const r = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: '123.456.789-00', senha: 'senai2026' }) });
      if (r.status === 200 && r.body && r.body.token) {
        token = r.body.token;
        ok('login professor -> token');
      } else fail('login professor', 'status=' + r.status);
    }
    if (token) {
      const authOpts = { headers: { Authorization: 'Bearer ' + token } };
      // Grava uma chave da própria unidade (e tenta uma de outra) para validar escopo.
      const put = await req('/api/data', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {
          'senai_aulas_data__u_sp_sao_paulo__TEC_TESTE': { prova: 1 },
          'senai_aulas_data__u_sp_minas__TEC_XX': { x: 1 }
        } })
      });
      if (put.status === 200 && put.body && !put.body.updatedAt) {
        fail('PUT unidade + outra (mix)');
      } else if (put.status === 200 && put.body) {
        ok('PUT propria unidade ok (rejeica ' + (put.body.rejected || 0) + ' de outra)');
      } else {
        fail('PUT propria unidade ok', 'status=' + put.status);
      }
      const r = await req('/api/data', authOpts);
      if (r.status === 200 && r.body && r.body.data) {
        const keys = Object.keys(r.body.data);
        const okIsol = keys.includes('senai_aulas_data__u_sp_sao_paulo__TEC_TESTE') &&
          !keys.includes('senai_users_data') &&
          !keys.some(k => k.includes('__u_sp_') && !k.includes('__u_sp_sao_paulo'));
        if (okIsol) ok('GET /api/data isolado por unidade (sem senai_users_data)');
        else fail('GET /api/data isolado', keys.join(','));
      } else fail('GET /api/data com token', 'status=' + r.status);
    }

    // 6) CORS
    {
      const hostile = await req('/api/health', { headers: { Origin: 'http://evil.example' } });
      if (hostile.headers.get('access-control-allow-origin') === null) ok('CORS bloqueia origem estranha');
      else fail('CORS bloqueia origem estranha', 'ACAO=' + hostile.headers.get('access-control-allow-origin'));
      const sameOrigin = 'http://127.0.0.1:' + PORT;
      const same = await req('/api/health', { headers: { Origin: sameOrigin } });
      if (same.headers.get('access-control-allow-origin') === sameOrigin) ok('CORS permite mesma origem');
      else fail('CORS permite mesma origem', 'ACAO=' + same.headers.get('access-control-allow-origin'));
    }

    // 7) PUT com chave de outra unidade -> 403 (nenhuma permitida)
    if (token) {
      const r = await req('/api/data', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { 'senai_aulas_data__u_sp_minas__TEC_XX': { x: 1 } } })
      });
      if (r.status === 403) ok('PUT chave de outra unidade -> 403');
      else fail('PUT chave de outra unidade', 'status=' + r.status);
    }

    // 8) Rate limit: 5 erradas (401) e a 6ª bloqueia (429)
    {
      let codes = [];
      for (let i = 0; i < 6; i++) {
        const r = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: '123.456.789-00', senha: 'errada-' + i }) });
        codes.push(r.status);
      }
      const okRate = codes.slice(0, 5).every(c => c === 401) && codes[5] === 429;
      if (okRate) ok('rate limit: 5x401 depois 429');
      else fail('rate limit', codes.join(','));
    }

    // 9) IA: abortar o stream do chat no meio NÃO deve derrubar o servidor
    {
      const st = await req('/api/ollama/status');
      if (st.body && st.body.modelReady === true) {
        const model = (st.body.models && st.body.models[0]) || 'qwen2.5:3b';
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        try {
          await fetch(BASE + '/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model, context: {}, messages: [{ role: 'user', content: 'teste de abort' }] }),
            signal: ctrl.signal
          });
        } catch (e) { /* abortado de proposito */ }
        clearTimeout(t);
        const h = await req('/api/health');
        if (h.status === 200) ok('abortar o stream do chat nao derruba o servidor');
        else fail('abortar o stream do chat nao derruba o servidor', 'health=' + h.status);
      } else {
        console.log('  SKIP  IA offline (Ollama nao disponivel no ambiente de teste)');
      }
    }

    console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  } catch (e) {
    failed++;
    console.log('\nERRO no teste: ' + e.message);
    if (bootLog) console.log('--- log do servidor ---\n' + bootLog);
  } finally {
    child.kill();
    await new Promise(res => setTimeout(res, 300));
    try { fs.unlinkSync(DB); } catch (e) {}
    try { fs.unlinkSync(DB + '-wal'); } catch (e) {}
    try { fs.unlinkSync(DB + '-shm'); } catch (e) {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();