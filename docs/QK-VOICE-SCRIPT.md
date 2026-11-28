# QK voice recording script

Two sets of recordings, both in QK's own voice. No AI.

## 1. Demo video narration (27 lines, about 3 minutes)

Record each line as its **own file**, named with its number first: `01.m4a`, `02.m4a` … (iPhone voice memos or WhatsApp voice notes are fine).

| # | Part | Say |
|---|---|---|
| 01 | Today | Assalamu alaikum, I'm QK. Each morning, just tap how you feel. |
| 02 | Today | Then the app shows you one thing: your next step. Today, it's your workout. |
| 03 | Train | I'll show you exactly where to put your phone. |
| 04 | Live coaching | I watch every rep through the camera, count it, and coach you one cue at a time. |
| 05 | Live coaching | Feet too far forward? I'll tell you. Fix it, and I'll tell you that too. |
| 06 | Set summary | After every set: your form score, one thing to fix, and your rest timer starts by itself. |
| 07 | Train | Want to train something else? There are over two hundred exercises to choose from. |
| 08 | Tools | Everything else lives under All tools, so it's there when you need it. |
| 09 | Rehab | Got pain or an injury? You get a safe, step-by-step rehab plan. |
| 10 | Body check | Put your fingertip on the camera to check your heart rate and recovery, and see your seven-day trend. |
| 11 | Sukoon | And when your mind is racing, there's Sukoon. |
| 12 | Sukoon | Tap how tense you feel. |
| 13 | Sukoon | Breathe slowly with the circle. Close your eyes if you like. |
| 14 | Sukoon | Then listen to a short recitation from the Quran. |
| 15 | Sukoon | And finish with a dua from the Sunnah. |
| 16 | Sukoon | Over time, you'll see what really calms you down. |
| 17 | Brain | And to keep your brain sharp, there's Brain. Your Brain score shows how well you looked after it this week. |
| 18 | Speed Flash | Speed Flash is the brain drill with twenty years of evidence behind it. |
| 19 | Reflex games | And reflex games, the way F1 drivers train. Lights out, and go! |
| 20 | Reflex games | Hit every light you can in thirty seconds. |
| 21 | Quran memory | Learn the Quran by heart. Listen, fade the words, and recite from memory. |
| 22 | Quran memory | And each verse comes back for review, just before you'd forget it. |
| 23 | Quran reader | And you can read the whole Quran here. All one hundred and fourteen surahs, with the translation. |
| 24 | Quran reader | Press play and it follows along with the recitation. And it remembers where you stopped. |
| 25 | Me | Your progress is all in one place. |
| 26 | Me | And with one tap, you send me your week, so I can coach you properly. |
| 27 | Shred by QK | Shred. Your coach in your pocket. Let's get to work. |

**Tips**
- Quiet room, phone about a hand's width from your mouth.
- Natural and warm, like talking to a client. Leave half a second of silence at the start and end.
- If a line feels wrong, change the words. Just keep it short (under about 6 seconds).

**Adding them to the video:** put the files in a folder and run
```
node tools/record-demo.cjs demo-out path/to/voice-folder
```
Each step waits until QK finishes speaking, and his voice is mixed onto `demo-out/demo.mp4`. The lines and on-screen captions live in `tools/demo-narration.json`.

## 2. Coaching lines inside the app (124 lines)

These are what QK says during sets: rep counts, form corrections, praise, rest calls. Record them in the app itself: **Me → Studio: record QK's voice**. Each line has a record button; recordings are used straight away on that phone, and **Export recordings** gives a file to publish so every client hears QK (see `audio/cues/`). Until then the phone's built-in voice is used.
