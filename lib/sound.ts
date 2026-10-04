/**
 * Procedural sound (spec v0.2 §12.2).
 *
 * No audio files, for the same reason the nebula is a shader and not a
 * texture: everything in this product is generated. But there is a second
 * reason here, and it is the stronger one. Sampled sound effects would make
 * this feel like an app. Two detuned sine waves and a filtered hiss feel like
 * a room — and what a card needs is for the reader to forget they are looking
 * at a screen, not to be told that something was clicked.
 *
 * Everything is quiet on purpose. The master is −26 dB, and each cue is a
 * single soft tone. If the sound is ever *noticed* as sound, it is too loud.
 *
 * Revision 7.1 §12 changes what quiet *sounds like*. The ambient bed was two
 * sines a bare fifth apart at 55 and 82.4 Hz — hollow, and intentionally so:
 * it was written for "lonely space". That is precisely the reading r7 exists
 * to get rid of, and a scene whose light says morning over a drone that says
 * abandoned does not read as either. So the bed is an open major add9 chord
 * now, with a sparse music-box arpeggio over it, and its low-pass **opens
 * with the dawn** — 600 Hz at blue hour, 1400 Hz on the day. The countdown is
 * in the sound as well as in the light.
 *
 * The engine is a singleton, fails silently if the browser will not give it an
 * AudioContext, and is driven entirely from `CardExperience` watching state
 * change — never from inside the reducer, which stays pure.
 */

export type Cue =
  | "faceLand"
  | "leave"
  | "deploy"
  | "memory"
  | "launch"
  | "release"
  | "returned"
  /** The arrival beat: a rising shimmer under Propel (r7 §11, §12). */
  | "dawn"
  /** The reply passing the comet: three bell tones, falling slightly. */
  | "bloom";

const STORAGE_KEY = "ks_sound";

/** Master gain, in linear terms: about −26 dB (r7 §12). */
const MASTER = 0.05;

/**
 * The ambient chord: C3 · G3 · E4 · D5 — a major add9 (r7 §12).
 *
 * Open rather than close voiced, and with the ninth two octaves above the
 * root, which is what keeps it from sounding like a chord being *played*. The
 * ear hears a space with a tonality rather than an instrument.
 */
const AMBIENT_CHORD = [130.81, 196.0, 329.63, 587.33];

/** The low-pass opens as the dawn rises: 600 Hz at p = 0.2, 1400 Hz at p = 1. */
const AMBIENT_CUTOFF = { closed: 600, open: 1400 };

/** The arpeggio: one note every 3-7 seconds, at random, with a long tail. */
const ARPEGGIO_GAP = { min: 3, max: 7 };

/** A pentatonic scale, so any two cues that overlap still agree. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // C D E G A C'

type Engine = {
  context: AudioContext;
  master: GainNode;
  ambient: GainNode | null;
  /** The bed's low-pass, so the dawn can open it (r7 §12). */
  tone: BiquadFilterNode | null;
  /** The next music-box note, so it can be cancelled on stop. */
  arpeggio: ReturnType<typeof setTimeout> | null;
};

let engine: Engine | null = null;
let enabled = true;
let started = false;

/** Remembered per browser; a default of "on" that survives a refresh. */
export function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Private browsing, or storage blocked entirely. Not worth a failure.
    return true;
  }
}

function writePreference(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function ensure(): Engine | null {
  if (engine) return engine;
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;

    const context = new Context();
    const master = context.createGain();
    master.gain.value = enabled ? MASTER : 0;
    master.connect(context.destination);
    engine = { context, master, ambient: null, tone: null, arpeggio: null };
    return engine;
  } catch {
    // No audio is a perfectly good outcome. Never let it break the card.
    return null;
  }
}

/**
 * Start the ambient bed. Must be called from a user gesture — the `カードを開く`
 * click — or the browser will refuse to start the context at all.
 */
