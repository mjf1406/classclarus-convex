import i18n from '#/i18n'
import { LANGUAGE_BCP47, coerceAppLanguage } from '#/i18n/locales'

/** Format a timestamp using the active UI locale. */
export function formatLocalizedDateTime(timestamp: number): string {
  const locale = LANGUAGE_BCP47[coerceAppLanguage(i18n.language)]
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
