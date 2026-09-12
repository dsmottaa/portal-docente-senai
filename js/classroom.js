/**
 * SEM_CLASSROOM - Cliente do Google Classroom (proxy local /api/classroom/*).
 * Sem credenciais configuradas, status() devolve configured:false
 * e o restante do portal mantém o feed simulado local.
 */
window.SENAI_Classroom = (() => {
  const MAP_KEY = 'senai_classroom_map';

  function loadMap() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMap(m) {
    localStorage.setItem(MAP_KEY, JSON.stringify(m));
  }

  async function status() {
    try {
      const r = await fetch('/api/classroom/status', { cache: 'no-store' });
      return await r.json();
    } catch (e) {
      return { ok: false, configured: false, connected: false };
    }
  }

  async function authUrl() {
    try {
      const r = await fetch('/api/classroom/auth-url', { method: 'POST' });
      const d = await r.json();
      return d.url || null;
    } catch (e) {
      return null;
    }
  }

  async function revoke() {
    await fetch('/api/classroom/revoke', { method: 'POST' }).catch(() => {});
  }

  async function courses() {
    try {
      const r = await fetch('/api/classroom/courses');
      const d = await r.json();
      return d.ok ? (d.courses || []) : [];
    } catch (e) {
      return [];
    }
  }

  async function feed(courseId) {
    const r = await fetch('/api/classroom/feed?courseId=' + encodeURIComponent(courseId));
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Erro ao buscar atividades do Classroom.');
    return d.posts || [];
  }

  function mappingFor(turmaCode) {
    if (!turmaCode) return null;
    const m = loadMap();
    return m[String(turmaCode)] || null;
  }

  function setMapping(turmaCode, course) {
    if (!turmaCode) return;
    const m = loadMap();
    m[String(turmaCode)] = { id: course.id, name: course.name };
    saveMap(m);
  }

  function clearMapping(turmaCode) {
    const m = loadMap();
    delete m[String(turmaCode)];
    saveMap(m);
  }

  async function autoMatch(turmaCode, fallbackName) {
    const list = await courses();
    if (!list.length) return null;
    const code = String(turmaCode || '').toUpperCase();
    const fb = String(fallbackName || '').toUpperCase();
    let found = null;
    if (code) found = list.find(c => c.name && c.name.toUpperCase().includes(code));
    if (!found && fb) found = list.find(c => c.name && c.name.toUpperCase().includes(fb));
    return found || null;
  }

  async function effectiveCourse(turmaCode, fallbackName) {
    const mapped = mappingFor(turmaCode);
    if (mapped && mapped.id) return mapped;
    const auto = await autoMatch(turmaCode, fallbackName);
    if (auto) {
      setMapping(turmaCode, { id: auto.id, name: auto.name });
      return { id: auto.id, name: auto.name };
    }
    return null;
  }

  return {
    status: status,
    authUrl: authUrl,
    revoke: revoke,
    courses: courses,
    feed: feed,
    loadMap: loadMap,
    mappingFor: mappingFor,
    setMapping: setMapping,
    clearMapping: clearMapping,
    autoMatch: autoMatch,
    effectiveCourse: effectiveCourse
  };
})();