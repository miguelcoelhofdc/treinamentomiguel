# Pattern match — Jornada de treino

- Produto: aplicativo pessoal de treinamento, com uso diário no iPhone.
- Objeto principal: dia do plano, com presença e conclusão independentes.
- Receita: `mobile-notes-app`; o fluxo de tarefa diária se adapta a treino, check-in e consulta de prescrição.

| Padrão | Uso | Adaptação |
|---|---|---|
| `mobile-app/notes-workbench` | Estrutura mobile, navegação inferior, lista/detalhes/ação | A tarefa é uma sessão datada; detalhes de metas e check-in ficam em painéis |
| `states/loading-empty-error-set` | Carregamento, vazio, erro, seleção e ação em andamento | Dados reais da base local, erro com nova tentativa e botões bloqueados durante gravação |

A trilha do Duolingo inspira a sequência visual de etapas: https://blog.duolingo.com/new-duolingo-home-screen-design/. Os ícones, o desenho do aplicativo e o código são próprios ou usam as bibliotecas já presentes. Não foram copiados mascotes, imagens, marcas ou componentes do Duolingo.

Padrões de tabelas, dashboards comerciais e bibliotecas adicionais de animação foram dispensados. O fluxo principal é uma ação diária em uma coluna, com animações pequenas em CSS.

## Dados e revisão

Os registros reais continuam no banco do perfil ativo. As capturas de QA usam exclusivamente registros sintéticos em um perfil descartável do navegador. Metas comerciais, quadro, permissões e serviços externos não recebem alterações. A revisão em um iPhone físico permanece como verificação de plataforma após a validação em navegador.
