/**
 * SERVER.JS - SERVIDOR LOCAL DO PORTAL DO DOCENTE SENAI
 *  - Serve os arquivos estáticos do site (mesma origem, sem CORS)
 *  - GET  /api/ollama/status  → verifica se o Ollama está no ar
 *  - POST /api/ai/chat        → proxy para o Ollama com resposta em stream (SSE)
 *
 * Uso: node server.js   (abre em http://localhost:8000)
 * Requer Node.js 22+ (usa node:sqlite e scrypt nativos) - recomendado Node 24 LTS.
 * Zero dependências.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.MODEL || 'qwen2.5:3b';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
};

/* Restrição de CORS: só mesma origem (localhost) ou origens listadas em CORS_ORIGIN. */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function corsOrigin(req) {
  const o = req.headers['origin'];
  if (!o) return null;
  try {
    const u = new URL(o);
    const host = req.headers['host'] || '';
    if (u.host === host) return o;
    if (ALLOWED_ORIGINS.includes(o)) return o;
  } catch (e) {}
  return null;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/pages/index.html';

  // Mantém compatibilidade com URLs antigas (arquivos que ficavam na raiz)
  if (!urlPath.startsWith('/pages/') && !urlPath.startsWith('/js/') && !urlPath.startsWith('/css/') && !urlPath.startsWith('/img/')) {
    const legacyPath = path.resolve(ROOT, '.' + urlPath);
    if (!fs.existsSync(legacyPath)) {
      const legacyMap = { '.html': 'pages', '.js': 'js', '.css': 'css', '.png': 'img', '.jpg': 'img', '.jpeg': 'img', '.svg': 'img' };
      const folder = legacyMap[path.extname(urlPath).toLowerCase()];
      if (folder) {
        res.writeHead(302, { Location: '/' + folder + urlPath });
        res.end();
        return;
      }
    }
  }

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (filePath.endsWith('.html') && (urlPath === '/index.html' || urlPath === '/pages/index.html')) {
        // Redireciona '/' e o antigo '/index.html' para a página inicial em pages/
        res.writeHead(302, { Location: '/pages/index.html' });
        res.end();
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

function readBody(req, maxMB) {
  const maxBytes = (Number(maxMB) || 64) * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/* =========================================================================
 * PERSISTÊNCIA NACIONAL - SQLite (node:sqlite, zero dependências)
 *  - tabela kv:  chave -> JSON (students, aulas, ocorrências, reservas, ...)
 *  - tabela materiais: catálogo nacional (links + anexos BLOB, moderação)
 *  - tabela log: trilha de auditoria (quem alterou o quê, quando)
 *  - backups automáticos via VACUUM INTO (snapshot consistente do banco)
 * ========================================================================= */

const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'portal.sqlite');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups');
const AUTO_BACKUP_HOURS = Math.max(Number(process.env.AUTO_BACKUP_HOURS) || 2, 0.1);
const AUTO_BACKUP_KEEP = Math.max(Number(process.env.AUTO_BACKUP_KEEP) || 20, 1);

let db;
try {
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS materiais (
      id              TEXT PRIMARY KEY,
      titulo          TEXT NOT NULL,
      tipo            TEXT NOT NULL,
      disciplina      TEXT DEFAULT '',
      curso           TEXT DEFAULT '',
      tags            TEXT DEFAULT '',
      unidadeOrigem   TEXT DEFAULT '',
      unidadeNome     TEXT DEFAULT '',
      autor           TEXT DEFAULT '',
      url             TEXT DEFAULT '',
      anexoNome       TEXT DEFAULT '',
      anexoMime       TEXT DEFAULT '',
      anexo           BLOB,
      tamanho         INTEGER DEFAULT 0,
      status          TEXT DEFAULT 'aguardando',
      criadoEm        TEXT DEFAULT '',
      atualizadoEm    TEXT DEFAULT '',
      motivoRejeicao  TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS log (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts       INTEGER NOT NULL,
      papel    TEXT DEFAULT '',
      usuario  TEXT DEFAULT '',
      acao     TEXT DEFAULT '',
      detalhe  TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      userId     TEXT NOT NULL,
      role       TEXT NOT NULL,
      unidadeId  TEXT DEFAULT '',
      unidadeLabel TEXT DEFAULT '',
      name       TEXT DEFAULT '',
      login      TEXT DEFAULT '',
      createdAt  INTEGER NOT NULL,
      expiresAt  INTEGER NOT NULL
    );
  `);
} catch (e) {
  console.error('[DB] Erro ao abrir o SQLite em', DB_PATH, '-', e.message);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

let lastBackupAt = 0;

function kvAll() {
  const rows = db.prepare('SELECT key, value FROM kv').all();
  const data = {};
  for (const r of rows) {
    try { data[r.key] = JSON.parse(r.value); } catch (e) { data[r.key] = r.value; }
  }
  return data;
}

function kvGet(key) {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(String(key));
  if (!row) return null;
  try { return JSON.parse(row.value); } catch (e) { return row.value; }
}

function kvLatestUpdatedAt() {
  const row = db.prepare('SELECT MAX(updatedAt) AS u FROM kv').get();
  return row && row.u ? Number(row.u) : 0;
}

function kvUpsert(data) {
  const stmt = db.prepare(
    'INSERT INTO kv (key, value, updatedAt) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt'
  );
  const now = Date.now();
  db.exec('BEGIN');
  try {
    for (const [k, v] of Object.entries(data)) {
      stmt.run(String(k), JSON.stringify(v), now);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return now;
}

function kvRemove(keys) {
  const stmt = db.prepare('DELETE FROM kv WHERE key = ?');
  db.exec('BEGIN');
  try {
    for (const k of keys) stmt.run(String(k));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function runBackup(force) {
  const now = Date.now();
  if (!force && now - lastBackupAt < AUTO_BACKUP_HOURS * 3600 * 1000) return false;
  try {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}-${String(d.getMilliseconds()).padStart(3, '0')}`;
    const file = path.join(BACKUP_DIR, `portal-backup-${stamp}.sqlite`);
    db.exec(`VACUUM INTO '${String(file).replace(/'/g, "''")}'`);
    lastBackupAt = now;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('portal-backup-') && f.endsWith('.sqlite')).sort().reverse();
    files.slice(AUTO_BACKUP_KEEP).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    });
    return true;
  } catch (e) {
    console.error('[DB] Falha no backup:', e.message);
    return false;
  }
}

function listBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('portal-backup-') && f.endsWith('.sqlite'))
    .sort().reverse();
  return files.map(f => {
    try {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { nome: f, tamanho: st.size, criadoEm: st.birthtimeMs || st.mtimeMs };
    } catch (e) { return { nome: f, tamanho: 0, criadoEm: 0 }; }
  });
}

function logAudit(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const stmt = db.prepare('INSERT INTO log (ts, papel, usuario, acao, detalhe) VALUES (?, ?, ?, ?, ?)');
  const now = Date.now();
  db.exec('BEGIN');
  try {
    for (const e of entries) {
      if (!e) continue;
      stmt.run(now, String(e.papel || ''), String(e.usuario || ''), String(e.acao || ''), String(e.detalhe || ''));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
  }
}

/* =========================================================================
 * AUTENTICAÇÃO (auth básica no servidor)
 *  - Senhas: scrypt com sal (formato scrypt$sal$hash). Hashes antigos
 *    (SHA-256) são aceitos uma única vez e migrados no primeiro login.
 *  - Sessões: tabela `sessions` (token aleatório, expiração de 12h).
 *  - Rate limit de login: 5 tentativas / 15 min por usuário+IP.
 *  - Isolamento: PUT /api/data só grava chaves da unidade do usuário
 *    (ou chaves globais da plataforma). O papel 'nacional' (visão geral)
 *    não tem restrição de escopo. GET /api/data só devolve chaves da
 *    própria unidade + globais permitidas.
 * ========================================================================= */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashSenha(text) {
  // Mantido para validar/migrar hashes antigos (SHA-256) criados por versões anteriores.
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function scryptHash(text) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(text), salt, 32).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function scryptVerify(text, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const actual = crypto.scryptSync(String(text), parts[1], 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(parts[2], 'hex'));
  } catch (e) {
    return false;
  }
}

function slugify(s) {
  return String(s || '').trim().replace(/[^A-Za-z0-9]+/g, '_');
}

// Chaves globais: podem ser gravadas por qualquer usuário autenticado.
const GLOBAL_WRITE_KEYS = new Set([
  'senai_users_data', 'senai_unidades_data', 'senai_cursos_data',
  'senai_catalogo_unidades', 'senai_catalogo_turmas',
  'senai_config_data', 'senai_materiais_data', 'senai_comunicados_data',
  'senai_calendario_data', 'senai_classroom_data'
]);

// Chaves globais legíveis por qualquer usuário autenticado.
// IMPORTANTE: senai_users_data NUNCA sai na leitura (contém hashes de senha).
const GLOBAL_READ_KEYS = new Set([
  'senai_unidades_data', 'senai_cursos_data',
  'senai_catalogo_unidades', 'senai_catalogo_turmas',
  'senai_config_data', 'senai_materiais_data', 'senai_comunicados_data',
  'senai_calendario_data', 'senai_classroom_data'
]);

function keyReadableFor(key, ses) {
  if (!key) return false;
  if (ses.role === 'nacional') return true;
  if (key === 'senai_users_data') return false;
  if (GLOBAL_READ_KEYS.has(key)) return true;
  const u = slugify(ses.unidadeId);
  if (!u) return false;
  return key.indexOf('__' + u + '__') !== -1 || key.endsWith('__' + u);
}

// Rate limit simples de login (anti força bruta): 5 tentativas / 15 min por usuário+IP.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

function loginKey(login, req) {
  return String(login || '').trim().toLowerCase() + '|' + (req.socket.remoteAddress || '');
}

function loginBlocked(key) {
  const rec = loginAttempts.get(key);
  if (!rec) return null;
  if (rec.blockedUntil && rec.blockedUntil > Date.now()) {
    return Math.ceil((rec.blockedUntil - Date.now()) / 1000);
  }
  if (rec.blockedUntil && rec.blockedUntil <= Date.now()) loginAttempts.delete(key);
  return null;
}

function recordLoginFailure(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now - (rec.firstAt || now) > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { firstAt: now, count: 1, blockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    rec.blockedUntil = now + LOGIN_WINDOW_MS;
    rec.count = 0;
  }
  loginAttempts.set(key, rec);
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function seedServerUsers() {
  const existing = kvGet('senai_users_data');
  const defaults = [
    { name: 'Lucas Nogueira', login: '123.456.789-00', cpf: '123.456.789-00', role: 'professor', matricula: 'DOC-84091', curso: 'Técnico em Mecatrônica', unidade: 'SENAI - Campus Industrial', unidadeId: 'u-sp-sao-paulo', passwordPlain: 'senai2026' },
    { name: 'Marina Duarte', login: 'coord.senai', cpf: '987.654.321-00', role: 'coordenacao', matricula: 'COORD-001', curso: 'Coordenação Acadêmica', unidade: 'SENAI - Campus Industrial', unidadeId: 'u-sp-sao-paulo', passwordPlain: 'coordenador2026' }
  ];
  if (Array.isArray(existing) && existing.length > 0) {
    // Repara registros antigos que ficaram sem unidadeId/hash.
    let changed = false;
    defaults.forEach(du => {
      const norm = du.login.toLowerCase();
      const idx = existing.findIndex(u => String(u.login).trim().toLowerCase() === norm);
      const u = idx >= 0 ? existing[idx] : null;
      if (u && (!u.passwordHash || !u.unidadeId)) {
        if (!u.unidadeId) u.unidadeId = du.unidadeId || '';
        if (!u.passwordHash) u.passwordHash = scryptHash(du.passwordPlain);
        if (!u.unidade) u.unidade = du.unidade || '';
        changed = true;
      }
    });
    if (changed) kvUpsert({ senai_users_data: existing });
    return existing;
  }
  const seeded = defaults.map((du, i) => ({
    id: 'usr-server-' + (i + 1),
    name: du.name,
    login: du.login,
    cpf: du.cpf,
    role: du.role,
    matricula: du.matricula,
    curso: du.curso,
    unidade: du.unidade,
    unidadeId: du.unidadeId || '',
    passwordHash: scryptHash(du.passwordPlain),
    createdAt: new Date().toISOString()
  }));
  kvUpsert({ senai_users_data: seeded });
  return seeded;
}

function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function getSessionByToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(String(token));
  if (!row) return null;
  if (Number(row.expiresAt) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token));
    return null;
  }
  return row;
}

