# 나무 도장 '통' 효과음 합성(직접 생성, 외부 소리 없음). 200ms, 22050Hz, 16bit 모노.
# 구성: 낮은 몸통(150Hz→110Hz 사인, 빠른 감쇠) + 나무 결 공명(420Hz, 더 빠른 감쇠) + 처음 4ms 짧은 잡음 딸깍.
import math
import random
import struct
import sys
import wave

out = sys.argv[1]
sr = 22050
dur = 0.2
n = int(sr * dur)
random.seed(7)
samples = []
phase1 = 0.0
for i in range(n):
    t = i / sr
    f1 = 150 - 40 * min(t / 0.08, 1)
    phase1 += 2 * math.pi * f1 / sr
    body = math.sin(phase1) * math.exp(-t / 0.045)
    wood = 0.35 * math.sin(2 * math.pi * 420 * t) * math.exp(-t / 0.018)
    click = (random.random() * 2 - 1) * 0.5 * math.exp(-t / 0.0015) if t < 0.004 else 0.0
    attack = min(t / 0.0015, 1.0)
    v = (body + wood + click) * attack
    fade = 1.0 if t < dur - 0.02 else max(0.0, (dur - t) / 0.02)
    samples.append(max(-1.0, min(1.0, v * 0.8 * fade)))
w = wave.open(out, 'wb')
w.setnchannels(1)
w.setsampwidth(2)
w.setframerate(sr)
w.writeframes(b''.join(struct.pack('<h', int(s * 32767)) for s in samples))
w.close()
print(n, 'samples')
