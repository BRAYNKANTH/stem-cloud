# -*- coding: utf-8 -*-
"""Build physics practice banks and source illustrations for the supplied years.

python tools/build_physics_years.py --source-dir "C:/.../tamil"
Model answers are not official marking schemes. Missing pages stay missing.
"""
import argparse, hashlib, json, shutil, re
import fitz
from expanded_physics import DATA, CROPS, ROOT, bi, notes
import physics_2016_2017, physics_2018_2019, physics_2020_2021, physics_2022_2023

OUT = ROOT/'site/lessons/past-papers'

def corrections():
    # Crop boundaries reviewed against the rendered source pages.
    CROPS.update({(2017,'mcq',27):(3,(.05,.55,.9,.607)),(2018,'mcq',15):(2,(.05,.68,.9,.783)),(2018,'mcq',36):(5,(.10,.285,.935,.411)),(2018,'mcq',37):(5,(.105,.427,.934,.561)),(2020,'mcq',20):(2,(.105,.84,.936,.94)),(2020,'mcq',23):(3,(.075,.201,.91,.300)),(2023,'mcq',25):(3,(.15,.28,.97,.438))})
    def q(y,n,p='I'): return next(x for x in DATA[y] if x['number']==n and x['paper']==p)
    def part(y,n,label): return next(x for x in q(y,n,'II')['parts'] if x['label']==label)
    def change_part(p,g,prompt,answer):
        p['prompt']=bi(*prompt);p['answer']=bi(*answer)
        p['steps']=[bi(a.strip(),b.strip()) for a,b in zip(answer[0].split(' | '),answer[1].split(' | '))]
        notes(p,g,answer)
    item=q(2019,3)
    item['prompt']=bi('Which is NOT a scalar quantity?','பின்வருவனவற்றுள் காவிக் கணியம் அல்லாதது எது?')
    item['options']=[bi('Displacement','இடப்பெயர்ச்சி'),bi('Distance','தூரம்'),bi('Pressure','அமுக்கம்'),bi('Work','வேலை')]
    item['correct']=0
    item['explanation']=bi('Displacement has magnitude and direction, so it is a vector. Distance, pressure and work have magnitude only and are scalars.','இடப்பெயர்ச்சி பருமனும் திசையும் உடைய காவிக் கணியம் அல்லாத ஆரிக் கணியம். தூரம், அமுக்கம், வேலை பருமன் மட்டும் உடைய காவிக் கணியங்கள்.')
    notes(item,'units',tuple(item['explanation'].values()))
    item=q(2023,9)
    item['options'][2]=bi('Frequency in matter is lower than frequency in vacuum','சடப்பொருள் ஊடகத்தில் மீடிறன் வெற்றிட மீடிறனைவிடக் குறைவு')
    item['explanation']=bi('Frequency is set by the source and remains unchanged when the wave crosses into another medium. Speed and wavelength change together: v = fλ. Therefore option 3 is false.','மீடிறன் மூலத்தால் நிர்ணயிக்கப்பட்டு ஊடகம் மாறினாலும் மாறாது. கதி, அலைநீளம் மாறும்: v = fλ. எனவே தெரிவு 3 பொய்.')
    notes(item,'waves',tuple(item['explanation'].values()))
    item=q(2018,25)
    item['options'][2]=bi('Convex lens changes b to a','குவிவு வில்லை b ஐ a ஆக மாற்றும்')
    item['options'][3]=bi('Concave lens changes c to a','குழிவு வில்லை c ஐ a ஆக மாற்றும்')
    item=q(2023,25)
    item['prompt']=bi('Upper metal A expands more than lower metal B in a bimetal strip. Which source shape results on heating?','இருஉலோகக் கீற்றில் மேல் உலோகம் A, கீழ் உலோகம் B ஐவிட அதிகமாக விரியும். சூடாக்கியபின் மூல வடிவம் எது?')
    item['explanation']=bi('A expands more, so it occupies the longer outer arc. B occupies the shorter inner arc. The strip bends toward B, the metal with smaller expansion, as in source diagram 4.','A அதிகமாக விரிவதால் நீண்ட வெளி வளைவிலும் B குறுகிய உள் வளைவிலும் இருக்கும். குறைவாக விரியும் B பக்கமாகக் கீற்று வளையும்; மூலப் படம் 4 பொருந்தும்.')
    notes(item,'heatcapacity',tuple(item['explanation'].values()))
    change_part(part(2021,8,'B(i–iii)'),'induction',
      ('A rod PQ moves right through a field into the page. Name the rule, determine current direction and which of LEDs Y and W lights.','PQ கோல் தாளுக்குள் காந்தப் புலத்தில் வலமாக நகரும். விதி, மின்னோட்டத் திசை, Y,W LED களில் ஒளிர்வது எது?'),
      ('Fleming’s right-hand generator rule gives current Q→P in the rod (v right, B inward, v×B upward). | Current returns from P through A→C on the left branch. Y is forward-biased and lights; W on the right branch is reverse-biased and does not light.','பிளெமிங்கின் வலக்கைப் பிறப்பாக்கி விதியில் கோலின் மின்னோட்டம் Q→P (வல இயக்கம், உள்புலம், v×B மேல்). | P இலிருந்து இடக் கிளையில் A→C வழி திரும்பும். Y முன்னோக்கிய சார்பில் ஒளிரும்; வலக் கிளையின் W மறைச் சார்பில் ஒளிராது.'))
    change_part(part(2018,4,'B(i–iii)'),'heatcapacity',
      ('Identify what A and B demonstrate, predict movement of the dyed water in the capillary, and name heat transfer through B’s test-tube wall.','A, B சோதனைகள் காட்டுவது என்ன? நுண்குழாயில் நிறநீர் எவ்வாறு மாறும்? B சோதனைக் குழாய்ச் சுவரூடான வெப்பப் பரிமாற்ற முறை என்ன?'),
      ('A demonstrates thermal expansion of a liquid; B demonstrates thermal expansion of air (a gas). Heating expands the water in A and the trapped air in B, raising the dyed water in the narrow tubes. Heat passes through the glass wall by conduction.','A திரவத்தின் வெப்ப விரிவையும் B வளியின் வெப்ப விரிவையும் காட்டும். சூடாக்கும்போது A நீரும் B அடைக்கப்பட்ட வளியும் விரிந்து நுண்குழாய்களில் நிறநீர் உயரும். கண்ணாடிச் சுவரூடாக வெப்பம் கடத்தலால் செல்கிறது.'))
    change_part(part(2016,4,'iv(b) I–IV'),'waves',
      ('Name R and PQ. With the same amplitude as the gamma wave, draw the wave labelled C in the spectrum. Which listed band has the lowest frequency?','R, PQ ஐப் பெயரிடுக. காமா அலையின் அதே வீச்சுடன் திருசியத்தில் C எனக் காட்டிய அலையை வரைக. பட்டியலிலுள்ள மிகக் குறைந்த மீடிறனுள்ள அலை எது?'),
      ('R is a trough; PQ is one wavelength. | C is X-rays: draw the same height from the midline but wider crest spacing than gamma rays, because X-rays have lower frequency and longer wavelength at the same speed. | Microwaves (A) have the lowest frequency among the six bands shown. Radio waves would lie below microwaves but are not included in this table.','R தாழி; PQ ஒரு அலைநீளம். | C என்பது X-கதிர்கள்: நடுக்கோட்டிலிருந்து அதே உயரம், காமாவைவிடப் பெரிய முகடு இடைவெளி வரைக. ஒரே கதியில் குறைந்த மீடிறனுக்கு நீண்ட அலைநீளம். | காட்டிய ஆறு பகுதிகளில் நுண்ணலைகள் (A) மிகக் குறைந்த மீடிறனுடையவை. வானொலி அலைகள் இன்னும் குறைந்த மீடிறனுடையவை; இவ்வட்டவணையில் இல்லை.'))
    change_part(part(2016,4,'iv(a)'),'waves',
      ('Complete A, B, visible, ultraviolet, C, gamma using the wave types listed in the source.','மூலத்தில் பட்டியலிட்ட அலை வகைகளிலிருந்து A, B, கட்புல ஒளி, ஊதாக்கடந்த, C, காமா வரிசையைப் பூர்த்திசெய்க.'),
      ('A = microwaves; B = infrared; C = X-rays. Frequency increases and wavelength decreases toward gamma rays.','A = நுண்ணலைகள்; B = செங்கீழ் கதிர்கள்; C = X-கதிர்கள். காமாவை நோக்கி மீடிறன் அதிகரித்து அலைநீளம் குறையும்.'))
    change_part(part(2016,4,'i'),'waves',
      ('Classify ultraviolet, infrared, microwaves, X-rays, gamma rays, visible light, sound and ultrasound as longitudinal or transverse.','ஊதாக்கடந்த, செங்கீழ், நுண்ணலை, X-கதிர், காமா, கட்புல ஒளி, ஒலி, கழியொலி ஆகியவற்றை நெட்டாங்கு/குறுக்காக வகைப்படுத்துக.'),
      ('Ultraviolet, infrared, microwaves, X-rays, gamma rays and visible light are transverse electromagnetic waves. Sound and ultrasound in air are longitudinal mechanical waves.','ஊதாக்கடந்த, செங்கீழ், நுண்ணலை, X-கதிர், காமா, கட்புல ஒளி குறுக்கு மின்காந்த அலைகள். வளியில் ஒலி, கழியொலி நெட்டாங்கு பொறிமுறை அலைகள்.'))
    # The track-length interpretation needs teacher review; do not publish a guessed answer.
    item=part(2016,8,'B(iii)(b–c)');item['label']='B(iii)(b)'
    change_part(item,'motion',('For train mass 1500 kg, find momentum from 5–35 s.','புகையிரதத்தின் திணிவு 1500 kg. 5–35 s இல் உந்தத்தைக் காண்க.'),('Read constant velocity 3 m/s from the graph. | p = mv = 1500 × 3 = 4500 kg m s⁻¹.','வரைபில் மாறா வேகம் 3 m/s. | p = mv = 1500 × 3 = 4500 kg m s⁻¹.'))
    q(2016,8,'II')['editorialWarning']=bi('Subpart B(iii)(c) is awaiting review and is not included in practice.','B(iii)(c) பகுதி மீளாய்வை எதிர்பார்ப்பதால் பயிற்சியில் சேர்க்கப்படவில்லை.')
    change_part(part(2023,7,'B(i–iii)'),'power',
      ('A 1000 W kettle boils four cups in 3 min. Find energy in J and kWh. If it boils eight cups in 5 min when only four are needed, how many kWh are wasted?','1000 W கேத்தல் நான்கு கோப்பை நீரை 3 min இல் கொதிக்கச் செய்கிறது. சக்தியை J, kWh இல் காண்க. நான்கு தேவைப்படும்போது எட்டு கோப்பைகளை 5 min இல் கொதிக்கவைத்தால் விரயமான kWh என்ன?'),
      ('Four cups: E = Pt = 1000 × 180 = 180000 J. | Divide by 3.6×10⁶: E = 0.050 kWh. | Eight cups use 1 kW × 5/60 h = 0.0833 kWh. Avoidable extra energy = 0.0833 − 0.050 = 0.0333 kWh (120000 J).','நான்கு கோப்பை: E = Pt = 1000 × 180 = 180000 J. | 3.6×10⁶ ஆல் வகுத்தால் E = 0.050 kWh. | எட்டு கோப்பை: 1 kW × 5/60 h = 0.0833 kWh. தவிர்க்கக்கூடிய மேலதிக சக்தி = 0.0833 − 0.050 = 0.0333 kWh (120000 J).'))
    # Keep feedback consistent with corrected model choices.
    for rows in DATA.values():
        for item in rows:
            if item['type']=='mcq':
                item['steps']=[item['explanation']]
                item['optionExplanations']=[item['explanation'] if i==item['correct'] else bi('Use the principle in the worked explanation to check this choice. '+item['explanation']['en'],'விடை விளக்கத்திலுள்ள தத்துவத்துடன் இத்தெரிவைச் சரிபார்க்கவும். '+item['explanation']['ta']) for i in range(4)]

