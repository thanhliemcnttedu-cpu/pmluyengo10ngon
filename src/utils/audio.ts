// Web Audio API Synthesizer for realistic mechanical keyboard clicks & game audio

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.7;

  public initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private bgmInterval: number | null = null;
  private isBgmPlaying: boolean = false;

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopBGM();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Nhạc nền (BGM) vui nhộn, sống động bằng Web Audio API Synthesizer (pentatonic marimba/chiptune)
  public startBGM() {
    if (this.isMuted || this.isBgmPlaying) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      this.isBgmPlaying = true;

      // Giai điệu thiếu nhi vui tươi, nhộn nhịp âm giai Đô Trưởng / Son Trưởng
      const melody = [
        { note: 523.25, dur: 0.2 }, // C5
        { note: 587.33, dur: 0.2 }, // D5
        { note: 659.25, dur: 0.2 }, // E5
        { note: 783.99, dur: 0.32 }, // G5
        { note: 659.25, dur: 0.2 }, // E5
        { note: 783.99, dur: 0.2 }, // G5
        { note: 880.00, dur: 0.38 }, // A5
        { note: 783.99, dur: 0.24 }, // G5
        { note: 659.25, dur: 0.2 }, // E5
        { note: 587.33, dur: 0.2 }, // D5
        { note: 523.25, dur: 0.38 }, // C5
        { note: 392.00, dur: 0.2 }, // G4
        { note: 523.25, dur: 0.2 }, // C5
        { note: 587.33, dur: 0.2 }, // D5
        { note: 659.25, dur: 0.32 }, // E5
        { note: 523.25, dur: 0.42 }, // C5
      ];

      const bassNotes = [261.63, 261.63, 329.63, 392.00, 349.23, 349.23, 261.63, 392.00];

      let noteIdx = 0;
      let bassIdx = 0;

      const playStep = () => {
        if (!this.isBgmPlaying || this.isMuted || !this.ctx) return;
        const t = this.ctx.currentTime;
        const currentMelody = melody[noteIdx % melody.length];

        // Âm sắc Marimba / Bell trong trẻo
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(currentMelody.note, t);

        const vol = this.volume * 0.12;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + currentMelody.dur * 0.95);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + currentMelody.dur);

        // Nốt trầm hòa âm bass
        if (noteIdx % 2 === 0) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(bassNotes[bassIdx % bassNotes.length], t);

          bassGain.gain.setValueAtTime(this.volume * 0.07, t);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);

          bassOsc.connect(bassGain);
          bassGain.connect(this.ctx.destination);
          bassOsc.start(t);
          bassOsc.stop(t + 0.36);
          bassIdx++;
        }

        noteIdx++;
      };

      playStep();
      this.bgmInterval = window.setInterval(playStep, 250);
    } catch {
      // AudioContext error suppressed
    }
  }

  public stopBGM() {
    this.isBgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  // Bộ đệm tiếng ồn trắng dùng chung (tạo 1 lần) cho tiếng "tách/cộp" của phím cơ
  private noiseBuf: AudioBuffer | null = null;
  private getNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuf || this.noiseBuf.sampleRate !== this.ctx.sampleRate) {
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  // Một lớp tiếng ồn ngắn đi qua bộ lọc dải: mô phỏng tiếng nhựa/kim loại va chạm
  private noiseHit(dest: AudioNode, t: number, freq: number, q: number, gain: number, decay: number) {
    if (!this.ctx) return;
    const buf = this.getNoise();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.Q.setValueAtTime(q, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.15);
    src.stop(t + decay + 0.01);
  }

  // Một lớp âm trầm tắt nhanh: tiếng "cộp" của vỏ bàn phím / keycap chạm đáy
  private toneHit(dest: AudioNode, t: number, from: number, to: number, gain: number, decay: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + decay + 0.01);
  }

  /**
   * Tiếng phím cơ chân thực (switch kiểu clicky):
   * nhấn = tiếng "tách" của lá công tắc + tiếng "cộp" keycap chạm đáy + cộng hưởng vỏ;
   * ~70-100ms sau là tiếng nhả phím nhỏ hơn. Mỗi lần bấm lệch nhẹ cao độ/âm lượng cho tự nhiên.
   * Phím to (Cách, Enter, Xóa) trầm và dày hơn, có tiếng rung thanh cân bằng.
   */
  public playMechanicalClick(kind: boolean | 'normal' | 'space' | 'enter' | 'backspace' = false) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const k = kind === true ? 'space' : kind === false ? 'normal' : kind;
      const big = k !== 'normal';
      const t = this.ctx.currentTime + 0.002;
      const jitter = 0.94 + Math.random() * 0.12; // lệch cao độ ±6%
      const level = this.volume * (0.85 + Math.random() * 0.2) * (big ? 1.15 : 1);

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(level, t);
      // Cắt bớt tần số quá cao để tiếng không chói
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(big ? 6500 : 9000, t);
      master.connect(tone);
      tone.connect(this.ctx.destination);

      // 1. "Tách": lá công tắc bật (rất ngắn, cao)
      this.noiseHit(master, t, 4200 * jitter, 2.2, big ? 0.35 : 0.55, 0.012);
      // 2. "Cộp": keycap chạm đáy (dải trung)
      this.noiseHit(master, t + 0.004, (big ? 1100 : 1900) * jitter, 1.3, big ? 0.75 : 0.6, big ? 0.05 : 0.035);
      // 3. Cộng hưởng vỏ bàn phím (trầm)
      this.toneHit(master, t + 0.004, (big ? 170 : 260) * jitter, big ? 70 : 110, big ? 0.55 : 0.32, big ? 0.09 : 0.06);
      // 4. Phím to: thanh cân bằng rung nhẹ
      if (big) this.noiseHit(master, t + 0.012, 520 * jitter, 2.5, 0.22, 0.07);
      // 5. Nhả phím: tiếng nhỏ hơn, cao hơn một chút
      const up = t + 0.07 + Math.random() * 0.03;
      this.noiseHit(master, up, (big ? 1500 : 2600) * jitter, 1.6, big ? 0.22 : 0.18, 0.025);
      this.toneHit(master, up, (big ? 200 : 320) * jitter, 140, 0.08, 0.035);
    } catch {
      // AudioContext error suppressed
    }
  }

  /**
   * Gõ SAI: vẫn có tiếng phím (học sinh đã bấm thật) nhưng đục hơn, kèm hai nốt "ơ-ơ" đi xuống
   * nhẹ nhàng, không gây giật mình.
   */
  public playWrongKey() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.002;
      const master = this.ctx.createGain();
      master.gain.setValueAtTime(this.volume, t);
      master.connect(this.ctx.destination);

      // Tiếng phím đục (keycap chạm đáy, không có tiếng "tách")
      this.noiseHit(master, t, 900, 1.2, 0.45, 0.05);
      this.toneHit(master, t, 200, 90, 0.35, 0.08);

      // Hai nốt "ơ-ơ" đi xuống (Mi -> Đô), âm sắc tròn
      const notes: Array<[number, number, number]> = [
        [659.25, 0.03, 0.12],
        [523.25, 0.17, 0.2],
      ];
      notes.forEach(([freq, offset, dur]) => {
        if (!this.ctx) return;
        const nt = t + offset;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, nt);
        o.frequency.exponentialRampToValueAtTime(freq * 0.94, nt + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, nt);
        g.gain.exponentialRampToValueAtTime(0.28, nt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, nt + dur);
        o.connect(g);
        g.connect(master);
        o.start(nt);
        o.stop(nt + dur + 0.02);
      });
    } catch {
      // AudioContext error suppressed
    }
  }

  // Soft typing pop sound (friendly for kids)
  public playBubblePop() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);

      gain.gain.setValueAtTime(this.volume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // AudioContext error suppressed
    }
  }

  // Friendly error boop
  public playErrorBoop() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.setValueAtTime(110, t + 0.07);

      gain.gain.setValueAtTime(this.volume * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    } catch {
      // AudioContext error suppressed
    }
  }

  // Victory fanfare for lesson completion
  public playVictoryFanfare() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteStartTime = this.ctx.currentTime + idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStartTime);

        gain.gain.setValueAtTime(this.volume * 0.4, noteStartTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + (idx === 3 ? 0.6 : 0.25));

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(noteStartTime);
        osc.stop(noteStartTime + (idx === 3 ? 0.65 : 0.3));
      });
    } catch {
      // AudioContext error suppressed
    }
  }

  // Authentic crowd applause / clapping sound effect for lesson completion
  public playApplause() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const bufferSize = Math.floor(this.ctx.sampleRate * 2.8);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Generate noise buffer
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // Play series of staggered individual claps for celebratory applause
      const startTime = this.ctx.currentTime;
      const numClaps = 38;

      for (let c = 0; c < numClaps; c++) {
        const clapTime = startTime + Math.random() * 2.4;
        const osc = this.ctx.createBufferSource();
        osc.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900 + Math.random() * 600, clapTime);
        filter.Q.setValueAtTime(3.5, clapTime);

        const clapGain = this.ctx.createGain();
        const baseVolume = this.volume * (0.35 + Math.random() * 0.35);
        clapGain.gain.setValueAtTime(baseVolume, clapTime);
        clapGain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.08);

        osc.connect(filter);
        filter.connect(clapGain);
        clapGain.connect(this.ctx.destination);

        osc.start(clapTime);
        osc.stop(clapTime + 0.09);
      }
    } catch {
      // AudioContext error suppressed
    }
  }

  // Encouraging chime when student achieves great accuracy or milestone
  public playEncouragementChime() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const chimeNotes = [587.33, 880.00, 1174.66]; // D5, A5, D6
      chimeNotes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteTime = t + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(this.volume * 0.35, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    } catch {
      // AudioContext error suppressed
    }
  }

  // Speak character or word using browser SpeechSynthesis
  public speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.lang = 'vi-VN';
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech error suppressed
    }
  }
}

export const soundEngine = new SoundEngine();
