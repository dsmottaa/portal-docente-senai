# PLANO DE IMPLEMENTAÇÃO — ReNova SENAI

## Visão Geral
Refatorar de **vanilla JS (14 páginas separadas)** → **React 18 + TypeScript + Vite (SPA única)**

### Telas a PRESERVAR (visual idêntico)
| Tela | Arquivo Atual | Status |
|------|---------------|--------|
| **Login** | `index.html` + `css/style.css` (login-page) | ✅ Manter pixel-perfect |
| **Minhas Turmas** | Nova tela (baseada em `dashboard.html` + `turma.html`) | 🎨 Recriar fiel ao design system atual |

### Telas a SUBSTITUIR por Diário de Classe (React SPA)
| Atual | Nova Aba no Diário |
|-------|-------------------|
| `dashboard.html` (Central da Aula) | Visão Geral + Frequência + Conteúdo |
| `diario.html` | Conteúdo + Visão Geral |
| `carometro.html` | Frequência |
| `ocorrencias.html` | Alunos → Ocorrências |
| `relatorios.html` | Relatórios |
| `turma.html` (gestão alunos) | Alunos → Dados + Notas + Frequência + Anotações + Histórico |
| `configuracao.html` | Settings (fora do Diário) |
| `materiais.html`, `mapa.html`, `ia.html`, `mural.html`, `calendario.html`, `central.html`, `instalacao.html` | **Remover** (fora do escopo ReNova) |

---

## Stack Tecnológica
- **React 18** + **TypeScript 5** + **Vite 5**
- **React Router 6** (SPA routing)
- **Zustand** (estado global leve, persistência em memória)
- **Tailwind CSS** (replicar design system SENAI via config)
- **Lucide React** (ícones - substituir SVGs inline)
- **React Hook Form + Zod** (formulários/validação)
- **date-fns** (datas PT-BR)
- **jspdf + autotable** (relatórios PDF - já no vendor)
- **VLibras** (manter widget acessibilidade)

---

## Estrutura de Pastas (src/)

