# UI QA report

Synthetic demo data in a disposable Chrome profile; no user data was accessed.

- PASS: Two same-day exercise sessions stay distinct
- PASS: Editing replaces only its session sets and moves its date
- PASS: Moving one session preserves the other same-day workout
- PASS: A partial check-in preserves workout completion and has no default energy
- PASS: Updating a check-in consolidates duplicate legacy days without discarding their fields
- PASS: Run corrections keep one linked run and exact pace
- PASS: A failed daily write rolls the entire session transaction back
- PASS: Renaming and reordering a sheet leaves recorded snapshots intact
- PASS: Editing legacy daily loads creates no fictitious session
- PASS: Backup v4 contains sheets and linked measurements
- PASS: Repeated restore does not duplicate sessions, runs or sets
- PASS: Tracking actions and backup restoration preserve old coaching snapshots without regenerating prescriptions
- PASS: A backup from another profile is rejected before writes
- PASS: The actual v4-to-v5 migration preserves old loads and creates sheets
- PASS: Visible running form retains its draft after failure and saves comma decimals on retry
- PASS: Visible strength form saves actual comma-decimal loads and an explicitly repeated series
- PASS: History detail edits the correct session through the visible form
- PASS: Visible sheet editor creates a custom exercise and persists the reordered sheet
- PASS: Escape closes the editor and returns keyboard focus to its original action
- PASS: The visible check-in saves only sleep on a previous date without adding ratings
- PASS: Old training routes redirect to their tracking equivalents
- PASS: Existing dark preference is respected and reduced motion disables animations
- PASS: Query errors display a clear retry state
- PASS: Switching profiles uses another database, another exercise library and an empty independent history
- PASS: Reload restores the original profile history

- empty-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- empty-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- save-error-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- saved-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- strength-form-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- strength-sets-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- after-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- after-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- chart-forca-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- chart-corrida-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- chart-peso-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- chart-sono-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- small-mobile: 320×740, horizontal overflow false, undersized controls 0, text overflow 0
- registrar-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- registrar-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- checkin-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- checkin-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- historico-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- historico-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- fichas-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- fichas-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- ajustes-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- ajustes-desktop: 1440×1000, horizontal overflow false, undersized controls 0, text overflow 0
- dark-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- loading-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- load-error-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0
- second-profile-mobile: 390×844, horizontal overflow false, undersized controls 0, text overflow 0

Runtime errors: 0.
