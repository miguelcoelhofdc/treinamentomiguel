# QA da interface — Jornada de treino

Navegador: Chrome em perfil descartável; dados sintéticos; fuso America/Sao_Paulo.

- Cenários aprovados: 43
- Capturas: 17
- Exceções não tratadas: 0

## Capturas e layout

| Captura | Largura | Rolagem horizontal | Controles pequenos |
|---|---:|---|---:|
| access-mobile | 390 | Não | 0 |
| after-mobile | 390 | Não | 0 |
| journey-path-mobile | 390 | Não | 0 |
| after-mobile-375 | 375 | Não | 0 |
| after-mobile-430 | 430 | Não | 0 |
| after-desktop | 1440 | Não | 0 |
| checkin-mobile | 390 | Não | 0 |
| achievement-mobile | 390 | Não | 0 |
| today-mobile | 390 | Não | 0 |
| future-week-mobile | 390 | Não | 0 |
| plan-mobile | 390 | Não | 0 |
| evolution-mobile | 390 | Não | 0 |
| goals-mobile | 390 | Não | 0 |
| profile-mobile | 390 | Não | 0 |
| dark-mobile | 390 | Não | 0 |
| guides-mobile | 390 | Não | 0 |
| sintia-mobile | 390 | Não | 0 |

## Cenários

- layout access-mobile: no horizontal overflow
- layout after-mobile: no horizontal overflow
- layout journey-path-mobile: no horizontal overflow
- layout after-mobile-375: no horizontal overflow
- layout after-mobile-430: no horizontal overflow
- layout after-desktop: no horizontal overflow
- layout checkin-mobile: no horizontal overflow
- check-in sheet covers the bottom navigation
- layout achievement-mobile: no horizontal overflow
- check-in extends streak once
- repeated check-in has no duplicate celebration
- one daily row after repeated check-in
- layout today-mobile: no horizontal overflow
- today contains the prescribed strength exercises
- workout completion preserves daily presence
- detailed check-in preserves completed workout
- undo preserves check-in
- layout future-week-mobile: no horizontal overflow
- future step opens the correct week prescription
- layout plan-mobile: no horizontal overflow
- layout evolution-mobile: no horizontal overflow
- layout goals-mobile: no horizontal overflow
- goal sheet covers the navigation and restores keyboard focus
- goal submission remains reachable in a reduced keyboard viewport
- invalid numeric target is displayed beside its field
- targets are persisted for the active profile
- layout profile-mobile: no horizontal overflow
- backup retains new fields and goals
- legacy backup imports successfully
- invalid new check-in field is rejected without writes
- backup from another profile is rejected
- layout dark-mobile: no horizontal overflow
- theme metadata follows the in-app setting
- layout guides-mobile: no horizontal overflow
- return after midnight refreshes the date and preserves yesterday’s streak
- a whole missed day resets the active streak
- storage failure shows a retry and keeps navigation available
- storage retry recovers the journey
- Sintia has independent data and her four-session weekly goal
- layout sintia-mobile: no horizontal overflow
- sales remains outside the training theme
- whiteboard remains outside the training theme
- no uncaught browser exceptions

## Limites

A validação usa emulação de dimensões e viewport reduzido para o teclado. Instalação pelo Safari, teclado nativo e safe areas físicas exigem um iPhone real. Os relatórios de validação do painel comercial na pasta superior foram preservados.
