const AI_MODEL_STORAGE_KEY = 'zandogo_preferred_ai_model';
const AI_LANG_STORAGE_KEY = 'zandogo_preferred_ai_lang';

export type AiLanguage = 'fr' | 'sw' | 'ln' | 'en';

export const AI_LANGUAGES: { code: AiLanguage; label: string }[] = [
  { code: 'fr', label: 'FR · Français' },
  { code: 'sw', label: 'SW · Kiswahili' },
  { code: 'ln', label: 'LN · Lingala' },
  { code: 'en', label: 'EN · English' },
];

export function getPreferredAiModel(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(AI_MODEL_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setPreferredAiModel(model: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = model.trim();
  try {
    if (trimmed) {
      window.localStorage.setItem(AI_MODEL_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(AI_MODEL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function getPreferredAiLanguage(): AiLanguage {
  if (typeof window === 'undefined') return 'fr';
  try {
    const raw = window.localStorage.getItem(AI_LANG_STORAGE_KEY);
    if (raw === 'sw' || raw === 'ln' || raw === 'en' || raw === 'fr') return raw;
    return 'fr';
  } catch {
    return 'fr';
  }
}

export function setPreferredAiLanguage(lang: AiLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}