def lesson_links():
    topic_lessons={'Friction':['chapter-05-friction'], 'Motion':['unit-02-motion-in-a-straight-line'], 'Motion and momentum':['unit-02-motion-in-a-straight-line','chapter-04-newtons-laws'], 'Forces':['chapter-09-resultant-force','chapter-11-turning-effect','chapter-12-equilibrium'], 'Energy':['g10-chapter-18-work-energy-power'], 'Potential energy':['g10-chapter-18-work-energy-power'], 'Simple machines':['g10-chapter-18-work-energy-power'], 'Waves':['g11-chapter-04-waves'], 'Sound':['g11-chapter-04-waves'], 'Optics':['g11-chapter-05-geometrical-optics'], 'Refraction':['g11-chapter-05-geometrical-optics'], 'Temperature':['g11-chapter-09-heat'], 'Heat':['g11-chapter-09-heat'], 'Gas laws':['g11-chapter-09-heat'], 'Circuits':['g10-chapter-19-current-electricity'], 'Electrical heating':['g11-chapter-10-electric-appliances'], 'Electrical energy':['g11-chapter-10-electric-appliances'], 'Electrical safety':['g11-chapter-10-electric-appliances'], 'Liquid pressure':['g10-chapter-15-hydrostatic-pressure'], 'Buoyancy':['g10-chapter-15-hydrostatic-pressure'], 'Electronics':['g11-chapter-11-electronics'], 'Semiconductors':['g11-chapter-11-electronics'], 'Electromagnetism':['g11-chapter-13-electromagnetism'], 'Electromagnetic induction':['g11-chapter-13-electromagnetism'], 'Transformers':['g11-chapter-13-electromagnetism']}
    refs={}
    for line in (ROOT/'site/lessons/index.html').read_text(encoding='utf-8').splitlines():
        m=re.search(r"\{ m:'g(\d+)',\s+n:'(\d+)'.*?file:'([^']+)'.*?en:('(?:[^'\\]|\\.)*'|\"[^\"]*\").*?ta:'([^']*)'",line)
        if m:
            grade,chapter,file,title,ta=m.groups()
            refs[file[:-5]]=dict(kind='lesson',grade=int(grade),chapter=int(chapter),title=bi(title[1:-1],ta),url='/lessons/'+file,verifiedAgainst='course-index')
    for rows in DATA.values():
        for q in rows:
            q['lessons']=sorted({l for topic in q['topics'] for l in topic_lessons.get(topic,[])})
            for item in ([q] if q['type']=='mcq' else q['parts']):
                # A written question may span several concepts; these are chapter-level reading links.
                item['lessons']=q['lessons'][:]
                item['references'] += [refs[l].copy() for l in item['lessons']]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',required=True,type=__import__('pathlib').Path);args=parser.parse_args()
    for mod in [physics_2016_2017,physics_2018_2019,physics_2020_2021,physics_2022_2023]:mod.add()
    corrections()
    lesson_links()
    catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf-8'))
    for year,questions in DATA.items():
        sources=list(args.source_dir.glob(f'gce-ordinary-level-exam-{year}-science-past-papers-*.pdf'));assert len(sources)==1
        source=sources[0];dest=OUT/str(year);dest.mkdir(exist_ok=True)
        shutil.copyfile(source,dest/'source.pdf')
        with fitz.open(source) as doc:
            for i,page in enumerate(doc):page.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(dest/f'page-{i+1:02}.jpg',jpg_quality=85)
            for (y,kind,n),(page,clip) in CROPS.items():
                if y!=year:continue
                rect=doc[page-1].rect
                box=fitz.Rect(clip[0]*rect.width,clip[1]*rect.height,clip[2]*rect.width,clip[3]*rect.height)
                doc[page-1].get_pixmap(matrix=fitz.Matrix(2,2),clip=box).save(dest/f'{kind}-{n:02}.jpg',jpg_quality=90)
            assert all(0 < p <= len(doc) for q in questions for p in q['pages'])
        assert len({q['id'] for q in questions})==len(questions)
        assert all(q['subjects']==['physics'] for q in questions)
        label={2017:'2017 · Old syllabus',2021:'2021 (2022)',2022:'2022 (2023)',2023:'2023 (2024)'}.get(year,str(year))
        missing={2020:'Written Part II A pages are missing from the supplied PDF.',2021:'Written Part II A pages are missing from the supplied PDF.',2022:'Written Part II A and printed page 5 are missing from the supplied PDF.'}.get(year,'')
        missingta='வழங்கிய PDF இல் எழுத்துத் தாளின் ஆரம்பப் பக்கங்கள் இல்லை; கிடைத்த பௌதிகவியல் பகுதிகள் மட்டும் சேர்க்கப்பட்டுள்ளன.' if missing else ''
        warning=' '+('Old syllabus paper. ' if year==2017 else '')+missing+(' B(iii)(c) of Q8 is awaiting review.' if year==2016 else '')
        note=bi('Physics-only teaching paraphrases and English translations; use scans for exact wording and diagrams. Independently worked model answers, not an official marking scheme; teacher review pending. Textbook links are related reading.'+warning,'பௌதிகவியல் கற்பித்தல் மீளுரைகளும் ஆங்கில மொழிபெயர்ப்புகளும். மூலச் சொற்களுக்கும் படங்களுக்கும் மூலத்தாளைப் பார்க்கவும். இவை அதிகாரபூர்வ விடைக்குறிப்பு அல்ல; ஆசிரியர் மீளாய்வு நிலுவையிலுள்ள மாதிரி விடைகள். பாடநூல் இணைப்புகள் தொடர்புடைய வாசிப்பு. '+('பழைய பாடத்திட்டத் தாள். ' if year==2017 else '')+missingta+(' வினா 8 B(iii)(c) மீளாய்வு நிலுவையில் உள்ளது.' if year==2016 else ''))
        papers=[]
        for p in ['I','II']:
            count=sum(q['paper']==p for q in questions)
            papers.append(dict(id=p,questionCount=count,instructions=bi(f'Physics-only practice: {count} questions. No time limit; submit when ready. Written answers use self-checking. '+(missing if p=='II' else ''),f'பௌதிகவியல் பயிற்சி: {count} வினாக்கள். நேர வரம்பு இல்லை; தயாரானதும் சமர்ப்பிக்கவும். எழுத்து விடைகளுக்குத் தன்னிலை மதிப்பீடு. '+(missingta if p=='II' else ''))))
        coverage=bi(missing,missingta)
        if year==2016:coverage=bi('Q8 B(iii)(c) is awaiting review and excluded from practice.','வினா 8 B(iii)(c) மீளாய்வு நிலுவையில் உள்ளது; பயிற்சியில் சேர்க்கப்படவில்லை.')
        bank=dict(schemaVersion=2,scope='physics',year=year,title=bi('O/L Physics '+label,'சா/த பௌதிகவியல் '+label),sourceLanguage='ta',teacherReviewed=False,status='model-answers',editorialNote=note,sourcePdf=f'/lessons/past-papers/{year}/source.pdf',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),coverageNote=coverage,papers=papers,questions=questions)
        temp=OUT/f'{year}.json.tmp'
        temp.write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        temp.replace(OUT/f'{year}.json')
        entry=next(e for e in catalog['papers'] if e['year']==year)
        entry.update(status='model-answers',examLabel=label,bank=f'/lessons/past-papers/{year}.json',scope='physics',mcqCount=papers[0]['questionCount'],writtenCount=papers[1]['questionCount'],coverageNote=bank['coverageNote'])
        print(year,entry['mcqCount'],'MCQs',entry['writtenCount'],'written questions')
    temp=OUT/'catalog.json.tmp'
    temp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp.replace(OUT/'catalog.json')

if __name__=='__main__':main()
