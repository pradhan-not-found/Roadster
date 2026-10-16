/**
 * Procedural Web Audio API sound synthesizer for Tesla Roadster Kickflip
 * Zero external audio files required, runs 100% in-browser with zero latency.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private hasJumped: boolean = false;
  private hasLanded: boolean = false;

  constructor() {
    this.isMuted = true;
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!muted) {
      this.initContext();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Generates white noise buffer for thrusters and tires
   */
  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Cold gas thruster ignition blast
   */
  public playThrusterBlast(intensity = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const noise = this.createNoiseBuffer();
      if (!noise) return;

      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.15);
      filter.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.5);
      filter.Q.value = 3.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22 * intensity, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.55);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      src.start();
      src.stop(this.ctx.currentTime + 0.6);
    } catch {
      // AudioContext fallback
    }
  }

  /**
   * Kickflip landing suspension compression
   */
  public playLandingThump() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {
      // AudioContext fallback
    }
  }

  /**
   * Frame update hook to sync sound with Roadster trajectory
   */
  public updateSound(t: number, _air: boolean, _jet: number) {
    if (this.isMuted) return;

    if (t < 0) {
      this.hasJumped = false;
      this.hasLanded = false;
    }

    // Launch event
    if (t >= 0 && t <= 0.08 && !this.hasJumped) {
      this.hasJumped = true;
      this.playThrusterBlast(1.2);
    }

    // Landing event
    if (t >= 0.95 && t <= 1.05 && !this.hasLanded && this.hasJumped) {
      this.hasLanded = true;
      this.playLandingThump();
      this.playThrusterBlast(0.6);
    }
  }
}

export const sounds = new SoundEngine();
