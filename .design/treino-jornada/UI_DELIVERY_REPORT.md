# Entrega — Jornada de treino

Implementação da jornada mobile sobre o sistema existente: abertura com sequência e presença, trilha semanal datada, check-in de energia, metas pessoais editáveis e oito conquistas. Preservados planos, exercícios, registros, bancos por perfil, guias, painel comercial e quadro.

## Mudanças

- Sessão em `/hoje`; inicial em `/`; navegação Jornada, Treino, Evolução, Guias e Perfil.
- Constância por check-in e cumprimento por sessões do plano, com calendários compartilhados.
- Metas semanais com padrões 6 e 4, meta de peso única e objetivos dos testes por unidade.
- Gravação diária transacional e atualização reativa após registros e importação.
- Reconhecimento de registros antigos, validação dos novos campos e bloqueio de backup de outro perfil.
- Tema escuro, painéis acessíveis, ícones de instalação e cache offline de telas e fontes.

## Validação

- Verificação de tipos: aprovada.
- Testes automatizados de cálculo e regressão: 44 aprovados.
- QA no navegador: `browser-qa.json`, incluindo formulário detalhado, desfazer, metas inválidas, backups, perfis, virada do dia e recuperação de erro.
- QA offline de produção: `offline-qa.json`, com recarga e abertura da sessão sem rede.
- Build de produção: aprovado; 52 recursos no cache. O aviso de tamanho do visualizador 3D existente permanece, com carregamento separado.
- Capturas sem rolagem horizontal ou controles abaixo de 44 px de altura nas telas verificadas.
- Revisão visual: 4,5 / 5.

## Capturas

- `screenshots/after-mobile.png`: abertura, com dados sintéticos.
- `screenshots/journey-path-mobile.png`: trilha em foco.
- `screenshots/after-mobile-375.png`, `screenshots/after-mobile-430.png`: larguras adicionais.
- `screenshots/after-desktop.png`: desktop.
- Capturas adicionais de check-in, conquistas, metas, treino, plano, evolução, guias, perfil, tema escuro e Sintia.

O servidor local de desenvolvimento oferece a prévia. Nenhuma publicação foi realizada e os dados reais não foram modificados pela validação. A confirmação da instalação no Safari e do comportamento nativo em um iPhone fica registrada como verificação de plataforma.
