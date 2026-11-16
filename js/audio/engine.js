/*
 * engine.js: the sounds of the shore, all synthesized (no sound files).
 *
 *   unlock()            call from a tap or a key: browsers start audio only then
 *   setEnv(env, swell)  each frame: wind, rain, how deep the water, the wave
 *   bell()              the tide bell
 *   chime(n)            a small rising figure: something happened
 *   plop(), click()     small sounds for the hand
 */
export class Audio {
    constructor() {
        this.enabled = true;
        this.ctx = null;
    }

    unlock() {
        if (!this.enabled) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!this.ctx) this.build(new AC());
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.1);
    }

    build(ctx) {
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.7;
        const comp = ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(ctx.destination);

        const len = ctx.sampleRate * 4;                    // four seconds of noise, looped
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            let last = 0;
            for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2 + w * 0.12; }
        }
        const voice = (type, freq, q) => {
            const src = ctx.createBufferSource();
            src.buffer = buf; src.loop = true;
            src.playbackRate.value = 0.8 + Math.random() * 0.4;
            const f = ctx.createBiquadFilter();
            f.type = type; f.frequency.value = freq; f.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = 0;
            src.connect(f).connect(g).connect(this.master);
            src.start(0, Math.random() * 3);
            return { f, g };
        };
        this.surf = voice('lowpass', 700, 0.3);
        this.hiss = voice('bandpass', 2600, 0.5);
        this.wind = voice('bandpass', 420, 1.6);
        this.rain = voice('highpass', 3800, 0.4);
        this.deep = voice('lowpass', 130, 0.8);
    }

    /** swell: 0..1, the breathing of the waves, the same as the picture's. */
    setEnv(env, swell) {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime, w = env.weather;
        const set = (v, x) => v.g.gain.setTargetAtTime(x, now, 0.25);
        const rough = 0.35 + 0.65 * w.wind + (env.storm ? 0.4 : 0);
        set(this.surf, (0.1 + 0.3 * swell * swell) * rough);
        this.surf.f.frequency.setTargetAtTime(420 + 900 * swell * rough, now, 0.3);
        set(this.hiss, 0.035 * Math.pow(swell, 3) * rough);
        set(this.wind, 0.01 + 0.13 * w.wind * w.wind * (0.7 + 0.3 * Math.sin(now * 0.37) * Math.sin(now * 0.13)));
        this.wind.f.frequency.setTargetAtTime(320 + 500 * w.wind + 120 * Math.sin(now * 0.21), now, 0.5);
        set(this.rain, 0.07 * w.rain);
        set(this.deep, 0.12 * env.level);
    }

    tone(freq, at, dur, vol, type = 'sine') {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g).connect(this.master);
        o.start(at); o.stop(at + dur + 0.05);
    }

    bell() {
        if (!this.ctx || !this.enabled) return;
        const at = this.ctx.currentTime + 0.02;
        for (const [k, v, d] of [[1, 0.2, 3.2], [2.0, 0.1, 2.4], [2.76, 0.07, 1.8], [5.4, 0.03, 1.0], [0.5, 0.06, 3.6]])
            this.tone(392 * k, at, d, v);
    }

    chime(n = 3) {
        if (!this.ctx || !this.enabled) return;
        const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
        const at = this.ctx.currentTime + 0.02, start = Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(scale[start + i], at + i * 0.13, 1.4, 0.07, 'triangle');
    }

    plop() {
        if (!this.ctx || !this.enabled) return;
        const at = this.ctx.currentTime + 0.01;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.frequency.setValueAtTime(240, at);
        o.frequency.exponentialRampToValueAtTime(620, at + 0.09);
        g.gain.setValueAtTime(0.16, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        o.connect(g).connect(this.master);
        o.start(at); o.stop(at + 0.2);
    }

    click() {
        if (!this.ctx || !this.enabled) return;
        const at = this.ctx.currentTime + 0.01;
        this.tone(190, at, 0.07, 0.2, 'triangle');
        this.tone(1300, at, 0.03, 0.05, 'square');
    }
}
