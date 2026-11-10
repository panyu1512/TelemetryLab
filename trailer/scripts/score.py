"""
The trailer's soundtrack, written out as code.

    pip install numpy scipy          # not project dependencies
    python3 trailer/scripts/score.py # → trailer/assets/audio/{music,sfx}.m4a

Two stems, so the film stays editable: `music` is the bed, `sfx` is every sound
that has a cause on screen (a cut, a window landing, the radar lighting). Both
are synthesised here from oscillators and noise — there is no sample, loop or
third-party recording in either, so the audio carries the repo's own licence.

The clock is the film's: 120 BPM at 30 fps is 15 frames a beat and 60 a bar,
so every bar line below is a whole frame and the cut list in `index.html` and
this file's section table are the same numbers.

    bar   s     section
    1–4   0–8   intro: pulse and heartbeat kick, riser from bar 3
    5     8–10  the title: impact, held chord, swell into the drop
    6–13  10–26 the drop: Fm · D♭ · A♭ · E♭, twice
    14    26–28 break: snare build while the windows fly in
    15–17 28–34 payoff: everything, with the top line
    18–20 34–40 end card: final hit on Fm, ring out

Deterministic: the only randomness is one seeded generator.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
DUR = 40.0
N = int(DUR * SR)
rng = np.random.default_rng(1420)

OUT = Path(__file__).resolve().parent.parent / "assets" / "audio"


# ── primitives ──────────────────────────────────────────────────────────────


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def saw(freq: np.ndarray | float, n: int, phase: float = 0.0) -> np.ndarray:
    """A PolyBLEP sawtooth — band-limited enough not to alias audibly."""
    f = np.full(n, freq, dtype=np.float64) if np.isscalar(freq) else freq
    dt = f / SR
    t = (phase + np.cumsum(dt)) % 1.0
    y = 2 * t - 1
    lo = t < dt
    hi = t > 1 - dt
    x = t[lo] / dt[lo]
    y[lo] -= x + x - x * x - 1
    x = (t[hi] - 1) / dt[hi]
    y[hi] -= x * x + x + x + 1
    return y


def sine(freq: np.ndarray | float, n: int) -> np.ndarray:
    f = np.full(n, freq, dtype=np.float64) if np.isscalar(freq) else freq
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(n: int) -> np.ndarray:
    return rng.uniform(-1, 1, n)


def butter(x: np.ndarray, kind: str, cutoff, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def decay(n: int, tau: float, attack: float = 0.002) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1.0, t / attack) * np.exp(-t / tau)


def svf_sweep(x: np.ndarray, cutoff: np.ndarray, q: float, mode: str) -> np.ndarray:
    """A state-variable filter whose cutoff moves every sample (risers, whooshes)."""
    g = np.tan(np.pi * np.clip(cutoff, 20, SR * 0.45) / SR)
    k = 1.0 / q
    out = np.empty_like(x)
    ic1 = ic2 = 0.0
    pick = {"low": 2, "band": 1, "high": 0}[mode]
    for i in range(len(x)):
        gi = g[i]
        a1 = 1.0 / (1.0 + gi * (gi + k))
        a2 = gi * a1
        a3 = gi * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v2 if pick == 2 else v1 if pick == 1 else x[i] - k * v1 - v2
    return out


BANK = [250, 500, 1000, 2000, 4000, 8000, 16000]


def morph_lowpass(x: np.ndarray, cutoff: np.ndarray) -> np.ndarray:
    """A low-pass whose cutoff follows a curve, by crossfading a bank of fixed
    filters an octave apart. Vectorised, and free of the zipper a swept biquad
    makes."""
    layers = [butter(x, "low", c, 2) for c in BANK]
    pos = np.clip(np.log2(cutoff / BANK[0]), 0, len(BANK) - 1 - 1e-6)
    lo = pos.astype(int)
    frac = pos - lo
    out = np.zeros_like(x)
    for i, layer in enumerate(layers):
        w = np.where(lo == i, 1 - frac, 0) + np.where(lo == i - 1, frac, 0)
        out += layer * (w[:, None] if x.ndim == 2 else w)
    return out


def place(buf: np.ndarray, x: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Mix `x` (mono or stereo) into the stereo buffer at `t` seconds."""
    i = int(round(t * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    if i < 0:
        x, i = x[-i:], 0
    x = x[: len(buf) - i]
    if x.ndim == 1:
        left = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        right = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        buf[i : i + len(x), 0] += x * gain * left
        buf[i : i + len(x), 1] += x * gain * right
    else:
        buf[i : i + len(x)] += x * gain


def stereo() -> np.ndarray:
    return np.zeros((N, 2))


def curve(points: list[tuple[float, float]], log: bool = False) -> np.ndarray:
    """A per-sample automation curve through (seconds, value) points."""
    t = np.arange(N) / SR
    xs, ys = zip(*points)
    if log:
        return np.exp(np.interp(t, xs, np.log(ys)))
    return np.interp(t, xs, ys)


def reverb_ir(seconds: float, damp: float) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 6.9))[:, None]
    ir = butter(ir, "low", damp, 1)
    ir = butter(ir, "high", 250, 1)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir**2).sum(axis=0)).max()