function requireSession(req) {
  const t = bearerToken(req);
  return t ? getSessionByToken(t) : null;
}

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, userId, role, unidadeId, unidadeLabel, name, login, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    token,
    String(user.id || ''),
    String(user.role || ''),
    String(user.unidadeId || ''),
    String(user.unidade || ''),
    String(user.name || ''),
    String(user.login || ''),
    now,
    now + SESSION_TTL_MS
  );
  return token;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, login: u.login, role: u.role,
    matricula: u.matricula, curso: u.curso, unidade: u.unidade,
    unidadeId: u.unidadeId || ''
  };
}

function handleAuthLogin(req, res) {
  readBody(req, 2).then(body => {
    const login = String(body.login || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    if (!login || !senha) {
      sendJson(res, 400, { ok: false, error: 'Informe usuário e senha.' });
      return;
    }
    const lk = loginKey(login, req);
    const blocked = loginBlocked(lk);
    if (blocked) {
      sendJson(res, 429, { ok: false, error: 'Muitas tentativas. Tente novamente em ' + blocked + 's.', retryInSeconds: blocked });
      return;
    }
    const users = kvGet('senai_users_data');
    if (!Array.isArray(users) || users.length === 0) {
      sendJson(res, 401, { ok: false, error: 'Base de usuários indisponível no servidor.' });
      return;
    }
    const user = users.find(u => String(u.login).trim().toLowerCase() === login);
    const stored = user && user.passwordHash;
    const ok = user && stored && (stored.startsWith('scrypt$')
      ? scryptVerify(senha, stored)
      : hashSenha(senha) === stored);
    if (!user || !ok) {
      recordLoginFailure(lk);
      const extra = (loginAttempts.get(lk) || {}).count >= LOGIN_MAX_ATTEMPTS - 1
        ? ' Após essa tentativa o acesso será bloqueado por 15 minutos.'
        : '';
      sendJson(res, 401, { ok: false, error: 'Usuário ou senha inválidos.' + extra });
      return;
    }
    // Migração de hashes antigos (SHA-256) para scrypt no primeiro login bem-sucedido.
    if (stored && !stored.startsWith('scrypt$')) {
      user.passwordHash = scryptHash(senha);
      const idx = users.findIndex(u => String(u.login).trim().toLowerCase() === login);
      if (idx >= 0) {
        users[idx] = user;
        try { kvUpsert({ senai_users_data: users }); } catch (e) {}
      }
    }
    clearLoginAttempts(lk);
    const token = issueSession(user);
    logAudit([{ papel: user.role, usuario: user.name, acao: 'login', detalhe: 'Autenticação no servidor' }]);
    sendJson(res, 200, { ok: true, token: token, user: publicUser(user) });
  }).catch(() => sendJson(res, 400, { ok: false, error: 'JSON inválido.' }));
}

function handleAuthLogout(req, res) {
  const t = bearerToken(req);
  if (t) {
    try { db.prepare('DELETE FROM sessions WHERE token = ?').run(String(t)); } catch (e) {}
  }
  sendJson(res, 200, { ok: true });
}

function handleAuthMe(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  const users = kvGet('senai_users_data');
  const user = (Array.isArray(users) ? users : []).find(u => String(u.id) === String(ses.userId)) || null;
  sendJson(res, 200, { ok: true, user: publicUser(user), role: ses.role });
}

function keyAllowedFor(key, ses) {
  if (!key) return false;
  if (GLOBAL_WRITE_KEYS.has(key)) return true;
  if (ses.role === 'nacional') return true;
  const u = slugify(ses.unidadeId);
  if (!u) return false;
  return key.indexOf('__' + u + '__') !== -1 || key.endsWith('__' + u);
}

function handleDataGet(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  const all = kvAll();
  const data = {};
  for (const k of Object.keys(all)) {
    if (keyReadableFor(k, ses)) data[k] = all[k];
  }
  sendJson(res, 200, { ok: true, data: data, updatedAt: kvLatestUpdatedAt() });
}

function handleDataPut(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  readBody(req, 96).then(body => {
    const data = body && typeof body.data === 'object' ? body.data : null;
    if (!data) {
      sendJson(res, 400, { ok: false, error: 'Payload inválido: envie { data: { chave: valor } }.' });
      return;
    }
    const entries = Object.entries(data);
    const rejected = entries.filter(([k]) => !keyAllowedFor(k, ses)).map(([k]) => k);
    const allowed = entries.filter(([k]) => keyAllowedFor(k, ses));
    if (allowed.length === 0) {
      sendJson(res, 403, { ok: false, error: 'Nenhuma chave permitida para a sua unidade.', rejected: rejected });
      return;
    }
    const writeData = {};
    allowed.forEach(([k, v]) => { writeData[k] = v; });
    try {
      const updatedAt = kvUpsert(writeData);
      const backed = runBackup(false);
      if (rejected.length) {
        logAudit([{ papel: ses.role, usuario: ses.name, acao: 'sync-restrito', detalhe: allowed.length + ' gravada(s); rejeitadas ' + rejected.length + ': [' + rejected.join(', ') + ']' }]);
      } else {
        logAudit([{ papel: ses.role, usuario: ses.name, acao: 'sync', detalhe: allowed.length + ' chave(s) gravada(s)' }]);
      }
      sendJson(res, 200, { ok: true, keys: allowed.length, rejected: rejected.length ? rejected : undefined, updatedAt: updatedAt, backup: backed });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
  }).catch(err => {
    sendJson(res, err && err.status === 413 ? 413 : 400, { ok: false, error: err.message || 'JSON inválido.' });
  });
}

function handleDataUpload(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  readBody(req, 96).then(body => {
    const data = body && typeof body.data === 'object' ? body.data : null;
    if (!data || Object.keys(data).length === 0) {
      sendJson(res, 400, { ok: false, error: 'Nenhum dado para restaurar.' });
      return;
    }
    try {
      const updatedAt = kvUpsert(data);
      if (Array.isArray(body.log)) logAudit(body.log);
      runBackup(true);
      sendJson(res, 200, { ok: true, keys: Object.keys(data).length, updatedAt: updatedAt });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
  }).catch(() => sendJson(res, 400, { ok: false, error: 'JSON inválido.' }));
}

function handleDataDownload(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  const payload = { meta: { app: 'portal-docente-senai', dataVersion: 'v3', createdAt: new Date().toISOString(), origem: 'SQLite' }, data: kvAll() };
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="portal-backup.json"'
  });
  res.end(body);
}

function handleLogGet(req, res, url) {
  const u = new URL(url, 'http://localhost');
  const limit = Math.min(Math.max(Number(u.searchParams.get('limit')) || 100, 1), 500);
  const rows = db.prepare('SELECT * FROM log ORDER BY id DESC LIMIT ?').all(limit);
  sendJson(res, 200, { ok: true, entries: rows });
}

function handleLogPost(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  readBody(req, 4).then(body => {
    logAudit([{ papel: ses.role, usuario: ses.name, acao: body.acao, detalhe: body.detalhe }]);
    sendJson(res, 200, { ok: true });
  }).catch(() => sendJson(res, 400, { ok: false, error: 'JSON inválido.' }));
}

/* =========================================================================
 * REPOSITÓRIO NACIONAL DE MATERIAIS
 * Metadados/catálogo: vivem na tabela kv (sincronizados nacionalmente).
 * Anexos (arquivos): BLOB na tabela materiais, baixáveis por id.
 * ========================================================================= */

function handleMateriaisGet(res) {
  const rows = db.prepare('SELECT id, titulo, tipo, disciplina, curso, unidadeOrigem, unidadeNome, autor, anexoNome, anexoMime, tamanho, criadoEm, atualizadoEm FROM materiais ORDER BY atualizadoEm DESC').all();
  sendJson(res, 200, { ok: true, itens: rows });
}

function handleMateriaisPost(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  readBody(req, 96).then(body => {
    const id = String(body.id || '');
    const anexoB64 = String(body.anexo || '');
    if (!id || !anexoB64) {
      sendJson(res, 400, { ok: false, error: 'Envie id e anexo (base64).' });
      return;
    }
    let buf;
    try {
      buf = Buffer.from(anexoB64.includes(',') ? anexoB64.split(',')[1] : anexoB64, 'base64');
    } catch (e) {
      sendJson(res, 400, { ok: false, error: 'Anexo base64 inválido.' });
      return;
    }
    if (buf.length === 0) {
      sendJson(res, 400, { ok: false, error: 'Anexo vazio.' });
      return;
    }
    try {
      db.prepare(`
        INSERT INTO materiais (id, titulo, tipo, disciplina, curso, unidadeOrigem, unidadeNome, autor, anexoNome, anexoMime, anexo, tamanho, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          anexo = excluded.anexo, anexoNome = excluded.anexoNome,
          anexoMime = excluded.anexoMime, tamanho = excluded.tamanho,
          titulo = excluded.titulo, atualizadoEm = excluded.atualizadoEm
      `).run(
        id,
        String(body.titulo || '').slice(0, 300),
        String(body.tipo || 'link').slice(0, 40),
        String(body.disciplina || '').slice(0, 120),
        String(body.curso || '').slice(0, 120),
        String(body.unidadeOrigem || '').slice(0, 80),
        String(body.unidadeNome || '').slice(0, 160),
        String(body.autor || '').slice(0, 120),
        String(body.anexoNome || 'material').slice(0, 255),
        String(body.anexoMime || 'application/octet-stream').slice(0, 120),
        buf,
        buf.length,
        String(body.criadoEm || new Date().toISOString()),
        new Date().toISOString()
      );
      sendJson(res, 200, { ok: true, id: id, tamanho: buf.length });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
  }).catch(err => sendJson(res, err && err.status === 413 ? 413 : 400, { ok: false, error: err.message || 'JSON inválido.' }));
}

function handleMateriaisDelete(req, res, url) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  const resto = url.replace('/api/materiais/', '');
  const id = decodeURIComponent(resto.split('?')[0]);
  if (!id) {
    sendJson(res, 400, { ok: false, error: 'Informe o id.' });
    return;
  }
  const row = db.prepare('SELECT unidadeOrigem FROM materiais WHERE id = ?').get(String(id));
  if (!row) {
    sendJson(res, 404, { ok: false, error: 'Material não encontrado.' });
    return;
  }
  const dono = row.unidadeOrigem;
  const permitido = ses.role === 'coordenacao' || ses.role === 'nacional' ||
    (dono && slugify(ses.unidadeId) === slugify(dono));
  if (!permitido) {
    sendJson(res, 403, { ok: false, error: 'Sem permissão para excluir este material.' });
    return;
  }
  db.prepare('DELETE FROM materiais WHERE id = ?').run(String(id));
  logAudit([{ papel: ses.role, usuario: ses.name, acao: 'material-delete', detalhe: 'Excluiu material ' + id }]);
  sendJson(res, 200, { ok: true, id: id });
}

/* Limpa todos os dados operacionais (mantém usuários/senhas). Restrito à coordenação. */
function handleDataReset(req, res) {
  const ses = requireSession(req);
  if (!ses) {
    sendJson(res, 401, { ok: false, error: 'Não autenticado.' });
    return;
  }
  if (ses.role !== 'coordenacao' && ses.role !== 'nacional') {
    sendJson(res, 403, { ok: false, error: 'Somente coordenação pode apagar os dados.' });
    return;
  }
  try {
    const removed = db.prepare("DELETE FROM kv WHERE key != 'senai_users_data'").run().changes;
    db.prepare('DELETE FROM materiais').run();
    db.prepare('DELETE FROM log').run();
    db.prepare('DELETE FROM sessions').run();
    logAudit([{ papel: ses.role, usuario: ses.name, acao: 'reset', detalhe: removed + ' chave(s) apagadas' }]);
    sendJson(res, 200, { ok: true, removed: removed });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message });
  }
}

