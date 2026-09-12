# Portal do Docente SENAI

Sistema completo de apoio ao docente — **100% local**, sem depender de internet ou da nuvem.

- Frontend e backend embutidos num único arquivo Node (`server.js`), **zero dependências** (`node:sqlite`, `http`, `crypto`).
- Banco de dados SQLite (`portal.sqlite`) com sincronização automática para o navegador (PWA / offline-first).
- Funciona como PWA: instala no celular/computador e abre offline após o primeiro uso.
- Assistente de IA local via [Ollama](https://ollama.com) (padrão: `qwen2.5:3b`). Sem IA instalada, o assistente responde offline.

## Rodando

Requisito: **Node.js 22+** (recomendado 24 LTS). Não há `npm install`.

```bash
node server.js
```

Depois abra **http://localhost:8000**.

No Windows, duplo clique em `iniciar-sistema.bat`. Se o Ollama/IA não estiver instalado, use `instalar-tudo.bat` (baixa o Node? não — baixa e instala o Ollama + modelo e avisa sobre o Node).

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
- **Assistente IA** — chat com modelo local (Ollama).
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
instalar-tudo.bat    instala Ollama + modelo (Windows)
iniciar-sistema.bat  inicia o servidor (Windows)
backups/             backups automáticos do banco (mantém 3)
backup-externo.cjs   backup para pendrive/pasta externa
backup-externo.bat   atalho do backup externo (Windows)
```

## Segurança e funcionamento

- Senhas com **scrypt + sal** (hashes antigos SHA-256 são migrados no primeiro login).
- **Rate limit de login** (5 tentativas em 15 min) e sessões com token de 12h.
- **Isolamento por unidade**: sobrescrever `PUT /api/data` só aceita chaves da própria unidade; `GET /api/data` só devolve dados da própria unidade (nunca retorna hashes de usuários).
- Upload/download exigem autenticação; exclusão de materiais é restrita ao autor da unidade, coordenação ou papel nacional.
- CORS restrito à mesma origem (ou origens em `CORS_ORIGIN`).
- `POST /api/data/reset` (somente coordenação/nacional) limpa os dados operacionais mantendo os usuários criados.
- `.gitignore` protege `portal.sqlite*`, `backups/`, `classroom-config.json` e `classroom-tokens.json`.

## IA local (Ollama)

Instale o Ollama e o modelo:

```bash
ollama pull qwen2.5:3b
```

Modelos recomendados (escolha na tela de IA — o seletor lista os instalados):

| Modelo | Velocidade | Qualidade | Ideal para |
|---|---|---|---|
| `qwen2.5:1.5b` | ⚡ Muito rápida (CPU simples) | Básica | Notebooks modestos; respostas rápidas |
| `qwen2.5:3b` | Normal | Boa | Uso diário com boa qualidade |
| `qwen2.5:7b` | Lenta sem GPU | Excelente | Máquinas com GPU ou poucos usuários |

Modelos maiores também podem ser usados, desde que instalados (`ollama pull`). O modelo padrão pode ser alterado pela constante `MODEL` no `server.js`. Endereço configurável via env `OLLAMA_HOST`.

## Acesso na rede local (outro aparelho na sala)

O servidor já escuta em todas as interfaces. Ao iniciar, ele **imprime no console os endereços da rede** (ex.: `http://192.168.1.20:8000`).

1. Notebook e aparelho(s) conectados no **mesmo Wi-Fi**.
2. Abra no outro aparelho o endereço impresso no console do servidor (ou descubra o IP do notebook e use `http://IP:8000`).
3. O primeiro acesso pode demorar um pouco (download do PWA); depois funciona offline.

> **Importante:** a integração com Google Classroom (OAuth) só funciona em `http://localhost` — em outros aparelhos o botão de login do Google fica indisponível (os demais recursos funcionam normalmente).

## Backup externo (pendrive)

Gere um **snapshot consistente do banco + a pasta `backups/`** em um pendrive ou pasta externa — pode ser feito com o servidor rodando:

```bash
node backup-externo.cjs D:\            # pendrive
node backup-externo.cjs "E:\Meu Backup" # pasta com espaço
node backup-externo.cjs                 # procura automaticamente D:, E: ou F:
```

No Windows também há o atalho `backup-externo.bat` (clique duas vezes). Recomenda-se rodar ao menos 1× por semana e guardar o pendrive em lugar seguro.

## Publicação no GitHub

O repositório contém o código-fonte completo sem dados sensíveis. Ao publicar, o `portal.sqlite` e o `backups/` **não** são versionados — os dados ficam somente na sua máquina.

## Testes

`node test.js` sobe uma instância isolada (porta e banco temporários) e valida: saúde da API, páginas, autenticação, isolamento por unidade, rate limit, CORS e reset de dados.