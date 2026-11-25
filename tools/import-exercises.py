# Step 2: builds js/library-extra.js from free-exercise-db (public domain, Unlicense) using a hand-reviewed keep list.
# Usage: python3 tools/import-exercises.py candidates.json js/library-extra.js
import json, sys, re
cand = {c['name']: c for c in json.load(open(sys.argv[1]))}
# name in the database → (new display name or None, extra fields)
NOPAD = {'skipRules': ['cu_swing']}  # upper arm rests on a pad or the thigh, so "elbow swing" doesn't apply
NOKNEE = {'skipRules': ['rdl_squat']}
KEEP = {
 # lunge
 'Barbell Lunge': (None, {}), 'Barbell Step Ups': ('Barbell Step-up', {}), 'Barbell Walking Lunge': (None, {}),
 'Bodyweight Walking Lunge': (None, {'equipment': 'Bodyweight'}), 'Dumbbell Lunges': ('Dumbbell Forward Lunge', {}), 'Elevated Back Lunge': ('Deficit Reverse Lunge', {}),
 'Smith Single-Leg Split Squat': ('Smith Machine Split Squat', {}), 'Split Squat with Dumbbells': ('Dumbbell Split Squat', {}), 'Suspended Split Squat': (None, {}),
 'Step-up with Knee Raise': (None, {}),
 # squat
 'Barbell Hack Squat': ('Barbell Hack Squat (bar behind legs)', {}), 'Bodyweight Squat': (None, {'free': True}), 'Box Squat': (None, {'free': True}),
 'Dumbbell Squat': (None, {'free': True}), 'Front Squats With Two Kettlebells': ('Double Kettlebell Front Squat', {'free': True}),
 'Narrow Stance Squats': ('Narrow-stance Squat', {'free': True}), 'One-Arm Overhead Kettlebell Squats': ('One-arm Overhead Kettlebell Squat', {'free': True}),
 'Plie Dumbbell Squat': ('Plié Dumbbell Squat', {'free': True}), 'Smith Machine Squat': (None, {}), 'Squats - With Bands': ('Banded Squat', {'free': True}),
 'Wide Stance Barbell Squat': ('Wide-stance Barbell Squat', {'free': True}), 'Zercher Squats': ('Zercher Squat', {'free': True}),
 # hinge
 'Band Good Morning': (None, {}), 'Pull Through': ('Cable Pull-through', NOKNEE), 'Smith Machine Stiff-Legged Deadlift': (None, {}),
 'Stiff-Legged Barbell Deadlift': (None, {}), 'Stiff-Legged Dumbbell Deadlift': (None, {}), 'Stiff Leg Barbell Good Morning': ('Stiff-leg Good Morning', {}),
 # hip thrust
 'Barbell Glute Bridge': (None, {'setup': 'Lying side-on to the camera, camera on the floor about two metres away.'}), 'Hip Lift with Band': ('Banded Hip Thrust', {}),
 # push-up
 'Decline Push-Up': (None, {}), 'Incline Push-Up Close-Grip': ('Close-grip Incline Push-up', {}), 'Incline Push-Up Wide': ('Wide Incline Push-up', {}),
 'Push-Up Wide': ('Wide Push-up', {}), 'Push-Ups - Close Triceps Position': ('Close-grip (Diamond) Push-up', {}), 'Suspended Push-Up': (None, {}),
 # bench (feet / bench lists set in exercises.js)
 'Barbell Incline Bench Press - Medium Grip': ('Incline Barbell Bench Press', {'bench': 'feet'}), 'Decline Dumbbell Bench Press': (None, {'bench': 'scap'}),
 'Decline Smith Press': ('Smith Machine Decline Press', {'bench': 'scap'}), 'Dumbbell Bench Press with Neutral Grip': ('Neutral-grip Dumbbell Bench Press', {'bench': 'feet'}),
 'Dumbbell Floor Press': (None, {'bench': 'scap', 'setup': 'Lying side-on to the camera, camera on the floor about two metres away.'}),
 'Floor Press': ('Barbell Floor Press', {'bench': 'scap', 'setup': 'Lying side-on to the camera, camera on the floor about two metres away.'}),
 'Hammer Grip Incline DB Bench Press': ('Neutral-grip Incline Dumbbell Press', {'bench': 'feet'}), 'One Arm Dumbbell Bench Press': ('One-arm Dumbbell Bench Press', {'bench': 'feet'}),
 'Smith Machine Bench Press': (None, {'bench': 'feet'}), 'Smith Machine Close-Grip Bench Press': (None, {'bench': 'feet'}),
 'Smith Machine Incline Bench Press': (None, {'bench': 'feet'}), 'Wide-Grip Barbell Bench Press': (None, {'bench': 'feet'}),
 'Cable Chest Press': (None, {'setup': 'Side-on, camera at chest height, arms in frame.'}),
 # overhead press (two arms together only: the evenness check needs both)
 'Cable Shoulder Press': (None, {}), 'Double Kettlebell Push Press': (None, {}), 'Leverage Shoulder Press': ('Machine Shoulder Press', {}),
 'Seated Barbell Military Press': ('Seated Barbell Press', {}), 'Seated Cable Shoulder Press': (None, {}), 'Shoulder Press - With Bands': ('Banded Shoulder Press', {}),
 'Smith Machine Overhead Shoulder Press': ('Smith Machine Shoulder Press', {}), 'Standing Dumbbell Press': ('Standing Dumbbell Shoulder Press', {}),
 'Standing Palms-In Dumbbell Press': ('Neutral-grip Dumbbell Shoulder Press', {}), 'Two-Arm Kettlebell Military Press': ('Double Kettlebell Press', {}),
 # dip
 'Dips - Triceps Version': ('Triceps Dip', {}), 'Ring Dips': ('Ring Dip', {}), 'Weighted Bench Dip': (None, {}),
 # row
 'Barbell Rear Delt Row': (None, {}), 'Bent Over One-Arm Long Bar Row': ('One-arm Landmine Row', {}), 'Bent Over Two-Arm Long Bar Row': ('Landmine Row', {}),
 'Bent Over Two-Dumbbell Row': ('Bent-over Dumbbell Row', {}), 'Bent Over Two-Dumbbell Row With Palms In': ('Neutral-grip Dumbbell Row', {}),
 'Dumbbell Incline Row': ('Chest-supported Dumbbell Row', {}), 'Inverted Row': (None, {}), 'Leverage High Row': ('Machine High Row', {}),
 'Leverage Iso Row': ('Machine Iso Row', {}), 'Lying T-Bar Row': ('Chest-supported T-Bar Row', {}), 'One-Arm Kettlebell Row': (None, {}),
 'Smith Machine Bent Over Row': ('Smith Machine Row', {}), 'Suspended Row': ('Suspension Trainer Row', {}), 'T-Bar Row with Handle': ('T-Bar Row', {}),
 'Two-Arm Kettlebell Row': ('Double Kettlebell Row', {}),
 # vertical pull
 'Close-Grip Front Lat Pulldown': ('Close-grip Lat Pulldown', {}), 'Underhand Cable Pulldowns': ('Underhand Lat Pulldown', {}), 'V-Bar Pulldown': (None, {}),
 'Wide-Grip Lat Pulldown': (None, {}),
 # curl
 'Cable Hammer Curls - Rope Attachment': ('Rope Hammer Curl', {}), 'Concentration Curls': ('Concentration Curl', NOPAD), 'Drag Curl': (None, {}),
 'EZ-Bar Curl': (None, {}), 'Incline Dumbbell Curl': (None, {}), 'Incline Hammer Curls': ('Incline Hammer Curl', {}), 'Machine Bicep Curl': ('Machine Biceps Curl', NOPAD),
 'Machine Preacher Curls': ('Machine Preacher Curl', NOPAD), 'Preacher Hammer Dumbbell Curl': ('Hammer Preacher Curl', NOPAD), 'Reverse Barbell Curl': (None, {}),
 'Reverse Cable Curl': (None, {}), 'Seated Dumbbell Curl': (None, {}), 'Spider Curl': (None, {}), 'Wide-Grip Standing Barbell Curl': ('Wide-grip Barbell Curl', {}),
 'Zottman Curl': (None, {}),
 # triceps
 'Cable Rope Overhead Triceps Extension': ('Overhead Cable Triceps Extension', {}), 'Decline EZ Bar Triceps Extension': ('Decline Skull Crusher', {}),
 'Dumbbell One-Arm Triceps Extension': ('One-arm Overhead Triceps Extension', {}), 'Lying Dumbbell Tricep Extension': ('Lying Dumbbell Triceps Extension', {}),
 'Machine Triceps Extension': (None, {}), 'Reverse Grip Triceps Pushdown': ('Reverse-grip Pushdown', {}),
 'Standing Bent-Over Two-Arm Dumbbell Triceps Extension': ('Dumbbell Triceps Kickback', {}), 'Triceps Pushdown - Rope Attachment': ('Rope Pushdown', {}),
 'Triceps Pushdown - V-Bar Attachment': ('V-Bar Pushdown', {}), 'Standing Overhead Barbell Triceps Extension': ('Overhead Barbell Triceps Extension', {}),
 'Kettlebell Overhead Triceps Extension': (None, {}), 'Incline Barbell Triceps Extension': ('Incline Skull Crusher', {}),
 # raises
 'Seated Side Lateral Raise': ('Seated Lateral Raise', {'setup': 'Facing the camera, arms fully in frame.'}),
 'Lateral Raise - With Bands': ('Banded Lateral Raise', {'setup': 'Facing the camera, arms fully in frame.'}),
 'Seated Bent-Over Rear Delt Raise': ('Seated Rear Delt Raise', {'setup': 'Facing the camera while bent over, arms in frame.'}),
 'Bent Over Low-Pulley Side Lateral': ('Cable Rear Delt Raise', {'setup': 'Facing the camera while bent over, arms in frame.'}),
 'Bent Over Dumbbell Rear Delt Raise With Head On Bench': ('Head-supported Rear Delt Raise', {'setup': 'Facing the camera while bent over, arms in frame.'}),
 'Front Plate Raise': (None, {'setup': 'Side-on to the camera, arms fully in frame.'}),
 # fly
 'Decline Dumbbell Flyes': ('Decline Dumbbell Fly', {}), 'Flat Bench Cable Flyes': ('Flat Bench Cable Fly', {}), 'Incline Dumbbell Flyes': ('Incline Dumbbell Fly', {}),
 'Low Cable Crossover': ('Low-to-high Cable Fly', {}),
 # calf
 'Standing Barbell Calf Raise': (None, {}), 'Standing Dumbbell Calf Raise': (None, {}), 'Smith Machine Calf Raise': (None, {}), 'Calf Raises - With Bands': ('Banded Calf Raise', {}),
 # core
 '3/4 Sit-Up': ('Three-quarter Sit-up', {}), 'Crunch - Hands Overhead': ('Overhead-reach Crunch', {}),
}
missing = [k for k in KEEP if k not in cand]
if missing: sys.exit('missing: ' + ', '.join(missing))
def camel(s):
    w = re.sub(r'[^A-Za-z0-9 ]', ' ', s).split()
    return 'x' + ''.join(x.capitalize() for x in w)[:40]