def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    return np.stack(
        [signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in (0, 1)], axis=1
    )


def ping_pong(x: np.ndarray, time: float, feedback: float, taps: int = 6) -> np.ndarray:
    """Echoes that alternate sides; returns the wet signal only."""
    d = int(time * SR)
    wet = np.zeros_like(x)
    mono = x.mean(axis=1)
    for k in range(1, taps + 1):
        g = feedback**k
        side = k % 2
        if k * d < len(x):
            wet[k * d :, side] += mono[: len(x) - k * d] * g
            wet[k * d :, 1 - side] += mono[: len(x) - k * d] * g * 0.25
    return butter(wet, "low", 5500, 1)


# ── the score ───────────────────────────────────────────────────────────────

# F minor: i · VI · III · VII.
CHORDS = {
    "Fm": {"sub": 29, "pad": [53, 56, 60, 65], "arp": [65, 68, 72, 77]},
    "Db": {"sub": 37, "pad": [53, 56, 61, 65], "arp": [65, 68, 73, 77]},
    "Ab": {"sub": 32, "pad": [51, 56, 60, 63], "arp": [63, 68, 72, 75]},
    "Eb": {"sub": 39, "pad": [51, 55, 58, 63], "arp": [63, 67, 70, 75]},
}

# Chord per bar, 0-indexed bars. The intro and the title sit on the tonic.
PROGRESSION = (
    ["Fm"] * 5
    + ["Fm", "Db", "Ab", "Eb"] * 2  # the drop, bars 6–13
    + ["Db"]  # the break
    + ["Fm", "Db", "Eb"]  # payoff
    + ["Fm"] * 3  # end card
)

T_TITLE, T_DROP, T_BREAK, T_PAYOFF, T_END = 8.0, 10.0, 26.0, 28.0, 34.0


def bar_start(b: int) -> float:
    return b * BAR


# ── drums ───────────────────────────────────────────────────────────────────


def kick(weight: float = 1.0) -> np.ndarray:
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    pitch = 46 + 120 * np.exp(-t / 0.028) + 60 * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / 0.16)
    click = butter(noise(n), "high", 3000) * np.exp(-t / 0.004) * 0.35
    y = np.tanh((body + click) * 1.6 * weight)
    y[-480:] *= np.linspace(1, 0, 480)
    return y


def clap() -> np.ndarray:
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for off in (0.0, 0.011, 0.021):
        m = t >= off
        env[m] += np.exp(-(t[m] - off) / 0.007) * 0.7
    m = t >= 0.03
    env[m] += np.exp(-(t[m] - 0.03) / 0.075)
    return butter(butter(noise(n), "band", [900, 3600]), "high", 700) * env


