/**
 * BACKUP-EXTERNO.CJS
 * Copia um snapshot consistente do banco (VACUUM INTO) + a pasta backups/
 * para um pendrive ou pasta escolhida. Funciona com o servidor rodando.
 *
 * Uso:  node backup-externo.cjs <destino>     (ex.: D:\ ou E:\MeusBackups)
 *       node backup-externo.cjs                (procura D:\ e E:\)
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'portal.sqlite');
const BACKUPS_DIR = path.join(ROOT, 'backups');

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}

function escolherDestino() {
  const argv = process.argv[2];
  if (argv) return argv;
  for (const d of ['D:', 'E:', 'F:']) {
    try {
      if (fs.existsSync(d + '\\')) return d + '\\';
    } catch (e) {}
  }
  return null;
}

function escSql(p) {
  return String(p).replace(/'/g, "''");
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('ERRO: ' + DB_PATH + ' não existe. Rode o portal ao menos uma vez antes.');
    process.exit(1);
  }

  const destino = escolherDestino();
  if (!destino) {
    console.error('Informe o destino: node backup-externo.cjs D:\\   (ou outro caminho com espaço: "E:\\Meus Backups").');
    process.exit(1);
  }
  fs.mkdirSync(destino, { recursive: true });

  const base = 'backup-portal-' + ts();
  const snapshot = path.join(destino, base + '.sqlite');
  const destBackups = path.join(destino, 'backups');

  // 1) Snapshot consistente (funciona mesmo com WAL e servidor no ar)
  const db = new DatabaseSync(DB_PATH);
  db.exec("VACUUM INTO '" + escSql(snapshot) + "'");
  db.close();

  // 2) Copia a pasta de backups automáticos do servidor
  let copiados = 1;
  if (fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(destBackups, { recursive: true });
    for (const f of fs.readdirSync(BACKUPS_DIR)) {
      const src = path.join(BACKUPS_DIR, f);
      const dst = path.join(destBackups, f);
      fs.copyFileSync(src, dst);
      copiados++;
    }
  }

  console.log('Backup externo concluído!');
  console.log('  Snapshot: ' + snapshot + ' (' + (fs.statSync(snapshot).size / 1024 / 1024).toFixed(2) + ' MB)');
  if (fs.existsSync(destBackups)) {
    console.log('  Backups automáticos copiados para: ' + destBackups + ' (' + (copiados - 1) + ' arquivo(s))');
  }
  console.log('Guarde o pendrive em lugar seguro.');
}

try {
  main();
} catch (e) {
  console.error('Erro no backup: ' + e.message);
  process.exit(1);
}