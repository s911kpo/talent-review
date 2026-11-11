import type { Locale } from '../i18n';
import { isBackendConfigured, isDemoMode, supabase } from './client';
import { demo } from './demo';

export type LoginResult = 'ok' | 'invalid' | 'locked' | 'unavailable';

export interface Profile {
  userId: string;
  employeeId: number | null;
  role: 'manager' | 'hr';
  displayName: string;
  locale: Locale;
  fontScale: number;
}

export async function signInWithPin(employeeId: string, pin: string): Promise<LoginResult> {
  if (isDemoMode) return demo.signIn(employeeId) ? 'ok' : 'invalid';
  const { data, error } = await supabase().functions.invoke('auth-pin', { body: { employeeId, pin } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) return 'invalid';
    if (status === 429) return 'locked';
    return 'unavailable';
  }
  const { error: sessionError } = await supabase().auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  return sessionError ? 'unavailable' : 'ok';
}

export async function signInHr(email: string, password: string): Promise<LoginResult> {
  if (isDemoMode) return demo.signInHr(email) ? 'ok' : 'invalid';
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (!error) return 'ok';
  return error.status === 400 ? 'invalid' : 'unavailable';
}

/** Quick-entry accounts for the fictional demo; null outside demo mode. */
export const demoAccounts = () => (isDemoMode ? demo.entryPoints() : null);
export const demoHrEmail = 'demo-hr@talentreview.local';
export function resetDemo(): void {
  if (isDemoMode) demo.reset();
}

export async function signOut(): Promise<void> {
  if (isDemoMode) {
    demo.signOut();
    return;
  }
  await supabase().auth.signOut();
}

export async function loadProfile(): Promise<Profile | null> {
  if (isDemoMode) return demo.profile();
  if (!isBackendConfigured) return null;
  const { data: session } = await supabase().auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase()
    .from('app_users')
    .select('user_id, employee_id, role, display_name, locale, font_scale, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  return {
    userId: data.user_id,
    employeeId: data.employee_id,
    role: data.role,
    displayName: data.display_name ?? '',
    locale: data.locale,
    fontScale: Number(data.font_scale),
  };
}

export async function savePreferences(userId: string, prefs: { locale?: Locale; font_scale?: number }): Promise<void> {
  if (isDemoMode) return;
  await supabase().from('app_users').update(prefs).eq('user_id', userId);
}

export function onAuthChange(callback: () => void): () => void {
  if (isDemoMode || !isBackendConfigured) return () => undefined;
  const { data } = supabase().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(callback, 0);
  });
  return () => data.subscription.unsubscribe();
}
