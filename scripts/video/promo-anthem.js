// Same picture as promo.js, with the driving anthem score instead of the original music.
// Renders to video-build/promo-anthem.mp4 and leaves promo.mp4 untouched.
import { DURATION, S } from './promo.js';

export { DURATION, draw } from './promo.js';
export const MUSIC = {
  style: 'anthem',
  duration: DURATION,
  cues: { turn: S.turn, data: S.data, take: S.take, launch: S.launch, accents: [S.m1, S.m2, S.m3] },
};
