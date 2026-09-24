# Portal do Docente SENAI

Sistema completo de apoio ao docente — **100% local**, sem depender de internet ou da nuvem.

- Frontend e backend embutidos num único arquivo Node (`server.js`), com uma dependência npm: `@google/generative-ai`.
- Banco de dados SQLite (`portal.sqlite`) com sincronização automática para o navegador (PWA / offline-first).
- Funciona como PWA: instala no celular/computador e abre offline após o primeiro uso.
- Assistente de IA via **Google Gemini** (`gemini-3.6-flash`) usando os dados da turma em tempo real. Sem a IA, o assistente responde offline.

## Rodando

Requisito: **Node.js 22+** (recomendado 24 LTS). Rode `npm install` uma única vez para instalar a dependência da IA.

```bash
npm install
node server.js
```

Depois abra **http://localhost:8000**.

No Windows, duplo clique em `iniciar-sistema.bat`. Use `instalar-tudo.bat` (instala as dependências npm e orienta sobre a chave do Gemini).

Login de demonstração:

| Perfil | Usuário | Senha |
|---|---|---|
| Professor | `123.456.789-00` | `senai2026` |
| Coordenação | `coord.senai` | `coordenador2026` |

## Recursos

- **Central da Aula** — visão geral da turma, atividades do dia.
- **Gestão da Turma** — cadastro de alunos e turmas.
- **Diário de Classe** — frequência e conteúdos por aula.
- **Presença & Frequência** — carômetro visual.
- **Ocorrências** — registro disciplinar.
- **Materiais** — repositório de arquivos (com aprovação da coordenação).
- **Reserva da Sala** — mapa de salas e reservas.
- **Assistente IA** — chat com o Google Gemini (gemini-1.5-flash).
- **Mural de Avisos** e **Calendário**.
- **Central Coordenação** — painel da equipe pedagógica.
- **Relatórios** — gera PDF (via jsPDF embutido, funciona offline).
- **Configurações** — contas, backups manual, integração Google Classroom (opcional).

## Estrutura

```
server.js            backend + API + banco (arquivo único)
pages/               páginas HTML (PWA)
js/                  scripts do front (data.js, auth.js, sidebar.js, vendor/jsPDF)
css/                 estilos
img/                 ícones e logo
service-worker.js    PWA / cache offline
instalar-tudo.bat    instala dependências npm (Windows)
iniciar-sistema.bat  inicia o servidor (Windows)
backups/             backups automáticos do banco (mantém 3)
```

## Segurança e funcionamento

- Senhas com **scrypt + sal** (hashes antigos SHA-256 são migrados no primeiro login).
- **Rate limit de login** (5 tentativas em 15 min) e sessões com token de 12h.
- **Isolamento por unidade**: sobrescrever `PUT /api/data` só aceita chaves da própria unidade; `GET /api/data` só devolve dados da própria unidade (nunca retorna hashes de usuários).
- Upload/download exigem autenticação; exclusão de materiais é restrita ao autor da unidade, coordenação ou papel nacional.
- CORS restrito à mesma origem (ou origens em `CORS_ORIGIN`).
- `.gitignore` protege `portal.sqlite*`, `backups/`, `classroom-config.json` e `classroom-tokens.json`.

## IA (Google Gemini)

O portal usa a API do Google Gemini (`gemini-3.6-flash`) para responder perguntas livres com os dados da turma (`POST /api/chat`).

1. Gere uma chave em https://aistudio.google.com/apikey (o formato é `AIza...`).
2. Defina como variável de ambiente `GEMINI_API_KEY` — ou edite o valor padrão na constante `GEMINI_API_KEY` do `server.js`.
3. O modelo pode ser alterado via env `GEMINI_MODEL` (padrão: `gemini-3.6-flash`).

Sem a chave, o assistente responde por consultas rápidas locais (resumo, risco, ausências, notas, frequência).

## Publicação no GitHub

O repositório contém o código-fonte completo sem dados sensíveis. Ao publicar, o `portal.sqlite` e o `backups/` **não** são versionados — os dados ficam somente na sua máquina.

## Testes

`node test.js` sobe uma instância isolada (porta e banco temporários) e valida: saúde da API, páginas, autenticação, isolamento por unidade, rate limit e CORS.