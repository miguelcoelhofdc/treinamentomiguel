# QA — redesign de treino e saúde

Concluído em 05/10/2026. Dados sintéticos, dois perfis, navegadores descartáveis.
A validação preservou os dados e o navegador habitual do usuário.

## Resultados

| Verificação | Resultado | Evidência |
|---|---|---|
| Verificação de tipos | Aprovada | npm run typecheck |
| Testes existentes | 55/55, sem falhas | npm test |
| Build de produção | Aprovado; 52 entradas no precache PWA | npm run build |
| Fluxos principais no navegador | 39/39 | browser-qa.json |
| Estados e fluxos adicionais dos perfis | 40/40 | browser-extra-qa.json |
| Critérios de painéis/teclado/layout | 10/10 | browser-panels-qa.json |
| Produção offline | 16/16 | offline-qa.json |
| Telas e painéis em seis larguras | 1164 auditorias; nenhuma rolagem horizontal ou alvo de ação abaixo de 44 × 44 px | browser-panels-qa.json |
| Avaliação visual | 4,31/5 | VISUAL_SCORECARD.md |

## Cobertura

Larguras: **375, 390, 430, 768, 1024 e 1440 px**.
Perfis: Miguel e Cíntia. Temas: claro e escuro.
A matriz final contém 216 visitas de telas e 948 inspeções de conteúdo expandido/painéis.

- Início antes/depois do check-in; energia rápida e formulário completo; treino permanece independente.
- Força, calistenia, corrida, atividade livre e descanso; carga, marcação, conclusão, check-out e desfazer.
- Seleção de atividade; nível, volume e duração; consultas da Rotina e retorno a Hoje.
- Resumo, Saúde, Histórico e Metas; URL, teclado nas abas e voltar/avançar.
- Histórico reconciliado, registros antigos, detalhes relacionados e carregamento de mais atividades.
- Cinco tipos de meta: minutos, distância, sessões, tempo de corrida e peso; validação, gravação e encerramento.
- Testes de performance, recordes, constância, conquistas e gráficos de peso/ritmo.
- Nutrição, Compras, Suplementos, Mobilidade e Rotina diária; somente um assunto aberto.
- Grupos de Perfil, gravação de preferências, tema e exportação/importação de backup.
- Separação de registros entre perfis.
- Esqueletos, vazio, erro de leitura/gravação, nova tentativa, salvando e botões desabilitados.
- Painéis inferiores em telas pequenas e centralizados no desktop; foco interno, Escape e retorno ao acionador.
- Formulário completo com viewport reduzido a 500 px para conferir alcance da ação de salvar.
- Redução de movimento habilitada no navegador; 3D inicia pausado nesse modo.
- Navegação sem conexão, recarregamento e URL direta; check-in salvo offline permanece após recarregar.

O catálogo de animações existente é a fonte de verdade. O 3D foi exercitado nos movimentos cadastrados;
exercícios do perfil Cíntia sem animação continuam sem oferecer uma ação indisponível.

## Contraste

Para os tokens principais do tema claro:
texto #18221E sobre #F7F9F7: **15,43:1**;
texto secundário #617068 sobre #F7F9F7: **4,93:1**;
texto branco sobre ação #327355: **5,65:1**.
Avisos e erros conservam texto/ícone, além da cor. O tema escuro foi conferido nas capturas e na matriz.

## Evidências

Há 291 capturas em screenshots, incluindo comparativos, temas, fluxos, estados e painéis.
As capturas finais da matriz ficam em screenshots/final. Os arquivos JSON conservam critérios e resultados.
Documentos e capturas anteriores em .design/continuous e .design/treino-jornada permanecem preservados.

## Reprodução

Na raiz do projeto:

    npm run typecheck
    npm test
    npm run build
    npm run dev -- --host 127.0.0.1 --port 5174
    npm run preview -- --host 127.0.0.1 --port 5175

Com os servidores disponíveis:

    node .design/minimal-redesign/qa.mjs
    node .design/minimal-redesign/qa-states.mjs
    node .design/minimal-redesign/qa-panels.mjs
    node .design/minimal-redesign/qa-offline.mjs

Os scripts iniciam Chrome/Edge em perfil temporário, usam dados de demonstração e removem somente esse perfil
após verificar que o caminho está dentro do diretório temporário. São necessários Node com WebSocket e Chrome/Edge local.

## Limites e observações

Validação em Chrome com emulação de tamanhos e toque; não houve teste em iPhone físico/Safari ou leitor de tela.
O aviso existente sobre o tamanho do módulo Three/3D permanece. Não houve deploy.
Cálculos, prescrições, APIs, schema e armazenamento não receberam alterações; /metas e /quadro ficam fora do redesign.
