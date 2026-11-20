// All sound is synthesised with WebAudio: no audio files, nothing to load.
// Short one-shot blips for shots, hits and pickups; two loops (a car engine
// whose pitch follows speed, and a two-tone police siren) and a slow
// synthwave chord loop for music. The context starts on the first user
// gesture, as browsers require; in screenshot mode nothing here runs.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    startMusic();
    return true;
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, dest = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(dest ?? master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.25, low = 400, high = 2400) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A minor-key synthwave loop: bass pulse on the beat, a soft pad chord each
  // bar, a sparse sparkle note. Scheduled with a timer while the tab plays.
  const BASS = [55, 55, 65.41, 49]; // A1 A1 C2 G1
  const PADS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const bar = Math.floor(musicStep / 4) % 4;
      if (musicStep % 4 === 0) {
        for (const f of PADS[bar]) tone(f, 1.9, 'triangle', 0.05, null, musicGain);
      }
      tone(BASS[bar], 0.22, 'sawtooth', 0.11, null, musicGain);
      if (musicStep % 2 === 0) tone(BASS[bar] * 2, 0.16, 'square', 0.045, null, musicGain);
      musicStep += 1;
    }, 240);
  }

  return {
    /** Call from any click/keypress handler: unlocks audio on this gesture. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
      return muted;
    },
    shoot() {
      noise(0.09, 0.3, 900, 3800);
      tone(160, 0.08, 'square', 0.16, 60);
    },
    dryFire() {
      tone(1200, 0.03, 'square', 0.08);
    },
    punch() {
      noise(0.07, 0.2, 200, 900);
    },
    hurt() {
      tone(220, 0.12, 'sawtooth', 0.14, 110);
    },
    crash(strength = 1) {
      noise(0.22, 0.22 * strength, 150, 1600);
      tone(90, 0.2, 'triangle', 0.2 * strength, 45);
    },
    cash() {
      tone(880, 0.07, 'square', 0.1);
      window.setTimeout(() => tone(1318, 0.1, 'square', 0.1), 55);
    },
    pickup() {
      tone(660, 0.06, 'triangle', 0.14, 990);
    },
    phone() {
      tone(1046, 0.09, 'sine', 0.12);
      window.setTimeout(() => tone(1046, 0.09, 'sine', 0.12), 130);
    },
    missionDone() {
      if (!ensure()) return;
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, 'triangle', 0.14), i * 90));
    },
    missionFail() {
      tone(392, 0.16, 'triangle', 0.13);
      window.setTimeout(() => tone(311, 0.22, 'triangle', 0.13), 140);
    },
    busted() {
      tone(196, 0.5, 'sawtooth', 0.16, 98);
    },
    horn() {
      tone(370, 0.16, 'square', 0.07);
      tone(466, 0.16, 'square', 0.05);
    },
    door() {
      noise(0.05, 0.12, 300, 1200);
      tone(140, 0.06, 'triangle', 0.1, 90);
    },
    spray() {
      noise(0.5, 0.1, 2000, 5200);
    },
    /** Engine loop: call every frame with speed 0..1, or null to stop it. */
    engine(level) {
      if (!ensure()) return;
      if (level === null) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(52 + level * 130, ctx.currentTime, 0.06);
      engineGain.gain.setTargetAtTime(0.05 + level * 0.05, ctx.currentTime, 0.09);
    },
    /** Siren loop: level 0..1 by how close the law is, or null to stop it. */
    siren(level) {
      if (!ensure()) return;
      if (level === null || level <= 0) {
        if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenFlip = window.setInterval(() => {
          if (!sirenOsc || !ctx) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 1180 : 840, ctx.currentTime);
        }, 380);
      }
      sirenGain.gain.setTargetAtTime(0.028 + level * 0.05, ctx.currentTime, 0.15);
    },
  };
}
