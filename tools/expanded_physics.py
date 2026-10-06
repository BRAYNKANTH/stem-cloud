"""Reviewed physics transcriptions from the supplied 2016-2023 Tamil scans.

Original numbering is retained. Answers are independently worked model answers,
not official marking schemes. Missing source pages are recorded, never inferred.
"""
from copy import deepcopy
from pilot_physics_explanations import GUIDES
from textbook_sources import READING, ROOT
import json

def bi(en, ta): return dict(en=en, ta=ta)

EXTRA = {
 'units': ('SI units identify the physical quantity.', 'SI அலகுகள் பௌதிகக் கணியத்தை அடையாளப்படுத்தும்.', 'Check dimensions rather than memorising a symbol alone.', 'குறியீட்டை மட்டும் மனப்பாடம் செய்யாமல் பரிமாணங்களைச் சரிபார்க்கவும்.', 'What is the SI unit of force?', 'விசையின் SI அலகு என்ன?', 'N = kg m s⁻².', 'N = kg m s⁻².'),
 'capacitor': ('A capacitor stores separated electric charge.', 'கொள்ளளவி பிரிக்கப்பட்ட மின்னேற்றத்தைச் சேமிக்கும்.', 'A capacitor does not generate a steady current.', 'கொள்ளளவி தொடர்ச்சியான மின்னோட்டத்தை உருவாக்காது.', 'Why place a capacitor across rectifier output?', 'சீராக்கி வெளியீட்டுக்குச் சமாந்தரமாகக் கொள்ளளவி ஏன் இணைக்கப்படுகிறது?', 'It charges at peaks and discharges between peaks, reducing ripple.', 'உச்சங்களில் ஏற்றம் பெற்று இடையில் இறங்குவதால் அலைவுத்துடிப்பு குறையும்.'),
 'transistor': ('A transistor can control a larger collector current with a small base current.', 'சிறிய அடி மின்னோட்டத்தால் பெரிய சேகரிப்பான் மின்னோட்டத்தைக் கட்டுப்படுத்தலாம்.', 'Keep base, collector and emitter distinct.', 'அடி, சேகரிப்பான், காலி ஆகிய முனைகளை வேறுபடுத்தவும்.', 'What are the regions in an npn transistor?', 'npn திரான்சிஸ்ரரின் பகுதிகள் என்ன?', 'n-type emitter, p-type base, n-type collector.', 'n-வகை காலி, p-வகை அடி, n-வகை சேகரிப்பான்.'),
 'induction': ('Changing magnetic flux induces an emf.', 'மாறும் காந்தப் பாயம் மின்னியக்க விசையைத் தூண்டும்.', 'A stationary magnet does not maintain induced current.', 'நிலையான காந்தம் தொடர்ச்சியான தூண்டல் மின்னோட்டத்தை ஏற்படுத்தாது.', 'What happens when a magnet is withdrawn from a coil?', 'சுருளிலிருந்து காந்தம் வெளியே எடுக்கப்படும்போது என்ன நடக்கும்?', 'A transient emf is induced, opposite to insertion.', 'உள்ளே செலுத்தியதற்கு எதிர்த் திசையில் தற்காலிக மின்னியக்க விசை தூண்டப்படும்.'),
 'transformer': ('For an ideal transformer, Vp/Vs = Np/Ns and input power equals output power.', 'இலட்சிய நிலைமாற்றியில் Vp/Vs = Np/Ns; உள்ளீட்டு வலு வெளியீட்டு வலுவிற்குச் சமம்.', 'Use alternating current and keep primary and secondary ratios in the same order.', 'ஆடலோட்டத்தைப் பயன்படுத்தி முதன்மை, துணை விகிதங்களை ஒரே வரிசையில் எழுதவும்.', 'A 240 V transformer supplies 12 V. Np = 1000. Find Ns.', '240 V நிலைமாற்றி 12 V வழங்குகிறது. Np = 1000. Ns ஐக் காண்க.', 'Ns = 1000 × 12/240 = 50 turns.', 'Ns = 1000 × 12/240 = 50 முறுக்குகள்.'),
 'energy': ('Energy is conserved while changing form; useful output can be less than input.', 'வடிவம் மாறினாலும் சக்தி காக்கப்படும்; பயனுள்ள வெளியீடு உள்ளீட்டைவிடக் குறையலாம்.', 'Distinguish energy in joules from power in watts.', 'யூலில் சக்தியையும் வாட்டில் வலுவையும் வேறுபடுத்தவும்.', 'A 100 W device runs for 10 s. Find energy.', '100 W சாதனம் 10 s இயங்குகிறது. சக்தியைக் காண்க.', 'E = Pt = 100 × 10 = 1000 J.', 'E = Pt = 100 × 10 = 1000 J.'),
 'friction': ('Friction opposes relative motion or its tendency at a contact.', 'தொடுகையில் சார்பு இயக்கத்தை அல்லது அதன் முயற்சியை உராய்வு எதிர்க்கும்.', 'Static friction adjusts up to a limiting value; kinetic friction is usually smaller.', 'நிலையுராய்வு எல்லை வரை மாறும்; இயக்க உராய்வு பொதுவாகக் குறைவானது.', 'A block remains stationary under a 3 N horizontal push. Find friction.', '3 N கிடை விசையின்கீழ் மரக்குற்றி அசையவில்லை. உராய்வைக் காண்க.', '3 N in the opposite direction, balancing the push.', 'எதிர்த் திசையில் 3 N; தள்ளும் விசையைச் சமப்படுத்தும்.'),
}

