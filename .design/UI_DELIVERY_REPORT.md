# Entrega — acompanhamento de treino

## Resultado

O aplicativo agora funciona como diário: registrar o que foi feito, consultar o último treino e acompanhar a evolução. A navegação principal reúne Início, Registrar, Histórico e Perfil. O coaching automático e as celebrações deixam o aplicativo principal; seus dados antigos continuam armazenados e incluídos no backup.

Receita `data-dashboard`, com os padrões `dashboard/tremor-kpi-chart-grid` para tendências e filtros e `states/loading-empty-error-set` para os estados. O desenho usa Outfit, verde com texto escuro, controles arredondados e uma base mais escura nos botões. A referência ao Duolingo foi aplicada à aparência e à confirmação breve de salvamento, respeitando movimento reduzido. Nenhum código ou ativo de marca externo foi copiado.

## Implementação

| Área | Entrega |
|---|---|
| Início | Últimos sete dias, datas ativas distintas, tempo efetivamente informado, um gráfico selecionável e último treino com detalhes. |
| Registros | Musculação, calistenia, corrida e outras atividades; séries com carga e repetições, distância, duração e ritmo real. Dois treinos no mesmo dia permanecem separados. |
| Fichas | Rotinas iniciais de cada perfil, criação, renomeação, ordenação e troca de exercícios. Fichas não alteram os snapshots dos treinos anteriores. |
| Check-in | Cinco avaliações opcionais, horas de sono, peso e observação; nenhuma avaliação pré-selecionada. Edição preserva a conclusão dos treinos. |
| Histórico | Datas, filtros, detalhes e correções. Séries antigas sem vínculo permanecem explicitamente agrupadas por dia. |
| Persistência | IndexedDB v5, transações para sessão e detalhes, consultas reativas e armazenamento independente por perfil. Falhas preservam o formulário e não deixam gravações parciais. |
| Backup | Versão 4 inclui fichas, vínculos e avaliações; aceita arquivos antigos, conserva snapshots de coaching e evita duplicação na restauração repetida. |
| Compatibilidade | Rotas antigas redirecionadas, tema já escolhido respeitado e funcionamento offline. Metas comerciais e quadro continuam separados. |

Principais arquivos: `src/lib/tracking.ts`, `src/db/tracking.ts`, `src/db/trainingBackup.ts`, `src/lib/trainingBackup.ts`, `src/hooks/useTracking.ts`, `src/components/tracking/`, as quatro novas páginas de acompanhamento, `src/tracking.css` e as adaptações de navegação, banco, tipos e Perfil. O build de produção em `dist/` foi atualizado, conforme a estrutura já versionada do projeto.

## Antes e depois

| Tela | Antes — captura existente de coaching | Depois — captura desta implementação |
|---|---|---|
| Computador | [Início antigo](coaching/screenshots/home-desktop.png) | [Início atual](screenshots/after-desktop.png) |
| Celular | [Início antigo](coaching/screenshots/miguel-home-mobile.png) | [Início atual](screenshots/after-mobile.png) |

Outras capturas: [registro](screenshots/registrar-mobile.png), [séries](screenshots/strength-sets-mobile.png), [check-in](screenshots/checkin-mobile.png), [histórico](screenshots/historico-mobile.png), [fichas](screenshots/fichas-mobile.png), [perfil](screenshots/ajustes-mobile.png), [tema escuro](screenshots/dark-mobile.png), [vazio](screenshots/empty-mobile.png), [carregamento](screenshots/loading-mobile.png), [erro de consulta](screenshots/load-error-mobile.png), [falha ao salvar](screenshots/save-error-mobile.png) e [offline](screenshots/offline-mobile.png). As capturas atuais usam dados fictícios.

## Validação

- **94 testes aprovados**, incluindo os 79 existentes e os novos casos de cálculos, datas, ausência de valores, sessões no mesmo dia, dados antigos e backup.
- Verificação de tipos e build de produção aprovados.
- **25 cenários de integração no navegador**, usando os formulários reais e IndexedDB: correções retroativas, falha transacional, migração v4→v5, importação repetida, preservação de coaching e isolamento dos dois perfis. Zero erros de execução.
- **27 capturas e auditorias de layout** em 1440×1000, 390×844 e 320×740: sem rolagem horizontal, texto cortado ou controles abaixo de 44 px.
- Auditoria mecânica da skill aprovada em computador e celular; o teste separado de integração cobre as telas autenticadas.
- **3 verificações offline de produção**: recarregar com service worker, salvar corrida com a rede desconectada e recuperar seus valores após novo carregamento.
- Avaliação visual por Codex: **4,5/5**, documentada em [VISUAL_SCORECARD.md](VISUAL_SCORECARD.md).

Evidências: [UI_QA_REPORT.md](UI_QA_REPORT.md), [tracking-browser-qa.json](tracking-browser-qa.json), [offline-qa.json](offline-qa.json) e [auditoria da skill](access-audit/UI_QA_REPORT.md). O roteiro reproduzível está em `scripts/tracking-qa.mjs`; aceita a URL local e a opção `--offline` para validar o build de produção.

## Limites dos registros antigos

Uma marcação antiga de treino concluído sem modalidade não permite saber qual treino foi feito; ela aparece como “Atividade registrada”. Séries sem vínculo continuam como cargas daquele dia e podem ser corrigidas sem criar uma sessão fictícia. O editor dessas cargas mantém a data original. Não são estimados valores ausentes nem relações entre registros antigos.

Implementação local pronta para revisão. Não foi solicitada publicação nem houve acesso ou alteração dos dados pessoais existentes no navegador do usuário.
