/**
 * DATA.JS - MÓDULO COMPARTILHADO PORTAL DO DOCENTE SENAI (v3)
 * Base de dados em localStorage com:
 *  - Alunos + múltiplas avaliações com pesos (média 0-100)
 *  - Chamada com histórico por data (frequência computada)
 *  - Ocorrências e Diário de conteúdo
 *  - Usuários (professor/coordenação) com senha com hash (SHA-256)
 *  - Configurações de unidade/turma e template de avaliações
 *  - Backup / restauração completa
 */

const SENAI_STUDENTS_KEY = 'senai_students_data';
const SENAI_DATA_VERSION = 'v3-avaliacoes';
const SENAI_DIARIO_KEY = 'senai_diario_data';
const SENAI_OCORRENCIAS_KEY = 'senai_ocorrencias_data';
const SENAI_AULAS_KEY = 'senai_aulas_data';
const SENAI_USERS_KEY = 'senai_users_data';
const SENAI_CONFIG_KEY = 'senai_config_data';
const SENAI_SESSION_KEY = 'senai_user_session';
const SENAI_BACKUP_KEY = 'senai_backup_data';
const SENAI_RESERVAS_KEY = 'senai_reservas_data';
const SENAI_SUBTURMAS_KEY = 'senai_subturmas_data';
const SENAI_SUBTURMA_ACTIVE_KEY = 'senai_subturma_ativa';
const SENAI_CLASSROOM_KEY = 'senai_classroom_data';

/* Matérias lecionadas pelo professor (fonte única de seleção da Turma Virtual) */
const SENAI_MATERIAS = [
  { turma: 'TEC-MEC-21', disciplina: 'Automação Industrial', oficina: 'Oficina 2 (Bancada A)', turno: 'MANHÃ', curso: 'Técnico em Mecatrônica', alunos: 35 },
  { turma: 'TEC-ELETRO-14', disciplina: 'Instalações Elétricas Prediais', oficina: 'Laboratório de Elétrica B', turno: 'TARDE', curso: 'Técnico em Eletrotécnica', alunos: 28 },
  { turma: 'APRENDIZ-USIN-08', disciplina: 'Torno CNC & Fresagem', oficina: 'Oficina Mecânica CNC', turno: 'NOITE', curso: 'Aprendizagem Industrial - Usinagem', alunos: 22 }
];

const DEFAULT_CONFIG = {
unidade: 'SENAI - Campus Industrial',
  unidadeId: 'u-sp-sao-paulo',
  curso: 'Técnico em Mecatrônica',
  turma: 'TEC-MEC-21',
  disciplina: 'Automação Industrial',
  turno: 'MANHÃ',
  oficina: 'Oficina 2 (Bancada A)',
  cargaHoraria: '04H',
  avaliacoesTemplate: [
    { nome: 'AV1', peso: 0.3 },
    { nome: 'AV2', peso: 0.3 },
    { nome: 'PRÁTICA', peso: 0.4 }
  ]
};

const DEFAULT_USERS = [
  { name: 'Lucas Nogueira', login: '123.456.789-00', cpf: '123.456.789-00', role: 'professor', matricula: 'DOC-84091', curso: 'Técnico em Mecatrônica', unidade: 'SENAI - Campus Industrial', unidadeId: 'u-sp-sao-paulo', passwordPlain: 'senai2026' },
  { name: 'Marina Duarte', login: 'coord.senai', cpf: '987.654.321-00', role: 'coordenacao', matricula: 'COORD-001', curso: 'Coordenação Acadêmica', unidade: 'SENAI - Campus Industrial', unidadeId: 'u-sp-sao-paulo', passwordPlain: 'coordenador2026' }
];

/* Unidades SENAI de demonstração (visão nacional) */
const SENAI_UNIDADES = [
  { id: 'u-sp-sao-paulo', sigla: 'SP', cidade: 'São Paulo', nome: 'SENAI - Campus Industrial' },
  { id: 'u-am-manaus', sigla: 'AM', cidade: 'Manaus', nome: 'SENAI Amazonas - Manaus' },
  { id: 'u-es-vitoria', sigla: 'ES', cidade: 'Vitória', nome: 'SENAI Espírito Santo - Vitória' }
];

const SENAI_CATALOGO_UNIDADES_KEY = 'senai_catalogo_unidades';
const SENAI_CATALOGO_TURMAS_KEY = 'senai_catalogo_turmas';

