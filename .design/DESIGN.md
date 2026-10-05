# Training diary design

Based on `dashboard/tremor-kpi-chart-grid` and `states/loading-empty-error-set`.

Home: compact greeting and Register action; active-day and recorded-time summaries; one chart with metric and 7/30/90-day selectors; latest session; compact daily check-in. Register: activity/check-in tabs, selectable sheet, actual sets or distance/time inputs. History: date groups, activity filter, details and editing. Sheets: reusable ordered exercise lists. Profile: personal data, sheets/reference material, appearance and backup.

Use Outfit, white/soft-neutral surfaces, dark readable text, green primary buttons with a darker base, restrained blue/orange accents for activity icons, 16-24px radii and clear borders. Keep the existing dark-mode preference. No brand asset copying. Respect reduced motion.

Desktop uses the existing lateral navigation with a wider dashboard. Mobile uses a four-item bottom navigation and stacked panels. Sheets retain the existing focus trap and visual-viewport keyboard behavior. Charts and data sections provide loading, actionable empty and retry states. New data is kept in IndexedDB, transactional and isolated by profile. Backup v4 includes templates and new links while preserving old records.

Implementation is grouped under tracking library/database/hooks/components and new tracking pages, with app routing, scoped CSS and profile backup updates. Verification includes calculations, same-day sessions, retroactive edits, legacy migration/import, profile isolation, offline reload and screenshots at desktop and mobile sizes.
