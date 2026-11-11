// Replaces ./demo in non-demo builds so the fictional data never ships to staging or production.
// Every caller checks isDemoMode first, so reaching this is a bug.
import type { demo as DemoApi } from './demo';

export const demo = new Proxy({}, {
  get() {
    throw new Error('Demo data is not part of this build');
  },
}) as typeof DemoApi;
