"use client";

/**
 * sound.ts — Sound notifications for the KFM Delice dashboard (kitchen + admin).
 *
 * Uses the Web Audio API to synthesize beeps/chimes in-browser — no audio
 * files needed (zero asset weight, works offline, no CDN dependency).
 *
 * Sound presets:
 *   - 'new-order'    : urgent double-beep (kitchen: a new ticket arrived)
 *   - 'order-ready'  : ascending chime (kitchen: dish ready for pickup)
 *   - 'status-change': subtle single click (admin: order status updated)
 *   - 'alert'        : long idle alert (kitchen: order pending > 15 min)
 *
 * Preferences are stored in localStorage (per-device):
 *   - kfm-sound-enabled       : 'true' | 'false'  (master toggle)
 *   - kfm-sound-volume        : '0' to '1'        (master volume)
 *   - kfm-sound-new-order     : 'true' | 'false'  (per-event toggle)
 *   - kfm-sound-order-ready   : 'true' | 'false'
 *   - kfm-sound-status-change : 'true' | 'false'
 *   - kfm-sound-alert         : 'true' | 'false'
 *
 * Browsers block audio autoplay until the user has interacted with the
 * page. We lazily create the AudioContext on the first user gesture
 * (click / keypress) and resume it if suspended.
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type SoundType =
  | "new-order"
  | "order-ready"
  | "status-change"
  | "alert";

interface SoundPreset {
  /** Per-event localStorage key */
  prefKey: string;
  /** Sequence of oscillator notes (frequency in Hz, duration in seconds, type) */
  notes: Array<{
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
  }>;
}

const PRESETS: Record<SoundType, SoundPreset> = {
  // Urgent double-beep — grabs attention without being aggressive.
  // Two short 880 Hz beeps (A5) with 80 ms gap.
  "new-order": {
    prefKey: "kfm-sound-new-order",
    notes: [
      { freq: 880, duration: 0.12, type: "sine", gain: 0.35 },
      { freq: 880, duration: 0.12, type: "sine", gain: 0.35 },
    ],
  },
  // Ascending chime — C5 → E5 → G5 (happy "ready!" signal).
  "order-ready": {
    prefKey: "kfm-sound-order-ready",
    notes: [
      { freq: 523.25, duration: 0.10, type: "sine", gain: 0.30 }, // C5
      { freq: 659.25, duration: 0.10, type: "sine", gain: 0.30 }, // E5
      { freq: 783.99, duration: 0.20, type: "sine", gain: 0.30 }, // G5
    ],
  },
  // Subtle single click — confirms a status change without being noisy.
  "status-change": {
    prefKey: "kfm-sound-status-change",
    notes: [
      { freq: 1000, duration: 0.05, type: "square", gain: 0.10 },
    ],
  },
  // Long idle alert — three descending beeps (urgency: check this order).
  "alert": {
    prefKey: "kfm-sound-alert",
    notes: [
      { freq: 660, duration: 0.15, type: "triangle", gain: 0.25 },
      { freq: 550, duration: 0.15, type: "triangle", gain: 0.25 },
      { freq: 440, duration: 0.30, type: "triangle", gain: 0.25 },
    ],
  },
};

// ────────────────────────────────────────────────────────────────
// AudioContext singleton (lazy + browser-gesture aware)
// ────────────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
let _userInteracted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null; // SSR guard
  if (_audioCtx) return _audioCtx;

  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtxClass) return null;

  try {
    _audioCtx = new AudioCtxClass();
    return _audioCtx;
  } catch {
    return null;
  }
}

/**
 * Mark that the user has interacted with the page (click / keypress).
 * Called once on the first gesture — unlocks audio autoplay.
 */
function markUserInteracted(): void {
  if (_userInteracted) return;
  _userInteracted = true;
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* ignore — will retry on next playSound */
    });
  }
}

if (typeof window !== "undefined") {
  // Listen for the first user gesture to unlock audio.
  // We use { once: false } with a guard because some browsers fire
  // multiple events before considering audio "unlocked".
  const unlock = () => markUserInteracted();
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

// ────────────────────────────────────────────────────────────────
// Preferences helpers
// ────────────────────────────────────────────────────────────────

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("kfm-sound-enabled") !== "false";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kfm-sound-enabled", enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return 0.5;
  try {
    const v = parseFloat(localStorage.getItem("kfm-sound-volume") || "0.5");
    return Math.max(0, Math.min(1, isNaN(v) ? 0.5 : v));
  } catch {
    return 0.5;
  }
}

