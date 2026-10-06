# -*- coding: utf-8 -*-
"""Visually transcribed 2015 pilot. Build data; render source assets with import_past_papers.py.

Tamil prompts preserve the meaning/option order; English prompts are teaching translations.
The original Tamil scan is always linked. Explanations are independently authored model solutions.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'site' / 'lessons' / 'past-papers'
KEY = [1,3,2,2,4,1,1,4,3,1,3,4,4,1,4,2,2,3,3,2,3,1,2,1,3,3,1,2,4,2,3,1,2,2,2,3,1,4,4,3]
SOURCE = 'https://www.doenets.lk/documents/evaluation-reports/ol/2015/english/evol15E_Science.pdf'
questions = []

def bi(en, ta):
    return {'en': en, 'ta': ta}

def mcq(n, subject, topic, page, en, ta, options, why, wrong, lessons=(), steps=()):
    questions.append(dict(id=f'ol2015-i-{n:02}', number=n, paper='I', section='MCQ', type='mcq',
        subjects=[subject], topics=[topic], lessons=list(lessons), pages=[page],
        prompt=bi(en,ta), options=[bi(*o) for o in options], correct=KEY[n-1]-1,
        explanation=bi(*why), optionExplanations=[bi(*w) for w in wrong],
        steps=[bi(*s) for s in steps], hint=bi('Identify the concept before choosing an option.', 'விடையைத் தெரிவதற்கு முன் தொடர்புடைய கருத்தை இனங்காண்க.'),
        answerVerification='official-mcq-key', sourceChecked=True))

mcq(1,'biology','Plant classification',1,'Which non-flowering plant produces seeds?',
    'வித்துகளை உருவாக்கும் பூக்காத் தாவரம் எது?',
    [('Cycad','மடுப்பனை'),('Nephrolepis','நெப்ரோலெப்பிஸ்'),('Paddy','நெல்'),('Grass','புல்')],
    ('Cycads are gymnosperms: they produce seeds without flowers.','மடுப்பனை ஒரு வித்துமூடிலி. பூக்கள் இல்லாமல் வித்துகளை உருவாக்கும்.'),
    [('A seed-producing non-flowering gymnosperm.','பூக்காமல் வித்துகளை உருவாக்கும் வித்துமூடிலி.'),('This fern reproduces by spores.','இந்தப் பன்னம் வித்திகளால் இனப்பெருக்கம் செய்கிறது.'),('Paddy is a flowering plant.','நெல் ஒரு பூக்கும் தாவரம்.'),('Grass is a flowering plant.','புல் ஒரு பூக்கும் தாவரம்.')])
mcq(2,'biology','Classification',1,'Select the correctly written scientific name of the pea plant.',
    'இருசொற்பெயரீட்டுக்கேற்ப பட்டாணித் தாவரத்தின் விஞ்ஞானப் பெயரைச் சரியாகக் குறிக்கும் விடையைத் தெரிவுசெய்க.',
    [('Italic Pisum Sativum','சாய்வெழுத்தில் Pisum Sativum'),('Upright Pisum Sativum','நேரெழுத்தில் Pisum Sativum'),('Italic Pisum sativum','சாய்வெழுத்தில் Pisum sativum'),('Upright Pisum sativum','நேரெழுத்தில் Pisum sativum')],
    ('Use an initial capital for the genus, lower case for the species, and italics in print.','பேரினத்தின் முதல் எழுத்து பெரிய எழுத்தாகவும் இனப் பெயர் சிறிய எழுத்தாகவும் இருக்க வேண்டும். அச்சில் இரண்டும் சாய்வெழுத்தாக எழுதப்படும்.'),
    [('The species must begin with a lower-case letter.','இனப் பெயர் சிறிய எழுத்தில் தொடங்க வேண்டும்.'),('The species capital and upright print are incorrect.','இனப் பெயரின் பெரிய எழுத்தும் நேரெழுத்தும் தவறு.'),('Both case and italic style are correct.','எழுத்தளவும் சாய்வெழுத்தும் சரியானவை.'),('The printed name must be italicized.','அச்சிடப்பட்ட பெயர் சாய்வெழுத்தில் இருக்க வேண்டும்.')])
mcq(3,'biology','Cells',1,'Which plant-cell structure is non-living?', 'தாவரக் கலத்தில் காணப்படும் உயிரற்ற கட்டமைப்பு எது?',
    [('Chloroplast','பச்சையவுருமணி'),('Cell wall','கலச்சுவர்'),('Golgi body','கொல்கியுடலி'),('Mitochondrion','இழைமணி')],
    ('The cell wall is a non-living supporting layer outside the cell membrane.','கலச்சவ்வுக்கு வெளியே உள்ள கலச்சுவர் உயிரற்ற ஆதரவுப் படையாகும்.'),
    [('A living organelle for photosynthesis.','ஒளித்தொகுப்புக்குரிய உயிருள்ள புன்னங்கம்.'),('A non-living cellulose supporting layer.','செல்லுலோசால் ஆன உயிரற்ற ஆதரவுப் படை.'),('An organelle that processes and packages materials.','பொருட்களைச் செயலாக்கிப் பொதிக்கும் புன்னங்கம்.'),('An organelle involved in respiration.','சுவாசத்தில் பங்குபற்றும் புன்னங்கம்.')])
mcq(4,'biology','Human body',1,'How many premolars should a healthy adult have on both sides of the upper jaw?', 'வளர்ந்த ஆரோக்கியமான நபரின் மேற்றாடையின் இரு பக்கங்களிலும் இருக்க வேண்டிய முன்கடைவாய்ப் பற்களின் எண்ணிக்கை என்ன?',
    [('Two','இரண்டு'),('Four','நான்கு'),('Six','ஆறு'),('Eight','எட்டு')],
    ('There are two upper premolars on each side: 2 + 2 = 4. Premolars lie between the canine and molars.','மேற்றாடையின் ஒவ்வொரு பக்கத்திலும் இரண்டு முன்கடைவாய்ப் பற்கள் உள்ளன. மொத்தம் 2 + 2 = 4. அவை கோரைப்பல்லுக்கும் கடைவாய்ப் பற்களுக்கும் இடையில் உள்ளன.'),
    [('Counts only one side.','ஒரு பக்கத்தை மட்டும் கணக்கிடுகிறது.'),('Counts both sides of the upper jaw.','மேற்றாடையின் இரு பக்கங்களையும் கணக்கிடுகிறது.'),('Not the adult upper-premolar count.','வளர்ந்தவரின் மேல் முன்கடைவாய்ப் பற்களின் எண்ணிக்கை இதுவல்ல.'),('Eight counts premolars in both jaws.','எட்டு என்பது இரு தாடைகளிலுள்ள மொத்த முன்கடைவாய்ப் பற்கள்.')])
mcq(5,'physics','Diffusion',1,'Cinnamon-oil smell spreads through air after the bottle is opened. Which transport process is this?', 'கறுவா எண்ணெய்ப் போத்தலைத் திறந்ததும் மணம் வளியில் பரவுவது எந்தக் கொண்டு செல்லல் முறையாகும்?',
    [('Osmosis','திணிவுப்பாய்ச்சல்'),('Transpiration','ஆவியுயிர்ப்பு'),('Evaporation','ஆவியாதல்'),('Diffusion','பரவல்')],
    ('Vapour molecules spread from a region of higher concentration to lower concentration: diffusion.','ஆவித் துணிக்கைகள் அதிக செறிவுள்ள இடத்திலிருந்து குறைந்த செறிவுள்ள இடத்திற்குப் பரவுகின்றன.'),
    [('Osmosis needs a selectively permeable membrane and water.','திணிவுப்பாய்ச்சலுக்கு தேர்வூடுபுகவிடும் சவ்வும் நீரும் தேவை.'),('Transpiration is water loss from plants.','ஆவியுயிர்ப்பு தாவரங்களிலிருந்து நீர் வெளியேறுவதாகும்.'),('Evaporation forms vapour; spreading the smell is diffusion.','ஆவியாதல் ஆவியை உருவாக்கும்; மணம் பரவுவது பரவல்.'),('Explains the spreading through air.','வளியில் மணம் பரவுவதை விளக்குகிறது.')])
mcq(6,'biology','Transpiration',1,'Which increase does NOT increase transpiration?', 'எக்காரணியின் அதிகரிப்பு ஆவியுயிர்ப்பை அதிகரிக்காது?',
    [('Air humidity','வளியின் ஈரப்பதன்'),('Wind speed','காற்றின் வேகம்'),('Environmental temperature','சூழல் வெப்பநிலை'),('Light intensity','ஒளிச்செறிவு')],
    ('Higher humidity reduces the water-vapour concentration difference between the leaf and air.','வளியின் ஈரப்பதன் அதிகரிக்கும்போது இலைக்கும் வளிக்கும் இடையிலான நீராவிச் செறிவு வேறுபாடு குறைகிறது.'),
    [('Reduces the vapour gradient, so it does not increase transpiration.','நீராவிச் செறிவு வேறுபாட்டைக் குறைப்பதால் ஆவியுயிர்ப்பை அதிகரிக்காது.'),('Removes moist air around the leaf.','இலையைச் சுற்றிய ஈரமான வளியை அகற்றுகிறது.'),('Usually increases evaporation.','பொதுவாக ஆவியாதலை அதிகரிக்கிறது.'),('Promotes stomatal opening under suitable conditions.','பொருத்தமான நிலைகளில் இலைவாய்கள் திறப்பதை ஊக்குவிக்கிறது.')])
mcq(7,'biology','Digestion',1,'Which enzyme digests protein in an alkaline medium in the human digestive system?', 'காரத் தன்மையுள்ள ஊடகத்தில் புரதத்தைச் சமிபாடடையச் செய்யும் நொதியம் எது?',
    [('Trypsin','திரிப்சின்'),('Peptidase','பெப்டிடேசு'),('Pepsin','பெப்சின்'),('Lipase','இலிப்பேசு')],
    ('Trypsin acts on proteins in the alkaline small intestine. Peptidase mainly acts on shorter peptides.','திரிப்சின் சிறுகுடலின் கார ஊடகத்தில் புரதத்தைச் சமிபாடடையச் செய்கிறது. பெப்டிடேசு சிறிய பெப்டைடுகளில் செயற்படும்.'),
    [('Digests protein in an alkaline medium.','கார ஊடகத்தில் புரதத்தைச் சமிபாடடையச் செய்கிறது.'),('Acts on peptides rather than the initial protein digestion tested here.','இங்கு கேட்கப்படும் ஆரம்ப புரதச் சமிபாட்டை விட பெப்டைடுகளில் செயற்படுகிறது.'),('Requires an acidic stomach medium.','இரைப்பையின் அமில ஊடகம் தேவை.'),('Digests fats, not proteins.','கொழுப்பைச் சமிபாடடையச் செய்கிறது; புரதத்தை அல்ல.')])
mcq(8,'biology','Respiratory system',1,'A class teacher misses school for two days with a red throat, sore throat and loss of voice. Which condition fits the exam scenario?', 'தொண்டை சிவத்தல், தொண்டை நோவு, குரல் வெளிவராமை காரணமாக வகுப்பாசிரியர் இரண்டு நாட்கள் பாடசாலைக்கு வரவில்லை. பரீட்சைச் சூழலில் பொருத்தமான நோய் நிலை எது?',
    [('Ilaippu (original Tamil term; English translation awaiting review)','இளைப்பு'),('Gastritis','இரைப்பையழற்சி'),('Tuberculosis','காசநோய்'),('Laryngitis','குரல்வளையழற்சி')],
    ('Inflammation of the larynx affects the vocal cords and causes hoarseness. This is an exam scenario, not a diagnosis guide.','குரல்வளை அழற்சி குரல்நாண்களைப் பாதித்து குரல் கரகரப்பை ஏற்படுத்தும். இது பரீட்சைச் சூழ்நிலை வினா.'),
    [('Not the keyed answer to this loss-of-voice scenario; the original Tamil term is retained pending translation review.','குரல் வெளிவராமைக்கான விடைக்குறிப்பின் தெரிவு இதுவல்ல; மூலத் தமிழ்ச் சொல் மொழிபெயர்ப்பு மீளாய்விற்காகப் பேணப்பட்டுள்ளது.'),('Gastritis affects the stomach lining, not the larynx.','இரைப்பையழற்சி இரைப்பை அகப்படையைப் பாதிக்கும்; குரல்வளையை அல்ல.'),('The listed acute throat and voice symptoms do not specifically indicate TB.','இந்தத் தொண்டை மற்றும் குரல் அறிகுறிகள் காசநோயைக் குறிப்பாகக் காட்டவில்லை.'),('Best fits the loss of voice and sore throat.','குரல் வெளிவராமைக்கும் தொண்டை நோவுக்கும் மிகப் பொருத்தமானது.')])
mcq(9,'physics','Vision',1,'Where does a clear image form in an eye with normal vision?', 'பார்வைக் குறைபாடற்ற கண்ணில் தெளிவான விம்பம் எங்கு உருவாகும்?',
    [('Very near the lens','கண்வில்லைக்கு மிக அருகில்'),('Between lens and retina','கண்வில்லைக்கும் விழித்திரைக்கும் இடையில்'),('On the retina','விழித்திரையில்'),('Behind the retina','விழித்திரைக்குப் பின்னால்')],
    ('The eye focuses light onto the retina; its receptors detect the image.','கண் ஒளியை விழித்திரையில் குவிக்கிறது; அங்குள்ள ஒளியுணரிகள் விம்பத்தை உணர்கின்றன.'),
    [('The retina must receive the focused image.','குவிக்கப்பட்ட விம்பம் விழித்திரையில் விழ வேண்டும்.'),('An image in front of the retina is not normal focusing.','விழித்திரைக்கு முன்னால் விம்பம் உருவாவது சாதாரணக் குவிப்பு அல்ல.'),('Correct location for normal vision.','சாதாரணப் பார்வைக்குரிய சரியான இடம்.'),('An image behind the retina indicates a focusing error.','விழித்திரைக்குப் பின்னால் விம்பம் உருவாவது குவிப்புக் குறைபாடு.')],['g11-chapter-05-geometrical-optics'])
mcq(10,'biology','Inheritance',1,'Both sons of a couple are colour-blind. Which statement can be made with certainty in the usual X-linked inheritance model?', 'ஒரு பெற்றோருக்குப் பிறந்த இரு மகன்களும் நிறக்குருடு. வழக்கமான X-இணைந்த மரபுரிமை மாதிரியில் நிச்சயமாகக் கூறக்கூடியது எது?',
    [('Mother is colour-blind (original option wording)','தாய் நிறக்குருடு (மூலத் தெரிவின் சொற்கள்)'),('Father is colour-blind','தந்தை நிறக்குருடு'),('Mother or father is colour-blind','தாய் அல்லது தந்தை நிறக்குருடு'),('Both parents are colour-blind','தாய், தந்தை இருவரும் நிறக்குருடு')],
    ('A son receives his X chromosome from his mother and Y from his father. The mother must carry the affected allele; she need not herself have affected vision.','மகன் X நிறமூர்த்தத்தைத் தாயிடமிருந்தும் Y-ஐத் தந்தையிடமிருந்தும் பெறுகிறான். எனவே தாய் குறித்த மரபலகைக் கொண்டிருக்க வேண்டும்; தாய்க்கு நோய் வெளிப்பட வேண்டியதில்லை.'),
    [('The affected X allele comes from the mother; distinguish a carrier from an affected person.','பாதிக்கப்பட்ட X மரபலகு தாயிடமிருந்து வரும்; காவியையும் நோய் வெளிப்படுபவரையும் வேறுபடுத்துக.'),('The father gives a son Y, not X.','தந்தை மகனுக்கு Y-ஐ வழங்குகிறார்; X-ஐ அல்ல.'),('The inheritance establishes the maternal allele, not that either parent must visibly be affected.','தாயின் மரபலகை உறுதிப்படுத்துகிறது; பெற்றோரில் ஒருவருக்கு நோய் வெளிப்பட வேண்டும் என்பதல்ல.'),('Neither the father’s status nor visible symptoms in the mother follow.','தந்தையின் நிலையும் தாயில் நோய் வெளிப்படுவதும் இதிலிருந்து உறுதியாகாது.')])
mcq(11,'biology','Plant tissues',1,'Samples A and B contain parenchyma and sclerenchyma respectively. Which pair fits?', 'A, B மாதிரிகளில் முறையே புடைக்கலவிழையமும் வல்லுருக்கலவிழையமும் காணப்படுகின்றன. பொருத்தமான தாவரப் பகுதிகள் எவை?',
    [('Potato; carrot','உருளைக்கிழங்கு; கரட்'),('Leaf midrib; carrot','இலையின் நடுநரம்பு; கரட்'),('Potato; pear fruit','உருளைக்கிழங்கு; பியார்ஸ் பழம்'),('Wheat seed; pear fruit','கோதுமை வித்து; பியார்ஸ் பழம்')],
    ('Potato storage tissue contains parenchyma. Pear fruit contains gritty sclereids, a type of sclerenchyma.','உருளைக்கிழங்கின் சேமிப்புத் திசுவில் புடைக்கலவிழையம் உள்ளது. பியார்ஸ் பழத்தில் வல்லுருக்கலவிழைய வகையான கற்கலங்கள் உள்ளன.'),
    [('Carrot is not the sclereid example in this pair.','கரட் இவ்விணையில் கற்கலங்களுக்கு உரிய உதாரணமல்ல.'),('The pair does not match the two tissues in order.','இரு திசுக்களையும் வரிசையாகப் பொருத்தவில்லை.'),('Matches storage parenchyma and pear sclereids.','சேமிப்புப் புடைக்கலவிழையத்தையும் பியார்ஸ் கற்கலங்களையும் பொருத்துகிறது.'),('The intended parenchyma example is potato.','கேட்கப்பட்ட புடைக்கலவிழைய உதாரணம் உருளைக்கிழங்கு.')])
mcq(12,'biology','Evolution',2,'Organisms with the most suitable inherited variations survive longer. Which theory explains this?', 'மிகப் பொருத்தமான பிறப்புரிமைக்குரிய மாறல்களைக் கொண்ட அங்கிகள் நீண்ட காலம் வாழ்வதை விளக்கும் கொள்கை எது?',
    [('Special creation','சிறப்புப் படைப்புக் கொள்கை'),('Spontaneous generation','தன்னிச்சைப் பிறப்பாக்கக் கொள்கை'),('Use and disuse','பயன்படுத்தல், பயன்படாமைக் கொள்கை'),('Natural selection','இயற்கைத் தேர்வுக் கொள்கை')],
    ('Natural selection favours inherited variations that improve survival and reproduction in a particular environment.','குறித்த சூழலில் உயிர்வாழ்வையும் இனப்பெருக்கத்தையும் மேம்படுத்தும் மரபுரிமை மாறல்களை இயற்கைத் தேர்வு ஆதரிக்கிறது.'),
    [('Does not explain selection among inherited variations.','மரபுரிமை மாறல்களுக்கிடையிலான தேர்வை விளக்காது.'),('Concerns an obsolete origin-of-life idea.','உயிரின் தோற்றம் பற்றிய பழைய கருத்தாகும்.'),('Does not describe selection of inherited variations.','மரபுரிமை மாறல்களின் தேர்வை விவரிக்காது.'),('Directly matches the statement.','கூற்றுடன் நேரடியாகப் பொருந்துகிறது.')])
mcq(13,'chemistry','Metals',2,'Which metal is used to galvanize iron?', 'இரும்பைக் கல்வனைசப்படுத்தப் பயன்படும் உலோகம் எது?',
    [('Copper','செப்பு'),('Lead','ஈயம்'),('Aluminium','அலுமினியம்'),('Zinc','நாகம்')],
    ('Galvanizing coats iron with zinc, which protects it from corrosion.','கல்வனைசப்படுத்தலில் இரும்புக்கு நாகப் பூச்சு இடப்பட்டு அரிப்பிலிருந்து பாதுகாக்கப்படுகிறது.'),
    [('Not the galvanizing coating.','கல்வனைசப் பூச்சு அல்ல.'),('Not the galvanizing coating.','கல்வனைசப் பூச்சு அல்ல.'),('Not the galvanizing coating.','கல்வனைசப் பூச்சு அல்ல.'),('Zinc is the galvanizing metal.','நாகமே கல்வனைச உலோகம்.')])
mcq(14,'chemistry','Gases',2,'How is oxygen normally collected in a school laboratory?', 'பாடசாலை ஆய்வுகூடத்தில் ஒட்சிசன் வாயு எவ்வாறு சேகரிக்கப்படும்?',
    [('Downward displacement of water','நீரின் கீழ்முகப் பெயர்ச்சி'),('Downward displacement of air','வளியின் கீழ்முகப் பெயர்ச்சி'),('Upward displacement of air','வளியின் மேன்முகப் பெயர்ச்சி'),('Upward displacement of water','நீரின் மேன்முகப் பெயர்ச்சி')],
    ('Oxygen is only slightly soluble in water, so an inverted water-filled jar can collect it as water is pushed out.','ஒட்சிசன் நீரில் மிகக் குறைவாகக் கரையும். தலைகீழான நீர் நிரம்பிய சாடியில் நீரை வெளியேற்றிச் சேகரிக்கலாம்.'),
    [('Suitable because oxygen is sparingly soluble in water.','ஒட்சிசன் நீரில் குறைவாகக் கரைவதால் பொருத்தமானது.'),('Not the standard collection method depicted by this question.','இவ்வினாவின் வழக்கமான சேகரிப்பு முறை அல்ல.'),('Not the standard method here.','இங்கு கேட்கப்படும் வழக்கமான முறை அல்ல.'),('The collected gas pushes water downward/out of the jar.','சேகரிக்கப்படும் வாயு நீரை கீழே/சாடிக்கு வெளியே தள்ளுகிறது.')])
mcq(15,'chemistry','Atomic structure',2,'Element X forms ionic XCl₂ with chlorine. Which electron configuration fits X?', 'X மூலகம் குளோரினுடன் XCl₂ அயன் சேர்வையை உருவாக்குகிறது. X-இற்குப் பொருத்தமான இலத்திரன் நிலை அமைப்பு எது?',
    [('2,6','2,6'),('2,8','2,8'),('2,8,1','2,8,1'),('2,8,2','2,8,2')],
    ('Two chloride ions each need one electron. X loses two outer electrons to form X²⁺.','இரு குளோரைட்டு அயன்களுக்கும் தலா ஒரு இலத்திரன் தேவை. X வெளி ஓட்டின் இரு இலத்திரன்களை இழந்து X²⁺ ஆகிறது.'),
    [('Six outer electrons suggests electron gain rather than X²⁺ formation.','ஆறு வெளி இலத்திரன்கள் X²⁺ உருவாக்கத்திற்குப் பொருத்தமல்ல.'),('A full outer shell is comparatively unreactive.','முழுமையான வெளி ஓடு பொதுவாக வினைத்திறன் குறைந்தது.'),('One outer electron gives X⁺ and XCl.','ஒரு வெளி இலத்திரன் X⁺ மற்றும் XCl-ஐத் தரும்.'),('Losing two outer electrons gives X²⁺ and XCl₂.','இரு வெளி இலத்திரன்களை இழப்பதால் X²⁺ மற்றும் XCl₂ உருவாகும்.')])
mcq(16,'chemistry','Gas tests',2,'A gas turns a colourless aqueous solution milky. Which solution and gas are possible?', 'ஒரு வாயுவைக் குமிழிடும்போது நிறமற்ற நீர்க்கரைசல் பால் நிறமாகிறது. கரைசலும் வாயுவும் எவை?',
    [('CuSO₄; O₂','CuSO₄; O₂'),('Ca(OH)₂; CO₂','Ca(OH)₂; CO₂'),('ZnSO₄; O₂','ZnSO₄; O₂'),('CaCO₃; CO₂','CaCO₃; CO₂')],
    ('CO₂ reacts with limewater to form a white calcium-carbonate precipitate: CO₂ + Ca(OH)₂ → CaCO₃ + H₂O.','CO₂ சுண்ணாம்பு நீருடன் தாக்கமுற்று வெள்ளை CaCO₃ வீழ்படிவை உருவாக்கும்: CO₂ + Ca(OH)₂ → CaCO₃ + H₂O.'),
    [('Copper sulfate solution is coloured and oxygen does not give this test.','செப்புச் சல்பேற்றுக் கரைசல் நிறமுடையது; ஒட்சிசன் இச்சோதனையைத் தராது.'),('This is the carbon-dioxide limewater test.','இது CO₂-க்குரிய சுண்ணாம்பு நீர்ச் சோதனை.'),('Oxygen does not cause this milky precipitate.','ஒட்சிசன் இப்பால் நிற வீழ்படிவை உருவாக்காது.'),('Limewater is Ca(OH)₂, not a CaCO₃ solution.','சுண்ணாம்பு நீர் Ca(OH)₂; CaCO₃ கரைசல் அல்ல.')])
mcq(17,'chemistry','Electrochemistry',2,'In the Zn/Cu cell shown, what does the external-circuit arrow indicate?', 'காட்டப்பட்ட Zn/Cu கலத்தின் வெளிச்சுற்றில் அம்புக்குறி எதைக் காட்டுகிறது?',
    [('Electron-flow direction','இலத்திரன்களின் பயணத் திசை'),('Conventional-current direction','நியம மின்னோட்டத் திசை'),('Ion-flow direction','அயன்களின் பயணத் திசை'),('Both electron and conventional-current directions','இலத்திரன் மற்றும் நியம மின்னோட்டத் திசைகள் இரண்டும்')],
    ('The arrow is from Cu towards Zn in the external wire: conventional current. Electrons travel in the opposite direction.','வெளிக் கம்பியில் அம்பு Cu-இலிருந்து Zn-ஐ நோக்குகிறது. இது நியம மின்னோட்டம்; இலத்திரன்கள் எதிர்த்திசையில் செல்கின்றன.'),
    [('Electrons move from zinc towards copper.','இலத்திரன்கள் நாகத்திலிருந்து செப்பை நோக்கிச் செல்கின்றன.'),('Matches the arrow in the external circuit.','வெளிச்சுற்றின் அம்புடன் பொருந்துகிறது.'),('Ions move through the electrolyte, not the metal wire.','அயன்கள் மின்பகுளியில் நகரும்; உலோகக் கம்பியில் அல்ல.'),('Electron and conventional-current directions are opposite.','இலத்திரன் மற்றும் நியம மின்னோட்டத் திசைகள் எதிரானவை.')],['g10-chapter-19-current-electricity'])
mcq(18,'chemistry','Electrochemistry',2,'What is the anode reaction in the same Zn/Cu cell?', 'அதே Zn/Cu கலத்தின் அனோட்டுத் தாக்கம் எது?',
    [('Cu²⁺ + 2e⁻ → Cu','Cu²⁺ + 2e⁻ → Cu'),('Zn²⁺ + 2e⁻ → Zn','Zn²⁺ + 2e⁻ → Zn'),('Zn → Zn²⁺ + 2e⁻','Zn → Zn²⁺ + 2e⁻'),('2H⁺ + 2e⁻ → H₂','2H⁺ + 2e⁻ → H₂')],
    ('Oxidation occurs at the anode: zinc atoms release electrons and enter solution as Zn²⁺.','அனோட்டில் ஒட்சியேற்றம் நிகழும். நாக அணுக்கள் இலத்திரன்களை விடுவித்து Zn²⁺ ஆகக் கரைசலில் சேரும்.'),
    [('Reduction, not the zinc anode oxidation.','தாழ்த்தல்; நாக அனோட்டு ஒட்சியேற்றம் அல்ல.'),('Reduction of zinc ions.','நாக அயன்களின் தாழ்த்தல்.'),('Zinc oxidation at the anode.','அனோட்டில் நாகத்தின் ஒட்சியேற்றம்.'),('Hydrogen-ion reduction at the other electrode.','மற்றைய முனையில் ஐதரசன் அயன்களின் தாழ்த்தல்.')])
mcq(19,'chemistry','Carbon',2,'An element occurs in several natural allotropes, has a high melting point and is used to extract metals. Identify it.', 'பல பிறதிருப்ப நிலைகள், உயர் உருகுநிலை, உலோகப் பிரித்தெடுப்பில் பயன்பாடு கொண்ட மூலகம் எது?',
    [('K','K'),('Al','Al'),('C','C'),('S','S')],
    ('Carbon occurs as diamond and graphite, withstands high temperatures, and acts as a reducing agent in metal extraction.','காபன் வைரம், கிரபைற்று போன்ற பிறதிருப்பங்களில் காணப்படும். உலோகப் பிரித்தெடுப்பில் தாழ்த்தியாகப் பயன்படும்.'),
    [('Potassium does not match these properties.','பொற்றாசியம் இப்பண்புகளுடன் பொருந்தாது.'),('Aluminium is not the allotrope example described.','அலுமினியம் இங்கு விவரிக்கப்பட்ட பிறதிருப்ப உதாரணமல்ல.'),('Carbon matches all three clues.','காபன் மூன்று குறிப்புகளுடனும் பொருந்துகிறது.'),('Sulfur has a much lower melting point and is not this extraction agent.','கந்தகத்தின் உருகுநிலை குறைந்தது; இப்பிரித்தெடுப்பு தாழ்த்தி அல்ல.')])
mcq(20,'chemistry','Acids and bases',2,'Choose the litmus colours in vinegar and table-salt solution.', 'வினாகிரி கரைசலிலும் மேசை உப்புக் கரைசலிலும் பாசிச்சாய்த்தாளின் நிறங்களுக்கு உரிய விடையைத் தெரிவுசெய்க.',
    [('Red litmus: blue in vinegar, red in salt solution','சிவப்பு தாள்: வினாகிரியில் நீலம்; உப்பில் சிவப்பு'),('Blue litmus: red in vinegar, blue in salt solution','நீலத் தாள்: வினாகிரியில் சிவப்பு; உப்பில் நீலம்'),('Red litmus: red in vinegar, blue in salt solution','சிவப்பு தாள்: வினாகிரியில் சிவப்பு; உப்பில் நீலம்'),('Blue litmus: blue in both','நீலத் தாள்: இரண்டிலும் நீலம்')],
    ('Vinegar is acidic and turns blue litmus red. Neutral salt solution leaves blue litmus blue.','வினாகிரி அமிலம்; நீலப் பாசிச்சாய்த்தாளைச் சிவப்பாக்கும். நடுநிலை உப்புக் கரைசலில் நீலத் தாள் நீலமாகவே இருக்கும்.'),
    [('An acid does not turn red litmus blue.','அமிலம் சிவப்புத் தாளை நீலமாக்காது.'),('Both colour predictions are correct.','இரு நிறக் கணிப்புகளும் சரி.'),('Neutral salt solution does not turn red litmus blue.','நடுநிலை உப்புக் கரைசல் சிவப்புத் தாளை நீலமாக்காது.'),('Blue litmus becomes red in vinegar.','வினாகிரியில் நீலத் தாள் சிவப்பாகும்.')])
mcq(21,'chemistry','Moles and energy',2,'1 g NaOH reacting completely with dilute HCl releases 1.47 kJ. How much is released by 1 mol NaOH? (Na=23, O=16, H=1)', '1 g NaOH ஐதான HCl உடன் முற்றாகத் தாக்கமுற்று 1.47 kJ வெப்பத்தை வெளியிடுகிறது. 1 mol NaOH வெளியிடும் வெப்பம் எவ்வளவு? (Na=23, O=16, H=1)',
    [('1.47 kJ','1.47 kJ'),('5.88 kJ','5.88 kJ'),('58.80 kJ','58.80 kJ'),('147.00 kJ','147.00 kJ')],
    ('One mole weighs 40 g, so the released heat is 40 × 1.47 = 58.80 kJ.','ஒரு மூலின் திணிவு 40 g. வெளியிடும் வெப்பம் 40 × 1.47 = 58.80 kJ.'),
    [('This is the heat for only 1 g.','இது 1 g-க்குரிய வெப்பம் மட்டுமே.'),('The molar mass is 40 g, not 4 g.','மூலர் திணிவு 40 g; 4 g அல்ல.'),('Correctly scales to 40 g.','40 g-க்கு சரியாகக் கணக்கிடப்பட்டுள்ளது.'),('This uses 100 g instead of 40 g.','40 g-க்குப் பதிலாக 100 g பயன்படுத்தப்பட்டுள்ளது.')],steps=[('M(NaOH) = 23 + 16 + 1 = 40 g mol⁻¹.','M(NaOH) = 23 + 16 + 1 = 40 g mol⁻¹.'),('Q = 40 × 1.47 = 58.80 kJ.','Q = 40 × 1.47 = 58.80 kJ.')])
mcq(22,'chemistry','Energy changes',2,'Select the energy diagram for the same heat-releasing reaction (see the original diagrams).', 'அதே வெப்பத்தை வெளியிடும் தாக்கத்திற்குரிய சக்தி வரைபடத்தைத் தெரிவுசெய்க. அசல் வரைபடங்களைப் பார்க்கவும்.',
    [('Reactants higher; products lower; downward energy arrow','தாக்கிகள் மேலே; விளைவுகள் கீழே; கீழ்நோக்கிய சக்தி அம்பு'),('Products higher; reactants lower; upward arrow','விளைவுகள் மேலே; தாக்கிகள் கீழே; மேல்நோக்கிய அம்பு'),('Reactants higher; products lower; two-way arrow','தாக்கிகள் மேலே; விளைவுகள் கீழே; இருவழி அம்பு'),('Products higher; reactants lower; two-way arrow','விளைவுகள் மேலே; தாக்கிகள் கீழே; இருவழி அம்பு')],
    ('In an exothermic reaction the products have less chemical energy than the reactants; the difference is released as heat.','புறவெப்பத் தாக்கத்தில் விளைவுகளின் இரசாயனச் சக்தி தாக்கிகளை விடக் குறைந்தது. வேறுபாடு வெப்பமாக வெளியிடப்படும்.'),
    [('Shows the correct decrease and direction of released energy.','சக்திக் குறைவையும் வெளியீட்டுத் திசையையும் சரியாகக் காட்டுகிறது.'),('Shows energy gain, not release.','சக்தி அதிகரிப்பைக் காட்டுகிறது; வெளியீட்டை அல்ல.'),('The two-way arrow does not identify the directed release required here.','இருவழி அம்பு இங்கு தேவைப்படும் வெளியீட்டுத் திசையைச் சுட்டாது.'),('Products should be lower in energy.','விளைவுகளின் சக்தி குறைவாக இருக்க வேண்டும்.')])
mcq(23,'biology','Plant growth',3,'Why are some plants grown in glasshouses at Hakgala botanical garden?', 'ஹக்கல பூங்காவில் சில தாவரங்கள் கண்ணாடி வீட்டில் வளர்க்கப்படுவதன் காரணம் எது?',
    [('Supply enough O₂','போதுமான O₂ வழங்குதல்'),('Provide a suitable temperature','உகந்த வெப்பநிலை வழங்குதல்'),('Supply enough CO₂','போதுமான CO₂ வழங்குதல்'),('Supply enough light','போதுமான ஒளி வழங்குதல்')],
    ('A glasshouse helps retain heat and maintain suitable conditions for plants in a cool environment.','குளிர்ந்த சூழலில் கண்ணாடி வீடு வெப்பத்தைத் தக்கவைத்து தாவரங்களுக்கு உகந்த வெப்பநிலையை வழங்க உதவும்.'),
    [('This is not the main reason in this setting.','இச்சூழலில் பிரதான காரணம் இதுவல்ல.'),('Matches temperature control in a cool climate.','குளிர்ந்த சூழலில் வெப்பநிலைக் கட்டுப்பாட்டுடன் பொருந்துகிறது.'),('A glasshouse does not itself generate carbon dioxide.','கண்ணாடி வீடு தானாக CO₂-ஐ உருவாக்காது.'),('The main need here is a suitable temperature.','இங்கு பிரதான தேவை உகந்த வெப்பநிலை.')])
mcq(24,'biology','Ecosystems',3,'Fertilizer runoff creates a green layer on a pond. A: excess nitrogen fertilizer was used. B: algae are concentrated in the layer. C: BOD decreases. Which are true?', 'பசளை நீர் குளத்தில் கலந்து பச்சைப் படை உருவாகிறது. A: அதிக நைதரசன் பசளை பயன்படுத்தப்பட்டது. B: படையில் அல்காக்கள் செறிந்துள்ளன. C: BOD குறையும். உண்மையான கூற்றுகள் எவை?',
    [('A and B only','A, B மட்டும்'),('A and C only','A, C மட்டும்'),('B and C only','B, C மட்டும்'),('A, B and C','A, B, C எல்லாம்')],
    ('Nutrient enrichment encourages algal growth. Decomposition consumes oxygen, so BOD tends to rise, not fall.','போசணைச் செறிவூட்டல் அல்கா வளர்ச்சியை அதிகரிக்கும். சிதைவாக்கம் ஒட்சிசனைப் பயன்படுத்துவதால் BOD அதிகரிக்கும்; குறையாது.'),
    [('Includes the two true statements and excludes false C.','உண்மையான இரு கூற்றுகளையும் சேர்த்து தவறான C-ஐ நீக்குகிறது.'),('C is false.','C தவறு.'),('C is false and A is omitted.','C தவறு; A விடப்பட்டுள்ளது.'),('C is false because oxygen demand increases.','ஒட்சிசன் தேவை அதிகரிப்பதால் C தவறு.')])
mcq(25,'physics','Temperature',3,'Express 37 °C in kelvin.', '37 °C வெப்பநிலையை கெல்வினில் தருக.',
    [('236 K','236 K'),('273 K','273 K'),('310 K','310 K'),('337 K','337 K')],
    ('For the school approximation, T = 37 + 273 = 310 K. The exact conversion is 310.15 K.','பாடசாலை அண்மிப்பில் T = 37 + 273 = 310 K. துல்லியமான பெறுமானம் 310.15 K.'),
    [('Subtracts instead of adding 273.','273-ஐக் கூட்டுவதற்குப் பதிலாகக் கழிக்கிறது.'),('273 K corresponds approximately to 0 °C.','273 K ஏறத்தாழ 0 °C-க்கு உரியது.'),('Uses the correct conversion.','சரியான மாற்றத்தைப் பயன்படுத்துகிறது.'),('Uses an incorrect offset.','தவறான கூட்டுப் பெறுமானம் பயன்படுத்தப்பட்டுள்ளது.')],['g11-chapter-09-heat'],[('T(K) = t(°C) + 273.','T(K) = t(°C) + 273.'),('37 + 273 = 310 K.','37 + 273 = 310 K.')])
mcq(26,'physics','Semiconductors',3,'Which impurity makes pure silicon an n-type semiconductor?', 'தூய சிலிக்கனை n-வகை குறைக்கடத்தியாக மாற்றும் மாசு மூலகம் எது?',
    [('Boron','போரன்'),('Aluminium','அலுமினியம்'),('Phosphorus','பொசுபரசு'),('Germanium','ஜெர்மானியம்')],
    ('Phosphorus has five valence electrons. Four form bonds and the fifth supplies an extra electron.','பொசுபரசுக்கு ஐந்து வலுவளவு இலத்திரன்கள் உள்ளன. நான்கு பிணைப்பில் பங்குபற்ற, ஐந்தாவது மேலதிக இலத்திரனாகிறது.'),
    [('Three valence electrons produce p-type material.','மூன்று வலுவளவு இலத்திரன்கள் p-வகையை உருவாக்கும்.'),('A trivalent p-type dopant.','மூவலுவளவு p-வகை மாசு மூலகம்.'),('A pentavalent donor gives n-type material.','ஐவலுவளவு வழங்கி n-வகையை உருவாக்கும்.'),('Four valence electrons do not provide the required extra electron.','நான்கு வலுவளவு இலத்திரன்கள் தேவையான மேலதிக இலத்திரனை வழங்காது.')],['g11-chapter-11-electronics'])
mcq(27,'physics','Refraction',3,'A ray enters glass from air. As incidence increases towards 90°, what happens to the angle of refraction?', 'வளியிலிருந்து கண்ணாடிக்குச் செல்லும் கதிரின் படுகோணம் 90° வரை அதிகரிக்கும்போது முறிகோணம் எவ்வாறு மாறும்?',
    [('Increases','கூடும்'),('Decreases','குறையும்'),('Increases then decreases','கூடிக் குறையும்'),('Does not change','மாற்றமடையாது')],
    ('Snell’s law gives sin r = sin i / n for entry into glass. Increasing i increases r, although r remains smaller than i.','கண்ணாடியில் sin r = sin i / n. i அதிகரிக்கும்போது r-உம் அதிகரிக்கும்; r, i-ஐ விடச் சிறியது.'),
    [('Consistent with Snell’s law.','ஸ்நெல் விதியுடன் பொருந்துகிறது.'),('Refraction angle does not decrease as incidence increases.','படுகோணம் அதிகரிக்கும்போது முறிகோணம் குறையாது.'),('There is no reversal before 90° incidence.','90° படுகோணத்திற்கு முன் மாற்றம் திரும்பாது.'),('r depends on i.','r, i-இல் தங்கியுள்ளது.')],['g11-chapter-05-geometrical-optics'])
mcq(28,'physics','Electronics',3,'Which diagram correctly numbers the pins of the illustrated 8-pin IC?', 'காட்டப்பட்ட 8-முனை ஒருங்கிணைச் சுற்றின் முடிவுகளைச் சரியாக இலக்கமிட்ட வரைபடம் எது?',
    [('Diagram 1','வரைபடம் 1'),('Diagram 2','வரைபடம் 2'),('Diagram 3','வரைபடம் 3'),('Diagram 4','வரைபடம் 4')],
    ('Use the dot/notch to identify pin 1. Seen from above, pins proceed counter-clockwise; original diagram 2 matches.','புள்ளி/வெட்டைக் கொண்டு முனை 1-ஐ இனங்காண்க. மேலிருந்து பார்க்கும்போது முனைகள் மணிக்கூட்டுக்கு எதிர்த்திசையில் தொடர்கின்றன. அசல் வரைபடம் 2 பொருந்துகிறது.'),
    [('Does not follow numbering from the marked pin.','குறிக்கப்பட்ட முனையிலிருந்து சரியான இலக்க வரிசையைப் பின்பற்றவில்லை.'),('Matches the marker and counter-clockwise convention.','குறியீட்டுக்கும் மணிக்கூட்டுக்கு எதிர்த்திசை வரிசைக்கும் பொருந்துகிறது.'),('The marker and numbering orientation do not match.','குறியீடும் இலக்கமிடும் திசையும் பொருந்தவில்லை.'),('The second row is numbered in the wrong order.','இரண்டாவது வரிசையின் இலக்க ஒழுங்கு தவறு.')],['g11-chapter-11-electronics'])
mcq(29,'physics','Density',3,'A gold chain contains 2 cm³ gold of density 18 g cm⁻³. Find its mass.', '2 cm³ தங்கத்தின் அடர்த்தி 18 g cm⁻³. தங்கச் சங்கிலியின் திணிவு என்ன?',
    [('9 g','9 g'),('18 g','18 g'),('27 g','27 g'),('36 g','36 g')],
    ('Mass = density × volume = 18 × 2 = 36 g.','திணிவு = அடர்த்தி × கனவளவு = 18 × 2 = 36 g.'),
    [('Divides by volume instead of multiplying.','கனவளவால் பெருக்குவதற்குப் பதிலாக வகுக்கிறது.'),('This is density’s numerical value, not the mass.','இது அடர்த்தியின் எண் பெறுமானம்; திணிவு அல்ல.'),('Not the product of density and volume.','அடர்த்தி, கனவளவின் பெருக்கல் அல்ல.'),('Correct product and unit.','சரியான பெருக்கலும் அலகும்.')],['g10-chapter-15-hydrostatic-pressure'],[('m = ρV.','m = ρV.'),('18 g cm⁻³ × 2 cm³ = 36 g.','18 g cm⁻³ × 2 cm³ = 36 g.')])
mcq(30,'physics','Potential energy',3,'A 5 g butterfly rises from 2 m to 4 m. Find the increase in gravitational potential energy (g=10 m s⁻²).', '5 g வண்ணத்துப்பூச்சி 2 m உயரத்திலிருந்து 4 m உயரத்துக்குச் செல்கிறது. அழுத்தச் சக்தி அதிகரிப்பு என்ன? (g=10 m s⁻²)',
    [('0.01 J','0.01 J'),('0.10 J','0.10 J'),('0.20 J','0.20 J'),('0.50 J','0.50 J')],
    ('Use the change in height, not the final height: 0.005 × 10 × (4 − 2) = 0.10 J.','இறுதி உயரத்தை அல்ல, உயர வேறுபாட்டைப் பயன்படுத்துக: 0.005 × 10 × (4 − 2) = 0.10 J.'),
    [('A factor-of-ten error.','பத்து மடங்குக் கணிப்புப் பிழை.'),('Correct mass conversion and height change.','சரியான திணிவு மாற்றமும் உயர வேறுபாடும்.'),('Uses final height 4 m instead of the increase 2 m.','உயர அதிகரிப்பு 2 m-க்குப் பதிலாக இறுதி உயரம் 4 m பயன்படுத்தப்பட்டுள்ளது.'),('Does not follow m g Δh.','m g Δh-க்கு பொருந்தவில்லை.')],['g10-chapter-18-work-energy-power'],[('5 g = 0.005 kg; Δh = 4 − 2 = 2 m.','5 g = 0.005 kg; Δh = 4 − 2 = 2 m.'),('ΔE = m g Δh = 0.005 × 10 × 2 = 0.10 J.','ΔE = m g Δh = 0.005 × 10 × 2 = 0.10 J.')])
mcq(31,'physics','Liquid pressure',3,'Four containers hold water to heights 12, 12, 15 and 14 cm. Which bottom point has the greatest water pressure?', 'நான்கு பாத்திரங்களின் நீர் உயரங்கள் முறையே 12, 12, 15, 14 cm. அடியில் அதிக நீர் அமுக்கம் உள்ள புள்ளி எது?',
    [('P','P'),('Q','Q'),('R','R'),('S','S')],
    ('For the same liquid, p = ρgh. The deepest point R at 15 cm has the greatest pressure, regardless of container shape.','ஒரே திரவத்திற்கு p = ρgh. பாத்திர வடிவத்தைப் பொருட்படுத்தாமல் 15 cm ஆழமுள்ள R-இல் அதிக அமுக்கம் இருக்கும்.'),
    [('12 cm is not the greatest depth.','12 cm அதிகபட்ச ஆழமல்ல.'),('12 cm is not the greatest depth.','12 cm அதிகபட்ச ஆழமல்ல.'),('15 cm is the greatest depth.','15 cm அதிகபட்ச ஆழம்.'),('14 cm is less than 15 cm.','14 cm, 15 cm-ஐ விடக் குறைவு.')],['g10-chapter-15-hydrostatic-pressure'])
mcq(32,'physics','Motion and momentum',4,'A 1 kg body moving at 4 m s⁻¹ stops uniformly in 2 s. Find deceleration and initial momentum.', '1 kg பொருள் 4 m s⁻¹ வேகத்திலிருந்து 2 s-இல் சீராக நிற்கிறது. அமர்வேகமும் ஆரம்ப உந்தமும் என்ன?',
    [('2 m s⁻²; 4 kg m s⁻¹','2 m s⁻²; 4 kg m s⁻¹'),('4 m s⁻²; 2 kg m s⁻¹','4 m s⁻²; 2 kg m s⁻¹'),('8 m s⁻²; 1 kg m s⁻¹','8 m s⁻²; 1 kg m s⁻¹'),('4 m s⁻²; 4 kg m s⁻¹','4 m s⁻²; 4 kg m s⁻¹')],
    ('Acceleration is (0−4)/2 = −2 m s⁻²; deceleration magnitude is 2. Initial momentum is 1 × 4 = 4 kg m s⁻¹.','முடுக்கம் (0−4)/2 = −2 m s⁻². அமர்வேகத்தின் பருமன் 2. ஆரம்ப உந்தம் 1 × 4 = 4 kg m s⁻¹.'),
    [('Both values are correct.','இரு பெறுமானங்களும் சரி.'),('Confuses speed change with acceleration and gives wrong momentum.','வேக மாற்றத்தை முடுக்கமாக எடுத்துள்ளது; உந்தமும் தவறு.'),('Multiplies speed by time instead of dividing.','வேக மாற்றத்தை நேரத்தால் வகுப்பதற்குப் பதிலாகப் பெருக்கியுள்ளது.'),('Momentum is right, but deceleration must include the 2 s time.','உந்தம் சரி; அமர்வேகத்தில் 2 s நேரத்தைப் பயன்படுத்த வேண்டும்.')],['unit-02-motion-in-a-straight-line','chapter-04-newtons-laws'],[('a = (v−u)/t = (0−4)/2 = −2 m s⁻².','a = (v−u)/t = (0−4)/2 = −2 m s⁻².'),('p = mu = 1 × 4 = 4 kg m s⁻¹.','p = mu = 1 × 4 = 4 kg m s⁻¹.')])
mcq(33,'physics','Simple machines',4,'A: scissors are second-class levers. B: mechanical advantage = effort/load. C: a fixed pulley has velocity ratio 1. Which statements are true?', 'A: கத்தரிக்கோல் இரண்டாம் வகை நெம்பு. B: பொறிமுறை நயம் = எத்தனம்/சுமை. C: நிலைத்த தனிக் கப்பியின் வேக விகிதம் 1. உண்மையானது எது?',
    [('B only','B மட்டும்'),('C only','C மட்டும்'),('A and C only','A, C மட்டும்'),('A, B and C','A, B, C எல்லாம்')],
    ('Scissors are first-class levers; mechanical advantage is load/effort. Only the fixed-pulley statement is true.','கத்தரிக்கோல் முதலாம் வகை நெம்பு. பொறிமுறை நயம் = சுமை/எத்தனம். நிலைத்த கப்பி பற்றிய C மட்டுமே உண்மை.'),
    [('B reverses the ratio.','B விகிதத்தைத் தலைகீழாக்குகிறது.'),('Only C is true.','C மட்டுமே உண்மை.'),('A is false: the pivot is between effort and load.','A தவறு: தாங்குபுள்ளி எத்தனத்துக்கும் சுமைக்கும் இடையில் உள்ளது.'),('A and B are false.','A, B இரண்டும் தவறு.')],['chapter-11-turning-effect'])
mcq(34,'physics','Circuits',4,'In the shown 12 V circuit, two 6 Ω resistors are parallel and in series with 3 Ω. Find the voltage across 3 Ω.', '12 V சுற்றில் இரு 6 Ω தடையிகள் சமாந்தரமாகவும் அவற்றுடன் 3 Ω தொடராகவும் உள்ளன. 3 Ω-இன் அழுத்த வித்தியாசம் என்ன?',
    [('3 V','3 V'),('6 V','6 V'),('9 V','9 V'),('12 V','12 V')],
    ('The parallel pair is 3 Ω. Total resistance is 6 Ω, current is 2 A, and the voltage across the series 3 Ω is 6 V.','சமாந்தர இணையின் தடை 3 Ω. மொத்தம் 6 Ω; மின்னோட்டம் 2 A. தொடர் 3 Ω-இன் அழுத்தம் 6 V.'),
    [('Underestimates the series voltage.','தொடர் அழுத்தத்தை குறைவாகக் கணிக்கிறது.'),('Equal 3 Ω sections share the 12 V equally.','சமமான 3 Ω பகுதிகள் 12 V-ஐ சமமாகப் பகிரும்.'),('Does not follow the circuit’s equivalent resistance.','சுற்றின் சமவலுத் தடைக்கு பொருந்தவில்லை.'),('12 V is across the whole circuit, not only this resistor.','12 V முழுச் சுற்றுக்கும் உரியது; இத்தடையிக்கு மட்டும் அல்ல.')],['g10-chapter-19-current-electricity'],[('Rparallel = (6×6)/(6+6) = 3 Ω.','Rசமாந்தரம் = (6×6)/(6+6) = 3 Ω.'),('Rtotal = 3+3 = 6 Ω; I = 12/6 = 2 A.','Rமொத்தம் = 3+3 = 6 Ω; I = 12/6 = 2 A.'),('V = IR = 2×3 = 6 V.','V = IR = 2×3 = 6 V.')])
mcq(35,'physics','Sound',4,'Thunder is heard 5 s after lightning. With sound speed 330 m s⁻¹, how far away is the strike?', 'மின்னலுக்கு 5 s பின்னர் இடி கேட்கிறது. ஒலியின் கதி 330 m s⁻¹ எனில் மின்னல் ஏற்பட்ட தூரம் என்ன?',
    [('1500 m','1500 m'),('1650 m','1650 m'),('2000 m','2000 m'),('2200 m','2200 m')],
    ('Light travel time is negligible at this scale: d = vt = 330 × 5 = 1650 m.','இத்தூரத்தில் ஒளியின் பயண நேரம் புறக்கணிக்கத்தக்கது. d = vt = 330 × 5 = 1650 m.'),
    [('Would use 300 m s⁻¹, not the given 330.','கொடுக்கப்பட்ட 330-க்குப் பதிலாக 300 m s⁻¹ பயன்படுத்துகிறது.'),('Uses the given speed and time.','கொடுக்கப்பட்ட கதியையும் நேரத்தையும் பயன்படுத்துகிறது.'),('Does not equal 330×5.','330×5-க்கு சமமல்ல.'),('Does not equal 330×5.','330×5-க்கு சமமல்ல.')],['g11-chapter-04-waves'],[('d = vt = 330×5 = 1650 m.','d = vt = 330×5 = 1650 m.')])
mcq(36,'physics','Electrical heating',4,'Identical water samples are heated for equal time with current I: A has one coil; B has three identical coils in series. Compare temperature rises t₁ and t₂ (no heat loss).', 'ஒரே அளவு நீரை ஒரே நேரம் I மின்னோட்டத்தால் சூடாக்குகின்றனர். A-இல் ஒரு சுருள்; B-இல் அதே வகை மூன்று சுருள்கள் தொடராக உள்ளன. வெப்ப இழப்பின்றி வெப்பநிலை உயர்வுகள் t₁, t₂ எவ்வாறு தொடர்புபடும்?',
    [('t₂ = t₁','t₂ = t₁'),('t₂ = 2t₁','t₂ = 2t₁'),('t₂ = 3t₁','t₂ = 3t₁'),('t₂ = t₁/3','t₂ = t₁/3')],
    ('At the same current and time, heat I²Rt is proportional to total resistance. Three series coils give three times the heat.','ஒரே மின்னோட்டத்திலும் நேரத்திலும் I²Rt வெப்பம் மொத்தத் தடைக்கு விகிதசமம். மூன்று தொடர் சுருள்கள் மூன்று மடங்கு வெப்பத்தைத் தரும்.'),
    [('Ignores the tripled resistance.','மூன்று மடங்கான தடையைப் புறக்கணிக்கிறது.'),('There are three coils, not two.','மூன்று சுருள்கள் உள்ளன; இரண்டு அல்ல.'),('Heat and temperature rise triple.','வெப்பமும் வெப்பநிலை உயர்வும் மூன்று மடங்காகும்.'),('Would not apply at the explicitly equal current.','குறிப்பிட்ட சம மின்னோட்டத்தில் இது பொருந்தாது.')],['g11-chapter-10-electric-appliances','g11-chapter-09-heat'])
mcq(37,'physics','Technology',4,'Electronic identity cards are an application of which technology?', 'இலத்திரனியல் அடையாள அட்டைகள் எந்தத் தொழில்நுட்பத்தின் பயன்பாடு?',
    [('Information technology','தகவல் தொழில்நுட்பம்'),('Nanotechnology','நனோ தொழில்நுட்பம்'),('Molecular biotechnology','மூலக்கூற்று உயிர்த்தொழில்நுட்பம்'),('Genetic engineering','பிறப்புரிமைப் பொறியியல்')],
    ('Electronic identification involves storing, processing and retrieving information.','இலத்திரனியல் அடையாளத்தில் தகவல் சேமிப்பு, செயலாக்கம், மீட்டெடுப்பு இடம்பெறும்.'),
    [('Directly concerns electronic information handling.','இலத்திரனியல் தகவல் கையாளலுடன் நேரடியாகத் தொடர்புடையது.'),('Nanoscale materials are not the defining function here.','நனோ அளவுப் பொருட்கள் இங்கு வரையறுக்கும் செயற்பாடு அல்ல.'),('Not biological molecular manipulation.','உயிரியல் மூலக்கூறு மாற்றம் அல்ல.'),('Not gene modification.','மரபணு மாற்றம் அல்ல.')])
mcq(38,'biology','Biodiversity',4,'P: meet basic needs of all animals including humans. Q: maintain natural cycles. R: improve aesthetic and cultural values. Which are services of biodiversity?', 'P: மனிதர் உட்பட விலங்குகளின் அடிப்படைத் தேவைகளை நிறைவு செய்தல். Q: இயற்கை வட்டங்களைப் பேணல். R: அழகியல், கலாசாரப் பெறுமானங்களை மேம்படுத்தல். உயிர்ப்பல்வகைமையின் சேவைகள் எவை?',
    [('P and Q only','P, Q மட்டும்'),('P and R only','P, R மட்டும்'),('Q and R only','Q, R மட்டும்'),('P, Q and R','P, Q, R எல்லாம்')],
    ('Biodiversity supports resources, ecosystem processes and cultural benefits. All three are services.','உயிர்ப்பல்வகைமை வளங்கள், சூழற் செயன்முறைகள், கலாசார நன்மைகள் ஆகியவற்றை வழங்கும். மூன்றும் சேவைகள்.'),
    [('Omits cultural and aesthetic benefits.','கலாசார, அழகியல் நன்மைகளை விட்டுள்ளது.'),('Omits maintenance of natural cycles.','இயற்கை வட்டங்களைப் பேணுவதை விட்டுள்ளது.'),('Omits basic resource services.','அடிப்படை வளச் சேவைகளை விட்டுள்ளது.'),('Includes all three services.','மூன்று சேவைகளையும் உள்ளடக்குகிறது.')])
mcq(39,'physics','Sustainable technology',4,'Which is the best response to waste and environmental problems from discarded electronics?', 'கழிக்கப்பட்ட இலத்திரனியல் உபகரணங்களால் ஏற்படும் கழிவு, சூழல் பிரச்சினைகளுக்குப் பொருத்தமான நடவடிக்கை எது?',
    [('Reduce use of all these devices','எல்லா உபகரணங்களின் பாவனையைக் குறைத்தல்'),('Reduce production','உற்பத்தி அளவைக் குறைத்தல்'),('Invent substitutes only','பதிலான வேறு பொருட்களை உருவாக்குதல்'),('Arrange manufacturer-led recycling','உற்பத்தியாளர்களால் மீள்பாவனை/மீள்சுழற்சி நடவடிக்கை')],
    ('Producer take-back and recycling recover materials and help manage hazardous electronic waste responsibly.','உற்பத்தியாளரின் மீளப்பெறல், மீள்சுழற்சி நடவடிக்கைகள் வளங்களை மீட்டு ஆபத்தான இலத்திரனியல் கழிவை முறையாகக் கையாள உதவும்.'),
    [('Does not address management of existing waste.','ஏற்கனவே உள்ள கழிவைக் கையாளுவதைத் தீர்க்காது.'),('Does not directly manage discarded equipment.','கழிக்கப்பட்ட உபகரணங்களை நேரடியாகக் கையாளாது.'),('Substitutes alone do not manage existing e-waste.','பதிலீடுகள் மட்டும் தற்போதைய கழிவைக் கையாளாது.'),('Directly addresses recovery and end-of-life management.','வள மீட்பையும் பயன்பாட்டிறுதி கையாளலையும் நேரடியாகத் தீர்க்கிறது.')])
mcq(40,'physics','Science and society',4,'What was the theme of World Science Day in 2015?', '2015 உலக விஞ்ஞான தினத்தின் கருப்பொருள் என்ன?',
    [('Science for technology','தொழில்நுட்பங்களுக்கான விஞ்ஞானம்'),('Science for health and well-being','சுகாதாரம், நல்வாழ்வுக்கான விஞ்ஞானம்'),('Science for a sustainable future','நிலைத்திருக்கும் எதிர்காலத்திற்கான விஞ்ஞானம்'),('Science for exploring the world','உலகை ஆராய்வதற்கான விஞ்ஞானம்')],
    ('The historical theme tested by this paper is Science for a Sustainable Future. Treat it as a year-specific fact, not a current theme.','இவ்வினாத்தாள் கேட்கும் வரலாற்றுக் கருப்பொருள் நிலைத்திருக்கும் எதிர்காலத்திற்கான விஞ்ஞானம். இது 2015-க்குரிய உண்மை; தற்போதைய கருப்பொருள் அல்ல.'),
    [('Not the theme tested for 2015.','2015-இற்குக் கேட்கப்பட்ட கருப்பொருள் அல்ல.'),('Not the theme tested for 2015.','2015-இற்குக் கேட்கப்பட்ட கருப்பொருள் அல்ல.'),('Matches the verified 2015 answer key.','சரிபார்க்கப்பட்ட 2015 விடைக் குறிப்புடன் பொருந்துகிறது.'),('Not the theme tested for 2015.','2015-இற்குக் கேட்கப்பட்ட கருப்பொருள் அல்ல.')])

# Written questions are appended below. Each part has its own subject, prompt and solution.
def part(label, subject, en, ta, answer_en, answer_ta, steps=(), lessons=(), hint=None):
    return dict(label=label, subject=subject, prompt=bi(en,ta), answer=bi(answer_en,answer_ta),
        steps=[bi(*s) for s in steps], lessons=list(lessons),
        hint=bi(*(hint or ('Identify the relevant principle and list the given information.', 'தொடர்புடைய தத்துவத்தையும் கொடுக்கப்பட்ட தகவல்களையும் இனங்காண்க.'))))

def written(n, subjects, topics, pages, en, ta, parts):
    questions.append(dict(id=f'ol2015-ii-{n:02}', number=n, paper='II', section='A' if n<=4 else 'B',
        type='written', subjects=subjects, topics=topics, pages=pages, prompt=bi(en,ta), parts=parts,
        marks=15 if n<=4 else 20, lessons=sorted({l for p in parts for l in p['lessons']}),
        answerVerification='model-solution', sourceChecked=True))

from pilot_2015_written import append_written
append_written(written, part)
for q in questions:
    if q['type']=='mcq' and q['number'] in (2,8,17,18,22,27,28,30,31,32,34,36):
        q['figure']=f'/lessons/past-papers/2015/mcq-{q["number"]:02}.jpg'
questions[9]['editorialWarning']=bi('The official key selects option 1, but its wording is imprecise: an affected son must inherit the allele from his mother, who can be a carrier without being colour-blind. The scan and original option are preserved; score follows the historical key.',
    'அதிகாரப்பூர்வ விடை தெரிவு 1; ஆனால் சொற்கள் துல்லியமற்றவை. பாதிக்கப்பட்ட மகன் மரபலகைத் தாயிடமிருந்து பெறுகிறான்; தாய்க்கு நோய் வெளிப்படாமல் காவியாக இருக்கலாம். மூலத் தெரிவும் தாளும் பேணப்பட்டுள்ளன; புள்ளிகள் வரலாற்று விடைக்குறிப்பைப் பின்பற்றும்.')
questions[7]['translationReview']=dict(option=1,term='இளைப்பு',note='English meaning of this regional source term requires Tamil-medium teacher confirmation.')
questions[16]['sourceDescription']=bi('Diagram description: zinc is on the left and copper on the right, in dilute sulfuric acid. The arrow on the external wire points from copper towards zinc.',
    'பட விளக்கம்: ஐதான சல்பூரிக் அமிலத்தில் இடப்புறம் துத்தநாகமும் வலப்புறம் செம்பும் உள்ளன. வெளிக்கம்பியின் அம்பு செம்பிலிருந்து துத்தநாகத்தை நோக்குகிறது.')
questions[27]['sourceDescription']=bi('The chip is viewed from above, with its notch on the left and the marker beside the lower-left pin. Read the upper and lower rows from left to right.',
    'மேலிருந்து பார்க்கும் சில்லுவின் வெட்டு இடப்புறத்திலும் குறி கீழ் இடப்புற முனையருகிலும் உள்ளன. மேல், கீழ் வரிசைகளை இடமிருந்து வலமாக வாசிக்கவும்.')
questions[27]['options']=[bi(f'Diagram {i+1}: upper row {a}; lower row {b}',f'படம் {i+1}: மேல் வரிசை {a}; கீழ் வரிசை {b}')
    for i,(a,b) in enumerate([('1, 2, 3, 4','8, 7, 6, 5'),('8, 7, 6, 5','1, 2, 3, 4'),('5, 6, 7, 8','1, 2, 3, 4'),('1, 2, 3, 4','5, 6, 7, 8')])]
questions[30]['sourceDescription']=bi('Water heights above the bottom points: P = 12 cm, Q = 12 cm, R = 15 cm, S = 14 cm. All containers contain the same water.',
    'அடிப்புள்ளிகளுக்கு மேலுள்ள நீரின் உயரங்கள்: P = 12 cm, Q = 12 cm, R = 15 cm, S = 14 cm. எல்லாப் பாத்திரங்களிலும் அதே நீர் உள்ளது.')
questions[42]['sourceDescription']=bi('Electron-diagram description: (1) two X atoms share one pair; (2) one Y shares one pair with each of four X atoms; (3) one Z shares one pair with each of three X atoms and has one lone pair. X, Y, Z are placeholders, with atomic numbers below 10.',
    'இலத்திரன் பட விளக்கம்: (1) இரண்டு X அணுக்கள் ஒரு சோடியைப் பகிர்கின்றன; (2) Y நான்கு X அணுக்களுடன் ஒவ்வொரு சோடியைப் பகிர்கிறது; (3) Z மூன்று X அணுக்களுடன் ஒவ்வொரு சோடியைப் பகிர்ந்து ஒரு தனிச்சோடியைக் கொண்டுள்ளது. X, Y, Z குறியீடுகளின் அணு எண்கள் 10 இற்குக் குறைவு.')
questions[48]['sourceDescription']=bi('Velocity–time graph: velocity increases uniformly from 0 to 60 m s⁻¹ over 40 s; a horizontal segment follows; velocity then decreases uniformly to zero over 20 s. The horizontal segment covers 15,000 m.',
    'வேகம்–நேர வரைபு: 40 s இல் வேகம் சீராக 0 இலிருந்து 60 m s⁻¹ ஆகும்; பின் கிடைப் பகுதி; பின் 20 s இல் சீராக பூச்சியமாகக் குறையும். கிடைப் பகுதியில் 15,000 m பயணிக்கிறது.')

# Publish only substantive physics questions; retain original source numbering.
physics_mcqs = {5, 9, *range(25, 37)}
physics_questions = []
for q in questions:
    if q['type'] == 'mcq':
        if q['number'] in physics_mcqs:
            physics_questions.append(q)
        continue
    original_parts = q['parts']
    q['parts'] = [p for p in original_parts if p['subject'] == 'physics']
    if not q['parts']:
        continue
    q['subjects'] = ['physics']
    q['lessons'] = sorted({l for p in q['parts'] for l in p['lessons']})
    if len(q['parts']) != len(original_parts):
        q.pop('marks', None)  # Source total includes excluded science subparts.
        q.pop('sourceDescription', None)
        q['physicsSubset'] = True
    if q['number'] == 1:
        q['prompt'] = bi('Waves and a floating ship: answer the physics subparts below.', 'அலைகளும் மிதக்கும் கப்பலும்: கீழுள்ள பௌதிகவியல் பகுதிகளுக்கு விடையளிக்கவும்.')
        q['topics'] = ['Waves', 'Buoyancy']
    if q['number'] == 3:
        q['prompt'] = bi('A balloon is cooled at constant pressure. Answer the gas-law subparts below.', 'மாறா அமுக்கத்தில் பலூன் குளிர்விக்கப்படுகிறது. கீழுள்ள வாயு விதிப் பகுதிகளுக்கு விடையளிக்கவும்.')
        q['topics'] = ['Gas laws']
    physics_questions.append(q)
questions = physics_questions

bank = dict(schemaVersion=2, scope="physics", year=2015, title=bi('O/L Physics questions 2015 — Tamil-medium pilot','சா/த பௌதிகவியல் வினாக்கள் 2015 — தமிழ் முன்னோடி'),
    sourceLanguage='ta', teacherReviewed=False, status='pilot',
    editorialNote=bi('Tamil teaching paraphrases and English translations. Use the original scan for exact wording and diagrams. MCQ choices are checked against the Department of Examinations key. All explanations and written answers are model solutions awaiting teacher review.',
        'தமிழ் கற்பித்தல் மீளுரைகளும் ஆங்கில மொழிபெயர்ப்புக்களும். சரியான மூலச் சொற்களுக்கும் படங்களுக்கும் மூலத்தாளைப் பார்க்கவும். தெரிவு விடைகள் பரீட்சைத் திணைக்கள விடைக்குறிப்புடன் சரிபார்க்கப்பட்டன. விளக்கங்களும் எழுத்து விடைகளும் ஆசிரியர் மீளாய்வை எதிர்பார்க்கும் மாதிரி விடைகள்.'),
    keySource=SOURCE, sourcePdf='/lessons/past-papers/2015/source.pdf',
    papers=[dict(id='I', questionCount=14, instructions=bi('Physics subset practice: answer all 14 MCQs with no time limit. This is not the complete Science paper.', 'பௌதிகவியல் பயிற்சி: நேர வரம்பின்றி 14 தெரிவு வினாக்களுக்கும் விடையளிக்கவும். இது முழு விஞ்ஞான வினாத்தாள் அல்ல.')),
        dict(id='II', questionCount=5, instructions=bi('Physics subset practice: attempt all five written questions with no time limit. Questions 1 and 3 contain only their physics subparts. Use model answers for self-checking; no automatic written marks.', 'பௌதிகவியல் பயிற்சி: நேர வரம்பின்றி ஐந்து எழுத்து வினாக்களுக்கும் முயற்சிக்கவும். வினாக்கள் 1, 3 இல் பௌதிகவியல் பகுதிகள் மட்டும் உள்ளன. மாதிரி விடைகளுடன் தன்னிலை மதிப்பீடு செய்க; தானியங்கி புள்ளிகள் இல்லை.'))],
    questions=questions)

from pilot_physics_explanations import enrich
enrich(bank)

if __name__ == '__main__':
    assert len(questions) == 19
    assert len({q['id'] for q in questions}) == 19
    assert all(q['correct']+1 == KEY[q['number']-1] for q in questions if q['type']=='mcq')
    assert all(q['subjects']==['physics'] for q in questions)
    assert all(p['subject']=='physics' for q in questions for p in q.get('parts',[]))
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'2015.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Built {len(questions)} questions and {sum(len(q.get("parts",[])) for q in questions)} written subparts.')

