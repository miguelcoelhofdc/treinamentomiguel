# Correspondência de padrões — coaching

## Resumo

- Produto: aplicativo pessoal de treino, com prioridade para celular.
- Objeto principal: sessão prescrita para uma data, vinculada a um objetivo e ao registro realizado.
- Receita: `recipes/mobile-notes-app.md` do codex-ui-designer-kit.
- Padrões: `mobile-app/notes-workbench`, `settings/settings-form-page`, `states/loading-empty-error-set`.
- Não selecionados: CRM, tabelas de dados e AI workbench. A tarefa principal é começar uma sessão, sem gerenciar clientes ou conversar com IA.

## Escolha e mapeamento

| Padrão | Aplicação | Estrutura aproveitada | Elementos não copiados |
|---|---|---|---|
| mobile-app/notes-workbench | Início, Treino e Rotina | Objeto com ação principal, lista de dias, detalhe e resultado | Marcas, conteúdo de notas e recursos de compartilhamento |
| settings/settings-form-page | Configuração em quatro etapas | Rótulos, validação próxima ao campo, resumo antes de salvar | Chaves de API, permissões e áreas administrativas |
| states/loading-empty-error-set | Todas as telas | Carregamento, erro com nova tentativa, vazio com próxima ação | Texto genérico e estados sem ligação com a persistência |

| Objeto do projeto | Objeto do padrão | Campos relevantes |
|---|---|---|
| CoachingSettings | Configuração | Objetivo, dias, minutos, nível, local, equipamentos, limitações |
| PlannedSession | Item e detalhe | Data, duração, sequência, instruções, estado |
| ActivityLog / RunningLog | Resultado | Conclusão, minutos e distância realmente registrados |
| TrainingGoal | Meta opcional | Quantidade, prazo e resultado, separado da adesão ao plano |

## Estados e fontes

Carregamento usa os componentes existentes. Erros de gravação mantêm os dados do formulário. Botões ficam desabilitados durante gravação. Escolhas usam `aria-pressed`; etapas usam `aria-current`. Dias de recuperação têm explicação. Metas atingidas ou vencidas oferecem revisão.

As fontes e licenças foram verificadas nos `source-map.json` locais: padrões móveis e estados são documentação composta do kit; forms referenciam shadcn/ui e Origin UI, ambos MIT. Foram usadas ideias de estrutura, sem copiar código ou ativos externos, e sem novas dependências.

## Revisão humana

A implementação local e reversível foi expressamente solicitada. A validação utilizou dados sintéticos em navegadores isolados. Não houve publicação, envio a terceiros, alteração de permissões ou uso de credenciais reais. Backup e restauração mantêm o fluxo de confirmação existente, acionado pela pessoa. Não há aprovação pendente para entregar a prévia local.
