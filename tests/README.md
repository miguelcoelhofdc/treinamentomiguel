# Verificações das rotinas

Os hábitos agora persistem a avaliação real em `routineEntries`: `format: rating` com nota inteira de 1 a 5, ou `format: binary` com 0/1. `value: null` registra uma limpeza explícita, para que dados antigos do dia não reapareçam. Avaliar água ou sono não produz litros ou horas; marcar exercício não cria nem apaga sessões de treino.

Medições anteriores permanecem legíveis. Ao avaliar uma data com uma medição antiga, o valor original fica em `legacy`. As metas quantitativas anteriores são arquivadas, e as novas metas usam notas ou dias realizados. O backup na versão 6 preserva avaliações, limpezas e medições; versões antigas continuam aceitas e não substituem uma avaliação atual por uma quantidade antiga.

`npm test` executa os testes de lógica e os cenários de armazenamento em um IndexedDB em memória. Os testes criam bancos com nomes aleatórios, simulam uma atualização da versão anterior, verificam gravação, edição, restauração e separação de perfis e descartam os bancos ao terminar. Nenhum banco real do navegador é acessado.

Para conferir as telas manualmente, execute `npm run dev` e abra `/tests/routines-browser.html`. A página executa os mesmos cenários em um banco novo e isolado e oferece o botão **Abrir aplicativo de teste** com dados fictícios. Essa página está disponível apenas em desenvolvimento e não faz parte da compilação de produção.

Complete a validação com `npm run typecheck` e `npm run build`. Para evitar alterar a pasta de distribuição durante uma conferência, também é possível usar `npm run build -- --outDir tmp/routines-build`.