def snare(tone: float = 185) -> np.ndarray:
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (tone + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    rattle = butter(noise(n), "band", [1200, 8000]) * np.exp(-t / 0.07)
    return body * 0.6 + rattle * 0.8


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.3 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return butter(noise(n), "high", 7500, 4) * np.exp(-t / (0.085 if open_ else 0.014))


def crash(seconds: float = 2.6) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = np.stack([butter(noise(n), "high", 3800, 2) for _ in (0, 1)], axis=1)
    return x * (np.exp(-t / (seconds / 4.5)) * np.minimum(1, t / 0.002))[:, None]


def build_drums() -> tuple[np.ndarray, np.ndarray, list[float]]:
    """Returns (kick bus, everything else, kick times for the sidechain)."""
    kicks, tops = stereo(), stereo()
    kick_times: list[float] = []
    k_soft, k_full = kick(0.75), kick(1.0)
    cl, hh, oh, sn = clap(), hat(), hat(True), snare()

    def four_on_floor(t0: float, t1: float, sample: np.ndarray, gain: float) -> None:
        for t in np.arange(t0, t1 - 1e-6, BEAT):
            place(kicks, sample, t, gain)
            kick_times.append(float(t))

    # Intro: a heartbeat on one and three, then four to the bar under the riser.
    for t in (0, 2 * BEAT, BAR, BAR + 2 * BEAT):
        place(kicks, k_soft, t, 0.8)
        kick_times.append(t)
    four_on_floor(4.0, 7.5, k_soft, 0.85)

    # The drop and the payoff.
    four_on_floor(T_DROP, T_BREAK, k_full, 1.0)
    four_on_floor(T_PAYOFF, T_END, k_full, 1.0)
    for t0, t1 in ((T_DROP, T_BREAK), (T_PAYOFF, T_END)):
        for b in np.arange(t0, t1 - 1e-6, BEAT):
            if int(round((b - t0) / BEAT)) % 2 == 1:
                place(tops, cl, b, 0.62)
            place(tops, oh, b + BEAT / 2, 0.20, pan=0.15)
            for s in range(4):
                place(tops, hh, b + s * S16, (0.20, 0.10, 0.15, 0.11)[s], pan=-0.2 if s % 2 else 0.2)

    # Quieter hats tick through bars 3–4 so the build has a grid.
    for b in np.arange(4.0, 7.5 - 1e-6, BEAT / 2):
        place(tops, hh, b, 0.10 + 0.012 * (b - 4.0))

    # Snare builds: eighths, then sixteenths, then thirty-seconds, rising.
    def build(t0: float, length: float, gap: float) -> None:
        end = t0 + length - gap
        t, i = t0, 0
        while t < end - 1e-6:
            p = (t - t0) / length
            step = BEAT / 2 if p < 0.5 else BEAT / 4 if p < 0.8 else BEAT / 8
            place(tops, snare(185 + 70 * p), t, 0.16 + 0.42 * p**1.5)
            t += step
            i += 1

    build(6.0, 2.0, BEAT / 2)
    build(9.0, 1.0, 0.0)
    build(T_BREAK, 2.0, BEAT / 2)

    for t in (T_TITLE, T_DROP, 18.0, T_PAYOFF, 32.0, T_END):
        place(tops, crash(3.4 if t in (T_TITLE, T_END) else 2.4), t, 0.26 if t != 18.0 else 0.18)

    return kicks, tops, kick_times


def sidechain(kick_times: list[float], depth: float, release: float) -> np.ndarray:
    g = np.ones(N)
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    duck = 1 - depth * np.exp(-t / release) * np.minimum(1, t / 0.004)
    for kt in kick_times:
        i = int(kt * SR)
        seg = duck[: N - i]
        g[i : i + len(seg)] = np.minimum(g[i : i + len(seg)], seg)
    return g


# ── bass ────────────────────────────────────────────────────────────────────


def build_bass() -> tuple[np.ndarray, np.ndarray]:
    sub, mid = stereo(), stereo()

    def note(root: int, length: float, bright: float) -> np.ndarray:
        n = int(length * SR)
        f = hz(root + 12)
        y = saw(f, n) * 0.6 + saw(f * 1.006, n, 0.3) * 0.4
        y = butter(y, "low", 600 + 3200 * bright, 2)
        return np.tanh(y * 1.5) * decay(n, 0.11 + 0.05 * bright, 0.003)

    for b, name in enumerate(PROGRESSION):
        t0 = bar_start(b)
        root = CHORDS[name]["sub"]
        if t0 < T_TITLE:
            # A muted pulse, eighths in bars 1–2 and sixteenths in 3–4.
            step = BEAT / 2 if b < 2 else S16
            for t in np.arange(t0, min(t0 + BAR, 7.5) - 1e-6, step):
                p = t / 8.0
                place(mid, note(root, step * 0.9, 0.05 + 0.5 * p**2), t, 0.34 + 0.2 * p)
        elif T_DROP <= t0 < T_BREAK or T_PAYOFF <= t0 < T_END:
            # Rolling bass: the three sixteenths the kick leaves empty.
            for beat in range(4):
                for s in (1, 2, 3):
                    r = root + (12 if s == 2 and beat % 2 else 0)
                    place(mid, note(r, S16 * 0.95, 0.55 if t0 >= T_PAYOFF else 0.4), t0 + beat * BEAT + s * S16, 0.62)
            n = int(BAR * SR)
            env = np.ones(n)
            env[:240] = np.linspace(0, 1, 240)
            env[-240:] = np.linspace(1, 0, 240)
            place(sub, sine(hz(root + 12 if root < 33 else root), n) * env, t0, 0.5)

    # The title and the end card hold one long low note under the chord.
    for t, length in ((T_TITLE, 2.0), (T_END, 5.0)):
        n = int(length * SR)
        env = np.exp(-np.arange(n) / SR / (length / 3))
        env[-2400:] *= np.linspace(1, 0, 2400)
        place(sub, sine(hz(41), n) * env, t, 0.5)
    return sub, mid


# ── pad, arp, lead ──────────────────────────────────────────────────────────


def supersaw(midi: int, n: int) -> np.ndarray:
    """Seven detuned saws spread across the stereo field."""
    out = np.zeros((n, 2))
    for i, cents in enumerate((-17, -11, -5, 0, 6, 12, 18)):
        y = saw(hz(midi) * 2 ** (cents / 1200), n, phase=rng.uniform())
        pan = (i - 3) / 3 * 0.85
        out[:, 0] += y * np.cos((pan + 1) * np.pi / 4)
        out[:, 1] += y * np.sin((pan + 1) * np.pi / 4)
    return out / 3.2


def build_pad() -> np.ndarray:
    raw = stereo()
    b = 0
    while b < len(PROGRESSION):
        name = PROGRESSION[b]
        span = 1
        while b + span < len(PROGRESSION) and PROGRESSION[b + span] == name and bar_start(b + span) not in (
            T_TITLE, T_DROP, T_PAYOFF, T_END, 18.0,
        ):
            span += 1
        t0, length = bar_start(b), span * BAR
        n = int(length * SR)
        env = np.ones(n)
        a = int((1.2 if t0 == 0 else 0.03) * SR)
        r = int(0.12 * SR)
        env[:a] = np.linspace(0, 1, a) ** 2
        env[-r:] *= np.linspace(1, 0, r)
        chord = sum(supersaw(m, n) for m in CHORDS[name]["pad"]) + supersaw(CHORDS[name]["pad"][0] - 12, n) * 0.7
        place(raw, chord * env[:, None], t0, 0.2)
        b += span

    cutoff = curve(
        [
            (0, 700), (4, 1100), (7.4, 2600), (7.5, 300),
            (T_TITLE, 9000), (9.2, 2600), (9.99, 1500),
            (T_DROP, 3400), (17.99, 4200), (18, 5200), (25.99, 5800),
            (T_BREAK, 700), (27.5, 5200), (27.51, 400),
            (T_PAYOFF, 9000), (33.99, 9500),
            (T_END, 11000), (36, 3600), (40, 700),
        ],
        log=True,
    )
    level = curve(
        [
            (0, 0.55), (4, 0.7), (7.45, 0.95), (7.5, 0.0), (7.99, 0.0),
            (T_TITLE, 1.15), (9.99, 0.85),
            (T_DROP, 1.0), (25.99, 1.0), (T_BREAK, 0.7), (27.5, 1.0), (27.52, 0.0), (27.99, 0.0),
            (T_PAYOFF, 1.12), (33.99, 1.12),
            (T_END, 1.2), (36.5, 0.75), (39.6, 0.0), (40, 0.0),
        ]
    )
    return morph_lowpass(raw, cutoff) * level[:, None]


def pluck(midi: int, bright: float) -> np.ndarray:
    n = int(0.3 * SR)
    f = hz(midi)
    y = saw(f, n) * 0.55 + np.sign(sine(f * 2.0, n)) * 0.12 + saw(f * 0.997, n, 0.5) * 0.4
    y = butter(y, "low", min(900 + 9000 * bright, 16000), 2)
    return y * decay(n, 0.055 + 0.07 * bright, 0.002)


ARP = [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 2, 1, 3, 2, 1]


def build_arp() -> np.ndarray:
    dry = stereo()
    for b, name in enumerate(PROGRESSION):
        t0 = bar_start(b)
        notes = CHORDS[name]["arp"]
        if t0 < T_TITLE:
            bright, gain, octave = 0.12 + 0.3 * t0 / 8, 0.14 + 0.012 * t0, 0
        elif T_DROP <= t0 < 18.0:
            bright, gain, octave = 0.45, 0.3, 0
        elif 18.0 <= t0 < T_BREAK:
            bright, gain, octave = 0.62, 0.32, 0
        elif T_BREAK <= t0 < T_PAYOFF:
            bright, gain, octave = 0.3, 0.2, 0
        elif T_PAYOFF <= t0 < T_END:
            bright, gain, octave = 0.85, 0.34, 0
        else:
            continue
        for s, idx in enumerate(ARP):
            t = t0 + s * S16
            if t >= 7.5 and t < T_TITLE or 27.5 <= t < T_PAYOFF:
                continue
            accent = 1.0 if s % 4 == 0 else 0.72
            place(dry, pluck(notes[idx] + octave, bright), t, gain * accent, pan=(-0.35, 0.35)[s % 2])
            if t0 >= 18.0 and t0 < T_BREAK or t0 >= T_PAYOFF:
                # The second pass doubles the arp an octave up, quieter.
                place(dry, pluck(notes[idx] + 12, bright * 0.8), t, gain * accent * 0.4, pan=(0.5, -0.5)[s % 2])
    return dry


def build_lead() -> np.ndarray:
    """One long note a bar over the payoff: C · D♭ · B♭, then home."""
    dry = stereo()
    line = [(T_PAYOFF, 84, BAR), (30.0, 85, BAR), (32.0, 82, BAR), (T_END, 84, 3.0)]
    for t0, midi, length in line:
        n = int(length * SR)
        t = np.arange(n) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.5)
        f = hz(midi) * vib
        y = saw(f, n) * 0.5 + saw(f * 1.004, n, 0.4) * 0.4 + sine(f, n) * 0.5
        y = butter(y, "low", 5200, 2)
        env = np.minimum(1, t / 0.03) * np.exp(-t / (length * 0.9))
        env[-1200:] *= np.linspace(1, 0, 1200)
        place(dry, y * env, t0, 0.2)
        place(dry, y * env, t0, 0.07, pan=-0.6)
    return dry


