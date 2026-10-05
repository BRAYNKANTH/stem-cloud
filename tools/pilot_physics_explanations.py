# -*- coding: utf-8 -*-
"""Authored teaching notes for the physics pilot; no generated book citations.

Chapter metadata is read from the actual course index. These are lesson
references, not claims that a particular printed textbook page was checked.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def bi(en, ta):
    return {'en': en, 'ta': ta}

# concept, reasoning, common mistake, practice question, practice answer
GUIDES = {
 'diffusion': (
  ('Diffusion: particles spread by random motion.', 'பரவல்: துணிக்கைகள் எழுந்தமான இயக்கத்தால் பரவுகின்றன.'),
  ('The bottle creates a high vapour concentration nearby. Molecules move in all directions, but more leave that crowded region than enter it. This produces net spreading towards regions with fewer vapour molecules; bulk air flow can also help in a real room.', 'போத்தலுக்கு அருகில் ஆவித் துணிக்கைகளின் செறிவு அதிகம். துணிக்கைகள் எல்லாத் திசைகளிலும் இயங்கினாலும், அப்பகுதியிலிருந்து வெளியேறுபவை அதிகம். இதனால் குறைந்த செறிவுள்ள இடங்களை நோக்கி நிகரப் பரவல் ஏற்படும். உண்மையான அறையில் காற்றோட்டமும் உதவலாம்.'),
  ('Do not confuse diffusion with osmosis, which involves solvent crossing a selectively permeable membrane.', 'பரவலைத் தேர்ந்தெடுக்கும் புகவிடும் மென்சவ்வூடான கரைப்பான் இயக்கமான சவ்வூடு பரவலுடன் குழப்ப வேண்டாம்.'),
  ('Why does perfume smell reach someone across a still room?', 'அசைவற்ற அறையின் மறுபுறத்தில் உள்ளவருக்கு வாசனைத் திரவிய மணம் எவ்வாறு அடைகிறது?'),
  ('Vapour molecules diffuse from the concentrated region near the perfume into the surrounding air.', 'வாசனைத் திரவியத்திற்கு அருகிலுள்ள அதிக செறிவுப் பகுதியிலிருந்து ஆவித் துணிக்கைகள் சுற்றியுள்ள காற்றில் பரவுகின்றன.')),
 'eye': (
  ('A clear image must fall on the retina.', 'தெளிவான விம்பம் விழித்திரையில் உருவாக வேண்டும்.'),
  ('The cornea and eye lens bend incoming light. The lens adjusts its shape to focus light from different distances onto the retina. Focusing is the optical process; the retina detects that focused image. The pupil is an opening, not the image screen.', 'கண்ணின் கருவிழியும் வில்லையும் வரும் ஒளியை முறிக்கின்றன. வெவ்வேறு தூரங்களிலிருந்து வரும் ஒளியை விழித்திரையில் குவிக்க வில்லை வடிவத்தை மாற்றுகிறது. குவித்தல் ஒளியியல் செயல்; விழித்திரை விம்பத்தை உணர்கிறது. கண்மணி ஒரு திறப்பு; விம்பத் திரை அல்ல.'),
  ('The lens focuses the light; the image does not form on the lens itself.', 'வில்லை ஒளியைக் குவிக்கிறது; விம்பம் வில்லையிலேயே உருவாவதில்லை.'),
  ('In short-sightedness, does the image of a distant object form before or behind the retina?', 'கிட்டப்பார்வையில் தூரப் பொருளின் விம்பம் விழித்திரைக்கு முன்னாலா பின்னாலா உருவாகும்?'),
  ('Before the retina; a diverging lens can correct the focus.', 'விழித்திரைக்கு முன்னால்; விரிக்கும் வில்லை மூலம் குவிப்பைச் சரிசெய்யலாம்.')),
 'kelvin': (
  ('Kelvin measures temperature from absolute zero.', 'கெல்வின் தனிப்பூச்சியத்திலிருந்து வெப்பநிலையை அளக்கிறது.'),
  ('Celsius and kelvin have the same-sized interval, but different zero points. For an actual temperature, add 273.15, or 273 when the paper uses the school approximation. For a temperature rise, the numerical change is identical in °C and K: do not add 273 to a difference.', 'செல்சியஸ், கெல்வின் இடைவெளிகள் ஒரே அளவானவை; பூச்சியப் புள்ளிகள் வேறுபடும். வெப்பநிலைக்கு 273.15 ஐ, பாடசாலை அணுகுமுறையில் 273 ஐச் சேர்க்கவும். வெப்பநிலை அதிகரிப்பின் எண் மதிப்பு °C, K இரண்டிலும் ஒன்றே; வேறுபாட்டிற்கு 273 சேர்க்க வேண்டாம்.'),
  ('Write K, not °K. A rise of 5°C is 5 K, not 278 K.', '°K அல்ல, K என எழுதவும். 5°C உயர்வு 5 K; 278 K அல்ல.'),
  ('Convert 27°C to kelvin using the school approximation.', 'பாடசாலை அணுகுமுறையில் 27°C ஐக் கெல்வினாக மாற்றுக.'),
  ('27 + 273 = 300 K.', '27 + 273 = 300 K.')),
 'doping': (
  ('An n-type semiconductor has electrons as majority carriers.', 'n-வகை அரைக்கடத்தியில் இலத்திரன்கள் பெரும்பான்மை காவிகள்.'),
  ('Silicon forms four bonds. A pentavalent impurity can supply those four bonding electrons and still has one electron available to carry current. This is why phosphorus produces n-type silicon. The n describes the carrier type; the whole crystal remains approximately electrically neutral.', 'சிலிக்கன் நான்கு பிணைப்புகளை உருவாக்குகிறது. ஐந்து இணைதிறன் இலத்திரன்களுள்ள மாசு நான்கு பிணைப்பு இலத்திரன்களை வழங்கிய பின்னும் மின்னோட்டத்தைக் காவும் ஒரு இலத்திரனை வழங்கும். அதனால் பொசுபரசு n-வகையை உருவாக்குகிறது. n என்பது காவி வகை; முழுப் படிகமும் ஏறத்தாழ மின்நடுநிலையானது.'),
  ('Adding a trivalent impurity creates p-type material, not n-type.', 'மூன்று இணைதிறன் இலத்திரன்களுள்ள மாசு p-வகையை உருவாக்கும்; n-வகையை அல்ல.'),
  ('Which majority carrier results from adding boron to silicon?', 'சிலிக்கனில் போரனைச் சேர்க்கும்போது பெரும்பான்மை காவி எது?'),
  ('Holes: boron is trivalent and produces p-type material.', 'துளைகள்: போரனுக்கு மூன்று இணைதிறன் இலத்திரன்கள் உள்ளதால் p-வகை உருவாகும்.')),
 'refraction': (
  ('Refraction changes light direction when its speed changes between media.', 'ஊடகங்களுக்கிடையில் ஒளியின் வேகம் மாறும்போது முறிவு திசையை மாற்றுகிறது.'),
  ('Measure both angles from the normal, not the surface. Light entering glass from air bends towards the normal. Snell’s law links the angles: n₁ sin i = n₂ sin r. With fixed media, increasing i increases r, while r remains smaller than i for this direction of travel.', 'இரு கோணங்களையும் மேற்பரப்பிலிருந்து அல்ல, செங்குத்திலிருந்து அளக்கவும். வளியிலிருந்து கண்ணாடிக்குள் செல்லும் ஒளி செங்குத்தை நோக்கி வளைகிறது. ஸ்நெல் விதி: n₁ sin i = n₂ sin r. ஊடகங்கள் மாறாதபோது i அதிகரித்தால் r அதிகரிக்கும்; இத்திசையில் r, i ஐவிடச் சிறியது.'),
  ('Total internal reflection requires travel from higher to lower refractive index, not air into glass.', 'முழு அகத்தெறிப்புக்கு அதிக முறிவுச் சுட்டியிலிருந்து குறைந்த முறிவுச் சுட்டிக்குச் செல்ல வேண்டும்; வளியிலிருந்து கண்ணாடிக்குள் அல்ல.'),
  ('A ray enters glass perpendicular to its surface. Does its direction change?', 'ஒளிக்கதிர் கண்ணாடி மேற்பரப்பிற்கு செங்குத்தாக நுழைந்தால் திசை மாறுமா?'),
  ('No. i = 0, so r = 0; its speed still changes.', 'இல்லை. i = 0 என்பதால் r = 0; ஆனால் வேகம் மாறும்.')),
 'pins': (
  ('IC pin numbers depend on the package orientation and viewing side.', 'IC முனை எண்கள் பொதியின் திசையையும் பார்க்கும் பக்கத்தையும் சாரும்.'),
  ('Locate the notch or dot first, identify pin 1, and trace the top-view numbering around the package counter-clockwise. Rotating the drawing changes where the pins appear on the page, but not the numbering sequence. Compare every labelled pin, not just the first row.', 'முதலில் வெட்டு அல்லது புள்ளியைக் கண்டறிந்து முனை 1 ஐ அடையாளம் காணவும். மேலிருந்து பார்க்கும்போது கடிகார எதிர்த்திசையில் எண்களைப் பின்தொடரவும். படத்தைச் சுழற்றினாலும் எண் வரிசை மாறாது. முதல் வரிசையை மட்டும் அல்ல, எல்லா முனைகளையும் ஒப்பிடவும்.'),
  ('A bottom view reverses the apparent layout. Do not use it for this top-view drawing.', 'கீழிருந்து பார்க்கும்போது தோற்ற ஒழுங்கு மாறும். மேலிருந்து பார்க்கும் இப்பதிலுக்கு அதைப் பயன்படுத்த வேண்டாம்.'),
  ('In a top-view 8-pin package with the notch upward, which pin is opposite pin 1?', 'வெட்டு மேலுள்ள 8-முனைப் பொதியை மேலிருந்து பார்க்கும்போது முனை 1 க்கு எதிரே உள்ள முனை எது?'),
  ('Pin 8: left side runs 1 to 4 downward, and right side 5 to 8 upward.', 'முனை 8: இடப்புறம் மேலிருந்து கீழ் 1 முதல் 4; வலப்புறம் கீழிருந்து மேல் 5 முதல் 8.')),
 'density': (
  ('Density is mass per unit volume: ρ = m/V.', 'அடர்த்தி அலகு கனவளவின் திணிவு: ρ = m/V.'),
  ('Rearrange the definition to m = ρV because mass is required. Match volume units to the denominator in the density unit. Here g cm⁻³ multiplied by cm³ leaves grams, so conversion to SI is unnecessary unless the question asks for kilograms.', 'திணிவு தேவைப்படுவதால் வரையறையை m = ρV என மாற்றவும். அடர்த்தியின் கீழுள்ள கனவளவு அலகுடன் கொடுக்கப்பட்ட கனவளவு அலகை ஒத்திசைக்கவும். g cm⁻³ ஐ cm³ ஆல் பெருக்கினால் g கிடைக்கும்; kg கேட்டால் மட்டுமே மாற்றம் தேவை.'),
  ('Do not divide density by volume; the units would not give mass.', 'அடர்த்தியைக் கனவளவால் வகுக்க வேண்டாம்; திணிவின் அலகு கிடைக்காது.'),
  ('A material has density 4 g cm⁻³ and volume 3 cm³. Find its mass.', 'ஒரு பொருளின் அடர்த்தி 4 g cm⁻³; கனவளவு 3 cm³. திணிவைக் காண்க.'),
  ('m = 4 × 3 = 12 g.', 'm = 4 × 3 = 12 g.')),
 'potential': (
  ('Gravitational potential-energy change is ΔE = mgΔh.', 'ஈர்ப்பு அழுத்தச் சக்தி மாற்றம் ΔE = mgΔh.'),
  ('The question asks for a change, so subtract the starting height from the ending height. Convert grams to kilograms before substituting into the SI formula. Raising the object requires work against gravity, and that work becomes additional gravitational potential energy.', 'மாற்றம் கேட்கப்படுவதால் இறுதி உயரத்திலிருந்து ஆரம்ப உயரத்தைக் கழிக்கவும். SI சூத்திரத்தில் பிரதியிட முன் g ஐ kg ஆக மாற்றவும். பொருளை உயர்த்த ஈர்ப்பிற்கு எதிராகச் செய்யும் வேலை மேலதிக ஈர்ப்பு அழுத்தச் சக்தியாகிறது.'),
  ('Using 5 instead of 0.005 kg makes the energy 1000 times too large.', '0.005 kg க்குப் பதில் 5 பயன்படுத்தினால் சக்தி 1000 மடங்கு அதிகமாகும்.'),
  ('Raise a 2 kg object by 3 m with g = 10 N kg⁻¹. Find the energy increase.', 'g = 10 N kg⁻¹ எனில் 2 kg பொருளை 3 m உயர்த்தும் சக்தி அதிகரிப்பைக் காண்க.'),
  ('ΔE = 2 × 10 × 3 = 60 J.', 'ΔE = 2 × 10 × 3 = 60 J.')),
 'pressure': (
  ('Liquid pressure at depth h is p = ρgh.', 'h ஆழத்திலுள்ள திரவ அமுக்கம் p = ρgh.'),
  ('For the same liquid and gravitational field, density and g are identical. Only the vertical depth above the point changes. Therefore compare the listed depths directly. Container width or shape changes the amount of water, but does not determine the pressure at a given depth.', 'ஒரே திரவத்திலும் ஈர்ப்புப் புலத்திலும் அடர்த்தியும் g உம் ஒன்றே. புள்ளிக்கு மேலுள்ள செங்குத்து ஆழமே மாறும். எனவே ஆழங்களை நேரடியாக ஒப்பிடவும். பாத்திரத்தின் அகலம் அல்லது வடிவம் நீரின் அளவை மாற்றும்; குறிப்பிட்ட ஆழத்தின் அமுக்கத்தை அல்ல.'),
  ('Pressure and total force are different: force also depends on area.', 'அமுக்கமும் மொத்த விசையும் வேறு: விசை பரப்பளவையும் சாரும்.'),
  ('Two points in the same still water are both 10 cm below its surface. Compare their pressure.', 'அசைவற்ற ஒரே நீரில் இரு புள்ளிகள் மேற்பரப்பிலிருந்து 10 cm ஆழத்தில் உள்ளன. அமுக்கங்களை ஒப்பிடுக.'),
  ('Their liquid pressures are equal, regardless of container shape.', 'பாத்திர வடிவம் எதுவாயினும் அவற்றின் திரவ அமுக்கங்கள் சமம்.')),
 'motion': (
  ('Acceleration is change in velocity per time; momentum is mass × velocity.', 'ஆர்முடுகல் நேரத்திற்கான வேக மாற்றம்; உந்தம் திணிவு × வேகம்.'),
  ('Choose the initial direction as positive and write initial and final velocities before calculating. Stopping means v = 0, so acceleration is negative in that convention. A requested deceleration magnitude is positive. Initial momentum must use the initial velocity, not the final zero velocity.', 'ஆரம்ப இயக்கத் திசையை நேர்த் திசையாகத் தேர்ந்து ஆரம்ப, இறுதி வேகங்களை எழுதவும். நிறுத்தும்போது v = 0; அதனால் ஆர்முடுகல் மறையாகும். கேட்ட வேகவிறக்கத்தின் பருமன் நேராகும். ஆரம்ப உந்தத்திற்கு இறுதி பூச்சிய வேகத்தை அல்ல, ஆரம்ப வேகத்தைப் பயன்படுத்தவும்.'),
  ('Keep momentum (kg m s⁻¹) distinct from acceleration (m s⁻²).', 'உந்தம் (kg m s⁻¹), ஆர்முடுகல் (m s⁻²) ஆகியவற்றைக் குழப்ப வேண்டாம்.'),
  ('A 2 kg body slows from 6 m s⁻¹ to rest in 3 s. Find acceleration and initial momentum.', '2 kg பொருள் 6 m s⁻¹ இலிருந்து 3 s இல் நிற்கிறது. ஆர்முடுகலையும் ஆரம்ப உந்தத்தையும் காண்க.'),
  ('a = (0−6)/3 = −2 m s⁻²; initial p = 2 × 6 = 12 kg m s⁻¹.', 'a = (0−6)/3 = −2 m s⁻²; ஆரம்ப p = 2 × 6 = 12 kg m s⁻¹.')),
 'machines': (
  ('Mechanical advantage is load/effort; velocity ratio compares distances moved.', 'பொறிமுறை நயம் சுமை/பிரயோகம்; வேக விகிதம் நகர்ந்த தூரங்களை ஒப்பிடுகிறது.'),
  ('Test each statement separately. A scissors pivot lies between the effort and load, making it a first-class lever. A fixed pulley changes the force direction: pulling one metre raises the load one metre, so its velocity ratio is one. This does not mean every pulley arrangement has ratio one.', 'ஒவ்வொரு கூற்றையும் தனியாகச் சோதிக்கவும். கத்தரிக்கோலின் ஆதாரம் பிரயோகத்திற்கும் சுமைக்கும் இடையில் இருப்பதால் முதல் வகுப்பு நெம்புகோல். நிலைத்த கப்பியில் ஒரு மீற்றர் இழுத்தால் சுமை ஒரு மீற்றர் உயரும்; வேக விகிதம் ஒன்று. எல்லாக் கப்பித் தொகுதிகளுக்கும் இது பொருந்தாது.'),
  ('Mechanical advantage is not effort/load, and is not always identical to velocity ratio.', 'பொறிமுறை நயம் பிரயோகம்/சுமை அல்ல; எப்போதும் வேக விகிதத்திற்குச் சமமும் அல்ல.'),
  ('A 20 N effort lifts a 60 N load. Find mechanical advantage.', '20 N பிரயோகம் 60 N சுமையை உயர்த்துகிறது. பொறிமுறை நயத்தைக் காண்க.'),
  ('MA = 60/20 = 3.', 'MA = 60/20 = 3.')),
 'circuit': (
  ('In series, current is shared; in parallel, voltage is shared.', 'தொடரில் மின்னோட்டம் ஒன்றே; சமாந்தரத்தில் வோல்ற்றளவு ஒன்றே.'),
  ('First identify which components share both connection points: those are parallel. Replace that group by its equivalent resistance, then combine the remaining series resistors. Use the total resistance to find supply current. Finally apply V = IR to the particular series resistor asked about.', 'முதலில் இரு இணைப்புப் புள்ளிகளையும் பகிரும் கூறுகளைக் கண்டறியவும்; அவை சமாந்தரமானவை. அவற்றின் சமவலுப் தடையைப் பெற்று மீதித் தொடர் தடைகளுடன் சேர்க்கவும். மொத்தத் தடையிலிருந்து வழங்கல் மின்னோட்டத்தைக் கண்டு கேட்ட தொடர் தடைக்கு V = IR ஐப் பயன்படுத்தவும்.'),
  ('Parallel resistances are not added directly. Each equal parallel branch carries half the total current.', 'சமாந்தரத் தடைகளை நேரடியாகக் கூட்ட வேண்டாம். சமமான இரு கிளைகளில் ஒவ்வொன்றும் மொத்த மின்னோட்டத்தின் பாதியைக் காவும்.'),
  ('Two 4 Ω resistors in parallel are in series with 2 Ω across 8 V. Find the series resistor voltage.', 'சமாந்தரமான இரு 4 Ω தடைகள் 2 Ω உடன் தொடரில் 8 V வழங்கலில் உள்ளன. 2 Ω இன் வோல்ற்றளவைக் காண்க.'),
  ('Parallel = 2 Ω; total = 4 Ω; current = 2 A; voltage across 2 Ω = 4 V.', 'சமாந்தரம் = 2 Ω; மொத்தம் = 4 Ω; மின்னோட்டம் = 2 A; 2 Ω இன் வோல்ற்றளவு = 4 V.')),
 'sounddistance': (
  ('At constant speed, distance = speed × time.', 'மாறா வேகத்தில் தூரம் = வேகம் × நேரம்.'),
  ('The flash and thunder are produced by the same event. Light arrives almost immediately over this distance, so the delay mainly measures sound travel time. Multiply the sound speed by that delay. There is no return journey here, so do not divide by two as in an echo problem.', 'ஒளியும் இடியும் ஒரே நிகழ்விலிருந்து தோன்றுகின்றன. இத்தூரத்தில் ஒளி ஏறத்தாழ உடனடியாக வரும்; தாமதம் முக்கியமாக ஒலியின் பயண நேரம். ஒலியின் வேகத்தைத் தாமதத்தால் பெருக்கவும். எதிரொலி போல் திரும்பும் பயணம் இல்லாததால் இரண்டால் வகுக்க வேண்டாம்.'),
  ('Use sound speed, not light speed, for the measured delay.', 'அளந்த தாமதத்திற்கு ஒளி வேகத்தை அல்ல, ஒலி வேகத்தைப் பயன்படுத்தவும்.'),
  ('Thunder arrives 3 s after a flash. Sound speed is 330 m s⁻¹. Find the distance.', 'ஒளிக்குப் பின் 3 s இல் இடி கேட்கிறது. ஒலி வேகம் 330 m s⁻¹. தூரத்தைக் காண்க.'),
  ('d = 330 × 3 = 990 m.', 'd = 330 × 3 = 990 m.')),
 'heating': (
  ('Electrical heat is Q = I²Rt; thermal rise depends on Q = mcΔT.', 'மின் வெப்பம் Q = I²Rt; வெப்பநிலை உயர்வு Q = mcΔT ஐச் சாரும்.'),
  ('Read what is held constant. This question fixes current and heating time, not supply voltage. Three identical series coils have total resistance 3R, producing three times the heat at the same current. Identical water masses and heat capacities then give three times the temperature rise if heat losses are neglected.', 'எது மாறாமல் உள்ளது என்பதை வாசிக்கவும். இங்கு வழங்கல் வோல்ற்றளவு அல்ல, மின்னோட்டமும் நேரமும் மாறாதவை. ஒரே மாதிரியான மூன்று தொடர் சுருள்களின் தடை 3R; அதே மின்னோட்டத்தில் மூன்று மடங்கு வெப்பம் உண்டாகும். ஒரே நீர்த் திணிவுக்கும் வெப்பக் கொள்ளளவுக்கும், வெப்ப இழப்பின்றி உயர்வு மூன்று மடங்கு.'),
  ('At fixed voltage, power is V²/R instead. Changing the fixed quantity changes the comparison.', 'மாறா வோல்ற்றளவில் வலு V²/R. மாறாமல் வைத்த அளவு மாறினால் ஒப்பீடும் மாறும்.'),
  ('At fixed current and time, resistance doubles. What happens to heat produced?', 'மாறா மின்னோட்டத்திலும் நேரத்திலும் தடை இரட்டிப்பாகிறது. உண்டாகும் வெப்பம் என்ன ஆகும்?'),
  ('It doubles because Q is proportional to R under these conditions.', 'இந்நிபந்தனைகளில் Q, R க்கு நேர்விகிதமானதால் இரட்டிப்பாகும்.')),
 'waves': (
  ('Wave classification compares particle motion with wave travel direction.', 'அலை வகைப்பாடு துணிக்கை இயக்கத்தையும் அலை பயணத் திசையையும் ஒப்பிடுகிறது.'),
  ('Watch one particle rather than following the wave crest. In the school surface-ripple model it moves up and down as the disturbance travels horizontally, so the motions are perpendicular. A wave transports energy while particles oscillate near their positions; real water-wave particle paths need a more detailed model.', 'அலை முகட்டைப் பின்தொடராமல் ஒரு துணிக்கையைப் பார்க்கவும். பாடசாலை மேற்பரப்பு அலை மாதிரியில் அலை கிடையாகச் செல்ல, துணிக்கை மேலும் கீழும் இயங்கும்; திசைகள் செங்குத்தானவை. அலை சக்தியைக் காவுகிறது; துணிக்கைகள் தம் இடங்களருகில் அலைகின்றன. உண்மையான நீர் அலைப் பாதைகள் மேலும் சிக்கலானவை.'),
  ('A moving crest does not mean the same water particle travels across the pond.', 'முகடு நகர்வதால் அதே நீர்த் துணிக்கை குளத்தின் குறுக்கே பயணிக்கிறது என்று கருத வேண்டாம்.'),
  ('Particles oscillate parallel to the direction of a sound wave. Classify it.', 'ஒலி அலையின் திசைக்கு சமாந்தரமாக துணிக்கைகள் அலைகின்றன. வகைப்படுத்துக.'),
  ('Longitudinal, because particle motion is parallel to propagation.', 'நெட்டாங்கு அலை; துணிக்கை இயக்கம் அலை பரவலுக்கு சமாந்தரமானது.')),
 'buoyancy': (
  ('Upthrust equals the weight of displaced liquid; floating equilibrium requires U = mg.', 'மேலுதைப்பு இடம்பெயர்ந்த திரவத்தின் நிறைக்குச் சமம்; மிதக்கும் சமநிலையில் U = mg.'),
  ('Separate mass from weight. A floating object at rest has no vertical acceleration, so upward upthrust balances downward weight. The hollow ship displaces enough water before sinking completely. Compare the average density of the whole ship, including enclosed air, with water—not only the density of iron.', 'திணிவையும் நிறையையும் வேறுபடுத்தவும். ஓய்வில் மிதக்கும் பொருளுக்கு செங்குத்து ஆர்முடுகல் இல்லை; மேலுதைப்பு கீழ்நோக்கிய நிறையைச் சமப்படுத்தும். குழிவான கப்பல் முழுவதும் மூழ்குமுன் போதிய நீரை இடம்பெயர்க்கும். இரும்பின் அடர்த்தியை மட்டும் அல்ல, வளியுடன் முழுக் கப்பலின் சராசரி அடர்த்தியை நீருடன் ஒப்பிடவும்.'),
  ('Upthrust is a force in newtons, not a mass in kilograms.', 'மேலுதைப்பு நியூற்றனில் உள்ள விசை; கிலோகிராமிலுள்ள திணிவு அல்ல.'),
  ('A 200 kg raft floats at rest. With g = 10 N kg⁻¹, find upthrust.', '200 kg தெப்பம் ஓய்வில் மிதக்கிறது. g = 10 N kg⁻¹ எனில் மேலுதைப்பைக் காண்க.'),
  ('U = mg = 200 × 10 = 2000 N upward.', 'U = mg = 200 × 10 = 2000 N மேல்நோக்கி.')),
 'gas': (
  ('Charles’s law: V/T is constant at fixed pressure and fixed gas amount.', 'சாள்ஸ் விதி: மாறா அமுக்கத்திலும் வாயு அளவிலும் V/T மாறாதது.'),
  ('Cooling reduces average molecular motion. With approximately constant outside pressure, the flexible balloon contracts until its pressure matches the surroundings. Use absolute temperature for ratios: V₂/V₁ = T₂/T₁. The ideal graph of volume against kelvin is straight through the origin; this extrapolation is a model, not a claim that real gas stays gaseous down to 0 K.', 'குளிர்வித்தல் சராசரி மூலக்கூற்று இயக்கத்தைக் குறைக்கிறது. வெளியமுக்கம் ஏறத்தாழ மாறாதபோது பலூன் அதன் அமுக்கம் சூழலுடன் பொருந்தும் வரை சுருங்கும். விகிதங்களுக்கு தனி வெப்பநிலையைப் பயன்படுத்தவும்: V₂/V₁ = T₂/T₁. கெல்வினுடன் கனவளவு வரைபு ஆதியூடான நேர்கோடு; உண்மையான வாயு 0 K வரை வாயுவாக இருக்கும் என்ற பொருள் அல்ல.'),
  ('Do not calculate volume ratios using Celsius, or apply Boyle’s law when temperature changes.', 'செல்சியஸில் கனவளவு விகிதம் கணிக்க வேண்டாம்; வெப்பநிலை மாறும்போது பொயில் விதியைப் பயன்படுத்த வேண்டாம்.'),
  ('At constant pressure, 2 L of gas at 300 K is cooled to 270 K. Find its volume.', 'மாறா அமுக்கத்தில் 300 K இல் 2 L வாயு 270 K ஆகக் குளிர்விக்கப்படுகிறது. கனவளவைக் காண்க.'),
  ('V₂ = 2 × 270/300 = 1.8 L, for a fixed gas amount in the ideal model.', 'மாறா வாயு அளவுள்ள இலட்சிய மாதிரியில் V₂ = 2 × 270/300 = 1.8 L.')),
 'moment': (
  ('Turning moment = force × perpendicular distance from pivot.', 'திருப்புத் திறன் = விசை × ஆதாரத்திலிருந்து செங்குத்துத் தூரம்.'),
  ('The hinge is the pivot. For a perpendicular push of fixed size, increasing the distance from the hinge increases the moment. This explains why the handle is near the outer edge. Compare turning effect, not just force size; a large force close to the hinge can still give a small moment.', 'கீல் ஆதாரம். ஒரே செங்குத்து விசைக்கு கீலிலிருந்து தூரம் அதிகரித்தால் திருப்புத் திறன் அதிகரிக்கும். அதனால் கைப்பிடி வெளி விளிம்பருகில் இருக்கும். விசை அளவை மட்டும் அல்ல, திருப்புத் திறனை ஒப்பிடவும்; கீலருகிலுள்ள பெரிய விசையும் சிறிய திறனைத் தரலாம்.'),
  ('Use the perpendicular distance to the force’s line of action, not any convenient length.', 'விசையின் செயற்கோட்டிற்கான செங்குத்துத் தூரத்தைப் பயன்படுத்தவும்; எந்த நீளத்தையும் அல்ல.'),
  ('A perpendicular force of 10 N acts 0.8 m from a hinge. Find its moment.', 'கீலிலிருந்து 0.8 m இல் 10 N செங்குத்து விசை தாக்குகிறது. திருப்புத் திறனைக் காண்க.'),
  ('Moment = 10 × 0.8 = 8 N m.', 'திருப்புத் திறன் = 10 × 0.8 = 8 N m.')),
 'magnetic': (
  ('An electric current produces a magnetic field around a conductor.', 'மின்னோட்டம் கடத்தியின் சுற்றில் காந்தப் புலத்தை உருவாக்குகிறது.'),
  ('Around a straight current-carrying wire, field lines form circles. Point the right thumb in the direction of conventional current; curled fingers show the field direction. Reversing current reverses that direction. This links electricity and magnetism rather than requiring a permanent magnet next to the wire.', 'நேரான மின்னோட்டக் கம்பியைச் சுற்றிய புலக் கோடுகள் வட்டமானவை. வலது பெருவிரலை வழக்கமான மின்னோட்டத் திசையில் காட்டினால் மடங்கிய விரல்கள் புலத் திசையைக் காட்டும். மின்னோட்டம் மாறினால் புலத் திசையும் மாறும். அருகில் நிரந்தரக் காந்தம் தேவையில்லை.'),
  ('The thumb shows conventional current, not electron-flow direction.', 'பெருவிரல் வழக்கமான மின்னோட்டத்தைக் காட்டும்; இலத்திரன் ஓட்டத் திசையை அல்ல.'),
  ('What happens to the field direction when current in a straight wire reverses?', 'நேரான கம்பியில் மின்னோட்டம் எதிர்த்திசையானால் புலத் திசை என்ன ஆகும்?'),
  ('The magnetic field circles in the opposite direction.', 'காந்தப் புலம் எதிர்த்திசையில் சுற்றும்.')),
 'lightdevice': (
  ('A light-sensitive semiconductor changes its electrical behaviour under illumination.', 'ஒளி உணரும் அரைக்கடத்தியின் மின் நடத்தை ஒளியில் மாறும்.'),
  ('Connect the device’s purpose to its physical effect: a photocopier must distinguish light and dark areas, so its sensitive surface responds electrically to light. In the historical material question, CdS/CdSe refer to photoconductive compounds; that does not mean all modern photodiodes use those compounds.', 'கருவியின் நோக்கத்தையும் இயற்பியல் விளைவையும் இணைக்கவும். நகலாக்கி ஒளி, இருள் பகுதிகளை வேறுபடுத்த வேண்டும்; அதன் உணரும் மேற்பரப்பு ஒளிக்கு மின்சாரமாகப் பதிலளிக்கிறது. பழைய பொருள் வினாவில் CdS/CdSe ஒளிக்கடத்தல் சேர்வைகள்; எல்லா நவீன ஒளியிருமுனையங்களும் அவற்றைப் பயன்படுத்துகின்றன என்று பொருள் அல்ல.'),
  ('Do not confuse a light detector with an LED, which emits light.', 'ஒளி உணரியை ஒளி வெளியிடும் LED உடன் குழப்ப வேண்டாம்.'),
  ('For a typical light-dependent resistor, what happens to resistance when light intensity increases?', 'ஒரு வழக்கமான ஒளி உணரும் தடையில் ஒளிச் செறிவு அதிகரித்தால் தடை என்ன ஆகும்?'),
  ('Resistance decreases as more charge carriers become available.', 'மேலும் ஏற்றக் காவிகள் கிடைப்பதால் தடை குறையும்.')),
 'absorption': (
  ('Soft surfaces absorb some sound energy and reduce reflected sound.', 'மென்மையான மேற்பரப்புகள் ஒலிச் சக்தியின் ஒரு பகுதியை உறிஞ்சி தெறித்த ஒலியைக் குறைக்கின்றன.'),
  ('Hard walls repeatedly reflect sound. Thick curtains absorb part of the incident sound, leaving less energy for later reflections. The room therefore has less reverberation and speech is easier to distinguish. Curtains do not stop all sound or change the source’s frequency.', 'கடினச் சுவர்கள் ஒலியை மீண்டும் தெறிக்கின்றன. தடித்த திரைகள் வரும் ஒலியின் பகுதியை உறிஞ்சுவதால் பின்னைய தெறிப்புகளுக்கு சக்தி குறையும். இதனால் மீளொலி குறைந்து பேச்சைத் தெளிவாகக் கேட்கலாம். திரைகள் எல்லா ஒலியையும் நிறுத்துவதில்லை; மூலத்தின் மீடிறனையும் மாற்றுவதில்லை.'),
  ('Reducing reverberation is not the same as lowering the original sound’s pitch.', 'மீளொலியைக் குறைப்பது மூல ஒலியின் சுருதியைக் குறைப்பதற்கு சமமல்ல.'),
  ('Why does an empty hall usually sound more echoing than a furnished hall?', 'ஏன் வெற்று மண்டபத்தில் பொருட்கள் உள்ள மண்டபத்தைவிட எதிரொலி அதிகம்?'),
  ('More exposed hard surfaces reflect sound; furnishings absorb some of that energy.', 'வெளிப்படும் கடினப் பரப்புகள் ஒலியைத் தெறிக்கும்; பொருட்கள் அதன் சக்தியின் ஒரு பகுதியை உறிஞ்சும்.')),
 'lenses': (
  ('A convex lens converges light; a microscope uses an objective and an eyepiece.', 'குவிவு வில்லை ஒளியைக் குவிக்கும்; நுணுக்குக்காட்டி பொருள்வில்லையையும் பார்வைவில்லையையும் பயன்படுத்தும்.'),
  ('Identify a lens by its position and job. The objective is close to the specimen and forms an enlarged intermediate image. The eyepiece is close to the eye and magnifies that image. In a detector, a converging lens instead concentrates incoming light on the sensitive region; it does not generate extra light energy.', 'வில்லையின் இடத்தையும் செயலையும் கொண்டு அடையாளம் காணவும். பொருள்வில்லை மாதிரிக்கு அருகில் பெரிதாக்கிய இடை விம்பத்தை உருவாக்கும். பார்வைவில்லை கண்ணருகில் அவ்விம்பத்தைப் பெரிதாக்கும். உணரியில் குவிக்கும் வில்லை வரும் ஒளியை உணரும் பகுதியில் குவிக்கும்; மேலதிக ஒளிச் சக்தியை உருவாக்குவதில்லை.'),
  ('Objective and eyepiece names refer to their positions, not interchangeable parts.', 'பொருள்வில்லை, பார்வைவில்லை பெயர்கள் அவற்றின் இடங்களைக் குறிக்கும்; மாற்றிப் பயன்படுத்த வேண்டாம்.'),
  ('Which microscope lens is nearest the specimen?', 'நுணுக்குக்காட்டியில் மாதிரிக்கு மிக அருகிலுள்ள வில்லை எது?'),
  ('The objective lens.', 'பொருள்வில்லை.')),
 'forces': (
  ('The resultant is the signed sum of forces in a chosen direction.', 'தேர்ந்த திசையிலுள்ள விசைகளின் குறியுடன் கூட்டுத்தொகை விளையுள் விசை.'),
  ('Take the push direction as positive. Friction opposes the motion, so give it the opposite sign and subtract its magnitude. The positive remainder points with the push. Do not calculate acceleration unless mass is known; force alone does not tell you the acceleration value.', 'தள்ளும் திசையை நேர்த் திசையாக எடுக்கவும். உராய்வு இயக்கத்தை எதிர்ப்பதால் எதிர்க் குறியிட்டு அதன் பருமனைக் கழிக்கவும். நேரான மீதி தள்ளும் திசையிலிருக்கும். திணிவு தெரியாமல் ஆர்முடுகலைக் கணிக்க வேண்டாம்; விசை மட்டும் அதன் மதிப்பைத் தராது.'),
  ('Opposite forces subtract; they are not added as if they acted together.', 'எதிர் விசைகள் கழிக்கப்படும்; ஒரே திசை விசைகள் போலக் கூட்ட வேண்டாம்.'),
  ('A 50 N push acts against 30 N friction. Find the resultant.', '50 N தள்ளுவிசைக்கு எதிராக 30 N உராய்வு உள்ளது. விளையுள் விசையைக் காண்க.'),
  ('20 N in the direction of the push.', 'தள்ளும் திசையில் 20 N.')),
 'ohm': (
  ('Ohm’s law relates V and I for a conductor at constant temperature.', 'மாறா வெப்பநிலையில் கடத்தியின் V, I ஐ ஓம் விதி தொடர்புபடுத்துகிறது.'),
  ('An ammeter must carry the same current as the test resistor, so connect it in series. A voltmeter measures the difference between the resistor’s ends, so connect it in parallel. The rheostat changes current for different readings. Open the switch between readings to reduce heating; a temperature change can change resistance and spoil the comparison.', 'அம்மீற்றர் சோதனைத் தடையின் அதே மின்னோட்டத்தை அளக்கத் தொடரில் இணைக்கப்படும். வோல்ற்மீற்றர் இரு முனைகளின் வேறுபாட்டை அளக்கச் சமாந்தரமாக இணைக்கப்படும். மாறுதடை வாசிப்புகளுக்கு மின்னோட்டத்தை மாற்றும். சூடாதிருக்க இடையில் ஆளியைத் திறக்கவும்; வெப்பநிலை மாற்றம் தடையையும் ஒப்பீட்டையும் மாற்றலாம்.'),
  ('Never show the ammeter in parallel across the supply in your circuit drawing.', 'மின்சுற்றுப் படத்தில் அம்மீற்றரை வழங்கலுக்குச் சமாந்தரமாகக் காட்ட வேண்டாம்.'),
  ('A resistor has 6 V across it and carries 0.5 A. Find resistance.', 'ஒரு தடையின் வோல்ற்றளவு 6 V; மின்னோட்டம் 0.5 A. தடையைக் காண்க.'),
  ('R = V/I = 6/0.5 = 12 Ω.', 'R = V/I = 6/0.5 = 12 Ω.')),
 'signals': (
  ('Communication requires sending and receiving signals.', 'தொடர்பாடலுக்கு சமிக்ஞைகளை அனுப்புதலும் பெறுதலும் தேவை.'),
  ('A phone converts information into a signal for transmission and converts a received signal back into usable information. Therefore distinguish the transmitter function from the receiver function. The microphone and speaker are related input/output devices, but the question asks for the main signal circuits.', 'தொலைபேசி தகவலை அனுப்புவதற்குச் சமிக்ஞையாக மாற்றி, பெறப்பட்ட சமிக்ஞையைத் தகவலாக மாற்றுகிறது. அனுப்பும் செயலையும் பெறும் செயலையும் வேறுபடுத்தவும். ஒலிவாங்கி, ஒலிபெருக்கி உள்ளீட்டு/வெளியீட்டுக் கருவிகள்; வினா முக்கிய சமிக்ஞைச் சுற்றுகளைக் கேட்கிறது.'),
  ('Name circuit functions rather than substituting microphone and speaker.', 'ஒலிவாங்கி, ஒலிபெருக்கி என்பதற்குப் பதில் சுற்றின் செயல்களைப் பெயரிடவும்.'),
  ('Which circuit function handles an incoming communication signal?', 'வரும் தொடர்பாடல் சமிக்ஞையைக் கையாளும் சுற்றுச் செயல் எது?'),
  ('The receiver.', 'பெறுநர்.')),
 'or': (
  ('An OR gate outputs 1 when at least one input is 1.', 'OR வாயில் குறைந்தது ஓர் உள்ளீடு 1 ஆக இருந்தால் வெளியீடு 1.'),
  ('Check all four input combinations, including both inputs high. Only 00 produces 0. The word “or” here is inclusive: both inputs being high also gives a high output. Label both inputs and the output on the symbol so the truth table and diagram describe the same function.', 'இரு உள்ளீடுகளும் 1 ஆகும் நிலையுட்பட நான்கு நிலைகளையும் சோதிக்கவும். 00 மட்டுமே 0 ஐத் தரும். இங்கு “அல்லது” என்பது இரண்டும் உள்ள நிலையை உள்ளடக்கும். வாயில் படத்தில் இரு உள்ளீடுகளையும் வெளியீட்டையும் பெயரிடவும்.'),
  ('OR is not XOR: OR gives 1 for inputs 11.', 'OR, XOR அல்ல: OR இல் 11 உள்ளீட்டிற்கு வெளியீடு 1.'),
  ('What are the OR-gate outputs for inputs 00 and 11?', 'OR வாயிலில் 00, 11 உள்ளீடுகளின் வெளியீடுகள் என்ன?'),
  ('0 and 1 respectively.', 'முறையே 0, 1.')),
 'xray': (
  ('Different X-ray absorption creates image contrast.', 'வேறுபட்ட X-கதிர் உறிஞ்சல் விம்ப வேறுபாட்டை உருவாக்குகிறது.'),
  ('Penetration allows some X-rays to pass through tissue to a detector. Different tissues absorb different amounts, so fewer rays reach the detector behind more strongly absorbing regions. That difference creates contrast; simply saying “X-rays pass through everything” misses the imaging mechanism.', 'ஊடுருவல் சில X-கதிர்களை இழையூடாக உணரியை அடைய விடுகிறது. வெவ்வேறு இழையங்கள் வேறுபட்ட அளவில் உறிஞ்சுவதால் அதிகம் உறிஞ்சும் பகுதிகளுக்குப் பின்னால் குறைவான கதிர்கள் அடையும். இவ்வேறுபாடே விம்ப வேறுபாட்டை உருவாக்கும்; எல்லாவற்றையும் ஊடுருவும் என்று மட்டும் எழுதுவது போதாது.'),
  ('X-rays are electromagnetic waves; they do not need air to travel.', 'X-கதிர்கள் மின்காந்த அலைகள்; பரவ வளி தேவையில்லை.'),
  ('Why does stronger absorption in one tissue help reveal it on an X-ray image?', 'ஒரு இழையத்தின் அதிக உறிஞ்சல் அதை X-கதிர் விம்பத்தில் காட்ட எவ்வாறு உதவும்?'),
  ('It changes the amount reaching the detector compared with surrounding tissues, producing contrast.', 'சுற்றியுள்ள இழையங்களுடன் ஒப்பிடும்போது உணரியை அடையும் அளவை மாற்றி விம்ப வேறுபாட்டை உருவாக்கும்.')),
 'timbre': (
  ('Timbre depends on waveform and frequency mixture.', 'ஒலித் தரம் அலைவடிவத்தையும் மீடிறன் கலவையையும் சாரும்.'),
  ('Pitch mainly relates to frequency and loudness mainly to amplitude. Two sources can have similar pitch and loudness yet still sound different because their waveforms contain different harmonics. That distinctive quality is timbre; identify the characteristic actually asked for rather than listing every sound property.', 'சுருதி முக்கியமாக மீடிறனையும் உரப்பு வீச்சையும் சாரும். ஒரே சுருதியும் உரப்புமுள்ள இரு மூலங்களின் இசையன்கள் வேறுபடுவதால் வேறுபட்ட ஒலியாகக் கேட்கலாம். இத்தனித்த தரமே ஒலித் தரம்; எல்லா பண்புகளையும் பட்டியலிடாமல் கேட்ட பண்பைத் தேர்க.'),
  ('Do not use loudness or pitch as synonyms for timbre.', 'உரப்பையும் சுருதியையும் ஒலித் தரத்திற்கு மாற்றுப் பெயர்களாகப் பயன்படுத்த வேண்டாம்.'),
  ('Why can a violin and flute playing the same note still be distinguished?', 'ஒரே சுரத்தை வாசிக்கும் வயலினையும் புல்லாங்குழலையும் ஏன் வேறுபடுத்தலாம்?'),
  ('Their waveforms and harmonic mixtures give different timbres.', 'அலைவடிவங்களும் இசையன் கலவைகளும் வேறுபட்ட ஒலித் தரங்களைத் தருகின்றன.')),
 'frequency': (
  ('Wave speed, frequency and wavelength satisfy v = fλ.', 'அலை வேகம், மீடிறன், அலைநீளம் v = fλ ஐ நிறைவேற்றுகின்றன.'),
  ('Frequency counts waves per second, while wavelength measures the length of one wave. Each second the wave travels f wavelengths, giving v = fλ. Divide speed by wavelength when frequency is required. With metres and seconds, the result has units s⁻¹, written Hz.', 'மீடிறன் வினாடிக்கான அலை எண்ணிக்கை; அலைநீளம் ஓர் அலையின் நீளம். ஒவ்வொரு வினாடியிலும் f அலைநீளங்கள் பயணிப்பதால் v = fλ. மீடிறனைக் காண வேகத்தை அலைநீளத்தால் வகுக்கவும். m, s அலகுகளில் விடை s⁻¹ அல்லது Hz.'),
  ('Do not multiply speed by wavelength when finding frequency.', 'மீடிறனைக் காணும்போது வேகத்தை அலைநீளத்தால் பெருக்க வேண்டாம்.'),
  ('Find frequency for v = 340 m s⁻¹ and λ = 0.68 m.', 'v = 340 m s⁻¹, λ = 0.68 m எனில் மீடிறனைக் காண்க.'),
  ('f = 340/0.68 = 500 Hz.', 'f = 340/0.68 = 500 Hz.')),
 'mirror': (
  ('A plane mirror produces lateral inversion.', 'தள ஆடி இடவல மாற்றத்தை உருவாக்குகிறது.'),
  ('The observer sees the ambulance front through a rear-view mirror. Reversing the word on the vehicle compensates for the mirror’s apparent left-right reversal, making it readable. A plane-mirror image is upright, virtual and the same size; lateral inversion does not mean the image is upside down.', 'பார்ப்பவர் பின்பார்வை ஆடியில் அம்புலன்ஸின் முன்பகுதியைப் பார்க்கிறார். வாகனத்தில் சொல்லை மாற்றி எழுதுவது ஆடியின் இடவல மாற்றத்தை ஈடுசெய்து வாசிக்க உதவும். தள ஆடி விம்பம் நிமிர்ந்த, மாயமான, ஒரே அளவானது; இடவல மாற்றம் தலைகீழ் மாற்றமல்ல.'),
  ('State lateral inversion, not a change in letter size or upside-down inversion.', 'எழுத்தின் அளவு மாற்றம் அல்லது தலைகீழ் மாற்றம் அல்ல, இடவல மாற்றம் எனக் கூறவும்.'),
  ('Is a plane-mirror image larger than its object?', 'தள ஆடி விம்பம் பொருளைவிடப் பெரிதா?'),
  ('No; it is the same size.', 'இல்லை; அதே அளவு.')),
 'graph': (
  ('On a velocity–time graph, height gives velocity, slope gives acceleration, area gives displacement.', 'வேகம்–நேர வரைபில் உயரம் வேகம்; சரிவு ஆர்முடுகல்; பரப்பளவு இடப்பெயர்ச்சி.'),
  ('Read axis units first. A horizontal segment means constant velocity, and its duration is ending time minus starting time. Split the area into triangles and a rectangle, then add their areas. Here velocity is nonnegative throughout, so displacement and distance have the same magnitude; that is not true for every velocity graph.', 'முதலில் அச்சு அலகுகளை வாசிக்கவும். கிடைப் பகுதி மாறா வேகம்; காலம் இறுதி நேரம் கழித்தல் ஆரம்ப நேரம். பரப்பை முக்கோணங்களாகவும் செவ்வகமாகவும் பிரித்துக் கூட்டவும். இங்கு வேகம் முழுவதும் மறையல்லாததால் இடப்பெயர்ச்சியும் தூரமும் ஒரே பருமன்; எல்லா வரைபுகளிலும் அல்ல.'),
  ('Do not confuse slope with distance, or a duration with an absolute time-coordinate.', 'சரிவைத் தூரத்துடனும் கால இடைவெளியை நேர ஆயத்துடனும் குழப்ப வேண்டாம்.'),
  ('Velocity rises uniformly from 0 to 20 m s⁻¹ in 10 s. Find distance during this interval.', 'வேகம் 10 s இல் சீராக 0 இலிருந்து 20 m s⁻¹ ஆகிறது. இக்காலத் தூரத்தைக் காண்க.'),
  ('Triangle area = ½ × 10 × 20 = 100 m.', 'முக்கோணப் பரப்பு = ½ × 10 × 20 = 100 m.')),
 'safety': (
  ('Excess current produces heating; a fuse interrupts the circuit.', 'அதிக மின்னோட்டம் வெப்பத்தை உருவாக்கும்; உருகி சுற்றைத் துண்டிக்கும்.'),
  ('The protective fuse is in series so the protected circuit’s current passes through it. Excess current heats the fuse wire until it melts, opening that path. A correctly rated device matters: an oversized fuse may not interrupt current before the wiring overheats. This is a protection principle, not an instruction to repair mains equipment.', 'பாதுகாப்பு உருகி தொடரிலிருப்பதால் சுற்றின் மின்னோட்டம் அதனூடாகச் செல்லும். அதிக மின்னோட்டம் உருகிக் கம்பியைச் சூடாக்கி உருக்குவதால் பாதை திறக்கும். சரியான அளவீடு முக்கியம்; மிகப்பெரிய உருகி கம்பி சூடாகுமுன் துண்டிக்காமல் இருக்கலாம். இது பாதுகாப்புக் கொள்கை; வழங்கல் கருவிகளைப் பழுதுபார்க்கும் அறிவுறுத்தல் அல்ல.'),
  ('A fuse in parallel would not interrupt the protected current path.', 'சமாந்தர உருகி பாதுகாக்கும் மின்னோட்டப் பாதையைத் துண்டிக்காது.'),
  ('Why must a fuse be in series with the circuit it protects?', 'உருகி பாதுகாக்கும் சுற்றுடன் ஏன் தொடரில் இருக்க வேண்டும்?'),
  ('Melting the fuse then opens the same current path and stops current.', 'உருகும்போது அதே மின்னோட்டப் பாதை திறந்து மின்னோட்டம் நிற்கும்.')),
 'radiation': (
  ('Thermal radiation carries energy by electromagnetic waves.', 'வெப்பக் கதிர்வீசல் மின்காந்த அலைகளால் சக்தியைக் காவுகிறது.'),
  ('Conduction transfers energy through material interactions and convection involves moving fluid. Neither explains transfer across the largely empty space from Sun to Earth. Electromagnetic radiation needs no material medium. Surface colour affects absorption: under equal conditions, a black tank absorbs more sunlight than a white one.', 'கடத்தல் பொருளின் இடைவினைகளால் சக்தியை மாற்றும்; காவுகை பாய்ம இயக்கத்தை உடையது. சூரியன்–புவி இடையிலுள்ள பெரும்பாலும் வெற்றிடப் பரிமாற்றத்தை இவை விளக்காது. மின்காந்தக் கதிர்வீசலுக்கு ஊடகம் தேவையில்லை. ஒரே நிபந்தனைகளில் கருப்புத் தொட்டி வெள்ளையைவிட அதிக சூரிய ஒளியை உறிஞ்சும்.'),
  ('Compare surfaces with the same conditions; colour alone cannot predict every real tank’s temperature.', 'ஒரே நிபந்தனைகளில் பரப்புகளை ஒப்பிடவும்; நிறம் மட்டும் எல்லா உண்மைத் தொட்டிகளின் வெப்பநிலையையும் நிர்ணயிக்காது.'),
  ('Which heat-transfer process can carry solar energy through a vacuum?', 'வெற்றிடத்தினூடாகச் சூரிய சக்தியைக் காவும் வெப்பப் பரிமாற்ற முறை எது?'),
  ('Radiation.', 'கதிர்வீசல்.')),
 'mirage': (
  ('A temperature gradient in air changes its refractive index.', 'வளியின் வெப்பநிலைச் சரிவு அதன் முறிவுச் சுட்டியை மாற்றுகிறது.'),
  ('The road heats the air near it, giving that air a lower refractive index than cooler air above. Rays from the sky bend through these layers and can reach the eye from below. The eye traces them back as if they travelled straight, producing an apparent sky image near the road. The school model describes this using refraction and total internal reflection.', 'வீதி அருகிலுள்ள வளியைச் சூடாக்குவதால் அதன் முறிவுச் சுட்டி மேலுள்ள குளிர் வளியைவிடக் குறையும். வானிலிருந்து வரும் கதிர்கள் அடுக்குகளில் வளைந்து கீழிருந்து கண்ணை அடையலாம். கண் அவற்றை நேராக வந்ததாகப் பின்னோக்கிப் பார்ப்பதால் வீதியருகில் வானின் தோற்ற விம்பம் உருவாகும். பாடசாலை மாதிரி முறிவையும் முழு அகத்தெறிப்பையும் பயன்படுத்தும்.'),
  ('The apparent water is an optical image, not water created by the hot road.', 'தோன்றும் நீர் ஒளியியல் விம்பம்; சூடான வீதி உருவாக்கிய நீர் அல்ல.'),
  ('What supplies the bright image that looks like water in a road mirage?', 'வீதி கானலில் நீர் போலத் தோன்றும் பிரகாசமான விம்பத்தின் மூலம் எது?'),
  ('Light from the sky redirected through the air layers.', 'வளி அடுக்குகளூடாகத் திசை மாற்றப்படும் வானிலிருந்து வரும் ஒளி.')),
 'heatcapacity': (
  ('Heating without a phase change uses Q = mcΔT.', 'நிலை மாற்றமற்ற வெப்பமாக்கலுக்கு Q = mcΔT.'),
  ('Specific heat capacity gives energy per kilogram per degree of temperature rise. Multiply by the sheet’s mass and its temperature rise to obtain energy for one sheet. For identical sheets experiencing the same rise, multiply that energy by their number. Use ΔT, not the final temperature; a 5°C rise equals 5 K.', 'தன்வெப்பக் கொள்ளளவு ஒரு கிலோகிராமின் ஒரு பாகை உயர்வுக்கான சக்தி. தகட்டின் திணிவாலும் வெப்பநிலை உயர்வாலும் பெருக்கினால் ஒரு தகட்டின் சக்தி கிடைக்கும். ஒரே உயர்வுள்ள ஒரே மாதிரியான தகடுகளுக்கு எண்ணிக்கையால் பெருக்கவும். இறுதி வெப்பநிலையை அல்ல ΔT ஐப் பயன்படுத்தவும்; 5°C உயர்வு 5 K.'),
  ('Do not add 273 to a temperature rise or confuse energy (J) with power (W).', 'வெப்பநிலை உயர்விற்கு 273 சேர்க்க வேண்டாம்; சக்தி (J), வலு (W) ஆகியவற்றைக் குழப்ப வேண்டாம்.'),
  ('Heat 2 kg of material with c = 500 J kg⁻¹ K⁻¹ by 4°C. Find energy.', 'c = 500 J kg⁻¹ K⁻¹ உள்ள 2 kg பொருளை 4°C உயர்த்தும் சக்தியைக் காண்க.'),
  ('Q = 2 × 500 × 4 = 4000 J.', 'Q = 2 × 500 × 4 = 4000 J.')),
 'power': (
  ('Power is energy per time, so E = Pt.', 'வலு நேரத்திற்கான சக்தி; எனவே E = Pt.'),
  ('Choose a consistent unit system before multiplying. Kilowatts times hours gives kWh; watts times seconds gives joules. Half an hour is 0.5 h or 1800 s. One kWh is 1000 W × 3600 s = 3,600,000 J. Power tells how quickly energy is used, not the total energy without a duration.', 'பெருக்குமுன் ஒத்த அலகுத் தொகுதியைத் தேர்க. kW × h கொடுத்தால் kWh; W × s கொடுத்தால் J. அரை மணி 0.5 h அல்லது 1800 s. ஒரு kWh = 1000 W × 3600 s = 3,600,000 J. வலு சக்திப் பயன்பாட்டு வீதம்; நேரமின்றி மொத்த சக்தியைத் தராது.'),
  ('kW measures power; kWh measures energy. They are not interchangeable.', 'kW வலுவின் அலகு; kWh சக்தியின் அலகு. அவற்றை மாற்றிப் பயன்படுத்த வேண்டாம்.'),
  ('A 200 W device runs for 2 h. Find energy in kWh.', '200 W கருவி 2 h இயங்குகிறது. சக்தியை kWh இல் காண்க.'),
  ('200 W = 0.2 kW; E = 0.2 × 2 = 0.4 kWh.', '200 W = 0.2 kW; E = 0.2 × 2 = 0.4 kWh.')),
 'photodiode': (
  ('A photodiode detects incident light; symbol arrows point inward.', 'ஒளியிருமுனையம் வரும் ஒளியை உணரும்; குறியீட்டு அம்புகள் உள்ளே காட்டும்.'),
  ('Draw the diode symbol, identify the cathode by its bar, and add incoming-light arrows. Terminal names stay anode and cathode even when applied voltage reverses. A working photodiode is commonly reverse-biased: cathode to positive, anode to negative. Distinguish terminal identification from the voltage polarity in a particular operating circuit.', 'இருமுனையக் குறியை வரைந்து கோட்டால் எதிர்மின்வாயை அடையாளம் கண்டு உள்ளே வரும் ஒளி அம்புகளைச் சேர்க்கவும். கொடுக்கப்படும் வோல்ற்றளவு மாறினாலும் முனைப் பெயர்கள் மாறாது. வழக்கமாக ஒளியிருமுனையம் எதிர்ச் சார்பில் இயங்கும்: எதிர்மின்வாய் நேர் வழங்கலுக்கும் நேர்மின்வாய் மறை வழங்கலுக்கும். முனை அடையாளத்தையும் செயற்பாட்டு முனைவையும் வேறுபடுத்தவும்.'),
  ('Outward arrows indicate light emission, as in an LED, not detection.', 'வெளிநோக்கிய அம்புகள் LED போல ஒளி வெளியீட்டைக் குறிக்கும்; உணர்தலை அல்ல.'),
  ('Which way do the light arrows point on a photodiode symbol?', 'ஒளியிருமுனையக் குறியில் ஒளி அம்புகள் எத்திசையில் காட்டும்?'),
  ('Towards the diode, representing incoming light.', 'வரும் ஒளியைக் குறிக்கும் வகையில் இருமுனையத்தை நோக்கி.')),
}

MCQ_GUIDES = {5:'diffusion',9:'eye',25:'kelvin',26:'doping',27:'refraction',28:'pins',29:'density',30:'potential',31:'pressure',32:'motion',33:'machines',34:'circuit',35:'sounddistance',36:'heating'}
WRITTEN_GUIDES = {
 1:{'iv':'waves','v(a)':'buoyancy','v(b)':'buoyancy'},
 3:{'C(i)':'gas','C(ii)':'gas','C(iii)':'gas'},
 4:{'A(i)':'moment','A(ii)':'magnetic','B(i)':'lightdevice','B(ii)':'absorption','B(iii)(a)':'lenses','B(iii)(b)':'lenses','B(iv)':'forces','B(v)(a)':'ohm','B(v)(b)':'ohm','C(i)':'signals','C(ii)':'or'},
 9:{'i':'xray','ii(a)':'timbre','ii(b)':'frequency','ii(c)':'mirror','iii(a)':'graph','iii(b)':'graph','iii(c)':'graph','iii(d)':'graph','iv(a)':'safety','iv(b)':'safety','v':'safety'},
 10:{'i(a)':'radiation','i(b)':'radiation','ii(a)':'mirage','ii(b)(I)':'heatcapacity','ii(b)(II)':'heatcapacity','ii(c)':'power','ii(d)(I)':'radiation','ii(d)(II)':'radiation','iii(a)':'photodiode','iii(b)':'lightdevice','iii(c)':'lenses'},
}

def enrich(bank):
    index=(ROOT/'site/lessons/index.html').read_text(encoding='utf-8')
    references={}
    for line in index.splitlines():
        match=re.search(r"\{ m:'g(\d+)',\s+n:'(\d+)'.*?file:'([^']+)'.*?en:('(?:[^'\\]|\\.)*'|\"[^\"]*\").*?ta:'([^']*)'",line)
        if match:
            grade,chapter,file,title,tamil=match.groups()
            assert (ROOT/'site/lessons'/file).is_file()
            references[file[:-5]]=dict(kind='lesson',grade=int(grade),chapter=int(chapter),title=bi(title[1:-1],tamil),url='/lessons/'+file,verifiedAgainst='course-index')
    for q in bank['questions']:
        targets=[q] if q['type']=='mcq' else q['parts']
        for item in targets:
            guide=MCQ_GUIDES[q['number']] if q['type']=='mcq' else WRITTEN_GUIDES[q['number']][item['label']]
            concept,reasoning,mistake,question,answer=GUIDES[guide]
            item['detailedExplanation']=dict(concept=bi(*concept),reasoning=bi(*reasoning),commonMistake=bi(*mistake),practice=dict(question=bi(*question),answer=bi(*answer)))
            item['references']=[references[lesson].copy() for lesson in item['lessons']]
    bank['explanationVersion']=1
    from textbook_sources import add_textbook_references
    add_textbook_references(bank,MCQ_GUIDES,WRITTEN_GUIDES)
