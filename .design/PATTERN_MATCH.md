# Pattern match

Product: personal training diary. Main objects: completed activity, exercise sets, daily check-in, reusable workout sheet.

Recipe: `data-dashboard`, adapted to one chart at a time and mobile entry rather than an operational KPI grid.
Patterns: `dashboard/tremor-kpi-chart-grid` for readable trends, date filters and concrete metric definitions; `states/loading-empty-error-set` for loading, empty, retry and saving states.

Use the existing React/Tailwind/Recharts stack. Adapt structure only; copy no upstream code or brand assets. Tremor's Apache-2.0 and shadcn's MIT sources are references only. Avoid faceted tables, AI workbenches, decorative motion and extra chart libraries.

Duolingo reference: friendly rounded typography and controls, lively green, a darker button base and brief save feedback. All copy, icons and layouts are original. Human preferences were confirmed in planning: quick optional check-ins, editable sheets, retrospective editing, no main-flow coaching or gamification.
