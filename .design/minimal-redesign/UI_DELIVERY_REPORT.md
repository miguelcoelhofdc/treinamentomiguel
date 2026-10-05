# Entrega — redesign de treino e saúde

O app passou a organizar cada tela ao redor de uma tarefa. O check-in ocupa o primeiro plano no Início;
o Treino apresenta a sessão e sua execução; a Evolução separa resumo, saúde, histórico e metas. Guias e Perfil
abrem conteúdos progressivamente. O padrão visual usa Outfit, espaço livre, verde funcional e listas abertas.

## Estrutura entregue

- Início, Treino, Evolução, Guias e Perfil; barra inferior no mobile e menu lateral de 208 px a partir de 1024 px.
- Rotina mantém datas, consulta de prescrição e retorno a Hoje.
- Exercícios mostram nome/prescrição/conclusão; técnica, cargas e 3D são detalhes acessíveis.
- Evolução mantém as rotas e aceita aba=resumo|saude|historico|metas, com integração ao histórico do navegador.
- Saúde apresenta peso e data, preserva o gráfico e agrupa os dados de bem-estar.
- Histórico usa atividades reconciliadas, recentes primeiro, agrupadas por data e com carregamento progressivo.
- Metas conserva os cinco tipos, prazo, edição, encerramento e metas anteriores.
- Perfil agrupa Dados pessoais, Treino e rotina, Aparência, Conta e Dados e backup.
- Modais usam o mesmo painel, foco interno, Escape, retorno de foco e área segura.
- Estados vazios, carregando, salvando e erro apresentam orientação próxima da ação.

## Implementação

| Arquivos | Finalidade |
|---|---|
| src/training.css; src/components/BottomNav.tsx | Tokens e navegação exclusivos do app de treino. |
| src/pages/Journey.tsx; Today.tsx; Plan.tsx | Home, execução da sessão e consulta da rotina. |
| src/pages/Progress.tsx | Abas e apresentação progressiva da evolução. |
| src/components/progress/ActivityHistory.tsx; WellnessDetails.tsx | Histórico e detalhes de bem-estar. |
| src/pages/Guides.tsx; Settings.tsx; Access.tsx | Guias, perfil e acesso. |
| src/components/ui/BottomSheet.tsx; SegmentTabs.tsx; CollapsiblePanel.tsx | Painéis, abas acessíveis e expansões comuns. |
| src/components/journey/*; src/components/ExerciseCard.tsx | Ações, metas, conquistas, registros e exercícios. |
| src/components/visualizer/ExerciseVisualizerSheet.tsx | 3D no mesmo painel, controles de toque. |

## Antes e depois

| Tela | Antes preservado | Depois |
|---|---|---|
| Início mobile | [Antes](../continuous/journey-mobile.png) | [Depois](screenshots/final/panel-375-page--.png) |
| Início desktop | [Antes](../continuous/journey-desktop.png) | [Depois](screenshots/final/panel-1440-page--.png) |
| Evolução desktop | [Antes](../continuous/progress-desktop.png) | [Depois](screenshots/final/panel-1440-page--progresso-aba-resumo.png) |

## Validação

Resultados e comandos reproduzíveis: [UI_QA_REPORT.md](UI_QA_REPORT.md).
Avaliação visual: [VISUAL_SCORECARD.md](VISUAL_SCORECARD.md), média 4,31/5.
Auditoria, especificação e correspondência de padrões permanecem nesta pasta; registros anteriores não foram sobrescritos.

Regras, tipos persistidos, bancos por perfil, cálculos e prescrições seguem o código existente.
Não foram alterados o painel comercial /metas nem o quadro /quadro. Não há APIs novas, migração ou dependências adicionais.
O build foi atualizado com o cache offline. Não foi realizado deploy.

## Limites

O aviso de tamanho do módulo Three/3D já existente continua no build. Emulação de teclado/viewport não substitui teste
com teclado físico de iPhone e Safari. O perfil Cíntia mantém seu catálogo original: exercícios sem animação cadastrada
continuam sem botão 3D. A funcionalidade foi verificada nos movimentos que já possuem animação.