# ── risers, impacts ─────────────────────────────────────────────────────────


def riser(length: float, f0: float, f1: float) -> np.ndarray:
    n = int(length * SR)
    p = np.linspace(0, 1, n)
    out = np.zeros((n, 2))
    for c in (0, 1):
        out[:, c] = svf_sweep(noise(n), f0 * (f1 / f0) ** p, 1.8, "band")
    tone = saw(hz(41) * 2 ** (p * 2), n) * 0.12 + saw(hz(41.07) * 2 ** (p * 2), n, 0.5) * 0.12
    tremolo = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 12 * p**2) / SR)
    out += butter(tone, "low", 3000, 2)[:, None]
    env = p**2.2 * tremolo
    env[-int(0.01 * SR) :] *= np.linspace(1, 0, int(0.01 * SR))
    return out * env[:, None]


def reverse_swell(length: float) -> np.ndarray:
    n = int(length * SR)
    p = np.linspace(0, 1, n)
    x = np.stack([butter(noise(n), "high", 2500, 2) for _ in (0, 1)], axis=1)
    env = p**3
    env[-int(0.008 * SR) :] *= np.linspace(1, 0, int(0.008 * SR))
    return x * env[:, None]


def impact(size: float = 1.0) -> np.ndarray:
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    pitch = 34 + 70 * np.exp(-t / 0.09)
    boom = np.tanh(np.sin(2 * np.pi * np.cumsum(pitch) / SR) * 2.2) * np.exp(-t / (0.75 * size))
    thump = butter(noise(n), "low", 220, 2) * np.exp(-t / 0.12) * 1.4
    slam = butter(noise(n), "band", [300, 5000]) * np.exp(-t / 0.05) * 0.5
    y = butter(boom, "low", 900, 1) + thump + slam
    y[-2400:] *= np.linspace(1, 0, 2400)
    return y