def notes(item, guide, reason):
    if guide in GUIDES:
        concept, _, mistake, question, answer = GUIDES[guide]
    else:
        e=EXTRA[guide]; concept=e[:2]; mistake=e[2:4]; question=e[4:6]; answer=e[6:8]
    item['detailedExplanation']=dict(concept=bi(*concept),reasoning=bi(*reason),commonMistake=bi(*mistake),practice=dict(question=bi(*question),answer=bi(*answer)))
    books={b['id']:b for b in json.loads((ROOT/'site/lessons/textbooks/catalog.json').read_text(encoding='utf-8'))['books']}
    # These page ranges were reviewed for the 2015 guide. For new questions they
    # are background reading, not a claim that the page verifies a new solution.
    readings=deepcopy(READING.get(guide if guide in READING else {'transformer':'magnetic','induction':'magnetic','energy':'power','friction':'forces','units':'ohm','transistor':'photodiode','capacitor':'circuit'}.get(guide),[]))
    item['references']=[]
    for r in readings:
        b=books[r['bookId']]
        r.update(kind='textbook',support='related',language=b['language'],grade=b['grade'],part=b['part'],title=b['title'],sourceFilename=b['sourceFilename'],sourceSha256=b['sha256'],verifiedAgainst='uploaded-textbook',url=b['url']+'#page='+str(r['pdfPages'][0]),note=bi('Background principles only. This page does not verify this paper’s complete worked answer.','அடிப்படைத் தத்துவங்களுக்கான வாசிப்பு மட்டும். இப்பக்கத்தில் இவ்வினாத்தாளின் முழு விடை உறுதிப்படுத்தப்படவில்லை.'))
        item['references'].append(r)
    item['textbookReferenceStatus']='related-only' if readings else 'not-matched'

DATA={y:[] for y in range(2016,2024)}
CROPS={}

def mc(y,n,page,g,en,ta,opts,correct,why,whyta,clip=None):
    options=[bi(*o) if isinstance(o,tuple) else bi(o,o) for o in opts]
    assert len(options)==4 and 1<=correct<=4
    q=dict(id=f'ol{y}-i-{n:02}',number=n,paper='I',section='MCQ',type='mcq',subjects=['physics'],topics=[TOPICS[g]],lessons=[],pages=[page],prompt=bi(en,ta),options=options,correct=correct-1,explanation=bi(why,whyta),steps=[bi(why,whyta)],hint=bi(*((GUIDES[g][0]) if g in GUIDES else EXTRA[g][:2])),answerVerification='independently-worked-model',sourceChecked=True)
    q['optionExplanations']=[bi(why,whyta) if i==correct-1 else bi('Compare this choice with the governing relation: '+why,'இத்தெரிவைக் கருத்துடன் ஒப்பிடுக: '+whyta) for i in range(4)]
    notes(q,g,(why,whyta))
    if clip:
        q['figure']=f'/lessons/past-papers/{y}/mcq-{n:02}.jpg'; CROPS[y,'mcq',n]=(page,clip)
    DATA[y].append(q)

def written(y,n,pages,parts):
    q=dict(id=f'ol{y}-ii-{n:02}',number=n,paper='II',section='Written',type='written',subjects=['physics'],topics=sorted({TOPICS[p[1]] for p in parts}),lessons=[],pages=pages,physicsSubset=True,prompt=bi('Answer only the physics subparts below. Original subpart labels are retained; use the source pages for diagrams.','கீழுள்ள பௌதிகவியல் பகுதிகளுக்கு மட்டும் விடையளிக்கவும். மூலப் பகுதி இலக்கங்கள் பேணப்பட்டுள்ளன; படங்களுக்கு மூலப் பக்கங்களைப் பார்க்கவும்.'),parts=[])
    for label,g,en,ta,ans,ansta in parts:
        p=dict(label=label,subject='physics',lessons=[],prompt=bi(en,ta),answer=bi(ans,ansta),steps=[bi(s.strip(),t.strip()) for s,t in zip(ans.split(' | '),ansta.split(' | '))],hint=bi(*(GUIDES[g][0] if g in GUIDES else EXTRA[g][:2])))
        notes(p,g,(ans,ansta));q['parts'].append(p)
    DATA[y].append(q)

TOPICS=dict(units='Measurement',capacitor='Electronics',transistor='Electronics',induction='Electromagnetic induction',transformer='Transformers',energy='Energy',friction='Friction',**{k:v for k,v in zip(['diffusion','eye','kelvin','doping','refraction','pins','density','potential','pressure','motion','machines','circuit','sounddistance','heating','waves','buoyancy','gas','moment','magnetic','lightdevice','absorption','lenses','forces','ohm','signals','or','xray','timbre','frequency','mirror','graph','safety','radiation','mirage','heatcapacity','power','photodiode'],['Diffusion','Optics','Temperature','Semiconductors','Refraction','Electronics','Density','Potential energy','Liquid pressure','Motion and momentum','Simple machines','Circuits','Sound','Electrical heating','Waves','Buoyancy','Gas laws','Forces','Electromagnetism','Electronics','Sound','Optics','Forces','Circuits','Electronics','Electronics','Waves','Sound','Waves','Optics','Motion','Electrical safety','Heat','Refraction','Heat','Electrical energy','Electronics'])})
