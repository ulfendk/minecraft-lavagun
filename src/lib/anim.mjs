// Keyframed animations for the creatures. Everything is plain keyframes (no
// Molang), so GeckoLib on the Java edition reads the same files.
//
// Rotation convention (Bedrock): +x pitches a bone's front (-z) downwards and
// swings a hanging limb backwards.

const r = (n) => Math.round(n * 100) / 100;
const TAU = Math.PI * 2;
const sin = (phase, offset = 0) => Math.sin((phase + offset) * TAU);

/** Sample f(phase in [0,1)) into n keyframes over `length` seconds (looping). */
function cycle(length, n, f) {
  const out = {};
  for (let k = 0; k <= n; k++) out[r((k / n) * length).toFixed(2)] = f((k % n) / n).map(r);
  return out;
}

const loop = (length, bones) => ({ loop: true, animation_length: length, bones });
const once = (length, bones) => ({ animation_length: length, bones });

/** A heavy two-legged walker with long arms: the magma golem. */
export function golemAnims({ walkLength = 1.4 } = {}) {
  const n = 8;
  const stride = (len, amp) => ({
    leg_l: { rotation: cycle(len, n, (p) => [amp * sin(p), 0, 0]) },
    leg_r: { rotation: cycle(len, n, (p) => [amp * sin(p, 0.5), 0, 0]) },
    arm_l: { rotation: cycle(len, n, (p) => [-amp * 0.7 * sin(p), 0, 0]) },
    arm_r: { rotation: cycle(len, n, (p) => [-amp * 0.7 * sin(p, 0.5), 0, 0]) },
    body: { rotation: cycle(len, n, (p) => [0, 0, 3 * sin(p)]), position: cycle(len, n, (p) => [0, -0.6 * Math.abs(sin(p)), 0]) },
  });
  return {
    idle: loop(4, {
      body: { rotation: cycle(4, n, (p) => [1.5 * sin(p), 0, 0]) },
      arm_l: { rotation: cycle(4, n, (p) => [2 * sin(p, 0.2), 0, -2 - 1.5 * sin(p)]) },
      arm_r: { rotation: cycle(4, n, (p) => [2 * sin(p, 0.7), 0, 2 + 1.5 * sin(p)]) },
      head: { rotation: cycle(4, n, (p) => [0, 6 * sin(p, 0.3), 0]) },
    }),
    walk: loop(walkLength, stride(walkLength, 24)),
    // Both fists up, then down on the ground.
    attack: once(0.8, {
      arm_l: { rotation: { '0.0': [0, 0, 0], '0.3': [-150, 0, -10], '0.5': [-20, 0, 0], '0.8': [0, 0, 0] } },
      arm_r: { rotation: { '0.0': [0, 0, 0], '0.3': [-150, 0, 10], '0.5': [-20, 0, 0], '0.8': [0, 0, 0] } },
      body: { rotation: { '0.0': [0, 0, 0], '0.3': [-12, 0, 0], '0.5': [18, 0, 0], '0.8': [0, 0, 0] } },
    }),
  };
}

/** A slug: the body squeezes and stretches as it creeps, the eye stalks wave. */
export function slugAnims() {
  const n = 8;
  const stalks = (len, amp) => ({
    stalk_l: { rotation: cycle(len, n, (p) => [amp * sin(p), 0, 8 + amp * 0.5 * sin(p, 0.25)]) },
    stalk_r: { rotation: cycle(len, n, (p) => [amp * sin(p, 0.4), 0, -8 - amp * 0.5 * sin(p, 0.6)]) },
  });
  return {
    idle: loop(3, { ...stalks(3, 8), body: { scale: cycle(3, n, (p) => [1 + 0.03 * sin(p), 1 - 0.03 * sin(p), 1]) } }),
    walk: loop(1.2, {
      ...stalks(1.2, 12),
      body: { scale: cycle(1.2, n, (p) => [1 - 0.05 * sin(p), 1 + 0.04 * sin(p), 1 + 0.12 * sin(p)]) },
      head: { position: cycle(1.2, n, (p) => [0, 0, -0.8 * sin(p)]) },
      tail: { position: cycle(1.2, n, (p) => [0, 0, 0.6 * sin(p, 0.5)]) },
    }),
  };
}

/** Wrap one creature's animations into a Bedrock animation file. */
export function animationFile(ns, id, anims) {
  return { format_version: '1.8.0', animations: Object.fromEntries(Object.entries(anims).map(([name, a]) => [`animation.${ns}.${id}.${name}`, a])) };
}