# ── sound effects: one per visible cause ────────────────────────────────────


def whoosh(length: float, lo: float, hi: float, peak: float = 0.55) -> np.ndarray:
    """Band-passed noise that rises to `hi` at `peak` of its length and falls."""
    n = int(length * SR)
    p = np.linspace(0, 1, n)
    shape = np.where(p < peak, p / peak, (1 - p) / (1 - peak))
    centre = lo * (hi / lo) ** np.sin(shape * np.pi / 2)
    y = svf_sweep(noise(n), centre, 1.3, "band")
    return y * np.sin(np.clip(shape, 0, 1) * np.pi / 2) ** 2.2 * 1.5


def swish(t_peak: float, buf: np.ndarray, length: float, lo: float, hi: float, gain: float, direction: int) -> None:
    """Place a whoosh so its peak lands on `t_peak`, panning across the frame."""
    y = whoosh(length, lo, hi)
    n = len(y)
    pan = np.linspace(-0.8, 0.8, n) * direction
    st = np.stack(
        [y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], axis=1
    ) * np.sqrt(2)
    place(buf, st, t_peak - length * 0.55, gain)


def tick(freq: float = 2400) -> np.ndarray:
    """A dry mechanical tick: a short filtered noise burst, no pitch to speak of."""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = butter(noise(n), "band", [freq * 0.7, freq * 1.6]) * np.exp(-t / 0.011)
    return (y + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.014) * 0.4) * 2.4


