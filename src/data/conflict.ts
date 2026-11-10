export class ConflictError extends Error {
  constructor() {
    super('version_conflict');
  }
}
