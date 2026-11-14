# Verificação — Demais telas do Meu ritmo

## Resultado
- 139 testes existentes passaram, em 19 grupos, sem falhas.
- `npm run typecheck`: passou.
- Compilação final e geração do aplicativo instalável: passaram. [Registro](build.log).
- Navegador: 13 verificações de fluxo concluídas, 67 capturas finais e nenhum erro não tratado.
- Evidência reproduzível: [roteiro](browser-qa.mjs) e [resultados detalhados](browser-qa.json).

## Cobertura
| Área | Resultado |
|---|---|
| Início aprovado | Cores, tipografia, tamanhos e navegação iguais à referência anterior em desktop e celular |
| Registrar, Análise, Perfil, Rotinas, Fichas e Guias | Tema comum aplicado; larguras 320, 390, 768 e 1440 verificadas |
| Corrida | Formulário detalhado salva tempo com segundos e distância com vírgula |
| Meu dia | Acompanhamento de sono ativado pelo fluxo de Rotinas e horas salvas pelo formulário |
| Fichas | Validação de campos, escolha de exercício e salvamento funcionam |
| Rotinas | Criação de hábito, ativação e desativação, configuração e painel de meta funcionam |
| Perfil | Nome longo salvo e apresentado sem esmagamento no cartão móvel |
| Preferências | Todos os grupos abrem; seletor de tema alterna corretamente pelo controle visível |
| Guias | Cinco consultas expansíveis verificadas abertas |
| Análise | Cinco métricas disponíveis; período de sete dias, filtro de check-ins e detalhes funcionam |
| Modo escuro | As oito rotas verificadas com a preferência persistida |
| Teclado e movimento | Escape fecha painéis, foco de teclado visível e redução de movimento respeitada |
| Carregamento e erro | Esqueleto e falha de consulta mantêm o tema; Tentar novamente recupera os dados |
| Acesso | Desktop, celular e 320 px; código inválido mantém a mensagem e a autenticação existente |

As capturas finais verificam ausência de rolagem horizontal, texto excedente e controles menores que 44 px. Campos visualmente ocultos destinados à importação não são tratados como controles visíveis. A navegação móvel tem espaço inferior reservado.

## Método
Chrome com perfil temporário e dados fictícios, descartado ao final. Nenhum perfil real, registro pessoal, exportação ou exclusão foi utilizado. O roteiro local foi adaptado para autenticação por perfil e preparação de dados de demonstração, ampliando a captura móvel e desktop padrão.

O aviso existente de Browserslist desatualizado não impede a compilação. O quadro de desenho e o painel comercial permanecem fora do tema de saúde.