def thud() -> np.ndarray:
    """A window landing: a short low knock with a little air on top."""
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(62 + 90 * np.exp(-t / 0.015)) / SR) * np.exp(-t / 0.07)
    air = butter(noise(n), "band", [700, 4200]) * np.exp(-t / 0.018) * 0.35
    return np.tanh((body + air) * 1.4)


def alarm() -> np.ndarray:
    """The radar lighting: two hard low-mid pulses, like a relay closing twice."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for off in (0.0, 0.125):
        m = t >= off
        tt = t[m] - off
        y[m] += np.tanh(np.sin(2 * np.pi * 220 * tt) * 3 + np.sin(2 * np.pi * 331 * tt)) * np.exp(-tt / 0.045)
    return butter(y, "low", 2600, 2) + butter(noise(n), "high", 5000) * np.exp(-t / 0.01) * 0.25


def build_sfx() -> np.ndarray:
    """Every effect has a cause on screen; the times are the edit's (index.html)."""
    fx = stereo()
    one_frame = 1 / 30  # light before sound: each hit lands a frame after its picture

    # 4–7 s: a tick on each montage cut, then four on the flurry.
    cuts = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.1333, 7.2667, 7.4]
    for i, t in enumerate(cuts):
        place(fx, tick(2000 + 180 * i), t + one_frame, 0.5 if i < 6 else 0.36, pan=(-0.4, 0.4)[i % 2])

    # Scene changes: a whoosh that peaks on the cut. Direction follows the
    # picture and no two neighbours share a voice. 14 s is a hard cut and 23 s
    # a blur swap, so the first has none and the second a short soft one.
    scene_cuts = [(T_DROP, 0.7, 350, 5200, 0.55, -1), (16.0, 0.55, 500, 7000, 0.5, 1),
                  (20.0, 0.6, 300, 4800, 0.55, -1), (23.0, 0.4, 700, 5200, 0.28, 1),
                  (26.0, 0.6, 400, 6000, 0.5, -1), (32.0, 0.6, 450, 6800, 0.5, 1)]
    for t, length, lo, hi, gain, direction in scene_cuts:
        swish(t, fx, length, lo, hi, gain, direction)

    # 14.5 s: the radar's R lights. The one alarm in the film.
    place(fx, alarm(), 14.5 + one_frame, 0.9, pan=0.5)

    # 18 s: the pass — the player's row lands a place up. 21 s: the coach turns
    # to this lap's tips. 24 s: a row lands in the fuel table.
    place(fx, thud(), 18.0 + one_frame, 0.75, pan=-0.3)
    place(fx, tick(2300), 21.0 + one_frame, 0.45, pan=-0.3)
    place(fx, tick(2700), 24.0 + one_frame, 0.45, pan=0.4)

    # 26.5–27.75 s: the five windows land, left and right as they do on screen.
    landings = [(26.5, 0.0, 0.6), (27.0, -0.6, 0.7), (27.25, 0.6, 0.7), (27.5, -0.5, 0.7), (27.75, 0.5, 0.5)]
    for i, (t, pan, gain) in enumerate(landings):
        if i:
            swish(t - 0.06, fx, 0.34, 700, 6500 + 400 * i, 0.36, 1 if pan >= 0 else -1)
        place(fx, thud(), t + one_frame, gain, pan=pan)

    # 30–31 s: the pointer takes the radar, drops it, sizes it, lets go.
    for t, f, gain in ((30.02, 2500, 0.4), (30.44, 2100, 0.36), (30.98, 1900, 0.4)):
        place(fx, tick(f), t + one_frame, gain, pan=0.45)

    # 32.25–33.5 s: a tick as each value lands in the strip, left to right.
    for i in range(6):
        place(fx, tick(2600 + 160 * i), 32.25 + i * 0.25 + one_frame, 0.42, pan=-0.5 + 0.2 * i)

    # 34 s: the mark lands under the final hit; the name wipes in after it;
    # the download button lands at 36.
    swish(T_END, fx, 0.8, 250, 5000, 0.6, 1)
    swish(35.1, fx, 0.45, 900, 8000, 0.3, 1)
    place(fx, thud(), 36.0 + one_frame, 0.5)

    wet = convolve(fx, reverb_ir(1.1, 6000)) * 0.12
    return fx + wet