```
src/
├── app/
│   ├── routes.tsx              # Rotas: /login → /minhas-turmas → /diario/:turmaId
│   ├── providers.tsx           # Providers: Theme, Auth, VLibras, Toasts
│   └── App.tsx
├── features/
│   ├── auth/                   # Login (preservar visual)
│   │   ├── components/LoginForm.tsx
│   │   ├── components/ForgotModal.tsx
│   │   └── hooks/useAuth.ts
│   ├── minhas-turmas/          # Minhas Turmas (preservar visual)
│   │   ├── components/TurmaCard.tsx
│   │   ├── components/TurmaTabs.tsx (Atuais/Anteriores)
│   │   └── hooks/useTurmas.ts
│   └── diario/                 # Diário de Classe (NOVO - core do ReNova)
│       ├── components/
│       │   ├── DiarioLayout.tsx           # Layout fixo: header + tabs + content
│       │   ├── HeaderContexto.tsx         # "4RM • Segurança de Redes | 2º Período - Turma A"
│       │   ├── TabsNav.tsx                # 8 abas navegáveis
│       │   ├── AbaVisaoGeral.tsx
│       │   ├── AbaFrequencia.tsx
│       │   ├── AbaConteudo.tsx
│       │   ├── AbaNotas.tsx
│       │   ├── AbaAlunos/                 # Ficha 360°
│       │   │   ├── AlunoList.tsx
│       │   │   ├── AlunoFicha360.tsx      # Modal/Drawer com 6 sub-abas
│       │   │   ├── SubAbaDados.tsx
│       │   │   ├── SubAbaFrequencia.tsx
│       │   │   ├── SubAbaNotas.tsx
│       │   │   ├── SubAbaAnotacoes.tsx
│       │   │   ├── SubAbaOcorrencias.tsx
│       │   │   └── SubAbaHistorico.tsx
│       │   ├── AbaSubturmas.tsx
│       │   ├── AbaPlanejamento.tsx
│       │   ├── AbaRelatorios.tsx
│       │   └── AbaGestaoSalas.tsx
│       ├── hooks/
│       │   ├── useDiario.ts               # Estado global do diário (Zustand)
│       │   ├── useFrequencia.ts
│       │   ├── useNotas.ts
│       │   ├── useAlunos.ts
│       │   ├── useSubturmas.ts
│       │   ├── usePlanejamento.ts
│       │   ├── useSalas.ts
│       │   └── useRelatorios.ts
│       ├── store/
│       │   └── diarioStore.ts             # Zustand store único (SPA state persistence)
│       ├── types/
│       │   └── diario.ts                  # 52+ interfaces TypeScript
│       └── utils/
│           ├── messages.ts                # Mensagens amigáveis (regra: nada de "Erro")
│           ├── calculos.ts                # Média consolidada, consolidação faltas
│           └── validators.ts              # Zod schemas
├── shared/
│   ├── ui/                              # Design System SENAI (Button, Card, Input, Modal, Table, Badge, Toast, Tabs, Select, Tooltip)
│   ├── hooks/                           # useLocalStorage, useDebounce, useKeyboardShortcut
│   ├── utils/                           # cn (clsx), formatters, constants
│   └── styles/
│       ├── globals.css                  # Tailwind + variáveis CSS SENAI
│       └── theme.css                    # Tema claro/escuro (preservar)
├── data/
│   └── mocks/
│       ├── professor.ts                 # Prof. Flávio Almeida
│       ├── turma-4RM.ts                 # 32 alunos com histórico
│       ├── avaliacoes.ts                # Template avaliações
│       ├── planejamento.ts              # PTD/Plano de aula
│       ├── salas.ts                     # Salas disponíveis
│       └── ocorrencias.ts               # Tipos + exemplos
└── main.tsx
```

---

## Regras de Negócio (52) - Mapeamento para Implementação

### Autenticação & Contexto (3)
- [ ] R1: Login com CPF/usuário + senha + Caps Lock indicator
- [ ] R2: "Esqueci senha" modal funcional
- [ ] R3: Sessão Prof. Flávio Almeida persistida

### Minhas Turmas (5)
- [ ] R4: Lista cards turmas Atuais/Anteriores
- [ ] R5: Card mostra: código, disciplina, período, turno, qtd alunos, status
- [ ] R6: Click no card → navega para Diário de Classe
- [ ] R7: Filtro busca por código/disciplina
- [ ] R8: Badge "Ativa" na turma corrente

### Diário de Classe - Layout (4)
- [ ] R9: Header fixo com contexto "4RM • Segurança de Redes | 2º Período - Turma A"
- [ ] R10: 8 abas navegáveis (Visão Geral, Frequência, Conteúdo, Notas, Alunos, Subturmas, Planejamento, Relatórios, Gestão Salas)
- [ ] R11: Estado das abas preservado ao alternar (Zustand)
- [ ] R12: Breadcrumbs: Minhas Turmas > 4RM > Diário de Classe

### Aba Visão Geral (4)
- [ ] R13: Cards métricas: % frequência, média turma, alunos em risco, aulas dadas/previstas
- [ ] R14: Alertas: alunos com < 75% frequência, notas < 6, ocorrências abertas
- [ ] R15: Próximas aulas (calendário compacto)
- [ ] R16: Ações rápidas: "Lançar frequência hoje", "Nova anotação", "Ver relatório"

### Aba Frequência (6)
- [ ] R17: Grade alunos x datas (scroll horizontal virtualizado)
- [ ] R18: 3 estados: Presente (verde), Falta (vermelho), Atraso (amarelo) — **não converte atraso em falta**
- [ ] R19: Click ciclo: P → F → A → P
- [ ] R20: Salvamento automático com toast "Frequência salva às 14:32"
- [ ] R21: Janela temporal: editar até 5 dias úteis (regra SENAI)
- [ ] R22: Totais por aluno e por aula (rodapé fixo)

