# Design — Jornada de treino

## Estrutura

Receita mobile com os padrões `mobile-app/notes-workbench` e `states/loading-empty-error-set`. A página inicial reúne um resumo diário compacto e a trilha de sete etapas da semana. A navegação tem Jornada, Treino, Evolução, Guias e Perfil. A consulta do plano continua em `/plano`, e a sessão passa a ter acesso próprio em `/hoje`.

Outfit, ícones existentes, verde vivo, botões com relevo, chama, medalhas e contraste semântico formam a identidade. No desktop, a jornada permanece em uma coluna de até 480 px; as páginas de dados mantêm a largura existente. A variante escura usa os mesmos estados e hierarquia.

## Componentes e dados

- `useLocalDay`: calendário do dispositivo, atualização à meia-noite, foco e retorno à página.
- `useJourney`: observação do banco por Dexie; indicadores calculados pelo módulo puro de jornada.
- `QuickCheckIn`: energia de 1 a 5, confirmação e detalhes opcionais.
- `GoalEditor`: metas semanais, peso e objetivos dos testes, salvos juntos em uma transação.
- `Achievements`: conquistas derivadas do histórico; comemoração apenas após uma confirmação explícita feita hoje.
- `BottomSheet`: portal acima da navegação, foco preso ao painel, Escape, retorno de foco e ajuste ao espaço visível do teclado.

`DailyLog.checkInDone` é opcional. Campos não indexados usam o armazenamento existente, sem migração destrutiva. Preferências incluem `weeklyWorkoutGoal` e `performanceTargets`, preservando `goalWeight` como fonte única da meta de peso. Registros antigos com bem-estar contam como presença; registros internos e futuros ficam fora dos indicadores. Duplicatas antigas por data são combinadas, respeitando a gravação mais recente.

## Regras de acompanhamento

A presença conta uma vez por data. O check-in pendente de hoje preserva a sequência até o dia terminar. Treinos concluídos, meta semanal e cumprimento do plano são medidas distintas. A sessão atual pendente não é uma falta; descansos ficam fora do cumprimento. Semanas são blocos de sete dias a partir do início do ciclo.

Metas de treinamento não mudam a prescrição. Metas qualitativas mostram texto; percentuais dependem de base, resultado e objetivo numéricos comparáveis. A data do último peso é apresentada sem presumir que o registro foi feito hoje.

## PWA e limites

Ícones próprios em 180, 192 e 512 px, idioma pt-BR, cores de tema sincronizadas e cache incluindo fontes. A versão de produção foi validada com recarga e acesso ao treino sem rede após o primeiro carregamento. A instalação pelo Safari em um iPhone físico exige confirmação no aparelho; o teste automatizado usa Chrome com dimensões e agente mobile.

Nenhuma biblioteca visual adicional, fonte externa ou imagem de marca foi adicionada. A documentação e as capturas comerciais anteriores foram preservadas.
