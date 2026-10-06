import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

LESSONS_DIR = r"c:\Users\T.BRAYNKANTH\SCIENXE\stem-cloud\site\lessons"
lessons = [
    'unit-02-motion-in-a-straight-line.html',
    'chapter-05-friction.html',
    'chapter-09-resultant-force.html',
    'chapter-11-turning-effect.html',
    'chapter-12-equilibrium.html',
    'g10-chapter-15-hydrostatic-pressure.html',
    'g10-chapter-18-work-energy-power.html',
    'g10-chapter-19-current-electricity.html',
    'g11-chapter-04-waves.html',
    'g11-chapter-05-geometrical-optics.html',
    'g11-chapter-09-heat.html',
    'g11-chapter-10-electric-appliances.html',
    'g11-chapter-11-electronics.html',
    'g11-chapter-13-electromagnetism.html'
]

NEW_PHASES_KINDS = """  const PHASES = [
    {k:'p1', en:'Sector 1: Foundations',            ta:'பகுதி 1: அடிப்படை அறிமுகம்', emoji:'📌'},
    {k:'p2', en:'Sector 2: Theory & Principles',    ta:'பகுதி 2: விதிகள் & குறிப்புகள்', emoji:'📖'},
    {k:'p3', en:'Sector 3: Interactive Simulation', ta:'பகுதி 3: செய்முறை & லேப்', emoji:'🔬'},
    {k:'p4', en:'Sector 4: Assessment & Mastery',   ta:'பகுதி 4: பயிற்சி & மதிப்பீடு', emoji:'📝'}
  ];
  const KINDS = {
    story:{en:'1.1 Overview', ta:'1.1 அறிமுகம்', e:'🎬', p:'p1'},
    basics:{en:'1.2 Fundamentals', ta:'1.2 அடிப்படைக் கருத்துக்கள்', e:'💡', p:'p1'},
    watch:{en:'1.3 Demonstration', ta:'1.3 காட்சி விளக்கம்', e:'👀', p:'p1'},

    notes:{en:'2.1 Theory & Formulas', ta:'2.1 சூத்திரங்களும் விதிகளும்', e:'📖', p:'p2'},
    activities:{en:'2.2 Practical Activity', ta:'2.2 செய்முறை பரிசோதனை', e:'🧪', p:'p2'},

    lab:{en:'3.1 Physics Lab', ta:'3.1 இயற்பியல் லேப்', e:'🔬', p:'p3'},
    game:{en:'3.2 Concept Challenge', ta:'3.2 சவால் பயிற்சி', e:'🎯', p:'p3'},
    sortgame:{en:'3.3 Classification', ta:'3.3 வகைப்படுத்துதல்', e:'🧩', p:'p3'},

    quiz:{en:'4.1 Knowledge Check', ta:'4.1 சுயபரிசோதனை', e:'📝', p:'p4'},
    examples:{en:'4.2 Worked Problems', ta:'4.2 மாதிரி வினா-விடை', e:'✏️', p:'p4'},
    practice:{en:'4.3 Exam Practice', ta:'4.3 பரீட்சைப் பயிற்சி', e:'💪', p:'p4'},
    recap:{en:'4.4 Key Review', ta:'4.4 பாட மீளாய்வு', e:'🔄', p:'p4'},
    summary:{en:'4.5 Summary & Checklist', ta:'4.5 பாடச் சுருக்கம்', e:'📌', p:'p4'}
  };"""

# Pattern matching const PHASES ... const KINDS = { ... };
pattern = re.compile(r'  const PHASES = \[.*?\n  const KINDS = \{.*?\n  \};', re.DOTALL)

for fname in lessons:
    fpath = os.path.join(LESSONS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if pattern.search(content):
        new_content = pattern.sub(NEW_PHASES_KINDS, content, count=1)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {fname}")
    else:
        print(f"Pattern NOT found in: {fname}")
