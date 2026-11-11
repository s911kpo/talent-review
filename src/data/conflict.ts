export class ConflictError extends Error {
  constructor() {
    super('version_conflict');
  }
}

/** The sign-in has expired or was revoked; retrying cannot help until the person signs in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session_expired');
  }
}

/** The review was submitted, confirmed or locked elsewhere (for example by HR) while the page was open. */
export class NotEditableError extends Error {
  constructor() {
    super('review_not_editable');
  }
}

/** Sorts a backend error into the cases the screens explain differently. */
export function classifySaveError(error: { message?: string; code?: string; status?: number }): Error {
  const message = error.message ?? '';
  if (message.includes('version_conflict')) return new ConflictError();
  if (message.includes('review_not_editable')) return new NotEditableError();
  if (error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /JWT/i.test(message)) return new SessionExpiredError();
  return Object.assign(new Error(message || 'save_failed'), { code: error.code });
}
