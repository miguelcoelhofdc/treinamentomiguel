# Design e comportamento do coaching

## Direção

Aplicativo móvel de treino. A sessão diária é o objeto principal. Receita `mobile-notes-app`, com os padrões `mobile-app/notes-workbench`, `settings/settings-form-page` e `states/loading-empty-error-set` do codex-ui-designer-kit. A estrutura foi adaptada ao React, CSS e componentes existentes, sem copiar código de fontes externas.

## Telas

| Tela / componente | Papel | Celular e desktop |
|---|---|---|
| CoachingSetup | Objetivo → disponibilidade → condições → meu plano | Escolhas grandes, campos rotulados, validação e prévia de sete dias |
| CoachHome | Dizer o próximo passo | Uma ação principal; semana e resumo abaixo |
| CoachTraining | Executar a prescrição | Blocos e ExerciseCard com séries, repetições e pausas geradas |
| CoachPlan | Consultar semana e mês | Lista semanal, calendário e detalhes; futuras sessões como previsão |
| CoachSummary | Separar execução e resultado | Adesão ao plano, meta opcional e revisão |
| Folha de conclusão | Registrar o que aconteceu | Minutos e esforço opcionais; dor e distância quando aplicável |

## Regras compartilhadas

`src/lib/coaching.ts` gera o calendário com orçamento de tempo, equipamentos, limitações, recuperação e sequência. Não usa rede. As sessões persistidas contêm os blocos e sua prescrição. Após começar ou concluir, a sessão mantém essa versão mesmo ao mudar objetivo ou disponibilidade.

A progressão usa duas conclusões equivalentes com esforço fácil/adequado e sem dor. Sem feedback suficiente mantém o estágio. Dor pausa progressão e seleciona recuperação no dia; baixa energia ou esforço pesado usa versão leve. Faltas preservam a sequência e não geram treinos acumulados. Registros anteriores à configuração continuam na Evolução.

Força usa séries estruturadas e estimativa conservadora de execução, descanso e transições. Corrida usa estágios de caminhada/corrida, considerando a capacidade declarada. Referências fornecidas no plano: [ACSM](https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf) e [NHS](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/). A biblioteca é uma adaptação do produto, não uma reprodução integral dessas fontes.

## Estado e apresentação

Paleta, fontes, componentes e navegação preservados. Erros próximos à operação; carregamento explícito; escolhas com estado acessível; foco acompanha etapas e folhas. A ação principal tem área mínima de 44 px. O calendário mantém sete colunas sem exceder a largura do celular. Conteúdo central no desktop e coluna única nas tarefas móveis.

## Persistência e integração

- Types, settings e treinamento: `src/types/index.ts`, `src/hooks/useSettings.ts`, `src/lib/trainingSettings.ts`.
- Motor e testes: `src/lib/coaching.ts`, `src/lib/coaching.test.mjs`.
- Banco e transações: `src/db/index.ts`, `src/db/coaching.ts`; Dexie versão 4.
- Estado compartilhado e rota: `src/hooks/useCoaching.tsx`, `src/App.tsx`.
- Fluxo: `src/pages/CoachingSetup.tsx`, `src/components/coaching/`.
- Integração com legado: Today, Journey, Plan, Progress, ExerciseCard, TrainingControls e GoalEditor.
- Resultado real da corrida: `src/components/charts/PaceChart.tsx`.
- Backup/restauração: `src/pages/Settings.tsx`; exportação versão 3, aceitando backups anteriores.
- Aparência: `src/training.css`, sem alterar o visual das demais áreas.

Não foram adicionadas dependências, credenciais, permissões, publicação ou comunicações externas. Dados reais não foram alterados pelos testes. A implementação foi autorizada pelo pedido do usuário; operações de restauração seguem a confirmação existente da interface.