export function start() {
  if (started) return;
  const e = ensure();
  if (!e) return;
  started = true;

  void e.context.resume().catch(() => {});

  const bed = e.context.createGain();
  bed.gain.value = 0;

  /*
   * One filter over the whole bed, which the dawn opens (§12). Everything
   * else about the sound is fixed; this is the single parameter that tracks
   * the countdown, and it is the right one — a sound opening up is what
   * anyone would reach for to mean "morning", without being able to say why.
   */
  const tone = e.context.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = AMBIENT_CUTOFF.closed;
  tone.Q.value = 0.6;
  bed.connect(tone).connect(e.master);
  e.tone = tone;

  /*
   * The chord. Each voice slowly detuned against a fixed pitch, so the four
   * of them drift in and out of phase with one another — the same trick the
   * old bare fifth used, and the reason this is a place rather than a patch.
   */
  for (const [i, frequency] of AMBIENT_CHORD.entries()) {
    const oscillator = e.context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const gain = e.context.createGain();
    // The upper voices quieter, or the ninth sits on top of everything.
    gain.gain.value = 0.42 / (1 + i * 0.55);
    oscillator.connect(gain).connect(bed);

    // A few cents of slow drift, each voice on its own period.
    const drift = e.context.createOscillator();
    drift.frequency.value = 0.02 + i * 0.007;
    const driftGain = e.context.createGain();
    driftGain.gain.value = 4 + i * 1.5;
    drift.connect(driftGain).connect(oscillator.detune);
    drift.start();

    oscillator.start();
  }

  // Low-passed noise under it all: the layer that reads as "space" rather
  // than as "a tone". Quieter than it was, because the chord now carries it.
  const noise = e.context.createBufferSource();
  const seconds = 4;
  const buffer = e.context.createBuffer(1, e.context.sampleRate * seconds, e.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  noise.loop = true;

  const hiss = e.context.createBiquadFilter();
  hiss.type = "lowpass";
  hiss.frequency.value = 400;
  hiss.Q.value = 0.7;

  const lfo = e.context.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = e.context.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(hiss.frequency);
  lfo.start();

  const noiseGain = e.context.createGain();
  noiseGain.gain.value = 0.22;
  noise.connect(hiss).connect(noiseGain).connect(bed);
  noise.start();

  // Eight seconds to fade up. Anything faster and the reader hears sound
  // *arriving*, which is exactly what they should not notice.
  bed.gain.setValueAtTime(0, e.context.currentTime);
  bed.gain.linearRampToValueAtTime(1, e.context.currentTime + 8);
  e.ambient = bed;

  scheduleArpeggio(e);
}

/**
 * The music box (§12): one pentatonic note every three to seven seconds, at
 * random, with a long tail.
 *
 * Random rather than a loop, and that is the whole point. A repeating figure
 * becomes a piece of music the second time round, and the reader starts
 * listening to it instead of reading. An interval you cannot predict never
 * resolves into a phrase, so it stays weather.
 */
function scheduleArpeggio(e: Engine) {
  const gap = ARPEGGIO_GAP.min + Math.random() * (ARPEGGIO_GAP.max - ARPEGGIO_GAP.min);
  e.arpeggio = setTimeout(() => {
    if (engine !== e) return;
    if (enabled) {
      const note = SCALE[Math.floor(Math.random() * SCALE.length)] * 2;
      glass(e, note, e.context.currentTime, 3.4, 0.045);
    }
    scheduleArpeggio(e);
  }, gap * 1000);
}

/**
 * The bed opens with the dawn (§12).
 *
 * Called from the scene rather than computed here, because the dawn is a
 * fact about the card's dates and this module knows nothing about cards.
 */
export function setDawn(p: number) {
  const e = engine;
  if (!e?.tone) return;
  const open = Math.min(1, Math.max(0, (p - 0.2) / 0.8));
  const target = AMBIENT_CUTOFF.closed + (AMBIENT_CUTOFF.open - AMBIENT_CUTOFF.closed) * open;
  // Ramped over a second: a filter that jumps is a filter you can hear.
  e.tone.frequency.setTargetAtTime(target, e.context.currentTime, 1);
}

export function setEnabled(value: boolean) {
  enabled = value;
  writePreference(value);
  const e = engine;
  if (!e) return;
  // Ramped rather than switched, so muting is not itself a click.
  e.master.gain.cancelScheduledValues(e.context.currentTime);
  e.master.gain.setTargetAtTime(value ? MASTER : 0, e.context.currentTime, 0.12);
}

/** Background tabs should be silent, and should not burn a phone's battery. */
export function suspend() {
  void engine?.context.suspend().catch(() => {});
}

export function resume() {
  if (started) void engine?.context.resume().catch(() => {});
}

export function stop() {
  try {
    if (engine?.arpeggio) clearTimeout(engine.arpeggio);
    void engine?.context.close();
  } catch {
    /* ignore */
  }
  engine = null;
  started = false;
}

/**
 * One cue. Each is a few oscillators with an envelope — deliberately simple,
 * because anything more elaborate starts to sound like a notification.
 *
 * `speed` compresses a cue that sits under an animation which is itself being
 * played faster. Only `deploy` reads it: it is the one cue long enough that
 * the mismatch is audible, and a pad still rising over a satellite that has
 * already settled is worse than no sound at all.
 */
export function cue(name: Cue, index = 0, speed = 1) {
  const e = engine;
  if (!e || !enabled || !started) return;
  const now = e.context.currentTime;

  switch (name) {
    case "faceLand":
      // Up the scale as the reader moves through the letter, so the six faces
      // are a phrase rather than six copies of one sound.
      glass(e, SCALE[index % SCALE.length], now, 1.4, 0.22);
      break;

    case "memory":
      // An octave down and softer: looking back, not moving on.
      glass(e, SCALE[index % SCALE.length] / 2, now, 1.8, 0.18);
      break;

    case "leave": {
      glass(e, SCALE[2], now, 1.2, 0.16);
      glass(e, SCALE[0], now + 0.28, 1.8, 0.14);
      break;
    }

    case "deploy": {
      // A rising pad under the whole deployment, and a click per panel. Every
      // offset goes through `at`, so the cue keeps its shape at any speed.
      const at = (seconds: number) => now + seconds / speed;
      const pad = e.context.createOscillator();
      const gain = e.context.createGain();
      pad.type = "triangle";
      pad.frequency.setValueAtTime(110, now);
      pad.frequency.exponentialRampToValueAtTime(220, at(3.4));
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, at(1.3));
      gain.gain.linearRampToValueAtTime(0, at(3.5));
      pad.connect(gain).connect(e.master);
      pad.start(now);
      pad.stop(at(3.6));

      /*
       * A click as each of the six panels locks, following the unfold's own
       * stagger (rev 6 §2.4). Six small sounds rather than two: the ear counts
       * them without trying, and "six things locked" is the difference between
       * a lid opening and a machine deploying.
       */
      for (let wing = 0; wing < 2; wing++) {
        for (let k = 0; k < 3; k++) {
          // The unfold window starts at 0.35 of 3.6s; hinges 120ms apart, and
          // the near wing 80ms behind the far one.
          click(e, at(1.26 + k * 0.12 + wing * 0.08 + 0.31));
        }
      }
      break;
    }

    case "launch": {
      const noise = filteredNoise(e, now, 2.4);
      noise.frequency.setValueAtTime(220, now);
      noise.frequency.exponentialRampToValueAtTime(2600, now + 2);
      glass(e, SCALE[4], now + 0.1, 2, 0.14);
      break;
    }

    case "release": {
      // Down and away: the sound of something being let go, not sent.
      const oscillator = e.context.createOscillator();
      const gain = e.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(SCALE[5], now);
      oscillator.frequency.exponentialRampToValueAtTime(SCALE[0] / 2, now + 2.8);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
      oscillator.connect(gain).connect(e.master);
      oscillator.start(now);
      oscillator.stop(now + 3.1);
      break;
    }

    case "dawn": {
      /*
       * Propel's shimmer (§12): filtered noise sweeping up, with one bell
       * over it. It is the sound of arriving somewhere, and it lasts 1.6
       * seconds because the beat it sits under lasts 2.4.
       */
      const noise = filteredNoise(e, now, 1.6);
      noise.frequency.setValueAtTime(600, now);
      noise.frequency.exponentialRampToValueAtTime(3200, now + 1.4);
      glass(e, SCALE[3] * 2, now + 0.12, 1.8, 0.09);
      break;
    }

    case "bloom":
      // Three bell tones, falling slightly: the reply going past. Soft, and
      // over in a second — "joyful, not loud" is a volume as well as a shape.
      for (const [i, frequency] of [SCALE[5], SCALE[4], SCALE[2]].entries()) {
        glass(e, frequency * 2, now + i * 0.09, 1.1, 0.085);
      }
      break;

    case "returned":
      // The one bright moment in the whole palette, and it happens once.
      for (const [i, frequency] of [SCALE[0], SCALE[2], SCALE[4], SCALE[5]].entries()) {
        glass(e, frequency, now + i * 0.06, 2.6, 0.13);
      }
      break;
  }
}

/** A struck-glass tone: a sine with a fast attack and a long exponential tail. */
function glass(e: Engine, frequency: number, at: number, decay: number, peak: number) {
  const oscillator = e.context.createOscillator();
  const gain = e.context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);

  oscillator.connect(gain).connect(e.master);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.05);
}

function click(e: Engine, at: number) {
  const oscillator = e.context.createOscillator();
  const gain = e.context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = 1400;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.05, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  oscillator.connect(gain).connect(e.master);
  oscillator.start(at);
  oscillator.stop(at + 0.09);
}

function filteredNoise(e: Engine, at: number, duration: number): BiquadFilterNode {
  const source = e.context.createBufferSource();
  const buffer = e.context.createBuffer(1, e.context.sampleRate * duration, e.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  source.buffer = buffer;

  const filter = e.context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;

  const gain = e.context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.09, at + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(filter).connect(gain).connect(e.master);
  source.start(at);
  source.stop(at + duration);

  return filter;
}