function handleMaterialDownload(req, res, url) {
  const resto = url.replace('/api/materiais/', '').replace(/\/download$/, '');
  const id = decodeURIComponent(resto.split('?')[0]);
  const row = db.prepare('SELECT anexo, anexoNome, anexoMime FROM materiais WHERE id = ?').get(String(id));
  if (!row || row.anexo == null || row.anexo.length === 0) {
    sendJson(res, 404, { ok: false, error: 'Anexo não encontrado.' });
    return;
  }
  const nome = String(row.anexoNome || 'material').replace(/["\\\r\n]/g, '');
  res.writeHead(200, {
    'Content-Type': row.anexoMime || 'application/octet-stream',
    'Content-Disposition': 'attachment; filename="' + nome + '"',
    'Content-Length': row.anexo.length,
    'Cache-Control': 'no-cache'
  });
  res.end(Buffer.from(row.anexo));
}

function seedMateriaisNacional() {
  const hoje = new Date().toISOString();
  const base = [
    { titulo: 'Apostila - CLP Siemens S7-1200', tipo: 'pdf', disciplina: 'Automação Industrial', curso: 'Técnico em Mecatrônica', tags: 'CLP, Siemens, programação', unidadeId: 'u-sp-sao-paulo', unidadeNome: 'SENAI - Campus Industrial', autor: 'Lucas Nogueira' },
    { titulo: 'Slides - Instalações Elétricas Prediais (Aulas 1-4)', tipo: 'apresentacao', disciplina: 'Instalações Elétricas Prediais', curso: 'Técnico em Eletrotécnica', tags: 'tomadas, circuitos, NBR', unidadeId: 'u-sp-sao-paulo', unidadeNome: 'SENAI - Campus Industrial', autor: 'Marina Duarte' },
    { titulo: 'Vídeo - Operação de Torno CNC', tipo: 'video', disciplina: 'Torno CNC & Fresagem', curso: 'Aprendizagem Industrial - Usinagem', tags: 'CNC, torno, usinagem', unidadeId: 'u-am-manaus', unidadeNome: 'SENAI Amazonas - Manaus', autor: 'Equipe Manaus' },
    { titulo: 'Plano de aula - Eletropneumática (12 aulas)', tipo: 'plano_de_aula', disciplina: 'Eletropneumática', curso: 'Técnico em Mecatrônica', tags: 'pneumática, eletroválvulas', unidadeId: 'u-es-vitoria', unidadeNome: 'SENAI Espírito Santo - Vitória', autor: 'Coordenação Vitória' },
    { titulo: 'Comandos elétricos - apostila completa (Drive)', tipo: 'link', disciplina: 'Instalações Elétricas Prediais', curso: 'Técnico em Eletrotécnica', tags: 'comandos, partida, drive', unidadeId: 'u-am-manaus', unidadeNome: 'SENAI Amazonas - Manaus', autor: 'Equipe Manaus' }
  ];
  const seed = base.map((s, i) => ({
    id: Date.now() * 1000 + i,
    titulo: s.titulo,
    tipo: s.tipo,
    disciplina: s.disciplina,
    curso: s.curso,
    tags: s.tags,
    unidadeOrigem: s.unidadeId,
    unidadeNome: s.unidadeNome,
    autor: s.autor,
    url: s.tipo === 'link' ? 'https://drive.google.com/' : '',
    anexoNome: '',
    anexoMime: '',
    anexo: null,
    tamanho: 0,
    status: 'aprovado',
    criadoEm: hoje,
    atualizadoEm: hoje,
    motivoRejeicao: ''
  }));
  const row = db.prepare("SELECT 1 FROM kv WHERE key = 'senai_materiais_data'").get();
  if (row) return 0;
  kvUpsert({ 'senai_materiais_data': seed });
  return seed.length;
}

function handleMateriaisSeed(res) {
  const row = db.prepare("SELECT 1 FROM kv WHERE key = 'senai_materiais_data'").get();
  if (row) {
    sendJson(res, 200, { ok: true, seeded: false });
    return;
  }
  const n = seedMateriaisNacional();
  sendJson(res, 200, { ok: true, seeded: true, count: n });
}

function buildSystemPrompt(context) {
  const ctx = context || {};
  const students = Array.isArray(ctx.students) ? ctx.students : [];

  const linhas = students.slice(0, 30).map(s => {
    const avs = Array.isArray(s.avaliacoes) && s.avaliacoes.length > 0
      ? s.avaliacoes.map(a => `${a.nome}:${a.nota}`).join(', ')
      : '';
    const obs = typeof s.observacoes === 'string' && s.observacoes.trim() ? s.observacoes.trim() : '';
    return `- ${s.name || '?'} | matrícula ${s.matricula || '-'} | bancada ${s.bancada || '-'} | frequência ${s.freq || 0}% | nota ${s.nota != null ? s.nota : 0} (0-100) | status: ${s.status === 'absent' ? 'AUSENTE hoje' : (s.status === 'late' ? 'ATRASADO hoje' : 'presente hoje')} | ${s.riskLabel || 'sem risco'}${avs ? ` | avaliações: ${avs}` : ''}${obs ? ` | observações: ${obs}` : ''}`;
  });

  const mediasAv = Array.isArray(ctx.mediaPorAvaliacao) && ctx.mediaPorAvaliacao.length > 0
    ? ctx.mediaPorAvaliacao.map(m => `${m.nome}: ${m.media != null ? m.media : 'n/d'} (peso ${Math.round((m.peso || 0) * 100)}%)`).join(', ')
    : '';

  const aulaHoje = ctx.aulaHoje
    ? `Aula de hoje: ${ctx.aulaHoje.tema || 'sem tema'} | presentes: ${(ctx.aulaHoje.presenteIds || []).length}` + (ctx.aulaHoje.rascunho ? ' (chamada em andamento)' : '')
    : 'Aula de hoje: ainda não registrada';

  const aulasRecentes = Array.isArray(ctx.aulasRecentes) && ctx.aulasRecentes.length > 0
    ? ctx.aulasRecentes.map(a => `- ${a.date} | ${a.tema || 'sem tema'} | pres: ${a.presentes}, aus: ${a.ausentes}${a.rascunho ? ' (rascunho)' : ''}`).join('\n')
    : '';

  const ocorrencias = Array.isArray(ctx.ocorrenciasRecentes) && ctx.ocorrenciasRecentes.length > 0
    ? ctx.ocorrenciasRecentes.map(o => `- ${o.date.slice(0, 10)} | ${o.aluno} | ${o.tipo} | ${o.severidade} | ${o.status}`).join('\n')
    : '';

  const reservas = Array.isArray(ctx.proximasReservas) && ctx.proximasReservas.length > 0
    ? ctx.proximasReservas.map(r => `- ${r.date} ${r.inicio || ''}-${r.fim || ''} | ${r.titulo || ''}`).join('\n')
    : '';

  const materiais = Array.isArray(ctx.materiais) && ctx.materiais.length > 0
    ? ctx.materiais.map(m => `- ${m.titulo || ''} (${m.tipo || ''}${m.autor ? ' | autor: ' + m.autor : ''}${m.unidade ? ' | ' + m.unidade : ''})${m.disciplina && m.disciplina !== 'Geral' ? ' | ' + m.disciplina : ''}`).join('\n')
    : '';

  const resumo = [
    `Turma: ${ctx.turma || '-'} (atual)`,
    `Curso: ${ctx.curso || '-'}`,
    `Disciplina: ${ctx.disciplina || '-'}`,
    `Turno: ${ctx.turno || '-'} | Carga horária: ${ctx.cargaHoraria || '-'}`,
    `Oficina: ${ctx.oficina || '-'}`,
    `Professor(a): ${ctx.professor || '-'}`,
    ctx.subturma ? `Subturma ativa: ${ctx.subturma} (${ctx.alunosNaSubturma || students.length} alunos — dados abaixo referem-se SOMENTE a este grupo)` : '',
    `Total de alunos: ${ctx.total || students.length}`,
    `Presentes hoje: ${ctx.presentes || 0}`,
    `Atrasados hoje: ${ctx.atrasados || 0}`,
    `Ausentes hoje: ${ctx.ausentes || 0}`,
    `Média da turma (0-100): ${ctx.media || 0}`,
    mediasAv ? `Média por avaliação: ${mediasAv}` : '',
    `Alunos em risco alto: ${ctx.riscoAlto || 0}`,
    `Alunos em risco médio: ${ctx.riscoMedio || 0}`,
    aulaHoje
  ].filter(Boolean).join('\n');

  const extras = [
    aulasRecentes ? '\n== AULAS RECENTES ==\n' + aulasRecentes : '',
    ocorrencias ? '\n== OCORRÊNCIAS RECENTES ==\n' + ocorrencias : '',
    reservas ? '\n== PRÓXIMAS RESERVAS ==\n' + reservas : '',
    materiais ? '\n== MATERIAIS DIDÁTICOS DO REPOSITÓRIO (USAR PARA RECOMENDAR CONTEÚDOS) ==\n' + materiais : ''
  ].filter(Boolean).join('\n');

  return [
    'Você é o assistente inteligente do "Portal do Docente SENAI", um sistema de apoio ao professor.',
    'Responda SEMPRE em português do Brasil, de forma clara, objetiva e didática.',
    'Use EXCLUSIVAMENTE os dados da turma fornecidos abaixo. NUNCA invente nomes, notas, frequências ou números.',
    'Responda APENAS à pergunta atual do usuário. NÃO repita informações que já foram apresentadas na própria pergunta, no contexto ou em respostas anteriores da conversa.',
    'NÃO enumere nem liste os alunos do contexto a menos que a pergunta peça explicitamente uma lista de nomes.',
    'Se a pergunta pedir algo que os dados não cobrem, diga que não encontrou essa informação e sugira uma alternativa.',
    'Para listas, prefira tabelas simples ou listas com marcadores. Seja conciso (máx. ~200 palavras).',
    '',
    '==== DADOS DA TURMA ====',
    resumo,
    extras,
    '',
    '==== ALUNOS ====',
    linhas.length > 0 ? linhas.join('\n') : '(sem alunos cadastrados)',
    '',
    '==== TAREFA ===='
  ].join('\n');
}

function handleStatus(res) {
  const start = Date.now();
  const req = http.request(`${OLLAMA_HOST}/api/tags`, { method: 'GET', timeout: 3000 }, r => {
    let body = '';
    r.on('data', c => (body += c));
    r.on('end', () => {
      let models = [];
      try {
        const parsed = JSON.parse(body);
        models = (parsed.models || []).map(m => m.name);
      } catch (e) {}
      const hasModel = models.some(m => m === DEFAULT_MODEL || m.startsWith(DEFAULT_MODEL + ':'));
      sendJson(res, 200, {
        ok: true,
        ollama: true,
        model: hasModel ? DEFAULT_MODEL : (models[0] || null),
        modelReady: hasModel,
        models: models,
        latencyMs: Date.now() - start
      });
    });
  });
  req.on('timeout', () => { req.destroy(); });
  req.on('error', () => {
    sendJson(res, 200, { ok: false, ollama: false, model: null, modelReady: false, models: [], latencyMs: Date.now() - start });
  });
  req.end();
}

function handleChat(req, res) {
  readBody(req).then(body => {
    const model = String(body.model || DEFAULT_MODEL);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      sendJson(res, 400, { error: 'Nenhuma mensagem enviada.' });
      return;
    }

    const system = { role: 'system', content: buildSystemPrompt(body.context) };
    const payload = JSON.stringify({
      model: model,
      stream: true,
      keep_alive: '1h',
      options: {
        num_ctx: 8192,
        num_predict: 512,
        temperature: 0.7,
        repeat_penalty: 1.15,
        top_k: 40,
        top_p: 0.9
      },
      messages: [system].concat(messages.slice(-8))
    });

    let headersSent = false;
    const safeWrite = (chunk) => {
      if (!headersSent || res.writableEnded || res.destroyed) return;
      try { res.write(chunk); } catch (e) { /* cliente desconectou */ }
    };
    const safeEnd = () => {
      if (!res.writableEnded && !res.destroyed) {
        try { res.end(); } catch (e) {}
      }
    };

    const up = http.request(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, r => {
      if (r.statusCode && r.statusCode >= 400) {
        let err = '';
        r.on('data', c => (err += c));
        r.on('end', () => sendJson(res, 502, { error: 'Ollama retornou erro: ' + err }));
        return;
      }
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      let buffer = '';
      r.on('data', chunk => {
        if (res.destroyed) { up.destroy(); return; }
        if (!dataReceived) {
          dataReceived = true;
          up.setTimeout(600000, onTimeout);
        }
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(line => {
          const t = line.trim();
          if (!t) return;
          let parsed;
          try { parsed = JSON.parse(t); } catch (e) { return; }
          const delta = parsed.message && parsed.message.content ? parsed.message.content : '';
          const done = parsed.done === true;
          safeWrite(`data: ${JSON.stringify({ text: delta, done: done })}\n\n`);
          if (done) safeEnd();
        });
      });
      r.on('end', () => safeEnd());
      r.on('error', () => safeEnd());
    });

    // Cliente fechou a página no meio do stream: aborta o Ollama para não deixar pendência.
    res.on('close', () => { try { up.destroy(); } catch (e) {} });
    res.on('error', () => { try { up.destroy(); } catch (e) {} });

    let timedOut = false;
    let dataReceived = false;
    const onTimeout = () => {
      timedOut = true;
      try { up.destroy(); } catch (e) {}
      if (!dataReceived && !headersSent) {
        sendJson(res, 503, { error: 'O Ollama não respondeu em tempo hábil. Verifique se ele está em execução.' });
      } else {
        safeEnd();
      }
    };
    up.on('error', () => {
      if (!headersSent) {
        sendJson(res, 503, { error: 'Não foi possível conectar ao Ollama em ' + OLLAMA_HOST + '. Verifique se ele está instalado e em execução.' });
      } else {
        safeEnd();
      }
    });
    // 30s para o primeiro byte; após a primeira resposta o stream segue (total 10 min).
    up.setTimeout(30000, onTimeout);
    up.end(payload);
  }).catch(err => {
    sendJson(res, 400, { error: 'JSON inválido no corpo da requisição.' });
  });
}

function handlePull(res) {
  // Baixa o modelo padrão via Ollama (POST /api/pull). Opcional/sob demanda.
  const payload = JSON.stringify({ model: DEFAULT_MODEL, stream: false });
  const up = http.request(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, r => {
    let body = '';
    r.on('data', c => (body += c));
    r.on('end', () => {
      const ok = r.statusCode && r.statusCode >= 200 && r.statusCode < 400;
      sendJson(res, ok ? 200 : 502, {
        ok: ok,
        error: ok ? undefined : (body && body.slice(0, 200)) || 'Erro ao baixar o modelo.'
      });
    });
  });
  up.on('error', () => {
    sendJson(res, 503, { ok: false, error: 'Não foi possível conectar ao Ollama em ' + OLLAMA_HOST + '. Verifique se ele está instalado e em execução.' });
  });
  up.setTimeout(1200000, () => up.destroy());
  up.end(payload);
}

/* =========================================================================
 * GOOGLE CLASSROOM (integração opcional via OAuth 2.0)
 *  - Só ativa se houver credenciais (classroom-config.json ou env).
 *  - Sem credenciais: /api/classroom/status devolve { configured: false }
 *    e o front mantém o feed simulado local.
 * ========================================================================= */

const CLASSROOM_CFG_PATH = process.env.CLASSROOM_CONFIG_PATH || path.join(ROOT, 'classroom-config.json');
const CLASSROOM_TOKENS_PATH = process.env.CLASSROOM_TOKENS_PATH || path.join(ROOT, 'classroom-tokens.json');

function loadClassroomConfig() {
  try {
    if (fs.existsSync(CLASSROOM_CFG_PATH)) {
      const raw = fs.readFileSync(CLASSROOM_CFG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Classroom] Erro ao ler classroom-config.json:', e.message);
  }
  const id = process.env.GCLOUD_CLIENT_ID;
  const secret = process.env.GCLOUD_CLIENT_SECRET;
  if (id && secret) {
    return {
      clientId: id,
      clientSecret: secret,
      redirectUri: process.env.GCLOUD_REDIRECT_URI || `http://localhost:${PORT}/classroom/oauth2callback`
    };
  }
  return null;
}

function loadClassroomTokens() {
  try {
    if (!fs.existsSync(CLASSROOM_TOKENS_PATH)) return null;
    return JSON.parse(fs.readFileSync(CLASSROOM_TOKENS_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveClassroomTokens(tokens) {
  fs.writeFileSync(CLASSROOM_TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
}

let classroomTokens = loadClassroomTokens();

function classroomStatusPayload() {
  const cfg = loadClassroomConfig();
  if (!cfg) return { ok: true, configured: false, connected: false, refreshToken: false };
  const hasRefresh = !!(classroomTokens && classroomTokens.refresh_token);
  return { ok: true, configured: true, connected: hasRefresh, refreshToken: hasRefresh };
}

function classroomAuthUrlPayload() {
  const cfg = loadClassroomConfig();
  if (!cfg) return { ok: true, configured: false };
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly'
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  return { ok: true, configured: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString() };
}

async function exchangeCode(code) {
  const cfg = loadClassroomConfig();
  if (!cfg) throw new Error('Classroom não configurado.');
  const body = new URLSearchParams({
    code: code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.error || 'Falha ao trocar o código OAuth.');
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || (classroomTokens && classroomTokens.refresh_token),
    expires_at: Date.now() + Math.max(Number(data.expires_in || 3600), 60) * 1000
  };
  classroomTokens = tokens;
  saveClassroomTokens(tokens);
}

async function refreshClassroomToken() {
  const cfg = loadClassroomConfig();
  if (!cfg) return false;
  const old = classroomTokens;
  if (!old || !old.refresh_token) return false;
  const body = new URLSearchParams({
    refresh_token: old.refresh_token,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) return false;
  classroomTokens = {
    access_token: data.access_token,
    refresh_token: old.refresh_token,
    expires_at: Date.now() + Math.max(Number(data.expires_in || 3600), 60) * 1000
  };
  saveClassroomTokens(classroomTokens);
  return true;
}

async function classroomApi(path) {
  const cfg = loadClassroomConfig();
  if (!cfg) return Promise.reject(Object.assign(new Error('Classroom não configurado.'), { status: 503, code: 'not_configured' }));
  if (!classroomTokens || !classroomTokens.access_token || !classroomTokens.refresh_token) {
    return Promise.reject(Object.assign(new Error('Não conectado ao Google Classroom.'), { status: 401, code: 'not_connected' }));
  }

  const tokenOk = classroomTokens.expires_at > Date.now() + 60000;
  if (!tokenOk) {
    const ok = await refreshClassroomToken();
    if (!ok) return Promise.reject(Object.assign(new Error('Sessão do Google expirada. Reconecte.'), { status: 401, code: 'expired' }));
  }

  let r = await fetch('https://classroom.googleapis.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + classroomTokens.access_token }
  });

  if (r.status === 401) {
    const ok = await refreshClassroomToken();
    if (ok) {
      r = await fetch('https://classroom.googleapis.com/v1' + path, {
        headers: { Authorization: 'Bearer ' + classroomTokens.access_token }
      });
    }
  }

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = Object.assign(new Error((data.error && data.error.message) || ('Google Classroom (HTTP ' + r.status + ')')), { status: r.status });
    throw err;
  }
  return data;
}

/* --- Handler: callback OAuth (troca o code por tokens e redireciona) --- */
function handleClassroomCallback(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const code = u.searchParams.get('code');
  const error = u.searchParams.get('error');
  const redirectTo = '/pages/configuracao.html?classroom=';

  if (error) {
    res.writeHead(302, { Location: redirectTo + 'error' });
    res.end();
    return;
  }
  if (!code) {
    res.writeHead(302, { Location: redirectTo + 'error' });
    res.end();
    return;
  }

  exchangeCode(code)
    .then(() => {
      res.writeHead(302, { Location: redirectTo + 'connected' });
      res.end();
    })
    .catch(() => {
      res.writeHead(302, { Location: redirectTo + 'error' });
      res.end();
    });
}

/* --- Handler: lista de cursos da conta --- */
function handleClassroomCourses(res) {
  classroomApi('/courses?pageSize=100&courseStates=ACTIVE')
    .then(data => sendJson(res, 200, { ok: true, courses: (data.courses || []) }))
    .catch(err => sendJson(res, 200, { ok: false, error: err.message }));
}

/* --- Handler: atividades (feed) de um curso --- */
function handleClassroomFeed(req, res, query) {
  const courseId = (query.get('courseId') || '').trim();
  if (!courseId) {
    sendJson(res, 400, { ok: false, error: 'Informe courseId.' });
    return;
  }
  classroomApi(`/courses/${encodeURIComponent(courseId)}/courseWork?courseWorkStates=PUBLISHED&pageSize=20&orderBy=updateTime%20desc`)
    .then(data => {
      const posts = (data.courseWork || []).map(cw => ({
        id: cw.id,
        title: cw.title || 'Atividade',
        description: (cw.description || '').toString().slice(0, 500),
        createdAt: cw.creationTime || null,
        maxPoints: cw.maxPoints != null ? Number(cw.maxPoints) : null,
        dueDate: cw.dueDate
          ? `${String(cw.dueDate.year).padStart(4, '0')}-${String(cw.dueDate.month).padStart(2, '0')}-${String(cw.dueDate.day).padStart(2, '0')}`
          : null,
        submitted: cw.totalSubmissions || 0,
        missing: cw.assignmentSubmission && cw.assignmentSubmission.totalCount != null ? cw.assignmentSubmission.totalCount : null
      }));
      sendJson(res, 200, { ok: true, posts: posts });
    })
    .catch(err => sendJson(res, 200, { ok: false, error: err.message }));
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url;
  const method = req.method;
  const url = req.url.split('?')[0];

  // Restringe Access-Control-Allow-Origin em todas as respostas (mesma origem / CORS_ORIGIN).
  const resWriteHead = res.writeHead.bind(res);
  res.writeHead = (statusCode, headers, ...rest) => {
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      const origin = corsOrigin(req);
      if (origin) headers['Access-Control-Allow-Origin'] = origin;
      else delete headers['Access-Control-Allow-Origin'];
    }
    return resWriteHead(statusCode, headers, ...rest);
  };

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (url === '/api/auth/login' && method === 'POST') { handleAuthLogin(req, res); return; }
  if (url === '/api/auth/logout' && method === 'POST') { handleAuthLogout(req, res); return; }
  if (url === '/api/auth/me' && method === 'GET') { handleAuthMe(req, res); return; }

  if (url === '/api/data' && method === 'GET') { handleDataGet(req, res); return; }
  if (url === '/api/data' && method === 'PUT') { handleDataPut(req, res); return; }
  if (url === '/api/data/download' && method === 'GET') { handleDataDownload(req, res); return; }
  if (url === '/api/data/upload' && method === 'POST') { handleDataUpload(req, res); return; }
  if (url === '/api/data/backups' && method === 'GET') { sendJson(res, 200, { ok: true, backups: listBackups() }); return; }
  if (url === '/api/data/backup' && method === 'POST') { sendJson(res, 200, { ok: true, backup: runBackup(true) }); return; }
  if (url === '/api/data/reset' && method === 'POST') { handleDataReset(req, res); return; }
  if (url === '/api/log' && method === 'GET') { handleLogGet(req, res, rawUrl); return; }
  if (url === '/api/log' && method === 'POST') { handleLogPost(req, res); return; }

  if (url === '/api/materiais' && method === 'GET') { handleMateriaisGet(res); return; }
  if (url === '/api/materiais' && method === 'POST') { handleMateriaisPost(req, res); return; }
  if (url === '/api/materiais/seed' && method === 'POST') { handleMateriaisSeed(res); return; }
  if (url.indexOf('/api/materiais/') === 0) {
    const resto = url.replace('/api/materiais/', '');
    if (resto.endsWith('/download') && resto.length > 9 && method === 'GET') { handleMaterialDownload(req, res, url); return; }
    if (resto.length > 0 && method === 'DELETE') { handleMateriaisDelete(req, res, url); return; }
  }

  if (url === '/api/ollama/status' && method === 'GET') {
    handleStatus(res);
    return;
  }
  if (url === '/api/ai/chat' && method === 'POST') {
    handleChat(req, res);
    return;
  }
  if (url === '/api/ai/pull' && method === 'POST') {
    handlePull(res);
    return;
  }
  if (url === '/api/health') {
    sendJson(res, 200, { ok: true, app: 'portal-docente-senai' });
    return;
  }
  if (url === '/classroom/oauth2callback' && method === 'GET') {
    handleClassroomCallback(req, res);
    return;
  }
  if (url === '/api/classroom/status' && method === 'GET') {
    sendJson(res, 200, classroomStatusPayload());
    return;
  }
  if (url === '/api/classroom/auth-url' && method === 'POST') {
    sendJson(res, 200, classroomAuthUrlPayload());
    return;
  }
  if (url === '/api/classroom/revoke' && method === 'POST') {
    classroomTokens = null;
    try { if (fs.existsSync(CLASSROOM_TOKENS_PATH)) fs.unlinkSync(CLASSROOM_TOKENS_PATH); } catch (e) {}
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url === '/api/classroom/courses' && method === 'GET') {
    handleClassroomCourses(res);
    return;
  }
  if (url === '/api/classroom/feed' && method === 'GET') {
    handleClassroomFeed(req, res, new URL(rawUrl, 'http://localhost').searchParams);
    return;
  }
  if (url.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Endpoint não encontrado.' });
    return;
  }

  serveStatic(req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERRO] A porta ${PORT} já está em uso.`);
    console.error('Encerre o servidor anterior (ex.: python http.server) e rode novamente: node server.js\n');
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  try {
    seedServerUsers();
    console.log('[auth] base de usuários verificada.');
  } catch (e) {
    console.log('[auth] seed de usuários ignorado: ' + e.message);
  }
  try {
    const seeded = seedMateriaisNacional();
    if (seeded > 0) console.log(`[materiais] catálogo nacional semeado (${seeded} itens).`);
  } catch (e) {
    console.log('[materiais] seed ignorado: ' + e.message);
  }
  console.log('┌───────────────────────────────────────────────────┐');
  console.log('│  PORTAL DO DOCENTE SENAI - servidor local        │');
  console.log('│  Acesse: http://localhost:' + PORT + '                   │');
  console.log('│  Ollama: ' + OLLAMA_HOST + '          │');
  try {
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal);
    if (ips.length) {
      console.log('│  Na rede (outros aparelhos):                    │');
      for (const i of ips) console.log('│    http://' + i.address + ':' + PORT + '           │');
    }
  } catch (e) {}
  console.log('└───────────────────────────────────────────────────┘');
});