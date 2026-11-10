import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n, { type Locale } from '../i18n';
import { loadProfile, onAuthChange, savePreferences, signOut, type Profile } from '../data/auth';
import { readLocal, writeLocal } from '../lib/localPrefs';

export const FONT_STEPS = [0.875, 1, 1.125, 1.25];
const IDLE_LIMIT_MS = 60 * 60 * 1000;
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;

interface SessionValue {
  profile: Profile | null;
  loading: boolean;
  locale: Locale;
  fontScale: number;
  setLocale: (l: Locale) => void;
  setFontScale: (s: number) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}

function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = `${scale * 100}%`;
}

function applyLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>(readLocal('locale') === 'en' ? 'en' : 'zh-TW');
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const saved = Number(readLocal('fontScale'));
    return FONT_STEPS.includes(saved) ? saved : 1;
  });

  useEffect(() => applyFontScale(fontScale), [fontScale]);
  useEffect(() => applyLocale(locale), [locale]);

  const refresh = useCallback(async () => {
    try {
      const p = await loadProfile();
      setProfile(p);
      if (p) {
        setLocaleState(p.locale);
        setFontScaleState(p.fontScale);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onAuthChange(() => void refresh());
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut();
    setProfile(null);
  }, []);

  // Idle sign-out. Screens with unsaved work listen for app:before-idle-logout and flush it.
  useEffect(() => {
    if (!profile) return undefined;
    let timer = window.setTimeout(expire, IDLE_LIMIT_MS);
    function expire() {
      window.dispatchEvent(new Event('app:before-idle-logout'));
      window.setTimeout(() => void logout(), 1000);
    }
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, IDLE_LIMIT_MS);
    };
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [profile, logout]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeLocal('locale', l);
    if (profile) void savePreferences(profile.userId, { locale: l });
  }, [profile]);

  const setFontScale = useCallback((s: number) => {
    setFontScaleState(s);
    writeLocal('fontScale', String(s));
    if (profile) void savePreferences(profile.userId, { font_scale: s });
  }, [profile]);

  const value = useMemo(
    () => ({ profile, loading, locale, fontScale, setLocale, setFontScale, refresh, logout }),
    [profile, loading, locale, fontScale, setLocale, setFontScale, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