function SENAI_loadUnidades() {
  try {
    const raw = localStorage.getItem(SENAI_CATALOGO_UNIDADES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) {}
  return SENAI_UNIDADES;
}

function SENAI_loadCatalogoTurmas() {
  try {
    const raw = localStorage.getItem(SENAI_CATALOGO_TURMAS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) {}
  return SENAI_MATERIAS;
}

const STUDENTS_INITIAL = [
  { id: 1, bancada: '04', name: 'Gabriel Silva Moreira', matricula: '2026.0142', freq: 96, nota: 95, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'GM' },
  { id: 2, bancada: '02', name: 'Beatriz Helena Castro', matricula: '2026.0189', freq: 100, nota: 100, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'BC' },
  { id: 3, bancada: '06', name: 'Carlos Eduardo Lima', matricula: '2026.0094', freq: 72, nota: 60, risk: 'high', riskLabel: 'Risco Alto', status: 'absent', avatar: 'CL', observacoes: 'Dificuldade para interpretar esquemas elétricos. Encaminhado para reforço e monitoria nas aulas práticas.' },
  { id: 4, bancada: '01', name: 'Mariana Rocha Santos', matricula: '2026.0231', freq: 98, nota: 98, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'MS' },
  { id: 5, bancada: '05', name: 'Rodrigo Mendes Paiva', matricula: '2026.0155', freq: 84, nota: 78, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'RF' },
  { id: 6, bancada: '03', name: 'Juliana Albuquerque', matricula: '2026.0310', freq: 92, nota: 89, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'JA' },
  { id: 7, bancada: '08', name: 'Thiago Pinheiro Vaz', matricula: '2026.0078', freq: 75, nota: 70, risk: 'high', riskLabel: 'Risco Alto', status: 'absent', avatar: 'TP', observacoes: 'Faltas recorrentes às sextas-feiras. Responsável contatado; manter acompanhamento semanal de presença.' },
  { id: 8, bancada: '07', name: 'Lucas Ferreira Diniz', matricula: '2026.0244', freq: 91, nota: 84, risk: 'low', riskLabel: 'Risco Baixo', status: 'late', avatar: 'LD' },
  { id: 9, bancada: '09', name: 'Amanda Carvalho Souza', matricula: '2026.0112', freq: 94, nota: 91, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'AC', observacoes: 'Ótimo desempenho; demonstra interesse em projetos de robótica industrial.' },
  { id: 10, bancada: '10', name: 'Bruno Henrique Martins', matricula: '2026.0167', freq: 88, nota: 80, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'BM' },
  { id: 11, bancada: '11', name: 'Camila Nogueira Duarte', matricula: '2026.0205', freq: 97, nota: 96, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'CN' },
  { id: 12, bancada: '12', name: 'Diego Ramos Fagundes', matricula: '2026.0089', freq: 70, nota: 58, risk: 'high', riskLabel: 'Risco Alto', status: 'absent', avatar: 'DR' },
  { id: 13, bancada: '13', name: 'Eduarda Vasconcelos', matricula: '2026.0298', freq: 95, nota: 93, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'EV' },
  { id: 14, bancada: '14', name: 'Felipe Augusto Antunes', matricula: '2026.0178', freq: 90, nota: 87, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'FA' },
  { id: 15, bancada: '15', name: 'Gustavo Henrique Pires', matricula: '2026.0123', freq: 82, nota: 75, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'GH' },
  { id: 16, bancada: '16', name: 'Helena Ribeiro Fontes', matricula: '2026.0345', freq: 99, nota: 100, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'HR' },
  { id: 17, bancada: '17', name: 'Igor Matheus Camargo', matricula: '2026.0065', freq: 73, nota: 62, risk: 'high', riskLabel: 'Risco Alto', status: 'absent', avatar: 'IM' },
  { id: 18, bancada: '18', name: 'Jéssica Miranda Faria', matricula: '2026.0211', freq: 93, nota: 88, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'JM' },
  { id: 19, bancada: '19', name: 'Leonardo Siqueira Rios', matricula: '2026.0184', freq: 89, nota: 83, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'LS' },
  { id: 20, bancada: '20', name: 'Manuela Gomes Barreto', matricula: '2026.0276', freq: 96, nota: 94, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'MG' },
  { id: 21, bancada: '21', name: 'Nicolas Dias Medeiros', matricula: '2026.0150', freq: 91, nota: 85, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'ND' },
  { id: 22, bancada: '22', name: 'Otávio Borges Toledo', matricula: '2026.0229', freq: 94, nota: 90, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'OB' },
  { id: 23, bancada: '23', name: 'Patricia Lemos Vieira', matricula: '2026.0304', freq: 98, nota: 99, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'PL' },
  { id: 24, bancada: '24', name: 'Renan Cunha Rezende', matricula: '2026.0135', freq: 85, nota: 79, risk: 'medium', riskLabel: 'Risco Médio', status: 'late', avatar: 'RC' },
  { id: 25, bancada: '25', name: 'Sabrina Xavier Prado', matricula: '2026.0261', freq: 97, nota: 97, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'SX' },
  { id: 26, bancada: '26', name: 'Talita Peixoto Franco', matricula: '2026.0199', freq: 92, nota: 86, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'TP' },
  { id: 27, bancada: '27', name: 'Vinicius Brandão Maia', matricula: '2026.0160', freq: 89, nota: 81, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'VB' },
  { id: 28, bancada: '28', name: 'Yasmin Ferraz Braga', matricula: '2026.0333', freq: 95, nota: 92, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'YF' },
  { id: 29, bancada: '29', name: 'Arthur Belchior Cruz', matricula: '2026.0108', freq: 93, nota: 89, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'AB' },
  { id: 30, bancada: '30', name: 'Bianca Fonseca Leite', matricula: '2026.0287', freq: 98, nota: 98, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'BF' },
  { id: 31, bancada: '31', name: 'Caio Roberto Esteves', matricula: '2026.0149', freq: 86, nota: 80, risk: 'medium', riskLabel: 'Risco Médio', status: 'present', avatar: 'CR' },
  { id: 32, bancada: '32', name: 'Débora Silveira Luz', matricula: '2026.0252', freq: 96, nota: 95, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'DS' },
  { id: 33, bancada: '33', name: 'Enzo Gabriel Tavares', matricula: '2026.0175', freq: 91, nota: 87, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'EG' },
  { id: 34, bancada: '34', name: 'Fernanda Teles Melo', matricula: '2026.0318', freq: 99, nota: 100, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'FT' },
  { id: 35, bancada: '35', name: 'Guilherme Neves Brito', matricula: '2026.0201', freq: 94, nota: 90, risk: 'low', riskLabel: 'Risco Baixo', status: 'present', avatar: 'GN' }
];

/* ───────────────────────── Helpers genéricos ───────────────────────── */

function SENAI_uid() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function SENAI_clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function SENAI_todayKey(d) {
  d = d || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function SENAI_clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function SENAI_resizeImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '')) {
      reject(new Error('Selecione um arquivo de imagem.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = Number(maxSide) || 300;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.85));
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function SENAI_initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length === 0) return '..';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─────────────────────── Escopo multi-unidade (v5) ─────────────────────── */
/*
 * A partir da versão v5 os dados (alunos, chamadas, ocorrências e reservas)
 * são armazenados por unidade + turma, em chaves do tipo "<base>__<unidade>__<turma>".
 * A cada troca de unidade/turma na Central, as páginas passam a ler/gravar o
 * conjunto de dados da unidade e turma ativas. Chaves antigas (só por turma ou
 * sem sufixo) continuam funcionando: são migradas automaticamente na leitura.
 */

function SENAI_turmaSlug() {
  const cfg = SENAI_loadConfig();
  return String(cfg.turma || 'GERAL').trim().replace(/[^A-Za-z0-9]+/g, '_') || 'GERAL';
}

function SENAI_unidadeSlug() {
  const ctx = SENAI_ctx();
  return ctx.unidadeId ? String(ctx.unidadeId).trim().replace(/[^A-Za-z0-9]+/g, '_') : '';
}

function SENAI_scopeKey(baseKey) {
  const turma = SENAI_turmaSlug();
  const unidade = SENAI_unidadeSlug();
  return unidade ? baseKey + '__' + unidade + '__' + turma : baseKey + '__' + turma;
}

function SENAI_jsonGet(baseKey) {
  const scoped = SENAI_scopeKey(baseKey);
  try {
    const raw = localStorage.getItem(scoped);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) {}
  // Legado 1: escopo apenas por turma (antes da multi-unidade)
  try {
    const legacyTurma = baseKey + '__' + SENAI_turmaSlug();
    const raw = localStorage.getItem(legacyTurma);
    if (raw !== null) {
      localStorage.setItem(scoped, raw);
      return JSON.parse(raw);
    }
  } catch (e) {}
  // Legado 2: chave sem sufixo (primeira versão)
  try {
    const raw = localStorage.getItem(baseKey);
    if (raw !== null) {
      localStorage.setItem(scoped, raw);
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function SENAI_jsonSet(baseKey, value) {
  const scoped = SENAI_scopeKey(baseKey);
  try { localStorage.setItem(scoped, JSON.stringify(value)); } catch (e) {}
  SENAI_sync && SENAI_sync.markDirty && SENAI_sync.markDirty(scoped);
}

/* ───────────────────────── Subturmas (grupos A/B) ───────────────────────── */

/*
 * Subturmas dividem a turma em grupos de trabalho (ex.: A/B).
 * Os dados são gravados no MESMO escopo da turma (unidade + turma), logo são
 * COMPARTILHADOS: qualquer professor que dê a mesma disciplina nesta turma
 * enxerga e gerencia as mesmas subturmas.
 */

function SENAI_loadSubTurmas() {
  const arr = SENAI_jsonGet(SENAI_SUBTURMAS_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveSubTurmas(subTurmas) {
  SENAI_jsonSet(SENAI_SUBTURMAS_KEY, subTurmas);
}

function SENAI_createSubTurma(data) {
  const subTurmas = SENAI_loadSubTurmas();
  const nome = String(data.nome || '').trim();
  if (!nome) { throw new Error('Informe um nome para a subturma (ex.: A).'); }
  const duplicado = subTurmas.some(s => String(s.nome).trim().toLowerCase() === nome.toLowerCase());
  if (duplicado) { throw new Error('Já existe uma subturma com este nome nesta turma.'); }

  const ids = Array.isArray(data.alunoIds) ? data.alunoIds.map(Number).filter(Boolean) : [];
  const sub = {
    id: SENAI_uid(),
    nome: nome,
    descricao: String(data.descricao || '').trim(),
    alunoIds: ids,
    unidadeId: SENAI_ctx().unidadeId,
    professorId: SENAI_ctx().professorId,
    turmaId: SENAI_ctx().turmaId,
    criadoPor: (SENAI_getSession() && SENAI_getSession().name) || 'docente',
    criadoEm: new Date().toISOString()
  };
  if (SENAI_activeSubTurmaId() === null && subTurmas.length === 0) {
    SENAI_switchSubTurma(sub.id);
  }
  subTurmas.push(sub);
  SENAI_saveSubTurmas(subTurmas);
  return sub;
}

function SENAI_updateSubTurma(id, data) {
  const subTurmas = SENAI_loadSubTurmas();
  const sub = subTurmas.find(s => s.id === id);
  if (!sub) return null;
  if (data.nome !== undefined) sub.nome = String(data.nome).trim() || sub.nome;
  if (data.descricao !== undefined) sub.descricao = String(data.descricao).trim();
  if (data.alunoIds !== undefined) sub.alunoIds = (Array.isArray(data.alunoIds) ? data.alunoIds : []).map(Number).filter(Boolean);
  SENAI_saveSubTurmas(subTurmas);
  return sub;
}

function SENAI_deleteSubTurma(id) {
  const subTurmas = SENAI_loadSubTurmas().filter(s => s.id !== id);
  SENAI_saveSubTurmas(subTurmas);
  if (SENAI_activeSubTurmaId() === id) SENAI_switchSubTurma(null);
}

function SENAI_activeSubTurmaId() {
  const raw = SENAI_scopeKey(SENAI_SUBTURMA_ACTIVE_KEY);
  try { return localStorage.getItem(raw) || null; } catch (e) {}
  return null;
}

function SENAI_switchSubTurma(id) {
  const raw = SENAI_scopeKey(SENAI_SUBTURMA_ACTIVE_KEY);
  try {
    if (id) localStorage.setItem(raw, String(id));
    else localStorage.removeItem(raw);
  } catch (e) {}
}

function SENAI_activeSubTurma() {
  const ativoId = SENAI_activeSubTurmaId();
  if (!ativoId) return null;
  return SENAI_loadSubTurmas().find(s => s.id === ativoId) || null;
}

function SENAI_studentsOfSubTurma(subTurma) {
  if (!subTurma) return [];
  const ids = new Set((subTurma.alunoIds || []).map(Number));
  return SENAI_loadStudents().filter(s => ids.has(Number(s.id)));
}

function SENAI_countSubTurma(subTurma) {
  return (subTurma.alunoIds || []).length;
}

function SENAI_switchTurma(opts) {
  const cfg = SENAI_loadConfig();
  if (opts.turma !== undefined) cfg.turma = String(opts.turma).trim() || cfg.turma;
  if (opts.disciplina !== undefined) cfg.disciplina = String(opts.disciplina).trim() || cfg.disciplina;
  if (opts.oficina !== undefined) cfg.oficina = String(opts.oficina).trim() || cfg.oficina;
  if (opts.turno !== undefined) cfg.turno = String(opts.turno).trim() || cfg.turno;
  if (opts.curso !== undefined) cfg.curso = String(opts.curso).trim() || cfg.curso;
  if (opts.unidade !== undefined) cfg.unidade = String(opts.unidade).trim() || cfg.unidade;
  if (opts.unidadeId !== undefined) cfg.unidadeId = String(opts.unidadeId).trim() || cfg.unidadeId;
  SENAI_saveConfig(cfg);
  return cfg;
}

function SENAI_dataKeys() {
  return [
    SENAI_STUDENTS_KEY, SENAI_AULAS_KEY, SENAI_OCORRENCIAS_KEY,
    SENAI_CONFIG_KEY, SENAI_DIARIO_KEY, SENAI_RESERVAS_KEY
  ];
}

function SENAI_clearAllData() {
  const bases = SENAI_dataKeys();
  const toRemove = [];
  bases.forEach(b => toRemove.push(b));
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && SENAI_dataKeys().some(b => k.startsWith(b + '__'))) toRemove.push(k);
  }
  toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  return toRemove;
}

/* ─────────────────────── Seed por turma ─────────────────────── */

function SENAI_seedForTurma() {
  const cfg = SENAI_loadConfig();
  const turma = String(cfg.turma || '').trim();
  let size = 35;
  let prefix = 'TRM';
  if (/^TEC-MEC/i.test(turma)) { size = 35; prefix = 'TEC'; }
  else if (/^TEC-ELETRO/i.test(turma)) { size = 28; prefix = 'ELE'; }
  else if (/^APRENDIZ/i.test(turma)) { size = 22; prefix = 'APR'; }

  let seed = 0;
  (turma + cfg.disciplina).split('').forEach(ch => { seed = (seed * 31 + ch.charCodeAt(0)) % 9973; });

  const base = SENAI_clone(STUDENTS_INITIAL);
  const cfgForTemplate = SENAI_loadConfig();
  const template = (cfgForTemplate.avaliacoesTemplate || DEFAULT_CONFIG.avaliacoesTemplate).length > 0
    ? cfgForTemplate.avaliacoesTemplate
    : SENAI_clone(DEFAULT_CONFIG.avaliacoesTemplate);
  const out = [];
  for (let i = 0; i < size; i++) {
    const src = base[(seed + i) % base.length];
    const jitter = Math.round(((seed * (i + 7)) % 21) - 10); // -10..+10
    const s = Object.assign({}, src, {
      id: i + 1,
      bancada: String(i + 1).padStart(2, '0'),
      name: src.name,
      matricula: prefix + '.' + String(100 + i),
      avatar: SENAI_initials(src.name),
      nota: SENAI_clamp(src.nota + jitter, 30, 100),
      freq: SENAI_clamp(src.freq + jitter, 55, 100),
      status: src.status
    });

    // Avaliações determinísticas: varia por avaliação e ainda resulta na nota final
    const avs = template.map((t, ti) => {
      const desvio = Math.round(((seed * (i + 11) + ti * 23) % 19) - 9); // -9..+9
      return {
        nome: String(t.nome),
        peso: Number(t.peso) || 0,
        nota: SENAI_clamp(Math.round(s.nota + desvio), 10, 100)
      };
    });
    s.avaliacoes = avs;
    const somaP = avs.reduce((acc, a) => acc + a.nota * a.peso, 0);
    const totalP = avs.reduce((acc, a) => acc + a.peso, 0) || 1;
    s.nota = Math.round(somaP / totalP);

    s.risk = 'low';
    s.riskLabel = 'Risco Baixo';
    out.push(s);
  }
  return out;
}

/* ───────────────────────── Configurações ───────────────────────── */

function SENAI_configSlug(config) {
  return String((config && config.turma) || 'GERAL').trim().replace(/[^A-Za-z0-9]+/g, '_') || 'GERAL';
}

function SENAI_loadConfig() {
  let cfg = SENAI_clone(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(SENAI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') cfg = Object.assign(cfg, parsed);
    }
  } catch (e) {}
  if (!Array.isArray(cfg.avaliacoesTemplate) || cfg.avaliacoesTemplate.length === 0) {
    cfg.avaliacoesTemplate = SENAI_clone(DEFAULT_CONFIG.avaliacoesTemplate);
  }
  // Overrides por turma: cada turma guarda seu próprio config (multi-unidade)
  const slug = SENAI_configSlug(cfg);
  const overrideKey = SENAI_CONFIG_KEY + '__' + slug;
  try {
    const ovRaw = localStorage.getItem(overrideKey);
    if (ovRaw) {
      const ov = JSON.parse(ovRaw);
      if (ov && typeof ov === 'object') cfg = Object.assign(cfg, ov);
    } else {
      // Primeira leitura desta turma: persiste o atual como base da turma
      localStorage.setItem(overrideKey, JSON.stringify(cfg));
    }
  } catch (e) {}
  return cfg;
}

function SENAI_saveConfig(config) {
  if (!config || typeof config !== 'object') return;
  try { localStorage.setItem(SENAI_CONFIG_KEY, JSON.stringify(config)); } catch (e) {}
  const slug = SENAI_configSlug(config);
  try { localStorage.setItem(SENAI_CONFIG_KEY + '__' + slug, JSON.stringify(config)); } catch (e) {}
  SENAI_sync && SENAI_sync.markDirty && SENAI_sync.markDirty(SENAI_CONFIG_KEY + '__' + slug);
}

/* ───────────────────────── Hash / Usuários ───────────────────────── */

async function SENAI_hashPassword(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function SENAI_loadUsers() {
  try {
    const raw = localStorage.getItem(SENAI_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

async function SENAI_ensureUsers() {
  let users = SENAI_loadUsers();
  if (Array.isArray(users) && users.length > 0) {
    // Migração: usuários de versões antigas não possuem passwordHash.
    // Nesse caso, recria a base a partir dos usuários padrão.
    const todosComHash = users.every(u => u && typeof u.passwordHash === 'string' && u.passwordHash.length > 0);
    if (!todosComHash) {
      users = [];
    } else {
      // Garante que as contas padrão existam e estejam corretas,
      // preservando os demais usuários criados pelo professor.
      for (const du of DEFAULT_USERS) {
        const norm = du.login.toLowerCase();
        const idx = users.findIndex(u => String(u.login).trim().toLowerCase() === norm);
        const existente = idx >= 0 ? users[idx] : null;
        if (existente && existente.passwordHash) continue;
        const fresh = {
          id: (existente && existente.id) || SENAI_uid(),
          name: du.name,
          login: du.login,
          cpf: du.cpf || '',
          role: du.role,
          matricula: du.matricula,
          curso: du.curso,
          unidade: du.unidade,
          unidadeId: du.unidadeId || '',
          passwordHash: await SENAI_hashPassword(du.passwordPlain),
          createdAt: new Date().toISOString()
        };
        if (idx >= 0) users[idx] = fresh; else users.push(fresh);
      }
      SENAI_saveUsers(users);
      return users;
    }
  } else {
    users = [];
  }
  for (const du of DEFAULT_USERS) {
    users.push({
      id: SENAI_uid(),
      name: du.name,
      login: du.login,
      cpf: du.cpf || '',
      role: du.role,
      matricula: du.matricula,
      curso: du.curso,
      unidade: du.unidade,
      unidadeId: du.unidadeId || '',
      passwordHash: await SENAI_hashPassword(du.passwordPlain),
      createdAt: new Date().toISOString()
    });
  }
  SENAI_saveUsers(users);
  return users;
}

function SENAI_saveUsers(users) {
  try { localStorage.setItem(SENAI_USERS_KEY, JSON.stringify(users)); } catch (e) {}
  SENAI_sync && SENAI_sync.markDirty && SENAI_sync.markDirty(SENAI_USERS_KEY);
}

async function SENAI_authenticate(login, senha) {
  const users = await SENAI_ensureUsers();
  const normalized = String(login || '').trim().toLowerCase();
  const user = users.find(u => String(u.login).trim().toLowerCase() === normalized);
  if (!user) return null;
  const hash = await SENAI_hashPassword(senha || '');
  if (hash !== user.passwordHash) return null;
  const session = {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    matricula: user.matricula,
    curso: user.curso,
    unidade: user.unidade,
    unidadeId: user.unidadeId || '',
    loggedAt: new Date().toISOString()
  };
  SENAI_setSession(session);
  return session;
}

async function SENAI_createUser(data) {
  const users = await SENAI_ensureUsers();
  const normalized = String(data.login).trim().toLowerCase();
  if (users.some(u => String(u.login).trim().toLowerCase() === normalized)) {
    throw new Error('Já existe um usuário com este login.');
  }
  const user = {
    id: SENAI_uid(),
    name: data.name.trim(),
    login: data.login.trim(),
    cpf: data.cpf || '',
    role: data.role === 'coordenacao' ? 'coordenacao' : 'professor',
    matricula: data.matricula || '',
    curso: data.curso || '',
    unidade: data.unidade || '',
    unidadeId: data.unidadeId || '',
    passwordHash: await SENAI_hashPassword(data.senha || ''),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  SENAI_saveUsers(users);
  return user;
}

async function SENAI_resetPassword(id, novaSenha) {
  const users = await SENAI_ensureUsers();
  const user = users.find(u => u.id === id);
  if (!user) return false;
  user.passwordHash = await SENAI_hashPassword(novaSenha || '');
  SENAI_saveUsers(users);
  return true;
}

function SENAI_deleteUser(id) {
  let users = SENAI_loadUsers();
  if (!Array.isArray(users)) return false;
  const session = SENAI_getSession();
  if (session && session.id === id) return false;
  users = users.filter(u => u.id !== id);
  SENAI_saveUsers(users);
  return true;
}

/* ───────────────────────── Sessão / Auth ───────────────────────── */

function SENAI_getSession() {
  try {
    const raw = localStorage.getItem(SENAI_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { name: 'Lucas Nogueira', role: 'professor', matricula: 'DOC-84091', curso: 'Técnico em Mecatrônica', unidade: 'SENAI - Campus Industrial', unidadeId: 'u-sp-sao-paulo', login: '123.456.789-00' };
}

function SENAI_setSession(session) {
  try { localStorage.setItem(SENAI_SESSION_KEY, JSON.stringify(session)); } catch (e) {}
}

function SENAI_clearSession() {
  try { localStorage.removeItem(SENAI_SESSION_KEY); } catch (e) {}
}

function SENAI_isLogged() {
  const s = SENAI_getSession();
  return !!(s && s.id);
}

function SENAI_requireAuth() {
  if (!SENAI_isLogged()) {
    window.location.replace('index.html');
    return false;
  }
  return true;
}

/* ─────────────────── Autenticação no servidor (auth básica) ─────────────────── */

const SENAI_AUTH_TOKEN_KEY = 'senai_auth_token';

function SENAI_authToken() {
  try { return localStorage.getItem(SENAI_AUTH_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function SENAI_setAuthToken(token) {
  try {
    if (token) localStorage.setItem(SENAI_AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(SENAI_AUTH_TOKEN_KEY);
  } catch (e) {}
}

function SENAI_clearAuthToken() {
  SENAI_setAuthToken('');
}

function SENAI_authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  const t = SENAI_authToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

async function SENAI_loginServer(login, senha) {
  let res;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: login, senha: senha })
    });
  } catch (e) {
    return { ok: false, offline: true };
  }
  let json = null;
  try { json = await res.json(); } catch (e) {}
  if (res.ok && json && json.ok && json.token) {
    SENAI_setAuthToken(json.token);
    return { ok: true, user: json.user };
  }
  return { ok: false, status: res.status, error: (json && json.error) || 'Erro ao autenticar.' };
}

async function SENAI_logoutServer() {
  const t = SENAI_authToken();
  SENAI_clearAuthToken();
  if (!t) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: SENAI_authHeaders({ 'Content-Type': 'application/json' }) });
  } catch (e) {}
}

/* ─────────────────────── Contexto multi-unidade ─────────────────────── */
/*
 * Deriva a identidade ativa (unidade, professor e turma) a partir da sessão
 * e da configuração corrente. Todo registro criado deve ser carimbado com
 * esses campos para garantir o isolamento por unidade/professor/turma.
 */

function SENAI_ctx() {
  const session = SENAI_getSession() || {};
  const config = SENAI_loadConfig() || {};
  return {
    unidadeId: session.unidadeId || config.unidadeId || '',
    unidadeLabel: session.unidade || config.unidade || '',
    professorId: session.id || session.matricula || '',
    professorMatricula: session.matricula || '',
    professorName: session.name || '',
    turmaId: String(config.turma || '').trim(),
    turmaSlug: SENAI_turmaSlug()
  };
}

function SENAI_unidadeLabel(id) {
  if (!id) return '';
  const u = SENAI_UNIDADES.find(x => x.id === id);
  return u ? u.nome : String(id);
}

/* ───────────────────────── Alunos + Avaliações ───────────────────────── */

function SENAI_migrateStudentData(raw, config) {
  if (!Array.isArray(raw)) return null;
  config = config || SENAI_loadConfig();
  const template = (config.avaliacoesTemplate || []).length > 0
    ? config.avaliacoesTemplate
    : SENAI_clone(DEFAULT_CONFIG.avaliacoesTemplate);

  const ctx = SENAI_ctx();
  return raw.map(s => {
    const aluno = Object.assign({}, s);
    aluno.unidadeId = ctx.unidadeId;
    aluno.professorId = ctx.professorId;
    aluno.turmaId = ctx.turmaId;

    let nota = Number(s.nota);
    if (!Number.isFinite(nota)) {
      nota = Number(String(s.nota).replace(/[^\d.,]/g, '').replace(',', '.'));
    }
    if (!Number.isFinite(nota)) nota = 0;
    if (nota < 20) nota = Math.round(nota * 10);
    aluno.nota = SENAI_clamp(nota, 0, 100);

    if (Array.isArray(s.avaliacoes) && s.avaliacoes.length > 0) {
      aluno.avaliacoes = s.avaliacoes.map(a => ({
        nome: String(a.nome || 'AV'),
        peso: SENAI_clamp(Number(a.peso), 0, 1),
        nota: SENAI_clamp(a.nota, 0, 100)
      }));
    } else {
      aluno.avaliacoes = template.map(t => ({ nome: t.nome, peso: Number(t.peso) || 0, nota: aluno.nota }));
    }

    let freq = Number(s.freq);
    if (!Number.isFinite(freq)) {
      freq = Number(String(s.freq).replace('%', '').trim());
    }
    if (freq < 1) freq = Math.round(freq * 100);
    aluno.freq = SENAI_clamp(freq, 0, 100);

    aluno.status = s.status === 'absent' ? 'absent' : (s.status === 'late' ? 'late' : 'present');
    aluno.id = (s.id !== undefined && s.id !== null) ? s.id : SENAI_uid();
    aluno.avatar = s.avatar || SENAI_initials(s.name);
    aluno.observacoes = typeof s.observacoes === 'string' ? s.observacoes : '';
    aluno.photo = typeof s.photo === 'string' ? s.photo : '';
    aluno.risk = s.risk || 'low';
    aluno.riskLabel = s.riskLabel || 'Risco Baixo';
    return aluno;
  });
}

function SENAI_calcNota(aluno) {
  const av = Array.isArray(aluno.avaliacoes) ? aluno.avaliacoes : [];
  if (av.length === 0) return SENAI_clamp(aluno.nota, 0, 100);
  const totalPeso = av.reduce((a, x) => a + Number(x.peso || 0), 0);
  if (totalPeso <= 0) return SENAI_clamp(aluno.nota, 0, 100);
  const soma = av.reduce((a, x) => a + (Number(x.nota || 0) * Number(x.peso || 0)), 0);
  return SENAI_clamp(Math.round((soma / totalPeso) * 10) / 10, 0, 100);
}

function SENAI_calcRisk(nota, freq) {
  if (nota < 60 || freq < 75) return { risk: 'high', riskLabel: 'Risco Alto' };
  if (nota < 80 || freq < 90) return { risk: 'medium', riskLabel: 'Risco Médio' };
  return { risk: 'low', riskLabel: 'Risco Baixo' };
}

function SENAI_loadAulas() {
  const raw = SENAI_jsonGet(SENAI_AULAS_KEY);
  return Array.isArray(raw) ? raw : [];
}

function SENAI_saveAulas(aulas) {
  SENAI_jsonSet(SENAI_AULAS_KEY, aulas);
}

function SENAI_seedAulas(students) {
  const aulas = [];
  const ctx = SENAI_ctx();
  const freqById = {};
  students.forEach(s => { freqById[s.id] = s.freq; });
  const days = [];
  const today = new Date();
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1);
  while (days.length < 12) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  days.reverse().forEach((d, dayIndex) => {
    const presentes = students
      .filter(s => (((dayIndex * 7 + Number(s.id)) % 100) < (freqById[s.id] || 90)))
      .map(s => s.id);
    aulas.push({
      id: SENAI_uid(),
      date: SENAI_todayKey(d),
      tema: 'Aula prática registrada no início do semestre',
      disciplina: SENAI_loadConfig().disciplina,
      competencias: '',
      aulaCount: 4,
      turma: SENAI_loadConfig().turma,
      unidadeId: ctx.unidadeId,
      professorId: ctx.professorId,
      turmaId: ctx.turmaId,
      presenteIds: presentes
    });
  });
  SENAI_saveAulas(aulas);
  return aulas;
}

function SENAI_ensureAulas(students) {
  let aulas = SENAI_loadAulas();
  if (Array.isArray(aulas) && aulas.length > 0) return aulas;

  const ctx = SENAI_ctx();
  // Migração: diário antigo vira histórico de presença
  try {
    const old = JSON.parse(localStorage.getItem(SENAI_DIARIO_KEY) || '[]');
    if (Array.isArray(old) && old.length > 0) {
      const byDate = {};
      old.forEach(e => {
        const key = SENAI_todayKey(new Date(e.date));
        if (e.date && byDate[key] && byDate[key].updatedAt > (e.updatedAt || 0)) return;
        const presentes = Array.isArray(e.snapshot)
          ? e.snapshot.filter(s => s.status !== 'absent').map(s => s.id)
          : [];
        byDate[key] = {
          id: SENAI_uid(),
          date: key,
          tema: e.tema || 'Aula registrada',
          disciplina: e.disciplina || SENAI_loadConfig().disciplina,
          competencias: e.competencias || '',
          aulaCount: Number(e.aulas) || 4,
          turma: e.turma || SENAI_loadConfig().turma,
          unidadeId: ctx.unidadeId,
          professorId: ctx.professorId,
          turmaId: ctx.turmaId,
          presenteIds: presentes,
          updatedAt: e.updatedAt || Date.now()
        };
      });
      aulas = Object.keys(byDate).map(k => byDate[k]).sort((a, b) => b.date.localeCompare(a.date));
      if (aulas.length > 0) {
        SENAI_saveAulas(aulas);
        return aulas;
      }
    }
  } catch (e) {}

  return SENAI_seedAulas(students);
}

function SENAI_calcFreq(aluno, aulas) {
  const today = SENAI_todayKey();
  const past = Array.isArray(aulas) ? aulas.filter(a => a.date !== today) : [];
  if (past.length === 0) return SENAI_clamp(aluno.freq, 0, 100);
  const abonadas = new Set((aluno.justificativas || [])
    .filter(j => j.status === 'aprovado' && j.dataAula)
    .map(j => String(j.dataAula)));
  const presentes = past.filter(a => {
    if ((a.presenteIds || []).indexOf(aluno.id) !== -1) return true;
    return abonadas.has(String(a.date));
  }).length;
  return Math.round((presentes / past.length) * 100);
}

function SENAI_loadStudents() {
  const config = SENAI_loadConfig();
  try {
    let students = null;
    const raw = SENAI_jsonGet(SENAI_STUDENTS_KEY);
    if (raw !== null) {
      if (raw && Array.isArray(raw.students)) {
        students = raw.students;
      } else if (Array.isArray(raw)) {
        students = raw;
      }
    }
    if (!students) {
      students = SENAI_seedForTurma();
      SENAI_saveStudents(students);
    }
    students = SENAI_migrateStudentData(students, config);
    const aulas = SENAI_ensureAulas(students);
    students.forEach(s => {
      s.nota = SENAI_calcNota(s);
      s.freq = SENAI_calcFreq(s, aulas);
      const r = SENAI_calcRisk(s.nota, s.freq);
      s.risk = r.risk;
      s.riskLabel = r.riskLabel;
      if (s.status !== 'present' && s.status !== 'late' && s.status !== 'absent') s.status = 'present';
    });
    return students;
  } catch (e) {
    return SENAI_migrateStudentData(SENAI_seedForTurma(), config);
  }
}

function SENAI_saveStudents(students) {
  SENAI_jsonSet(SENAI_STUDENTS_KEY, {
    version: SENAI_DATA_VERSION,
    students: students.map(s => (Object.assign({}, s)))
  });
}

function SENAI_addStudent(data) {
  const students = SENAI_loadStudents();
  const config = SENAI_loadConfig();
  const template = (config.avaliacoesTemplate || []).length > 0
    ? config.avaliacoesTemplate
    : SENAI_clone(DEFAULT_CONFIG.avaliacoesTemplate);
  const aluno = {
    id: SENAI_uid(),
    bancada: String(data.bancada || '').trim(),
    name: String(data.name || '').trim(),
    matricula: String(data.matricula || '').trim(),
    status: 'present',
    avatar: SENAI_initials(data.name),
    observacoes: String(data.observacoes || '').trim(),
    photo: String(data.photo || ''),
    avaliacoes: template.map(t => ({ nome: t.nome, peso: Number(t.peso) || 0, nota: SENAI_clamp(data.nota, 0, 100) }))
  };
  if (!aluno.name) throw new Error('Informe o nome do aluno.');
  const aulas = SENAI_loadAulas();
  const ctx = SENAI_ctx();
  aluno.unidadeId = ctx.unidadeId;
  aluno.professorId = ctx.professorId;
  aluno.turmaId = ctx.turmaId;
  aluno.freq = SENAI_clamp(data.freq, 0, 100);
  aluno.nota = SENAI_calcNota(aluno);
  const r = SENAI_calcRisk(aluno.nota, SENAI_calcFreq(aluno, aulas));
  aluno.risk = r.risk;
  aluno.riskLabel = r.riskLabel;
  students.push(aluno);
  SENAI_saveStudents(students);
  return aluno;
}

function SENAI_updateStudent(id, patch) {
  const students = SENAI_loadStudents();
  const s = students.find(x => x.id === id);
  if (!s) return null;
  if (patch.name !== undefined) s.name = String(patch.name).trim();
  if (patch.matricula !== undefined) s.matricula = String(patch.matricula).trim();
  if (patch.bancada !== undefined) s.bancada = String(patch.bancada).trim();
  if (patch.observacoes !== undefined) s.observacoes = String(patch.observacoes);
  if (patch.photo !== undefined) s.photo = String(patch.photo);
  if (Array.isArray(patch.avaliacoes)) {
    s.avaliacoes = patch.avaliacoes.map(a => ({
      nome: String(a.nome || 'AV'),
      peso: SENAI_clamp(Number(a.peso), 0, 1),
      nota: SENAI_clamp(a.nota, 0, 100)
    }));
  }
  s.avatar = SENAI_initials(s.name);
  s.nota = SENAI_calcNota(s);
  s.freq = SENAI_calcFreq(s, SENAI_loadAulas());
  const r = SENAI_calcRisk(s.nota, s.freq);
  s.risk = r.risk;
  s.riskLabel = r.riskLabel;
  SENAI_saveStudents(students);
  return s;
}

function SENAI_deleteStudent(id) {
  let students = SENAI_loadStudents();
  students = students.filter(s => s.id !== id);
  SENAI_saveStudents(students);
  return students;
}

function SENAI_setStatus(id, status) {
  const students = SENAI_loadStudents();
  const s = students.find(x => x.id === id);
  if (!s) return null;
  s.status = status === 'absent' ? 'absent' : (status === 'late' ? 'late' : 'present');
  SENAI_saveStudents(students);
  SENAI_syncTodayAula(students);
  return s;
}

function SENAI_setTodosPresentes() {
  const students = SENAI_loadStudents();
  students.forEach(s => { s.status = 'present'; });
  SENAI_saveStudents(students);
  SENAI_syncTodayAula(students);
  return students;
}

function SENAI_setPresencaGrupo(alunoIds, status) {
  const ids = new Set((alunoIds || []).map(Number));
  const students = SENAI_loadStudents();
  let mudou = 0;
  students.forEach(s => {
    if (ids.has(Number(s.id))) {
      s.status = status === 'absent' ? 'absent' : (status === 'late' ? 'late' : 'present');
      mudou++;
    }
  });
  if (mudou) {
    SENAI_saveStudents(students);
    SENAI_syncTodayAula(students);
  }
  return students;
}

/* ───────────────────────── Chamada / Histórico ───────────────────────── */

function SENAI_registerAula(meta) {
  let aulas = SENAI_loadAulas();
  const date = meta.date || SENAI_todayKey();
  const config = SENAI_loadConfig();
  const ctx = SENAI_ctx();
  const entry = {
    id: SENAI_uid(),
    date: date,
    tema: String(meta.tema || 'Aula prática').trim(),
    disciplina: String(meta.disciplina || config.disciplina).trim(),
    competencias: String(meta.competencias || '').trim(),
    aulaCount: Number(meta.aulaCount) || 4,
    turma: meta.turma || config.turma,
    unidadeId: ctx.unidadeId,
    professorId: ctx.professorId,
    turmaId: ctx.turmaId,
    presenteIds: Array.isArray(meta.presenteIds) ? meta.presenteIds : [],
    ausenteIds: Array.isArray(meta.ausenteIds) ? meta.ausenteIds : [],
    rascunho: false,
    updatedAt: Date.now()
  };
  const idx = aulas.findIndex(a => a.date === date);
  if (idx !== -1) {
    entry.id = aulas[idx].id;
    aulas[idx] = entry;
  } else {
    aulas.unshift(entry);
  }
  SENAI_saveAulas(aulas);
  return entry;
}

function SENAI_saveConteudoDoDia(meta) {
  const date = SENAI_todayKey();
  let aulas = SENAI_loadAulas();
  let entry = aulas.find(a => a.date === date);
  if (entry) {
    if (meta.tema !== undefined) entry.tema = String(meta.tema).trim();
    if (meta.competencias !== undefined) entry.competencias = String(meta.competencias).trim();
    entry.updatedAt = Date.now();
    SENAI_saveAulas(aulas);
    return entry;
  }
  return SENAI_registerAula(Object.assign({ date: date, presenteIds: [] }, meta));
}

function SENAI_deleteAula(id) {
  const aulas = SENAI_loadAulas().filter(a => a.id !== id);
  SENAI_saveAulas(aulas);
}

function SENAI_updateAula(id, meta) {
  const aulas = SENAI_loadAulas();
  const entry = aulas.find(a => a.id === id);
  if (!entry) return null;
  Object.keys(meta).forEach(k => {
    if (['id', 'unidadeId', 'professorId', 'turmaId'].includes(k)) return;
    entry[k] = meta[k];
  });
  entry.updatedAt = Date.now();
  SENAI_saveAulas(aulas);
  return entry;
}

function SENAI_syncTodayAula(students) {
  let aulas = SENAI_loadAulas();
  const date = SENAI_todayKey();
  const config = SENAI_loadConfig();
  const ctx = SENAI_ctx();
  const presentes = Array.isArray(students) ? students.filter(s => s.status !== 'absent').map(s => s.id) : [];
  let entry = aulas.find(a => a.date === date);
  if (!entry) {
    entry = {
      id: SENAI_uid(),
      date: date,
      tema: '',
      disciplina: config.disciplina,
      competencias: '',
      aulaCount: Number(config.cargaHoraria) || 4,
      turma: config.turma,
      unidadeId: ctx.unidadeId,
      professorId: ctx.professorId,
      turmaId: ctx.turmaId,
      presenteIds: presentes,
      ausenteIds: [],
      rascunho: true,
      updatedAt: Date.now()
    };
    aulas.unshift(entry);
  }
  entry.presenteIds = presentes;
  entry.ausenteIds = Array.isArray(students)
    ? students.filter(s => s.status === 'absent').map(s => s.id)
    : (entry.ausenteIds || []);
  entry.rascunho = true;
  entry.updatedAt = Date.now();
  SENAI_saveAulas(aulas);
  return entry;
}

function SENAI_closeCall(meta) {
  const students = SENAI_loadStudents();
  const presentes = students.filter(s => s.status !== 'absent').map(s => s.id);
  const ausentes = students.filter(s => s.status === 'absent').map(s => s.id);
  const atrasados = students.filter(s => s.status === 'late').map(s => s.id);
  const entry = SENAI_registerAula(Object.assign({
    tema: meta.tema,
    disciplina: meta.disciplina,
    competencias: meta.competencias,
    aulaCount: meta.aulaCount,
    presenteIds: presentes,
    ausenteIds: ausentes
  }, meta));
  const ocorrenciasCriadas = SENAI_autoOcorrencias(students, ausentes);
  students.forEach(s => { s.status = 'present'; });
  SENAI_saveStudents(students);
  return { aula: entry, presentes: presentes.length, ausentes: ausentes.length, atrasados: atrasados.length, ocorrenciasCriadas: ocorrenciasCriadas };
}

function SENAI_autoOcorrencias(students, ausenteIds) {
  let ocorrencias = SENAI_loadOcorrencias();
  const aulas = SENAI_loadAulas().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ctx = SENAI_ctx();
  let criadas = 0;
  ausenteIds.forEach(id => {
    const s = students.find(x => x.id === id);
    if (!s) return;

    // Consecutive absences counting back from today (closed + today's draft)
    let consec = 0;
    for (let i = 0; i < aulas.length; i++) {
      if ((aulas[i].ausenteIds || []).indexOf(id) !== -1) consec++;
      else break;
    }
    const freq = SENAI_calcFreq(s, aulas);
    const jaTemAberta = ocorrencias.some(o =>
      o.alunoId === id && o.tipo === 'Falta' && o.status === 'aberta'
    );
    if ((consec >= 2 || freq < 75) && !jaTemAberta) {
      ocorrencias.unshift({
        id: Date.now() + criadas,
        date: new Date().toISOString(),
        alunoId: id,
        alunoName: s.name,
        matricula: s.matricula,
        bancada: s.bancada,
        tipo: 'Falta',
        severidade: consec >= 3 ? 'alta' : (freq < 75 ? 'media' : 'media'),
        descricao: 'Falta não justificada registrada automaticamente ao fechar a chamada' +
          (consec >= 2 ? ' (2ª falta consecutiva).' : '.'),
        origem: 'chamada',
        status: 'aberta',
        unidadeId: ctx.unidadeId,
        professorId: ctx.professorId,
        turmaId: ctx.turmaId,
        professor: (SENAI_getSession() && SENAI_getSession().name) || 'Professor'
      });
      criadas++;
    }
  });
  if (criadas > 0) SENAI_saveOcorrencias(ocorrencias);
  return criadas;
}

function SENAI_startCall() {
  const students = SENAI_loadStudents();
  students.forEach(s => { s.status = 'present'; });
  SENAI_saveStudents(students);
  let aulas = SENAI_loadAulas().filter(a => a.date !== SENAI_todayKey());
  SENAI_saveAulas(aulas);
  SENAI_syncTodayAula(students);
  return students;
}

function SENAI_listaFrequencia(students) {
  const aulas = SENAI_loadAulas();
  const today = SENAI_todayKey();
  const past = aulas.filter(a => a.date !== today);
  return students.map(s => {
    const presentes = past.filter(a => (a.presenteIds || []).indexOf(s.id) !== -1).length;
    return {
      id: s.id,
      name: s.name,
      matricula: s.matricula,
      bancada: s.bancada,
      presentes: presentes,
      total: past.length,
      freq: past.length > 0 ? Math.round((presentes / past.length) * 100) : Math.round(s.freq || 0)
    };
  });
}

/* ───────────────────────── Diário (conteúdo) ───────────────────────── */

function SENAI_loadDiario() { return SENAI_loadAulas(); }

function SENAI_saveDiario(entries) { SENAI_saveAulas(entries); }

/* ───────────────────────── Reservas de Sala / Oficina ───────────────────────── */

function SENAI_loadReservas() {
  const arr = SENAI_jsonGet(SENAI_RESERVAS_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveReservas(reservas) {
  SENAI_jsonSet(SENAI_RESERVAS_KEY, reservas);
}

function SENAI_minuto(str) {
  if (!str || !str.includes(':')) return 0;
  const partes = str.split(':');
  return (Number(partes[0]) || 0) * 60 + (Number(partes[1]) || 0);
}

function SENAI_sortReserva(a, b) {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  return (a.inicio || '00:00').localeCompare(b.inicio || '00:00');
}

function SENAI_seedReservas() {
  const cfg = SENAI_loadConfig();
  const ctx = SENAI_ctx();
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const seeds = [
    { data: hoje, inicio: '07:30', fim: '11:30', turma: cfg.turma, disciplina: cfg.disciplina, obs: 'Aula prática - turma reservada' },
    { data: hoje, inicio: '13:30', fim: '17:30', turma: 'TEC-MEC-22', disciplina: 'Eletropneumática', obs: 'Turma do vespertino' },
    { data: amanha, inicio: '07:30', fim: '11:30', turma: cfg.turma, disciplina: cfg.disciplina, obs: '' }
  ];
  const reservas = seeds.map(s => ({
    id: SENAI_uid(),
    oficina: cfg.oficina || 'Oficina',
    turma: s.turma,
    disciplina: s.disciplina,
    unidadeId: ctx.unidadeId,
    professorId: ctx.professorId,
    turmaId: ctx.turmaId,
    data: SENAI_todayKey(s.data),
    inicio: s.inicio,
    fim: s.fim,
    observacoes: s.obs,
    criadoPor: 'SENAI (demo)',
    createdAt: new Date().toISOString()
  }));
  SENAI_saveReservas(reservas);
  return reservas;
}

function SENAI_ensureReservas() {
  const reservas = SENAI_loadReservas();
  if (Array.isArray(reservas) && reservas.length > 0) return reservas;
  return SENAI_seedReservas();
}

function SENAI_addReserva(data) {
  const reservas = SENAI_loadReservas();
  const ctx = SENAI_ctx();
  const r = {
    id: SENAI_uid(),
    oficina: String(data.oficina || '').trim() || 'Oficina',
    turma: String(data.turma || '').trim(),
    disciplina: String(data.disciplina || '').trim(),
    unidadeId: ctx.unidadeId,
    professorId: ctx.professorId,
    turmaId: ctx.turmaId,
    data: data.data,
    inicio: data.inicio,
    fim: data.fim,
    observacoes: String(data.observacoes || '').trim(),
    criadoPor: (SENAI_getSession() && SENAI_getSession().name) || 'docente',
    createdAt: new Date().toISOString()
  };
  reservas.push(r);
  reservas.sort(SENAI_sortReserva);
  SENAI_saveReservas(reservas);
  return r;
}

function SENAI_updateReserva(id, data) {
  const reservas = SENAI_loadReservas();
  const r = reservas.find(x => x.id === id);
  if (!r) return null;
  r.oficina = String(data.oficina || r.oficina).trim();
  r.turma = String(data.turma || r.turma).trim();
  r.disciplina = String(data.disciplina || r.disciplina).trim();
  r.data = data.data || r.data;
  r.inicio = data.inicio || r.inicio;
  r.fim = data.fim || r.fim;
  r.observacoes = String(data.observacoes == null ? r.observacoes : data.observacoes).trim();
  reservas.sort(SENAI_sortReserva);
  SENAI_saveReservas(reservas);
  return r;
}

function SENAI_deleteReserva(id) {
  const reservas = SENAI_loadReservas();
  const nova = reservas.filter(r => r.id !== id);
  if (nova.length === reservas.length) return false;
  SENAI_saveReservas(nova);
  return true;
}

function SENAI_conflitoReserva(reservas, r) {
  const ini = SENAI_minuto(r.inicio);
  const fim = SENAI_minuto(r.fim);
  if (fim <= ini) return r;
  return reservas.find(x =>
    x.id !== r.id &&
    x.data === r.data &&
    SENAI_minuto(x.inicio) < fim &&
    SENAI_minuto(x.fim) > ini
  ) || null;
}

/* ───────────────────────── Turma Virtual (simulado - sem API) ───────────────────────── */

function SENAI_loadClassroom() {
  const arr = SENAI_jsonGet(SENAI_CLASSROOM_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveClassroom(posts) {
  SENAI_jsonSet(SENAI_CLASSROOM_KEY, posts);
}

function SENAI_seedClassroom() {
  const hoje = new Date();
  const add = (dias) => { const x = new Date(hoje); x.setDate(x.getDate() + dias); return SENAI_todayKey(x); };
  const autor = (SENAI_getSession() && SENAI_getSession().name) || 'Professor';
  const posts = [
    {
      id: SENAI_uid(),
      tipo: 'aviso',
      titulo: 'Boas-vindas ao semestre',
      conteudo: 'Atenção à ementa da disciplina e ao cronograma de aulas práticas, disponibilizados na Turma Virtual.',
      entrega: '',
      criadoEm: add(-3),
      autor: autor,
      entregue: false
    },
    {
      id: SENAI_uid(),
      tipo: 'tarefa',
      titulo: 'Lista de exercícios — CLP Siemens S7-1200',
      conteudo: 'Resolver os exercícios 1 a 10 do capítulo 3 e entregar a resolução na próxima aula prática.',
      entrega: add(5),
      criadoEm: add(-1),
      autor: autor,
      entregue: false
    },
    {
      id: SENAI_uid(),
      tipo: 'aviso',
      titulo: 'Lembrete de EPI',
      conteudo: 'O uso de EPI é obrigatório na oficina. Alunos sem equipamento não entrarão no laboratório.',
      entrega: '',
      criadoEm: add(1),
      autor: 'Coordenação',
      entregue: false
    }
  ];
  SENAI_saveClassroom(posts);
  return posts;
}

function SENAI_ensureClassroom() {
  const posts = SENAI_loadClassroom();
  if (Array.isArray(posts) && posts.length > 0) return posts;
  return SENAI_seedClassroom();
}

function SENAI_addClassroomPost(data) {
  const posts = SENAI_loadClassroom();
  const post = {
    id: SENAI_uid(),
    tipo: data.tipo === 'tarefa' ? 'tarefa' : 'aviso',
    titulo: String(data.titulo || '').trim(),
    conteudo: String(data.conteudo || '').trim(),
    entrega: data.entrega || '',
    criadoEm: SENAI_todayKey(),
    autor: (SENAI_getSession() && SENAI_getSession().name) || 'Professor',
    entregue: false
  };
  if (!post.titulo) throw new Error('Informe um título para a publicação.');
  if (post.tipo === 'tarefa' && !post.entrega) throw new Error('Informe a data de entrega da tarefa.');
  posts.unshift(post);
  SENAI_saveClassroom(posts);
  return post;
}

function SENAI_toggleEntrega(postId) {
  const posts = SENAI_loadClassroom();
  const post = posts.find(p => p.id === postId);
  if (!post) return false;
  post.entregue = !post.entregue;
  SENAI_saveClassroom(posts);
  return post.entregue;
}

function SENAI_deleteClassroomPost(postId) {
  const posts = SENAI_loadClassroom().filter(p => p.id !== postId);
  SENAI_saveClassroom(posts);
  return posts.length;
}

/* ───────────────────────── Calendário (aulas + reservas) ───────────────────────── */

function SENAI_calendarEvents() {
  const eventos = [];
  (SENAI_loadAulas() || []).forEach(a => {
    if (!a.date) return;
    eventos.push({
      date: a.date,
      tipo: 'aula',
      titulo: a.tema || 'Aula registrada',
      hora: '',
      detalhe: `${a.disciplina || ''}${a.rascunho ? ' (rascunho)' : ''}`
    });
  });
  (SENAI_loadReservas() || []).forEach(r => {
    if (!r.data) return;
    eventos.push({
      date: r.data,
      tipo: 'reserva',
      titulo: (r.turma || '') + (r.disciplina ? ' · ' + r.disciplina : ''),
      hora: (r.inicio || '') + (r.fim ? '–' + r.fim : ''),
      detalhe: r.oficina || ''
    });
  });
  return eventos;
}

/* ───────────────────────── Ocorrências ───────────────────────── */

function SENAI_loadOcorrencias() {
  const raw = SENAI_jsonGet(SENAI_OCORRENCIAS_KEY);
  return Array.isArray(raw) ? raw : [];
}

function SENAI_saveOcorrencias(ocorrencias) {
  SENAI_jsonSet(SENAI_OCORRENCIAS_KEY, ocorrencias);
}

function SENAI_addOcorrencia(data) {
  const ocorrencias = SENAI_loadOcorrencias();
  const ctx = SENAI_ctx();
  const o = {
    id: SENAI_uid(),
    studentId: data.studentId,
    tipo: String(data.tipo || 'Outro').trim(),
    severidade: data.severidade || 'media',
    descricao: String(data.descricao || '').trim(),
    data: data.data || new Date().toISOString(),
    status: 'aberta',
    unidadeId: ctx.unidadeId,
    professorId: ctx.professorId,
    turmaId: ctx.turmaId,
    createdAt: new Date().toISOString()
  };
  ocorrencias.unshift(o);
  SENAI_saveOcorrencias(ocorrencias);
  return o;
}

function SENAI_resolveOcorrencia(id) {
  const ocorrencias = SENAI_loadOcorrencias();
  const o = ocorrencias.find(x => x.id === id);
  if (!o) return false;
  o.status = 'resolvida';
  o.resolvedAt = new Date().toISOString();
  SENAI_saveOcorrencias(ocorrencias);
  return true;
}

function SENAI_deleteOcorrencia(id) {
  SENAI_saveOcorrencias(SENAI_loadOcorrencias().filter(o => o.id !== id));
}

/* ───────────────────────── Métricas ───────────────────────── */

function SENAI_avgNota(students) {
  if (!students || students.length === 0) return 0;
  const sum = students.reduce((acc, s) => acc + Number(s.nota || 0), 0);
  return Math.round((sum / students.length) * 10) / 10;
}

function SENAI_avgFreq(students) {
  if (!students || students.length === 0) return 0;
  const sum = students.reduce((acc, s) => acc + Number(s.freq || 0), 0);
  return Math.round((sum / students.length) * 10) / 10;
}

function SENAI_riskBadgeClass(risk) {
  if (risk === 'high') return 'risk-high';
  if (risk === 'medium') return 'risk-medium';
  return 'risk-low';
}

/* ───────────────────────── Formatação ───────────────────────── */

function SENAI_formatDate(date) {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function SENAI_formatDateKey(key) {
  if (!key) return '';
  const parts = String(key).split('-');
  if (parts.length !== 3) return key;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function SENAI_portuguesDate(date) {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return '';
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

/* ───────────────────────── Backup / Arquivos ───────────────────────── */

function SENAI_backup() {
  const bases = SENAI_dataKeys();
  const data = {};
  // Chaves base + chaves escopadas por turma (<base>__<slug>)
  const keysToBackup = [];
  bases.forEach(b => keysToBackup.push(b));
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && bases.some(b => k.startsWith(b + '__'))) keysToBackup.push(k);
  }
  keysToBackup.forEach(k => {
    try {
      const v = localStorage.getItem(k);
      if (v) data[k] = JSON.parse(v);
    } catch (e) {}
  });
  return {
    meta: {
      app: 'portal-docente-senai',
      version: SENAI_DATA_VERSION,
      createdAt: new Date().toISOString(),
      exportedBy: (SENAI_getSession() && SENAI_getSession().name) || 'desconhecido'
    },
    data: data
  };
}

function SENAI_restore(json) {
  if (!json || !json.data || typeof json.data !== 'object') return false;
  const bases = SENAI_dataKeys();
  const allowed = bases.concat([SENAI_USERS_KEY, SENAI_SESSION_KEY]);
  let restored = 0;
  Object.keys(json.data).forEach(k => {
    const isBase = bases.indexOf(k) !== -1;
    const isScoped = bases.some(b => k.startsWith(b + '__'));
    if ((isBase || isScoped) && json.data[k] !== undefined) {
      localStorage.setItem(k, JSON.stringify(json.data[k]));
      restored++;
    }
  });
  return restored > 0;
}

function SENAI_downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function SENAI_csvEscape(value) {
  const v = String(value === undefined || value === null ? '' : value);
  if (/["\n,;]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/* ═════════════════════════ Gestão de materiais didáticos (nacional) ═════════════════════════ */

const SENAI_MATERIAIS_KEY = 'senai_materiais_data';
const SENAI_COMUNICADOS_KEY = 'senai_comunicados_data';
const SENAI_CALENDARIO_KEY = 'senai_calendario_data';
const SENAI_MATERIAIS_TIPOS = [
  { id: 'pdf', label: 'Documento (PDF)' },
  { id: 'apresentacao', label: 'Apresentação (slides)' },
  { id: 'video', label: 'Vídeo' },
  { id: 'link', label: 'Link externo' },
  { id: 'plano_de_aula', label: 'Plano de aula' },
  { id: 'exercicio', label: 'Lista de exercícios' }
];

function SENAI_materiaisTipoLabel(id) {
  const t = SENAI_MATERIAIS_TIPOS.find(x => x.id === id);
  return t ? t.label : String(id || '');
}

function SENAI_loadMateriais() {
  const arr = SENAI_jsonGet(SENAI_MATERIAIS_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveMateriais(items) {
  SENAI_jsonSet(SENAI_MATERIAIS_KEY, items);
}

function SENAI_getMaterial(id) {
  return SENAI_loadMateriais().find(m => m.id === id) || null;
}

function SENAI_addMaterial(data) {
  const items = SENAI_loadMateriais();
  const ctx = SENAI_ctx();
  const item = {
    id: SENAI_uid(),
    titulo: String(data.titulo || '').trim(),
    tipo: String(data.tipo || 'link').trim(),
    disciplina: String(data.disciplina || '').trim(),
    curso: String(data.curso || '').trim(),
    tags: String(data.tags || '').trim(),
    unidadeOrigem: ctx.unidadeId || '',
    unidadeNome: ctx.unidadeLabel || '',
    autor: (SENAI_getSession() && SENAI_getSession().name) || 'Docente',
    autorRole: (SENAI_getSession() && SENAI_getSession().role) || 'professor',
    url: String(data.url || '').trim(),
    anexoNome: String(data.anexoNome || '').trim(),
    anexoMime: String(data.anexoMime || '').trim(),
    anexo: data.anexo || null,
    tamanho: Number(data.tamanho) || 0,
    status: 'aguardando',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    motivoRejeicao: ''
  };
  if (!item.titulo) throw new Error('Informe o título do material.');
  if (!item.url && !item.anexo && !item.anexoNome) throw new Error('Informe um link ou anexe o arquivo.');
  items.unshift(item);
  SENAI_saveMateriais(items);
  return item;
}

function SENAI_setMaterialStatus(id, status, motivo) {
  const items = SENAI_loadMateriais();
  const item = items.find(m => m.id === id);
  if (!item) return null;
  item.status = status === 'aprovado' ? 'aprovado' : (status === 'rejeitado' ? 'rejeitado' : 'aguardando');
  item.motivoRejeicao = item.status === 'rejeitado' ? String(motivo || '').trim() : '';
  item.atualizadoEm = new Date().toISOString();
  item.revisor = (SENAI_getSession() && SENAI_getSession().name) || '';
  if (item.status === 'aprovado') {
    item.aprovadoEm = item.atualizadoEm;
    item.aprovadoPor = item.revisor;
    item.aprovadoNaUnidade = (SENAI_getSession() && SENAI_getSession().unidadeId) || '';
  }
  SENAI_saveMateriais(items);
  return item;
}

function SENAI_deleteMaterial(id) {
  let items = SENAI_loadMateriais();
  const nova = items.filter(m => m.id !== id);
  if (nova.length === items.length) return false;
  SENAI_saveMateriais(nova);
  return true;
}

function SENAI_materiaisFilter(search, disciplina, tipo, status) {
  let items = SENAI_loadMateriais();
  const q = String(search || '').trim().toLowerCase();
  if (q) {
    items = items.filter(m =>
      String(m.titulo || '').toLowerCase().includes(q) ||
      String(m.tags || '').toLowerCase().includes(q) ||
      String(m.disciplina || '').toLowerCase().includes(q) ||
      String(m.curso || '').toLowerCase().includes(q) ||
      String(m.autor || '').toLowerCase().includes(q)
    );
  }
  if (disciplina) items = items.filter(m => String(m.disciplina || '') === String(disciplina));
  if (tipo) items = items.filter(m => String(m.tipo || '') === String(tipo));
  if (status) items = items.filter(m => String(m.status || '') === String(status));
  return items;
}

/* ═════════════════════════ Comunicação institucional (mural nacional) ═════════════════════════ */

function SENAI_loadComunicados() {
  const arr = SENAI_jsonGet(SENAI_COMUNICADOS_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveComunicados(items) {
  SENAI_jsonSet(SENAI_COMUNICADOS_KEY, items);
}

function SENAI_addComunicado(data) {
  const items = SENAI_loadComunicados();
  const ctx = SENAI_ctx();
  const item = {
    id: SENAI_uid(),
    titulo: String(data.titulo || '').trim(),
    conteudo: String(data.conteudo || '').trim(),
    visibilidade: data.visibilidade === 'turma' ? 'turma' : 'todas_unidades',
    unidadeId: data.visibilidade === 'turma' ? ctx.unidadeId : '',
    unidadeNome: data.visibilidade === 'turma' ? ctx.unidadeLabel : '',
    autor: (SENAI_getSession() && SENAI_getSession().name) || 'Coordenação',
    criadoEm: new Date().toISOString(),
    publico: true
  };
  if (!item.titulo) throw new Error('Informe o título do comunicado.');
  items.unshift(item);
  SENAI_saveComunicados(items);
  return item;
}

function SENAI_deleteComunicado(id) {
  let items = SENAI_loadComunicados();
  const nova = items.filter(c => c.id !== id);
  if (nova.length === items.length) return false;
  SENAI_saveComunicados(nova);
  return true;
}

function SENAI_visibleComunicados() {
  const ctx = SENAI_ctx();
  return SENAI_loadComunicados().filter(c =>
    c.visibilidade === 'todas_unidades' || c.unidadeId === ctx.unidadeId
  );
}

/* ═════════════════════════ Calendário acadêmico nacional ═════════════════════════ */

function SENAI_loadCalendario() {
  const arr = SENAI_jsonGet(SENAI_CALENDARIO_KEY);
  return Array.isArray(arr) ? arr : [];
}

function SENAI_saveCalendario(items) {
  SENAI_jsonSet(SENAI_CALENDARIO_KEY, items);
}

function SENAI_addEventoCalendario(data) {
  const items = SENAI_loadCalendario();
  const ctx = SENAI_ctx();
  const item = {
    id: SENAI_uid(),
    data: String(data.data || ''),
    titulo: String(data.titulo || '').trim(),
    tipo: String(data.tipo || 'evento').trim(),
    escopo: data.escopo === 'nacional' ? 'nacional' : 'local',
    unidadeId: data.escopo === 'local' ? ctx.unidadeId : '',
    unidadeNome: data.escopo === 'local' ? ctx.unidadeLabel : '',
    criadoPor: (SENAI_getSession() && SENAI_getSession().name) || '',
    criadoEm: new Date().toISOString()
  };
  if (!item.data) throw new Error('Informe a data do evento.');
  if (!item.titulo) throw new Error('Informe o título do evento.');
  items.unshift(item);
  SENAI_saveCalendario(items);
  return item;
}

function SENAI_deleteEventoCalendario(id) {
  let items = SENAI_loadCalendario();
  const nova = items.filter(e => e.id !== id);
  if (nova.length === items.length) return false;
  SENAI_saveCalendario(nova);
  return true;
}

function SENAI_eventosVisiveis() {
  const ctx = SENAI_ctx();
  return SENAI_loadCalendario().filter(e =>
    e.escopo !== 'local' || e.unidadeId === ctx.unidadeId
  );
}

/* ═════════════════════════ Justificativa de falta / abono ═════════════════════════ */

function SENAI_justificarFalta(alunoId, meta) {
  const students = SENAI_loadStudents();
  const s = students.find(x => x.id === alunoId);
  if (!s) return null;
  if (!s.justificativas) s.justificativas = [];
  s.justificativas.push({
    id: SENAI_uid(),
    dataAula: String(meta.dataAula || ''),
    motivo: String(meta.motivo || '').trim(),
    anexoNome: String(meta.anexoNome || '').trim(),
    anexo: meta.anexo || null,
    status: 'aguardando',
    criadoEm: new Date().toISOString(),
    criadoPor: (SENAI_getSession() && SENAI_getSession().name) || ''
  });
  SENAI_saveStudents(students);
  return s;
}

function SENAI_revisarJustificativa(alunoId, justId, status) {
  const students = SENAI_loadStudents();
  const s = students.find(x => x.id === alunoId);
  if (!s || !Array.isArray(s.justificativas)) return null;
  const j = s.justificativas.find(x => x.id === justId);
  if (!j) return null;
  j.status = status === 'aprovado' ? 'aprovado' : status === 'negado' ? 'negado' : 'aguardando';
  j.revisadoEm = new Date().toISOString();
  j.revisor = (SENAI_getSession() && SENAI_getSession().name) || '';
  if (!s.faltasJustificadas) s.faltasJustificadas = [];
  if (j.status === 'aprovado' && j.dataAula && s.faltasJustificadas.indexOf(j.dataAula) === -1) {
    s.faltasJustificadas.push(j.dataAula);
  } else if (j.status === 'negado') {
    s.faltasJustificadas = s.faltasJustificadas.filter(d => d !== j.dataAula);
  }
  SENAI_saveStudents(students);
  return j;
}

function SENAI_calcFreqComAbono(aluno, aulas) {
  const today = SENAI_todayKey();
  const past = Array.isArray(aulas) ? aulas.filter(a => a.date !== today) : [];
  if (past.length === 0) return SENAI_clamp(aluno.freq, 0, 100);
  const abonadas = new Set((aluno.justificativas || [])
    .filter(j => j.status === 'aprovado' && j.dataAula)
    .map(j => String(j.dataAula)));
  const presentes = past.filter(a => {
    if ((a.presenteIds || []).indexOf(aluno.id) !== -1) return true;
    if (abonadas.has(String(a.date))) return true;
    return false;
  }).length;
  return Math.round((presentes / past.length) * 100);
}

function SENAI_pendingJustificativas() {
  const out = [];
  SENAI_loadStudents().forEach(s => {
    (s.justificativas || [])
      .filter(j => j.status === 'aguardando')
      .forEach(j => out.push({ alunoId: s.id, alunoNome: s.name, ...j }));
  });
  return out;
}

/* ═════════════════════════ Sync com o servidor (SQLite nacional) ═════════════════════════ */

const SENAI_SYNC_ANCHOR_KEY = 'senai_sync_anchor';
const SENAI_SYNC_BASES = [
  SENAI_STUDENTS_KEY, SENAI_AULAS_KEY, SENAI_OCORRENCIAS_KEY,
  SENAI_CONFIG_KEY, SENAI_DIARIO_KEY, SENAI_RESERVAS_KEY,
  SENAI_SUBTURMAS_KEY, SENAI_CLASSROOM_KEY, SENAI_MATERIAIS_KEY,
  SENAI_COMUNICADOS_KEY, SENAI_USERS_KEY, SENAI_CALENDARIO_KEY
];

const SENAI_sync = {
  connected: null,
  lastSync: null,
  pending: false,
  dirty: new Set(),
  timer: null,

  collect() {
    const data = {};
    const keys = new Set();
    SENAI_SYNC_BASES.forEach(b => keys.add(b));
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && SENAI_SYNC_BASES.some(b => k === b || k.startsWith(b + '__'))) keys.add(k);
    }
    keys.forEach(k => {
      try {
        const v = localStorage.getItem(k);
        if (v) data[k] = JSON.parse(v);
      } catch (e) {}
    });
    return data;
  },

  markDirty(key) {
    this.dirty.add(key);
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 700);
  },

  push() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const payload = this.collect();
    try {
      fetch('/api/data', {
        method: 'PUT',
        headers: SENAI_authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ data: payload })
      })
        .then(r => r.json().catch(() => ({})))
        .then(res => {
          if (res && res.ok) {
            this.pending = false;
            this.lastSync = new Date();
            this.connected = true;
            if (res.updatedAt) localStorage.setItem(SENAI_SYNC_ANCHOR_KEY, String(res.updatedAt));
            this.dirty.clear();
          } else {
            this.connected = false;
          }
        })
        .catch(() => { this.connected = false; });
    } catch (e) {}
  },

  pull() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { this.connected = false; return; }
    fetch('/api/data', { headers: SENAI_authHeaders({ Accept: 'application/json' }), signal: AbortSignal.timeout(4000) })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(server => {
        if (!server || typeof server.data !== 'object') throw new Error('sem dados');
        this.connected = true;
        this.lastSync = new Date();
        const serverData = server.data || {};
        const serverUpdated = String(server.updatedAt || 0);
        const oldAnchor = localStorage.getItem(SENAI_SYNC_ANCHOR_KEY);
        let wrote = false;
        Object.entries(serverData).forEach(([k, v]) => {
          if (this.dirty.has(k)) return;
          try { localStorage.setItem(k, JSON.stringify(v)); wrote = true; } catch (e) {}
        });
        localStorage.setItem(SENAI_SYNC_ANCHOR_KEY, serverUpdated);
        if (Object.keys(serverData).length === 0) {
          const local = this.collect();
          if (Object.keys(local).length > 0) this.push();
        }
        if (serverUpdated !== oldAnchor && wrote && !sessionStorage.getItem('senai_reloaded')) {
          sessionStorage.setItem('senai_reloaded', '1');
          window.location.reload();
        }
        window.dispatchEvent(new CustomEvent('senai:synced', { detail: { updatedAt: serverUpdated } }));
      })
      .catch(() => { this.connected = false; });
  },

  status() {
    return { connected: this.connected, lastSync: this.lastSync, pending: this.pending };
  }
};

function SENAI_initSync() {
  if (typeof SENAI_sync === 'undefined') return;
  SENAI_sync.pull();
  window.addEventListener('online', () => SENAI_sync.push());
}

function SENAI_syncAudit(acao, detalhe) {
  const s = SENAI_getSession() || {};
  try {
    fetch('/api/log', {
      method: 'POST',
      headers: SENAI_authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ papel: s.role || '', usuario: s.name || '', acao: String(acao || ''), detalhe: String(detalhe || '') })
    }).catch(() => {});
  } catch (e) {}
}

function SENAI_syncStatusHTML() {
  const st = SENAI_sync.status();
  if (st.connected === false) return '<span class="sync-dot sync-off"></span>Offline (local)';
  if (st.pending) return '<span class="sync-dot sync-pending"></span>Sincronizando&hellip;';
  if (st.lastSync) {
    const h = String(st.lastSync.getHours()).padStart(2, '0');
    const m = String(st.lastSync.getMinutes()).padStart(2, '0');
    return '<span class="sync-dot sync-on"></span>Servidor &middot; ' + h + ':' + m;
  }
  return '<span class="sync-dot sync-pending"></span>Conectando&hellip;';
}

if (typeof window !== 'undefined') {
  SENAI_initSync();

  // PWA: injeta o manifest e registra o service worker (todas as páginas)
  try {
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link');
      l.rel = 'manifest';
      l.href = '/manifest.json';
      document.head.appendChild(l);
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      });
    }
  } catch (e) {}

  // Setup de aplicação (tema/LGPD) - hook para itens de UI globais
  if (typeof SENAI_setupGlobalUI === 'function') SENAI_setupGlobalUI();
}