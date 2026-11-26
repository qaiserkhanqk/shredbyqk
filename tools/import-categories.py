# Builds js/library-more.js: plyometrics, Olympic lifts, stretching/mobility and cardio from
# free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense / public domain).
# Only names, equipment, muscles and level come from the database. The coaching mode, camera pattern
# (where one honestly fits) and the spoken guide are the app's own, set by the rules below.
# Usage: python3 tools/import-categories.py exercises.json js/library.js js/library-extra.js > js/library-more.js
import json, re, sys
d = json.load(open(sys.argv[1]))
existing = set()
for f in sys.argv[2:]:
    existing |= {re.sub(r'[^a-z0-9]', '', n.lower()) for n in re.findall(r"(?:X\('[^']+', |\[\"[^\"]+\", )['\"]([^'\"]+)['\"]", open(f).read())}
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
SKIP = {'Superman', 'Mountain Climbers', 'Cat Stretch', 'Heavy Bag Thrust', 'Sledgehammer Swings'}  # duplicates by meaning, or strongman
EQ = {'barbell': 'Barbell', 'dumbbell': 'Dumbbells', 'cable': 'Cable', 'machine': 'Machine', 'kettlebells': 'Kettlebell', 'bands': 'Band', 'body only': 'Bodyweight',
      'e-z curl bar': 'EZ bar', 'exercise ball': 'Exercise ball', 'medicine ball': 'Medicine ball', 'foam roll': 'Foam roller', None: 'Bodyweight', 'other': 'Other'}
MU = {'abdominals': 'Core', 'abductors': 'Glutes', 'adductors': 'Quads', 'biceps': 'Biceps', 'calves': 'Calves', 'chest': 'Chest', 'forearms': 'Forearms', 'glutes': 'Glutes',
      'hamstrings': 'Hamstrings', 'lats': 'Back', 'lower back': 'Back', 'middle back': 'Back', 'neck': 'Back', 'quadriceps': 'Quads', 'shoulders': 'Shoulders', 'traps': 'Back', 'triceps': 'Triceps'}

G = {
 'jump': 'Land softly and quietly, knees in line with your toes, then reset before the next rep. Stop the set when your jumps get lower: quality beats quantity.',
 'push': 'Push the floor away explosively so your hands leave it, land with soft elbows and a straight body, then reset.',
 'swing': 'Hinge at the hips and snap them forward to drive the weight up. Arms stay relaxed; the power comes from your hips.',
 'throw': 'Brace your core, then throw explosively with your whole body. Reset fully before the next throw.',
 'drill': 'Fast, light feet and a tall posture. Rest fully between rounds so every round stays quick.',
 'oly': 'Start light. Keep the bar close to your body, drive with your legs, then move fast under the bar. If your technique slips, lower the weight. Learn the full lifts with a qualified coach.',
 'olyCam': 'Start light and stay balanced over your mid-foot. QK checks your squat or hinge position on camera.',
 'static': 'Ease into the stretch until you feel gentle tension, never pain. Breathe slowly and let the muscle relax a little more on each breath out.',
 'dynamic': 'Slow and controlled. Move a little further each rep, staying pain-free.',
 'smr': 'Roll slowly over the muscle. Pause on tight spots and breathe. Avoid rolling directly over joints or bone.',
 'cardio': 'Steady pace you could hold a conversation at (zone 2). Relax your shoulders and breathe deeply.',
 'cardioInt': 'Hard but controlled during the work, easy during the rest. Keep every round at the same effort.',
}
rows = []
def add(x, kind, coach, guide, pattern=None, **extra):
    mus = list(dict.fromkeys(MU[m] for m in x['primaryMuscles'] + x['secondaryMuscles'] if m in MU))[:3] or ['Full body']
    i = 'y' + ''.join(w.capitalize() for w in re.sub(r'[^A-Za-z0-9 ]', ' ', x['name']).split())[:40]
    rows.append([i, x['name'], mus, EQ.get(x['equipment'], 'Other'), pattern, {'kind': kind, 'coach': coach, 'guide': guide, **extra, 'src': x['id'], 'level': x['level']}])

for x in d:
    n, cat = x['name'], x['category']
    if n in SKIP or norm(n) in existing: continue
    l = n.lower()
    if cat == 'plyometrics':
        if re.search(r'push-?up|drop push', l): add(x, 'plyo', 'explosive', G['push'], reps=6, gap=5)
        elif 'swing' in l: add(x, 'plyo', 'explosive', G['swing'], reps=10, gap=3)
        elif x['equipment'] == 'medicine ball' or re.search(r'throw|slam|pass|chest push|return push|thrust', l): add(x, 'plyo', 'explosive', G['throw'], reps=6, gap=6)
        elif re.search(r'skip|kick|carioca|cone|shuffle|sprint|drill|claw|climber|start technique|quick step|wall drill|arm drill', l): add(x, 'plyo', 'intervals', G['drill'], work=20, rest=40, rounds=6)
        elif re.search(r'isometric', l): add(x, 'plyo', 'hold', 'Squeeze as hard as you can and hold, breathing steadily.', hold=20)
        else: add(x, 'plyo', 'explosive', G['jump'], reps=6, gap=5)
    elif cat == 'olympic weightlifting':
        if re.search(r'overhead squat|olympic squat|frankenstein', l): add(x, 'olympic', 'camera', G['olyCam'], 'squat', free=True)
        elif re.search(r'^push press$', l): add(x, 'olympic', 'camera', G['olyCam'], 'press')
        elif re.search(r'romanian|stiff legs', l): add(x, 'olympic', 'camera', G['olyCam'], 'rdl')
        elif re.search(r'(clean|snatch) deadlift', l): add(x, 'olympic', 'camera', G['olyCam'], 'rdl', skipRules=['rdl_squat'])
        else: add(x, 'olympic', 'explosive', G['oly'], reps=3, gap=12)
    elif cat == 'stretching':
        if '-SMR' in n or x['equipment'] == 'foam roll': add(x, 'stretch', 'hold', G['smr'], hold=45)
        elif re.search(r'circle|swing|raises|hops|inchworm|greatest|groiners|windmill|toe touchers|scissor|crossover|sit squats|split squats|iron cross|dynamic|rotation|elbows back|shoulder raise|vacuum|pelvic tilt|locust', l):
            add(x, 'stretch', 'mobility', G['dynamic'], reps=10, gap=3)
        else: add(x, 'stretch', 'hold', G['static'], hold=30)
    elif cat == 'cardio':
        if re.search(r'rope|prowler', l): add(x, 'cardio', 'intervals', G['cardioInt'], work=30 if 'rope' in l else 15, rest=30 if 'rope' in l else 60, rounds=8 if 'rope' in l else 6)
        else: add(x, 'cardio', 'timer', G['cardio'], mins=30 if re.search(r'walk|trail', l) else 20, **({'formTest': 'run'} if 'running' in l or 'jogging' in l else {}))

print('// Plyometrics, Olympic lifts, stretching/mobility and cardio from free-exercise-db')
print('// (https://github.com/yuhonas/free-exercise-db), public domain (Unlicense). Names, equipment, muscles')
print('// and level only; the coaching mode, camera pattern and spoken guide are the app\'s own.')
print('// Generated by tools/import-categories.py; edit the rules there, not this file.')
print('export const MORE = [')
for r in rows: print('  ' + json.dumps(r, ensure_ascii=False) + ',')
print('];')
from collections import Counter
print(len(rows), Counter((r[5]['kind'], r[5]['coach']) for r in rows), file=sys.stderr)