rows, ids = [], set()
for dbname, (name, extra) in KEEP.items():
    c = cand[dbname]; name = name or dbname
    i = camel(name); assert i not in ids, i; ids.add(i)
    eq = extra.get('equipment') or c['eq']
    if eq == 'Other': eq = 'Bodyweight' if c['pattern'] in ('pushUp', 'dip', 'vPull', 'row', 'lunge') else 'Other'
    muscles = c['muscles'] or ['Full body']
    fx = {k: v for k, v in extra.items() if k not in ('equipment',)}
    fx['src'] = c['id']; fx['level'] = c['level']
    rows.append((i, name, muscles, eq, c['pattern'], fx))
js = ['// Exercises added from free-exercise-db (https://github.com/yuhonas/free-exercise-db),',
      '// released into the public domain under the Unlicense. Only names, equipment, muscles and level are',
      '// used: each was hand-matched to a movement pattern QK can check on camera. Form cues, limits and',
      '// setup text are the app\'s own (NSCA-based, see SCIENCE.md), not the database\'s instructions.',
      '// Generated by tools/import-exercises.py from a reviewed keep list (KEEP); edit that list, not this file.',
      'export const EXTRA = [']
for i, name, mu, eq, pat, fx in rows:
    js.append(f"  [{json.dumps(i)}, {json.dumps(name)}, {json.dumps(mu)}, {json.dumps(eq)}, {json.dumps(pat)}, {json.dumps(fx)}],")
js.append('];')
open(sys.argv[2], 'w').write('\n'.join(js) + '\n')
from collections import Counter
print(len(rows), Counter(r[4] for r in rows))
for k in ('free', 'bench'):
    print(k, [(r[0], r[5].get(k)) for r in rows if r[5].get(k)])
