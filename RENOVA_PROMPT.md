# PROMPT DEFINITIVO — RE NOVA SENAI | PORTAL DO PROFESSOR

Atue como um Desenvolvedor Frontend Senior especialista em React, TypeScript e UI/UX Educacional.
Refatore o código do projeto para implementar a arquitetura e todas as 52 regras de negócio do "ReNova SENAI — Portal do Professor".
⚠ DIRETRIZ MANDATÓRIA DE LAYOUT
MANTER INTACTO O DESIGN EXISTENTE DA TELA DE LOGIN E DA TELA DE MINHAS TURMAS: Não altere a estrutura, cores, cards e disposição que já foram criados. O foco é refatorar a navegação interna e construir o Diário de Classe com todas as suas abas e inteligência de dados.

## 1. ARQUITETURA E NAVEGAÇÃO
Siga rigidamente o fluxo:
LOGIN  ➜  MINHAS TURMAS (Atuais / Anteriores)  ➜  DIÁRIO DE CLASSE

No Diário de Classe, preserve o cabeçalho fixo com o contexto (4RM • Segurança de Redes | 2º Período - Turma A) e disponibilize as abas:

**Visão Geral:** Resumo, métricas da turma, alertas e atalhos.

**Frequência:** Marcação rápida (Presença, Falta, Atraso sem converter atraso em falta automáticas), salvamento com feedback visual e janela temporal de alteração.

**Conteúdo:** Integração com o Planejamento (botão [Usar Conteúdo Planejado] para puxar competências/habilidades) e validação de aula prevista/reposição.

**Notas:** Lançamento por avaliação e exibição de Média Consolidada (com suporte a múltiplos professores).

**Alunos (Ficha 360°):**
- Dados
- Frequência (Histórico detalhado por data + Consolidação Automática de Faltas sem necessidade de PDF)
- Notas
- Anotações (com permissão Privada / Compartilhada)
- Ocorrências
- Histórico

**Subturmas:** Criação inteligente (Sequencial, Aleatória, Manual) e exclusão guiada (Transferir ou Remover alunos).

**Planejamento:** Visualização estruturada do PTD/Plano de aula.

**Relatórios:** Exportação e impressão dedicada.

**Gestão de Salas:** Sala vinculada por aula/data, com verificação de disponibilidade em tempo real e bloqueio claro em caso de conflito de reserva.

## 2. COMPORTAMENTO E DADOS (SPA)
- **Professor Logado:** Prof. Flávio Almeida.
- **Turma Principal:** 4RM — Segurança de Redes (32 alunos mockados com histórico de faltas e notas).
- **Regras de Mensagens:** Nunca exiba erros genéricos como "Erro". Sempre explique a regra do sistema (ex: "A Sala 309 já está reservada por outro professor" ou "Transfira os alunos antes de excluir a subturma").
- **Estado Global:** Mantenha o estado global em memória (SPA) garantindo que alternar abas não perca os dados inseridos.