# Pattern match — Início

- Produto: aplicativo pessoal de saúde; objetos: treino, check-in e dias ativos.
- Receita: `mobile-notes-app`, adaptada a captura rápida e resumo diário.
- Padrões: `mobile-app/notes-workbench` (navegação, captura, detalhe em painel) e `states/loading-empty-error-set` (carregamento, vazio, erro e recuperação).
- Referência visual principal: imagem fornecida pelo usuário; branco, cinza-claro, violeta, cantos arredondados e baixa densidade. A referência prevalece sobre os raios pequenos sugeridos no padrão.
- Mapeamento: QuickCapture → registrar treino/check-in; lista → último treino; detalhe → SessionDetails; BottomNav → navegação existente.
- Imitar hierarquia, fluxo e cobertura de estados. Não copiar conteúdo de loja, marcas, marcas d'água, campos de busca sem função ou dependências externas.
- Não selecionados: dashboards de métricas e microanimações; o usuário pediu simplificação e leveza.
- Licenças: padrões internos usados como orientação; nenhuma implementação externa copiada.
- Decisões do usuário: violeta, gráficos na Análise e adaptação ao computador. Sem novas ações destrutivas, compartilhamentos ou permissões.