### Aba Conteúdo (4)
- [ ] R23: Seleção de aula (data + nº ordem)
- [ ] R24: Botão "Usar Conteúdo Planejado" puxa competências/habilidades do PTD
- [ ] R25: Validação: aula prevista vs reposição (badge colorido)
- [ ] R26: Editor rico para tema + competências + observações

### Aba Notas (5)
- [ ] R27: Grade alunos x avaliações (AV1, AV2, PRÁTICA, etc.)
- [ ] R28: Média consolidada por aluno (ponderada)
- [ ] R29: Suporte a múltiplos professores (coluna "Professor")
- [ ] R30: Formatação 0-100, casas decimais configuráveis
- [ ] R31: Conditional formatting: < 60 vermelho, 60-70 amarelo, > 70 verde

### Aba Alunos - Ficha 360° (12)
- [ ] R32: Lista lateral buscável (nome, matrícula, bancada)
- [ ] R33: Click abre drawer/modal com 6 sub-abas
- [ ] R34: **Dados**: foto, nome, matrícula, CPF, contato, responsável, bancada, subturma
- [ ] R35: **Frequência**: histórico por data + consolidação automática (total faltas, %, consecutivas)
- [ ] R36: **Notas**: todas avaliações + média + evolução gráfica (sparkline)
- [ ] R37: **Anotações**: CRUD + toggle Privada/Compartilhada (ícones 🔒/👥)
- [ ] R38: **Ocorrências**: lista + nova ocorrência (tipo, severidade, descrição, anexo)
- [ ] R39: **Histórico**: timeline unificada (frequência + notas + anotações + ocorrências)
- [ ] R40: Navegação teclado (setas ↑↓ trocam aluno mantendo sub-aba)
- [ ] R41: Imprimir ficha individual (PDF)
- [ ] R42: Exportar ficha (JSON)
- [ ] R43: Badge risco (Baixo/Médio/Alto) calculado em tempo real

### Aba Subturmas (4)
- [ ] R44: Criação inteligente: Sequencial (A,B,C...), Aleatória, Manual (drag-drop)
- [ ] R45: Cards visual: nome, qtd alunos, cor identificadora
- [ ] R46: Exclusão guiada: modal "Transferir alunos para:" ou "Remover alunos"
- [ ] R47: Filtro global por subturma (persiste em todas abas)

### Aba Planejamento (3)
- [ ] R48: Visualização PTD: Unidades > Competências > Habilidades > Aulas
- [ ] R49: Status por aula: Prevista / Dada / Reposição / Cancelada
- [ ] R50: Link rápido "Usar na Aba Conteúdo" (R24)

### Aba Relatórios (3)
- [ ] R51: PDF Diário de Classe (frequência + conteúdo + notas)
- [ ] R52: PDF Ficha Aluno (360°)
- [ ] R53: CSV Frequência (formato SGE)
- [ ] R54: Impressão dedicada (@media print otimizado)

### Aba Gestão de Salas (3)
- [ ] R55: Calendário mensal com salas por aula
- [ ] R56: Verificação disponibilidade tempo real (conflito = toast explicativo)
- [ ] R57: Reserva/bloqueio sala por aula/data

### UX & Mensagens (3)
- [ ] R58: Zero erros genéricos — sempre mensagem explicativa da regra
- [ ] R59: Toasts: sucesso (verde), aviso (amarelo), erro (vermelho), info (azul)
- [ ] R60: Loading states em todos botões async
- [ ] R61: Confirmações destrutivas (modal "Tem certeza? Isso irá...")

### Acessibilidade & Qualidade (2)
- [ ] R62: VLibras widget funcional
- [ ] R63: Navegação teclado completa (Tab, Enter, Esc, Setas)
- [ ] R64: ARIA labels em todos componentes interativos

