type Sound = 'shot' | 'shield' | 'railgun' | 'impact' | 'leak' | 'clear' | 'place' | 'start' | 'over';

/** A lazy Web Audio synth. All oscillators and envelopes are generated locally. */
export class AudioSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastPlayed: Partial<Record<Sound, number>> = {};

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { /* The simulation also works on hosts without Web Audio. */ }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.18, this.context.currentTime, 0.025);
  }

  play(sound: Sound) {
    if (this.muted || !this.context || !this.master || this.context.state !== 'running') return;
    const context = this.context;
    const now = context.currentTime;
    const interval = sound === 'shot' ? 0.075 : sound === 'impact' ? 0.08 : 0.12;
    if (now - (this.lastPlayed[sound] ?? -100) < interval) return;
    this.lastPlayed[sound] = now;

    const tone = (frequency: number, endFrequency: number, duration: number, type: OscillatorType, volume = 0.4, delay = 0) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = now + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      envelope.gain.setValueAtTime(0.001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master!);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    };

    switch (sound) {
      case 'shot': tone(820, 230, 0.065, 'triangle', 0.2); break;
      case 'shield': tone(160, 270, 0.24, 'sine', 0.25); tone(240, 400, 0.26, 'sine', 0.12); break;
      case 'railgun': tone(1250, 60, 0.25, 'sawtooth', 0.18); tone(80, 35, 0.3, 'sine', 0.65); break;
      case 'impact': tone(130, 32, 0.095, 'triangle', 0.4); break;
      case 'leak': tone(220, 95, 0.25, 'square', 0.2); tone(130, 60, 0.3, 'sine', 0.5); break;
      case 'place': tone(440, 660, 0.1, 'sine', 0.45); tone(880, 880, 0.12, 'triangle', 0.2, 0.06); break;
      case 'start': [220, 330, 440].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.32, i * 0.07)); break;
      case 'clear': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.3, 'sine', 0.5, i * 0.09)); break;
      case 'over': [330, 277, 220, 110].forEach((f, i) => tone(f, f * 0.8, 0.4, 'triangle', 0.35, i * 0.15)); break;
    }
  }
}
