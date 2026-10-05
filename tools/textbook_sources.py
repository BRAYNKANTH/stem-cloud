# -*- coding: utf-8 -*-
"""Verified references to user-supplied books, preserving each edition's pagination."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

# Source filename, language, grade, part, chapter (chapter extracts only).
SOURCES={
 'g10-p2-ta':('Science part II G10 T.pdf','ta',10,'II',None),
 'g10-c09-ta':('Chapter 09 Physics.pdf','ta',10,'I',9),
 'g10-c11-ta':('Chapter 11 Physics.pdf','ta',10,'I',11),
 'g10-c12-ta':('Chapter 12 Physics.pdf','ta',10,'I',12),
 'g10-c04-ta':('Chapter 04 Physics.pdf','ta',10,'I',4),
 'g10-c02-ta':('Chapter 02 Physics.pdf','ta',10,'I',2),
 'g10-c05-ta':('Chapter 05 Physics.pdf','ta',10,'I',5),
 'g10-p2-en':('science G-10 P-II E (1).pdf','en',10,'II',None),
 'g11-p2-en':('science G-11  P-II E.pdf','en',11,'II',None),
 'g11-p1-en':('science G-11 P-I E.pdf','en',11,'I',None),
 'g11-c13-ta':('13.pdf','ta',11,'II',13),
 'g11-c11-ta':('11.pdf','ta',11,'II',11),
 'g11-c10-ta':('10.pdf','ta',11,'II',10),
}

def ref(book,chapter,section_en,section_ta,printed,pdf,end=None,support='direct',note=None):
    return dict(bookId=book,chapter=chapter,section={'en':section_en,'ta':section_ta},
                printedPages=[printed,end or printed],pdfPages=[pdf,pdf+(end or printed)-printed],
                support=support,**({'note':{'en':note[0],'ta':note[1]}} if note else {}))

READING={
 'eye':[ref('g11-p1-en',5,'5.4 Lenses: image on the retina','5.4 வில்லைகள்: விழித்திரை விம்பம்',126,136)],
 'kelvin':[ref('g11-p2-en',9,'9.1 Temperature: Kelvin scale','9.1 வெப்பநிலை: கெல்வின் அளவுத்திட்டம்',4,14)],
 'doping':[ref('g11-p2-en',11,'11.1.2 Extrinsic semiconductors','11.1.2 வெளிப்படு அரைக்கடத்திகள்',52,62,53),ref('g11-c11-ta',11,'Doping and n-type semiconductors','மாசூட்டலும் n-வகை அரைக்கடத்திகளும்',58,4,59)],
 'refraction':[ref('g11-p1-en',5,'5.3 Refraction and refractive index','5.3 முறிவும் முறிவுச் சுட்டியும்',121,131,122)],
 'pins':[ref('g11-p2-en',11,'Integrated-circuit example','ஒருங்கிணைந்த சுற்று உதாரணம்',72,82,support='related',note=('This UM66 example is related reading; it does not teach 8-pin package numbering.','இந்த UM66 உதாரணம் தொடர்புடைய வாசிப்பு; 8-முனைப் பொதியின் எண் வரிசையை விளக்குவதில்லை.'))],
 'density':[ref('g10-p2-en',15,'Mass = density × volume in the pressure derivation','அமுக்க விளக்கத்தில் திணிவு = அடர்த்தி × கனவளவு',67,77),ref('g10-p2-ta',15,'Density and liquid-pressure derivation','அடர்த்தியும் திரவ அமுக்க விளக்கமும்',84,94)],
 'potential':[ref('g10-p2-en',18,'18.2 Gravitational potential energy','18.2 ஈர்ப்பு அழுத்தச் சக்தி',131,141),ref('g10-p2-ta',18,'18.2 Gravitational potential energy','18.2 ஈர்ப்பு அழுத்தச் சக்தி',154,164)],
 'pressure':[ref('g10-p2-en',15,'15.2 Liquid pressure: shape and depth','15.2 திரவ அமுக்கம்: வடிவமும் ஆழமும்',66,76,67),ref('g10-p2-ta',15,'Liquid pressure: depth and p = ρgh','திரவ அமுக்கம்: ஆழமும் p = ρgh உம்',84,94)],
 'motion':[ref('g10-c02-ta',2,'Acceleration and deceleration','ஆர்முடுகலும் அமர்முடுகலும்',35,10,36),ref('g10-c04-ta',4,'4.2 Momentum','4.2 உந்தம்',98,10,99)],
 'machines':[ref('g10-c11-ta',11,'11.1 Turning effect of a force','11.1 விசையின் திருப்பல் விளைவு',199,1,200,support='related',note=('Turning-moment fundamentals only; the supplied chapter does not directly verify all the lever/pulley statements.','திருப்புத் திறன் அடிப்படைகள் மட்டும்; வழங்கிய அத்தியாயம் அனைத்து நெம்புகோல்/கப்பிக் கூற்றுகளையும் நேரடியாக உறுதிப்படுத்தவில்லை.'))],
 'circuit':[ref('g10-p2-en',19,'Series and parallel resistor combinations','தொடர், சமாந்தரத் தடைத் தொகுப்புகள்',162,172,164),ref('g10-p2-ta',19,'Series and parallel resistor combinations','தொடர், சமாந்தரத் தடைத் தொகுப்புகள்',188,198,190)],
 'sounddistance':[ref('g11-p1-en',4,'4.3.2 Speed of sound: lightning and thunder','4.3.2 ஒலி வேகம்: மின்னலும் இடியும்',90,100)],
 'heating':[ref('g11-p2-en',10,'10.2 Electrical energy: E = VIt','10.2 மின் சக்தி: E = VIt',34,44),ref('g10-p2-en',19,'Ohm’s law, used to derive E = I²Rt','E = I²Rt ஐப் பெறப் பயன்படும் ஓம் விதி',151,161)],
 'waves':[ref('g11-p1-en',4,'4.1.1 Transverse waves and water ripples','4.1.1 குறுக்கு அலைகளும் நீர் அலைகளும்',76,86)],
 'buoyancy':[ref('g10-p2-en',15,'15.5 Floating and Archimedes’ principle','15.5 மிதப்பும் ஆக்கிமிடீஸ் தத்துவமும்',79,89,82),ref('g10-p2-ta',15,'Archimedes’ principle and floating equilibrium','ஆக்கிமிடீஸ் தத்துவமும் மிதக்கும் சமநிலையும்',97,107,99)],
 'gas':[ref('g11-p2-en',9,'9.4.3 Expansion of gases','9.4.3 வாயுக்களின் விரிவு',21,31,support='related',note=('The balloon experiment supports expansion/contraction. Charles’s law and its V–T graph are not stated on this page.','பலூன் சோதனை விரிவு/சுருக்கத்தை ஆதரிக்கிறது. சாள்ஸ் விதியும் V–T வரைபும் இப்பக்கத்தில் குறிப்பிடப்படவில்லை.'))],
 'moment':[ref('g10-c11-ta',11,'11.1 Door experiment and moment arm','11.1 கதவு சோதனையும் திருப்புத் திறனும்',199,1,200)],
 'magnetic':[ref('g11-p2-en',13,'13.2 Magnetic effect of a current: right-hand rule','13.2 மின்னோட்டத்தின் காந்த விளைவு: வலக்கை விதி',120,130),ref('g11-c13-ta',13,'13.2 Magnetic field around a conductor','13.2 கடத்தியைச் சுற்றிய காந்தப் புலம்',133,6)],
 'lightdevice':[ref('g10-p2-en',19,'Light-dependent resistors and cadmium sulfide','ஒளி உணரும் தடைகளும் கட்மியம் சல்பைடும்',160,170,support='related',note=('This page describes an LDR, not a photocopier or a photodiode. It supports the photoconductive-material background only.','இப்பக்கம் LDR ஐ விவரிக்கிறது; நகலாக்கி அல்லது ஒளியிருமுனையத்தை அல்ல. ஒளிக்கடத்தல் பொருளின் பின்னணியை மட்டும் ஆதரிக்கிறது.')),ref('g10-p2-ta',19,'Light-dependent resistors','ஒளி உணரும் தடைகள்',186,196,187,support='related')],
 'lenses':[ref('g11-p1-en',5,'5.4 Lenses and convex-lens focusing','5.4 வில்லைகளும் குவிவு வில்லையின் குவிப்பும்',126,136,128,support='related',note=('Lens fundamentals; this passage does not label the objective and eyepiece of a compound microscope.','வில்லை அடிப்படைகள்; இப்பகுதி கூட்டுநுணுக்குக்காட்டியின் பொருள்வில்லை, பார்வைவில்லையைப் பெயரிடவில்லை.'))],
 'forces':[ref('g10-c09-ta',9,'9.2 Resultant of forces in one line','9.2 ஒரே கோட்டிலுள்ள விசைகளின் விளையுள்',165,2,166),ref('g10-c05-ta',5,'5.1 Nature of friction','5.1 உராய்வின் இயல்பு',104,1)],
 'ohm':[ref('g10-p2-en',19,'Activity 19.3 and Ohm’s law','செயற்பாடு 19.3 உம் ஓம் விதியும்',150,160,151),ref('g10-p2-ta',19,'Activity 19.3 and Ohm’s law','செயற்பாடு 19.3 உம் ஓம் விதியும்',176,186,177)],
 'xray':[ref('g11-p1-en',4,'4.2.2 X-rays: penetration and imaging','4.2.2 X-கதிர்கள்: ஊடுருவலும் விம்பமும்',83,93)],
 'timbre':[ref('g11-p1-en',4,'4.3.3 Quality of sound','4.3.3 ஒலியின் பண்பு',94,104,95)],
 'frequency':[ref('g11-p1-en',4,'4.1.3 Wave speed: v = fλ','4.1.3 அலை வேகம்: v = fλ',80,90)],
 'mirror':[ref('g11-p1-en',5,'5.1 Ambulance lettering and reflection','5.1 அம்புலன்ஸ் எழுத்தும் தெறிப்பும்',108,118)],
 'graph':[ref('g10-c02-ta',2,'Velocity–time graphs: displacement from area','வேகம்–நேர வரைபு: பரப்பிலிருந்து இடப்பெயர்ச்சி',40,15,43)],
 'safety':[ref('g11-p2-en',10,'10.4.1 Service fuse and circuit protection','10.4.1 உருகியும் சுற்றுப் பாதுகாப்பும்',38,48),ref('g11-p2-en',10,'10.4.3 Protective measures','10.4.3 பாதுகாப்பு நடவடிக்கைகள்',45,55,46),ref('g11-c10-ta',10,'Fuses and miniature circuit breakers','உருகிகளும் சிறுசுற்றுப்பிரிப்பான்களும்',46,11,47)],
 'radiation':[ref('g11-p2-en',9,'9.5.3 Radiation: vacuum, absorption and reflection','9.5.3 கதிர்வீசல்: வெற்றிடம், உறிஞ்சல், தெறிப்பு',26,36)],
 'mirage':[ref('g11-p1-en',5,'5.3.2 Total internal reflection','5.3.2 முழு அகத்தெறிப்பு',123,133,124,support='related',note=('Refraction and total-internal-reflection background; this passage does not describe a road mirage.','முறிவு, முழு அகத்தெறிப்பு பின்னணி; இப்பகுதி வீதிக் கானலை விவரிக்கவில்லை.'))],
 'heatcapacity':[ref('g11-p2-en',9,'9.2.2 Quantity of heat: Q = mcΔT','9.2.2 வெப்ப அளவு: Q = mcΔT',10,20,11)],
 'power':[ref('g11-p2-en',10,'10.2 Energy consumed: E = Pt','10.2 பயன்படும் சக்தி: E = Pt',34,44),ref('g11-p2-en',10,'10.5 Kilowatt hours and joules','10.5 கிலோவாட் மணியும் யூலும்',46,56)],
 'photodiode':[ref('g11-p2-en',11,'11.3 p–n junction diode','11.3 p–n சந்தி இருமுனையம்',57,67,support='related',note=('Ordinary diode fundamentals only; this page does not show the photodiode’s incoming-light symbol.','சாதாரண இருமுனைய அடிப்படைகள் மட்டும்; இப்பக்கம் ஒளியிருமுனையத்தின் உள்வரும் ஒளிக் குறியைக் காட்டவில்லை.'))],
}

def add_textbook_references(bank,mcq_guides,written_guides):
    catalog=json.loads((ROOT/'site/lessons/textbooks/catalog.json').read_text(encoding='utf-8'))
    books={book['id']:book for book in catalog['books']}
    count=0
    for q in bank['questions']:
        for item in ([q] if q['type']=='mcq' else q['parts']):
            guide=mcq_guides[q['number']] if q['type']=='mcq' else written_guides[q['number']][item['label']]
            readings=[dict(r) for r in READING.get(guide,[])]
            # These specific answers are supported directly, beyond the generic lens/gas guide.
            if q['type']=='written' and q['number']==3 and item['label']=='C(i)':
                readings[0].update(support='direct');readings[0].pop('note',None)
            if q['type']=='written' and q['number']==10 and item['label']=='iii(c)':
                readings[0].update(support='direct');readings[0].pop('note',None)
            for r in readings:
                b=books[r['bookId']]
                r.update(kind='textbook',language=b['language'],grade=b['grade'],part=b['part'],
                         title=b['title'],sourceFilename=b['sourceFilename'],sourceSha256=b['sha256'],
                         verifiedAgainst='uploaded-textbook',url=b['url']+'#page='+str(r['pdfPages'][0]))
                item['references'].append(r)
            item['textbookReferenceStatus']='verified' if any(r['support']=='direct' for r in readings) else 'related-only' if readings else 'not-matched'
            if readings:count+=1
    bank['textbookReferenceStatus']='verified-with-coverage-gaps'
    bank['textbookReferencedAnswerCount']=count
    bank['textbookCatalog']='/lessons/textbooks/catalog.json'
