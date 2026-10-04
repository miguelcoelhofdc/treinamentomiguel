# Correspondência de padrões
Produto: aplicativo pessoal de treino e saúde. Objeto principal: check-in e sessão de atividade datada.
Receita: mobile-notes-app, adaptada ao cuidado diário; stack React, Vite e Tailwind existente.
## Padrões selecionados
- mobile-app/notes-workbench: navegação mobile, lista e detalhes; na Home o check-in é a tarefa principal.
- settings/settings-form-page: grupos de preferências, formulários e ações sensíveis separadas.
- states/loading-empty-error-set: carregamento, vazio, erro, seleção e gravação por contexto.
Dispensados: grids de KPIs, tabelas comerciais e efeitos decorativos. Nenhuma biblioteca ou código externo copiado.
## Mapeamento e riscos
Sessão → tarefa; exercício → item de lista; registro → histórico; perfil → configuração.
Os padrões internos permitem adaptação; as convenções de formulário são referência estrutural, sem copiar componentes de terceiros.
Mudanças autorizadas pelo usuário em todas as áreas de treino/saúde. Painel comercial e quadro excluídos.
QA utiliza dados sintéticos em navegador descartável. Os handlers e confirmações de backup/exclusão existentes são preservados.
