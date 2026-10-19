export type SoundSettings = {
  effects: number;
  ambient: number;
  radio: number;
  mute: boolean;
};
const defaults: SoundSettings = {
  effects: 0.35,
  ambient: 0.12,
  radio: 0.3,
  mute: false,
};
let settings = { ...defaults };
try {
  settings = {
    ...defaults,
    ...JSON.parse(localStorage.getItem("orbital-sound-v1") || "{}"),
  };
} catch {}
let context: AudioContext | undefined,
  master: GainNode | undefined,
  ambient: GainNode | undefined,
  engine: GainNode | undefined;
export const sound = {
  settings: () => ({ ...settings }),
  configure(next: Partial<SoundSettings>) {
    settings = { ...settings, ...next };
    try {
      localStorage.setItem("orbital-sound-v1", JSON.stringify(settings));
    } catch {}
    if (master) master.gain.value = settings.mute ? 0 : 1;
    if (ambient) ambient.gain.value = settings.ambient;
  },
  async unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!context) {
        const C = window.AudioContext || (window as any).webkitAudioContext;
        if (!C) return;
        context = new C();
        master = context!.createGain();
        master.gain.value = settings.mute ? 0 : 1;
        master.connect(context!.destination);
        ambient = context!.createGain();
        ambient.gain.value = settings.ambient;
        ambient.connect(master);
        const hum = context!.createOscillator(),
          gain = context!.createGain();
        hum.frequency.value = 55;
        gain.gain.value = 0.018;
        hum.connect(gain);
        gain.connect(ambient);
        hum.start();
        const engineTone = context!.createOscillator();
        engineTone.type = "sawtooth";
        engineTone.frequency.value = 32;
        engine = context!.createGain();
        engine.gain.value = 0;
        engineTone.connect(engine);
        engine.connect(ambient);
        engineTone.start();
      }
      await context!.resume();
    } catch {
      /* Browsers may refuse audio; simulation remains fully available. */
    }
  },
  environment(launch: boolean, eva: boolean) {
    if (engine && context)
      engine.gain.setTargetAtTime(
        launch ? 0.22 : eva ? 0.012 : 0,
        context.currentTime,
        0.5,
      );
  },
  play(
    type:
      | "click"
      | "hatch"
      | "locker"
      | "step"
      | "radio"
      | "warning"
      | "science"
      | "breath",
  ) {
    if (!context || !master || settings.mute) return;
    const t = context.currentTime,
      o = context.createOscillator(),
      g = context.createGain();
    o.type = type === "hatch" || type === "step" ? "triangle" : "sine";
    const frequency = {
        click: 750,
        hatch: 90,
        locker: 220,
        step: 70,
        radio: 1100,
        warning: 520,
        science: 850,
        breath: 160,
      }[type],
      duration = {
        click: 0.025,
        hatch: 0.55,
        locker: 0.16,
        step: 0.08,
        radio: 0.12,
        warning: 0.28,
        science: 0.18,
        breath: 0.8,
      }[type];
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(25, frequency * 0.65),
      t + duration,
    );
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(
      (type === "radio" ? settings.radio : settings.effects) *
        (type === "breath" ? 0.025 : 0.045),
      t + 0.01,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  },
  suspend() {
    if (context) void context.suspend();
  },
};