export function setSoundVolume(volume: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kfm-sound-volume", String(Math.max(0, Math.min(1, volume))));
  } catch {
    /* ignore */
  }
}

export function isSoundTypeEnabled(type: SoundType): boolean {
  if (typeof window === "undefined") return false;
  if (!isSoundEnabled()) return false;
  try {
    const preset = PRESETS[type];
    return localStorage.getItem(preset.prefKey) !== "false";
  } catch {
    return false;
  }
}

export function setSoundTypeEnabled(type: SoundType, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const preset = PRESETS[type];
    localStorage.setItem(preset.prefKey, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

// ────────────────────────────────────────────────────────────────
// Core play function
// ────────────────────────────────────────────────────────────────

/**
 * Play a sound preset.
 *
 * Safe to call from anywhere — no-ops if:
 *   - sound is disabled (master toggle or per-event toggle)
 *   - AudioContext is not available (SSR or unsupported browser)
 *   - the user hasn't interacted with the page yet (autoplay blocked)
 *
 * @param type   Which preset to play
 * @param force  If true, bypass the enabled checks (for the "Test sound" button)
 */
export function playSound(type: SoundType, force = false): void {
  if (!force && !isSoundTypeEnabled(type)) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Browsers block audio until the user has interacted. If the context
  // is suspended, try to resume it (will succeed if the user has
  // already clicked/tapped anywhere on the page).
  if (ctx.state === "suspended") {
    if (!_userInteracted) return; // silent no-op
    ctx.resume().catch(() => {
      /* ignore — will retry next call */
    });
  }

  const preset = PRESETS[type];
  const masterVolume = getSoundVolume();
  const now = ctx.currentTime;
  let offset = 0;

  for (const note of preset.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = note.type || "sine";
    osc.frequency.value = note.freq;

    const peakGain = (note.gain ?? 0.3) * masterVolume;
    // Envelope: quick attack, exponential decay — avoids clicks/pops.
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(peakGain, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + offset + note.duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + note.duration + 0.02);

    // Small gap between notes for clarity
    offset += note.duration + 0.04;
  }
}

// ────────────────────────────────────────────────────────────────
// Convenience wrappers
// ────────────────────────────────────────────────────────────────

export function playNewOrderSound(): void {
  playSound("new-order");
}

export function playOrderReadySound(): void {
  playSound("order-ready");
}

export function playStatusChangeSound(): void {
  playSound("status-change");
}

export function playAlertSound(): void {
  playSound("alert");
}

// ────────────────────────────────────────────────────────────────
// React hook: subscribe to sound preference changes
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

export interface SoundPreferences {
  enabled: boolean;
  volume: number;
  newOrder: boolean;
  orderReady: boolean;
  statusChange: boolean;
  alert: boolean;
}

export function useSoundPreferences() {
  const [prefs, setPrefs] = useState<SoundPreferences>({
    enabled: isSoundEnabled(),
    volume: getSoundVolume(),
    newOrder: isSoundTypeEnabled("new-order"),
    orderReady: isSoundTypeEnabled("order-ready"),
    statusChange: isSoundTypeEnabled("status-change"),
    alert: isSoundTypeEnabled("alert"),
  });

  // Cross-tab sync: if the user changes prefs in another tab, update here.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith("kfm-sound")) return;
      setPrefs({
        enabled: isSoundEnabled(),
        volume: getSoundVolume(),
        newOrder: isSoundTypeEnabled("new-order"),
        orderReady: isSoundTypeEnabled("order-ready"),
        statusChange: isSoundTypeEnabled("status-change"),
        alert: isSoundTypeEnabled("alert"),
      });
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const update = useCallback(
    (partial: Partial<SoundPreferences>) => {
      if (partial.enabled !== undefined) setSoundEnabled(partial.enabled);
      if (partial.volume !== undefined) setSoundVolume(partial.volume);
      if (partial.newOrder !== undefined)
        setSoundTypeEnabled("new-order", partial.newOrder);
      if (partial.orderReady !== undefined)
        setSoundTypeEnabled("order-ready", partial.orderReady);
      if (partial.statusChange !== undefined)
        setSoundTypeEnabled("status-change", partial.statusChange);
      if (partial.alert !== undefined)
        setSoundTypeEnabled("alert", partial.alert);
      setPrefs((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const test = useCallback((type: SoundType = "new-order") => {
    // Force play so the user can hear it even if the toggle is off.
    playSound(type, true);
  }, []);

  return { prefs, update, test };
}
