import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictError, saveReview, snapshotReview } from '../../data/review';
import { NotEditableError, SessionExpiredError } from '../../data/conflict';
import { readLocal, writeLocal } from '../../lib/localPrefs';
import type { Review } from '../../lib/review/types';

export type SaveState = 'saved' | 'saving' | 'error' | 'offline' | 'conflict' | 'expired' | 'locked';
/** States where retrying cannot help; the screen explains what to do instead. */
export const BLOCKING_STATES: SaveState[] = ['conflict', 'expired', 'locked'];

const DEBOUNCE_MS = 1500;
const RETRY_MS = 5000;
const pendingKey = (id: string) => `pending.${id}`;

export function useAutosave(initial: Review, canEdit: boolean) {
  const [review, setReview] = useState<Review>(() => {
    // Work held on this device from an interrupted session, if it is still based on the server's copy.
    try {
      const raw = readLocal(pendingKey(initial.id));
      if (raw) {
        const held = JSON.parse(raw) as Review;
        if (held.rev === initial.rev) return held;
      }
    } catch {
      // Unreadable pending work is ignored.
    }
    return initial;
  });
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<string>(initial.updated_at);

  const latest = useRef(review);
  const dirty = useRef(review !== initial);
  const changedSinceSnapshot = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const blocked = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    if (!dirty.current || !canEdit) return;
    if (blocked.current) return;

    if (!navigator.onLine) {
      setState('offline');
      return;
    }

    const sending = latest.current;
    dirty.current = false;
    setState('saving');
    inFlight.current = (async () => {
      try {
        const result = await saveReview(sending);
        latest.current = { ...latest.current, rev: result.rev, version: result.version, updated_at: result.updated_at };
        setReview((r) => ({ ...r, rev: result.rev, version: result.version, updated_at: result.updated_at }));
        setSavedAt(result.updated_at);
        if (dirty.current) {
          writeLocal(pendingKey(sending.id), JSON.stringify(latest.current));
        } else {
          try {
            localStorage.removeItem(`talent-review.${pendingKey(sending.id)}`);
          } catch {
            // Storage may be unavailable.
          }
          setState('saved');
        }
      } catch (err) {
        if (err instanceof ConflictError) {
          blocked.current = true;
          setState('conflict');
          return;
        }
        // Work stays held on this device (written on every change), so nothing is lost.
        if (err instanceof SessionExpiredError) {
          dirty.current = true;
          blocked.current = true;
          setState('expired');
          return;
        }
        if (err instanceof NotEditableError) {
          blocked.current = true;
          setState('locked');
          return;
        }
        dirty.current = true;
        setState('error');
        timer.current = window.setTimeout(() => void flush(), RETRY_MS);
      }
    })();
    await inFlight.current;
    inFlight.current = null;
    if (dirty.current) timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [canEdit]);

  const update = useCallback((patch: Partial<Review>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setReview(next);
    dirty.current = true;
    changedSinceSnapshot.current = true;
    writeLocal(pendingKey(next.id), JSON.stringify(next));
    setState((s) => (BLOCKING_STATES.includes(s) ? s : 'saving'));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  /** Saves now and records a version if anything changed. Called when leaving this employee. */
  const leave = useCallback(async () => {
    await flush();
    if (changedSinceSnapshot.current && !dirty.current && canEdit) {
      changedSinceSnapshot.current = false;
      try {
        await snapshotReview(latest.current.id);
      } catch {
        // The next change will snapshot again; content is already saved.
      }
    }
  }, [flush, canEdit]);

  useEffect(() => {
    if (dirty.current) timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
    const online = () => void flush();
    const beforeIdle = () => void flush();
    window.addEventListener('online', online);
    window.addEventListener('app:before-idle-logout', beforeIdle);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('app:before-idle-logout', beforeIdle);
    };
  }, [flush]);

  return { review, update, state, savedAt, flush, leave };
}