# ── mix ─────────────────────────────────────────────────────────────────────


def build_music() -> np.ndarray:
    kicks, tops, kick_times = build_drums()
    sub, mid = build_bass()
    pad, arp, lead = build_pad(), build_arp(), build_lead()

    pump = sidechain(kick_times, 0.78, 0.13)[:, None]
    soft_pump = sidechain(kick_times, 0.45, 0.11)[:, None]

    fx = stereo()
    place(fx, riser(4.0, 250, 9000), 3.5, 0.5)          # into the title, cut at 7.5
    place(fx, reverse_swell(1.0), 9.0, 0.3)             # into the drop
    place(fx, riser(1.5, 400, 11000), T_BREAK, 0.5)     # into the payoff, cut at 27.5
    place(fx, reverse_swell(0.5), 27.5, 0.22)
    hits = stereo()
    for t, size, gain in ((T_TITLE, 1.3, 0.95), (T_DROP, 0.8, 0.5), (T_PAYOFF, 1.0, 0.7), (T_END, 1.5, 1.0)):
        place(hits, impact(size), t, gain)

    arp_wet = ping_pong(arp, 3 * S16, 0.42)
    lead_wet = ping_pong(lead, BEAT, 0.4)
    hall = reverb_ir(3.2, 5200)
    room = reverb_ir(1.3, 7000)

    send = pad * 0.35 + arp * 0.5 + arp_wet * 0.4 + lead * 0.9 + lead_wet * 0.6 + hits * 0.55 + fx * 0.3
    hall_wet = convolve(send, hall) * 0.34
    room_wet = convolve(tops, room) * 0.1

    mix = (
        kicks * 0.62
        + tops * 1.5
        + room_wet * 1.5
        + butter(sub, "low", 160, 2) * pump * 0.42
        + mid * soft_pump * 0.95
        + pad * pump * 1.9
        + (arp + arp_wet * 0.55) * soft_pump * 2.1
        + lead * 1.5 + lead_wet * 0.8
        + fx * 0.9
        + hits * 0.8
        + hall_wet * 1.6
    )
    mix = butter(mix, "high", 28, 2)
    return mix


def finish(x: np.ndarray, peak_db: float, drive: float) -> np.ndarray:
    """A soft clipper for the peaks, then normalise to a ceiling."""
    x = x / np.percentile(np.abs(x), 99.9)
    x = np.tanh(x * drive) / np.tanh(drive)
    fade = int(0.35 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    return x / np.abs(x).max() * 10 ** (peak_db / 20)


def write(name: str, x: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / f"{name}.wav"
        wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
             "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(OUT / f"{name}.m4a")],
            check=True,
        )
        if "--wav" in sys.argv:
            (OUT / f"{name}.wav").write_bytes(wav.read_bytes())
    print(f"{name}: {len(x) / SR:.2f} s → {OUT / (name + '.m4a')}")


if __name__ == "__main__":
    write("music", finish(build_music(), -1.5, 1.25))
    # The effects sit a few dB over the bed at their peaks; their own ceiling
    # is set against the music's in index.html (data-volume), not here.
    write("sfx", finish(build_sfx(), -3.0, 1.0))
