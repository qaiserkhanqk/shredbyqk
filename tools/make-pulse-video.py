"""Make a fake fingertip camera video (Y4M) with a known heart rate and HRV, for tests/camera-pulse.cjs.
Usage: python3 tools/make-pulse-video.py OUT.y4m BPM [HRV_AMPLITUDE_MS] [SECONDS]
Each beat darkens the red image slightly, with per-pixel sensor noise in every channel, like a real camera."""
import math, random, sys
out, bpm = sys.argv[1], float(sys.argv[2])
amp = float(sys.argv[3]) if len(sys.argv) > 3 else 0
secs = int(sys.argv[4]) if len(sys.argv) > 4 else 80
W, H, fps = 64, 48, 30
random.seed(2)
beats, rr, t, i = [], [], 0.3, 0
while t < secs + 2:
    r = 60000 / bpm + amp * math.sin(i / 2.2); rr.append(r); beats.append(t); t += r / 1000; i += 1
win = [r for b, r in zip(beats, rr) if 13 < b < 73]
true_rmssd = math.sqrt(sum((win[k] - win[k - 1]) ** 2 for k in range(1, len(win))) / (len(win) - 1))
print(f"true heart rate {bpm:.0f} bpm, true RMSSD {true_rmssd:.1f} ms")
cl = lambda x: max(0, min(255, int(round(x))))
with open(out, 'wb') as f:
    f.write(f"YUV4MPEG2 W{W} H{H} F{fps}:1 Ip A1:1 C420jpeg\n".encode())
    for k in range(fps * secs):
        t = k / fps; v = 0
        for b in beats:
            d = t - b
            if -0.3 < d < 0.6: v += 2.2 * math.exp(-((d - 0.08) ** 2) / 0.006) + 0.9 * math.exp(-((d - 0.33) ** 2) / 0.012)
        R, G, B = 190 - 2.5 * v, 30, 25
        Y = 0.299 * R + 0.587 * G + 0.114 * B; U = -0.169 * R - 0.331 * G + 0.5 * B + 128; V = 0.5 * R - 0.419 * G - 0.081 * B + 128
        f.write(b"FRAME\n" + bytes(cl(Y + random.gauss(0, 2)) for _ in range(W * H))
                + bytes(cl(U + random.gauss(0, 2)) for _ in range(W * H // 4)) + bytes(cl(V + random.gauss(0, 2)) for _ in range(W * H // 4)))
