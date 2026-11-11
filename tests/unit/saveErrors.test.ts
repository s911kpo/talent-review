import { describe, expect, it } from 'vitest';
import { ConflictError, NotEditableError, SessionExpiredError, classifySaveError } from '../../src/data/conflict';

describe('save error classification', () => {
  it('recognises a version conflict', () => expect(classifySaveError({ message: 'version_conflict' })).toBeInstanceOf(ConflictError));
  it('recognises a review locked elsewhere', () => expect(classifySaveError({ message: 'review_not_editable', code: 'P0001' })).toBeInstanceOf(NotEditableError));
  it('recognises an expired sign-in by code, status or message', () => {
    expect(classifySaveError({ code: 'PGRST301', message: 'JWT expired' })).toBeInstanceOf(SessionExpiredError);
    expect(classifySaveError({ status: 401 })).toBeInstanceOf(SessionExpiredError);
  });
  it('leaves other failures retryable', () => {
    const e = classifySaveError({ message: 'Failed to fetch' });
    expect(e).not.toBeInstanceOf(SessionExpiredError);
    expect(e).not.toBeInstanceOf(NotEditableError);
    expect(e).not.toBeInstanceOf(ConflictError);
  });
});
