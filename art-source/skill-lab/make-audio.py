"""Synthesize the original one-shot sounds used by the skill scenes."""
import array
import math
from pathlib import Path
import random
import wave

OUT = Path(__file__).resolve().parents[2] / "design/skill-lab/audio"
RATE = 32000
TAU = math.tau


def kick(t, high, low, fall, tail):
    """Damped pitch drop, with an upper partial that carries on phone speakers."""
    phase = TAU * (low*t + (high-low)*fall*(-math.expm1(-t/fall)))
    return (math.sin(phase) + .34*math.sin(2*phase) + .18*math.sin(3*phase)) * math.exp(-t/tail)


def envelope(t, attack, tail):
    return -math.expm1(-t/attack) * math.exp(-t/tail)


# Clip length, impact pitch, settled pitch, body decay, peak, room reflection.
GUNS = {
    "smgA": (.245, 290, 106, .038, .56, .045),
    "smgB": (.262, 252, 91, .045, .56, .052),
    "bulk": (.42, 250, 85, .070, .75, .073),
    "cannon": (.39, 215, 76, .065, .62, .069),
    "rifle": (.55, 318, 90, .084, .80, .091),
    "thump": (.38, 198, 78, .079, .68, .066),
    "lob": (.32, 230, 86, .059, .63, .073),
}

EXPLOSIONS = {
    # Duration, fundamental, overpressure tail, first debris hit, peak
    "grenade": (.65, 72, .112, .122, .81),
    "burst": (1.00, 51, .198, .167, .88),
}

METAL = {
    # Duration, tap pitch, body frequency, decay, peak
    "plant": (.51, 242, 64, .076, .77),
    "lock": (.19, 465, 155, .033, .47),
    "bolt": (.17, 690, 254, .025, .36),
    "hit": (.22, 423, 112, .041, .40),
    "block": (.32, 582, 162, .049, .53),
}


def synthesize(name, duration, peak, seed):
    rng = random.Random(seed)
    samples = []
    mid = bass = last_noise = 0.
    for i in range(round(duration * RATE)):
        t = i / RATE
        white = rng.uniform(-1, 1)
        mid += .29 * (white - mid)
        bass += .038 * (white - bass)
        grain = (mid - bass) * 2.1
        if name in GUNS:
            _, high, low, decay, _, reflect = GUNS[name]
            body = kick(t, high, low, .016, decay)
            value = .66*body + .89*grain*math.exp(-t/(decay*.56))
            value += .27*(white-last_noise)*math.exp(-t/.004)
            if t > reflect:
                rt = t - reflect
                value += .25 * (bass*3.3 + kick(rt, high*.72, low*1.45, .018, decay*.58)) * envelope(rt,.002,decay)
        elif name in EXPLOSIONS:
            _, low, decay, debris, _ = EXPLOSIONS[name]
            pressure = kick(t, 3.1*low, low, .032, decay)
            grit = (.78*grain + 1.58*bass) * envelope(t,.006,decay*1.16)
            value = .87*pressure + grit + .17*white*math.exp(-t/.013)
            # Two reflected rolls and a late scatter of fragments.
            for delay, weight in ((debris,.47),(debris*1.91,.28)):
                if t > delay:
                    rt = t-delay
                    value += weight * (kick(rt, low*3.8,low*1.3,.022,decay*.63)+grain*.60) * envelope(rt,.014,decay)
            if t > debris:
                value += .32*white*max(0,math.cos(TAU*9*(t-debris)))**8*envelope(t-debris,.009,.13)
        elif name == "pierce":
            # Impact first; a falling metallic harmonic hangs behind the beam.
            phase = TAU*(325*t + 430*.13*(-math.expm1(-t/.13)))
            light = (math.sin(phase) + .32*math.sin(phase*2.013))*envelope(t,.009,.150)
            value = .74*kick(t,258,69,.026,.106) + .42*light + .72*grain*math.exp(-t/.043)
            if t > .115:
                value += .19*math.sin(phase*.986)*envelope(t-.115,.007,.17)
        else:
            _, high, low, decay, _ = METAL[name]
            value = .66*kick(t, high, low, .012, decay) + .58*grain*math.exp(-t/decay)
            value += .19*math.sin(TAU*high*2.37*t)*math.exp(-t/(decay*.72))
            if t > .044:
                value += .31*mid*math.exp(-(t-.044)/.028)
        value *= min(1, t/.0008, (duration-t)/.018)
        samples.append(math.tanh(value*1.5))
        last_noise = white

    scale = 32767 * peak / max(map(abs, samples))
    pcm = array.array("h", (round(s*scale) for s in samples))
    with wave.open(str(OUT / (name + ".wav")), "wb") as wav:
        wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes(pcm.tobytes())


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    voices = [(k,v[0],v[4]) for k,v in GUNS.items()]
    voices += [(k,v[0],v[4]) for k,v in EXPLOSIONS.items()]
    voices += [(k,v[0],v[4]) for k,v in METAL.items()]
    voices.append(("pierce", .68, .82))
    for i, (name, duration, peak) in enumerate(voices):
        synthesize(name, duration, peak, 7283+i)
