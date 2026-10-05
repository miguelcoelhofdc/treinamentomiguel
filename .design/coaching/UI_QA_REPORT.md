# Verificação — coaching

## Resultado em 05/10/2026

| Verificação | Resultado |
|---|---|
| Testes automatizados | 79 passaram, incluindo 24 casos novos de coaching |
| Tipos | `npm run typecheck` passou |
| Build e PWA | `npm run build` passou; 57 entradas no precache |
| Navegador | 127 verificações passaram; zero exceções capturadas |
| Produção offline | 14 verificações passaram, nos dois perfis, sobre o build final |
| Avaliação visual | 4,38/5 por inspeção Codex das capturas |

## Cobertura

Motor: quatro objetivos, níveis, locais, equipamentos, 5–180 minutos, recuperação entre força/corrida, faltas, ausência longa, feedback, dor, baixa energia, alteração de objetivo, início preservado, registros legados, metas opcionais, integridade das prescrições e adesão sem contar realizações futuras.

Navegador: configurar, começar pelo Início, marcar exercícios, concluir, rejeitar duração inválida, desfazer e refazer corrida sem duplicar registros, trocar objetivo, agenda semanal/mensal, execução separada da meta, backup/restauração, backups antigos e rejeição de dados corrompidos. Foco das etapas e da folha de conclusão verificado com teclado.

Responsividade: seis larguras (375, 390, 430, 768, 1024 e 1440 px), temas claro/escuro e seis rotas. Nenhum overflow horizontal ou controle habilitado abaixo de 44 px na matriz verificada.

Offline: carregar recursos precacheados, configurar, concluir corrida com minutos/distância, recarregar, consultar mês, abrir gráfico de corrida e trocar objetivo mantendo a sessão concluída. Bancos separados dos perfis Miguel e Cíntia.

## Método e evidências

Chrome headless com perfis temporários isolados, dados sintéticos e portas locais. Dados reais do usuário não foram alterados. Foi usado um roteiro específico autenticado em `.design/coaching/qa.mjs`, em lugar do roteiro genérico `visual-audit.mjs`, para cobrir banco local, conclusão, restauração e os dois perfis. Imagens geradas foram inspecionadas visualmente.

- `browser-qa.json`: resultados detalhados de navegação e layout.
- `offline-qa.json`: resultados no build de produção sem rede.
- `qa.mjs` e `qa-offline.mjs`: roteiros reproduzíveis.
- `screenshots/`: capturas de desktop, celular, estados e objetivos.

Os testes avaliam comportamento do aplicativo e regras determinísticas. Não estabelecem eficácia de treinamento para cada pessoa. CrossFit, agilidade, novos cadastros e chat estão fora do escopo desta entrega.
