# Step 1 of importing from free-exercise-db: sort its strength exercises into movement-pattern candidates.
# Usage: python3 tools/exercise-candidates.py exercises.json candidates.json   (then review, then tools/import-exercises.py)
import json, re, sys
d = json.load(open(sys.argv[1]))
def N(x): return x['name'].lower().replace('_',' ')
RULES = [  # (pattern, include regex, exclude regex)
 ('lunge',  r'lunge|split squat|step[- ]?up', r'jump|plyo|lunge sprint|stretch|pass|twist|rotation'),
 ('squat',  r'squat|leg press', r'jump|split|clean|snatch|thrust|pistol|sissy|stretch|kettlebell pistol|rack delivery|squat to|press-?out|wall squat|hold|calf'),
 ('rdl',    r'romanian|stiff[- ]legged|stiff leg|good ?morning|deadlift|hyperextension|back extension|pull ?through', r'sumo|trap bar|deficit|rack pull|clean|snatch|high pull|with chains|axle|reverse hyper'),
 ('hipThrust', r'hip thrust|glute bridge|butt lift|hip lift|\bbridge\b', r'stretch|leg drop|ball|single leg glute bridge'),
 ('pushUp', r'push-?ups?\b|pushups', r'handstand|plyo|clap|depth|drop|medicine|incline push-up depth|on stability|with a twist|walking'),
 ('bench',  r'bench press|floor press|chest press|incline .*press|decline .*press|smith machine bench', r'jm|board|chains|bands|leverage|reverse grip|pin|speed|isometric|shoulder|close-grip push'),
 ('press',  r'shoulder press|military press|overhead press|arnold|push press|seated barbell press|seated dumbbell press|dumbbell press|kettlebell press|landmine press', r'floor|bench|incline|decline|chest|leg|calf|behind the neck|bradford|one arm|side press|sots|see-saw|pin|jm|anti-gravity|svend|seesaw|bottoms'),
 ('dip',    r'\bdips?\b', r'stretch|chin'),
 ('row',    r'\brow\b|\browing\b|face pull|seated cable rows', r'upright|renegade|gironda|rowing machine|inverted row with straps|sled|bodyweight mid row|alternating renegade'),
 ('vPull',  r'pull-?ups?\b|pullups|chin-?ups?\b|pulldown|pull down|chins', r'straight[- ]arm|kipping|rocky|muscle up|band assisted|v-bar pullup|mixed grip chin|stretch'),
 ('curl',   r'curls?\b', r'leg curl|wrist|ball leg curl|reverse barbell preacher|finger|thigh|knee|hamstring|natural glute|glute ham|nordic|lying|one arm cable preacher|incline inner|zottman preacher'),
 ('triExt', r'triceps? extension|tricep extension|skull ?crusher|pushdown|push ?down|triceps? kickback|tricep kickback|french press', r'band|close-grip ez|tate|rope pushdown overhead'),
 ('raise',  r'lateral raise|front raise|deltoid raise|rear delt|reverse fl(y|ye)|side lateral|front plate raise|bent over .*raise|y-raise|band pull apart', r'leg|calf|knee|lying one-arm|incline|cable rear delt fly|reverse cable|reverse machine'),
 ('fly',    r'\bfl(y|ye|yes)\b|cable crossover|butterfly|pec deck', r'reverse|rear|back|incline cable|band|lying'),
 ('calf',   r'calf raise|calf raises', r'seated|donkey|on a dumbbell|smith machine reverse|rocking'),
 ('torsoCurl', r'crunch|sit-?ups?\b|situp', r'cable|machine|oblique|reverse|decline|jackknife|plate|ball|bicycle|kneeling|exercise ball|v-up|tuck|frog|weighted|russian|cross'),
 ('legRaise', r'leg raise|knee raise|leg lift', r'side|lateral|ball|bench|dumbbell|flutter|alternate|single'),
 ('kneeExt', r'leg extension', r'single'),
 ('kneeFlex', r'leg curl', r'standing|ball|single|stability'),
 ('plank',  r'\bplank\b', r'side|push|reach|walk|jack'),
]
EQ = {'barbell':'Barbell','dumbbell':'Dumbbells','cable':'Cable','machine':'Machine','kettlebells':'Kettlebell','bands':'Band','body only':'Bodyweight','e-z curl bar':'EZ bar','exercise ball':'Exercise ball','medicine ball':'Medicine ball'}
MU = {'abdominals':'Core','abductors':'Glutes','adductors':'Quads','biceps':'Biceps','calves':'Calves','chest':'Chest','forearms':'Forearms','glutes':'Glutes','hamstrings':'Hamstrings','lats':'Back','lower back':'Back','middle back':'Back','neck':'Back','quadriceps':'Quads','shoulders':'Shoulders','traps':'Back','triceps':'Triceps'}
out = []
for x in d:
    if x['category'] not in ('strength','powerlifting'): continue
    n = N(x)
    for pat, inc, exc in RULES:
        if re.search(inc, n) and not re.search(exc, n):
            out.append({'id': x['id'], 'name': x['name'], 'pattern': pat, 'eq': EQ.get(x['equipment'] or '', 'Other'),
                        'muscles': list(dict.fromkeys(MU[m] for m in x['primaryMuscles'] + x['secondaryMuscles'] if m in MU))[:3], 'level': x['level']})
            break
json.dump(out, open(sys.argv[2], 'w'), indent=0)
from collections import Counter
print(len(out), Counter(o['pattern'] for o in out))
for pat in [r[0] for r in RULES]:
    print('\n##', pat)
    print(' | '.join(f"{o['name']} [{o['eq']}]" for o in out if o['pattern'] == pat))