---

## Dados Mock (Prof. Flávio Almeida + 4RM)

```typescript
// Professor
{
  id: 'prof-flavio',
  nome: 'Flávio Almeida',
  email: 'flavio.almeida@senai.br',
  cpf: '123.456.789-00',
  matricula: 'DOC-2024-001',
  avatar: 'FA'
}

// Turma 4RM - Segurança de Redes
{
  id: 'turma-4RM',
  codigo: '4RM',
  disciplina: 'Segurança de Redes',
  periodo: '2º Período',
  turma: 'A',
  turno: 'Noite',
  curso: 'Técnico em Redes de Computadores',
  cargaHoraria: 80,
  salaPadrao: 'Lab 309',
  alunos: 32, // mockados com: nome, matricula, cpf, bancada, frequencia[], notas[], anotacoes[], ocorrencias[], subturma, risco
  avaliacoes: [
    { id: 'av1', nome: 'AV1 - Conceitos', peso: 30, dataPrevista: '2024-03-15' },
    { id: 'av2', nome: 'AV2 - Prática Firewall', peso: 40, dataPrevista: '2024-05-20' },
    { id: 'av3', nome: 'AV3 - Projeto Final', peso: 30, dataPrevista: '2024-07-10' }
  ],
  planejamento: [/* 20 aulas previstas com competências/habilidades */],
  salas: ['Lab 309', 'Lab 310', 'Sala 205', 'Auditório']
}
```

---

## Cronograma Sugerido

| Fase | Entregável | Estimativa |
|------|------------|------------|
| **0. Setup** | Vite + React + TS + Tailwind + Design System base | 2h |
| **1. Login** | Portar `index.html` → React (pixel-perfect) | 3h |
| **2. Minhas Turmas** | Tela cards Atuais/Anteriores + navegação | 3h |
| **3. Diário Layout** | Header fixo + 8 abas + Zustand store | 4h |
| **4. Aba Frequência** | Grade virtualizada + 3 estados + janela temporal | 6h |
| **5. Aba Conteúdo** | Editor + integração Planejamento | 4h |
| **6. Aba Notas** | Grade + média consolidada + multi-professor | 5h |
| **7. Aba Alunos (360°)** | Lista + Drawer 6 sub-abas + navegação teclado | 8h |
| **8. Aba Subturmas** | Criação 3 modos + exclusão guiada | 4h |
| **9. Aba Planejamento** | Visualização PTD estruturada | 3h |
| **10. Aba Relatórios** | PDF + CSV + Print | 4h |
| **11. Aba Gestão Salas** | Calendário + conflitos | 3h |
| **12. Polish** | Mensagens, A11y, VLibras, Testes | 4h |
| **TOTAL** | | **~53h** |

---

## Próximos Passos Imediatos

1. **Criar projeto Vite + React + TS** na pasta `renova/` (separado do legado)
2. **Configurar Tailwind** com cores SENAI (extrair de `style.css`)
3. **Portar Login** componente por componente
4. **Criar Minhas Turmas** 
5. **Estruturar Diário** com store Zustand
6. **Implementar abas** na ordem de dependência (Frequência → Conteúdo → Notas → Alunos → demais)

---

## Decisões Técnicas Importantes

| Decisão | Justificativa |
|---------|---------------|
| **Zustand vs Redux** | Menos boilerplate, API simples, persistência seletiva fácil |
| **React Router vs TanStack Router** | Router v6 estável, equipe conhece |
| **Tailwind vs CSS Modules** | Design system SENAI mapeia 1:1 para tokens Tailwind |
| **Drawer vs Modal para Ficha 360°** | Drawer lateral melhora UX em desktop (painel fixo) |
| **Virtualização (tanstack/virtual)** | Grade frequência 32 alunos × ~40 aulas = 1280 cells |
| **Manter `data.js` logic** | Migrar regras de negócio puro para `utils/calculos.ts` (testável) |