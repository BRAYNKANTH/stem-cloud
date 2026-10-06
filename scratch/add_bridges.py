import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

LESSONS_DIR = r"c:\Users\T.BRAYNKANTH\SCIENXE\stem-cloud\site\lessons"

CHAPTER_DATA = {
    'unit-02-motion-in-a-straight-line.html': {
        'quest_en': "In this module: investigate how objects travel along a line, understand distance vs displacement, speed vs velocity, and learn how acceleration is represented on motion graphs.",
        'quest_ta': "இந்த பாடத்தில்: ஒரு நேர்கோட்டில் பொருட்களின் இயக்கம், தூரம் மற்றும் இடப்பெயர்ச்சி, கதி மற்றும் வேகம், ஆர்முடுகல் வரைபடங்களை ஆராய்வோம்.",
        'takeaways': [
            ("Distance & Displacement:", "Distance is total path length; displacement is direct distance in a specific direction.",
             "தூரம் & இடப்பெயர்ச்சி:", "தூரம் என்பது சென்ற மொத்த நீளம்; இடப்பெயர்ச்சி என்பது குறிப்பிட்ட திசையில் உள்ள நேர்கோட்டு தூரம்."),
            ("Velocity & Acceleration:", "Velocity is rate of displacement (v = s/t); acceleration is rate of change of velocity (a = (v - u)/t).",
             "வேகமும் ஆர்முடுகலும்:", "வேகம் என்பது இடப்பெயர்ச்சி வீதம்; ஆர்முடுகல் என்பது வேகம் மாறும் வீதம்."),
            ("Motion Graphs:", "Area under a velocity-time graph gives total displacement; slope gives acceleration.",
             "இயக்க வரைபடங்கள்:", "வேக-நேர வரைபடத்தின் பரப்பளவு இடப்பெயர்ச்சியையும், படித்திறன் ஆர்முடுகலையும் தரும்.")
        ],
        'anchor_en': "In Sector 1, you saw the motion demonstration. Below are the core definitions, displacement-velocity equations, and motion graph rules!",
        'anchor_ta': "பகுதி 1-ல் இயக்கக் காட்சிகளை பார்த்தோம். அதற்கான அதிகாரப்பூர்வ வரைவிலக்கணங்கள், சமன்பாடுகள், வரைபடக் கொள்கைகளை இங்கே கற்போம்!"
    },
    'chapter-05-friction.html': {
        'quest_en': "In this module: explore what causes friction between contacting surfaces, compare static vs dynamic friction, and find out how friction helps us walk and drive.",
        'quest_ta': "இந்த பாடத்தில்: தொடுகை மேற்பரப்புகளுக்கு இடையே உராய்வு எவ்வாறு உருவாகிறது, நிலை மற்றும் இயக்க உராய்வு, அதன் பயன்களை ஆராய்வோம்.",
        'takeaways': [
            ("Origin of Friction:", "Microscopic bumps on touching surfaces interlock, opposing relative motion.",
             "உராய்வின் தோற்றம்:", "தொடுகை மேற்பரப்புகளின் நுண்ணிய மேடு பள்ளங்கள் ஒன்றோடொன்று பிணைந்து இயக்கத்தை எதிர்க்கின்றன."),
            ("Static vs Dynamic:", "Limiting static friction is greater than dynamic friction; once motion starts, friction drops slightly.",
             "நிலை & இயக்க உராய்வு:", "எல்லை நிலை உராய்வு இயக்க உராய்வை விட அதிகம்; இயக்கம் தொடங்கியதும் உராய்வு சற்று குறைகிறது."),
            ("Normal Reaction:", "Frictional force is directly proportional to normal reaction (R), independent of surface area.",
             "செங்குத்து மறுதாக்கம்:", "உராய்வு விசை செங்குத்து மறுதாக்கத்திற்கு நேர்விகிதமானது; தொடுகை பரப்பளவில் தங்கியிருக்காது.")
        ],
        'anchor_en': "In Sector 1, you saw surfaces resisting motion. Below are the official laws of friction, limiting friction formulas, and practical calculations!",
        'anchor_ta': "பகுதி 1-ல் உராய்வின் விளைவை பார்த்தோம். அதற்கான அதிகாரப்பூர்வ உராய்வு விதிகள், சூத்திரங்கள், கணித்தல்களை இங்கே கற்போம்!"
    },
    'chapter-09-resultant-force.html': {
        'quest_en': "In this module: understand how multiple forces acting on an object combine into a single resultant force along a straight line or in parallel.",
        'quest_ta': "இந்த பாடத்தில்: ஒரு பொருள் மீது செயல்படும் பல விசைகள் எவ்வாறு ஒரு விளைவுள் விசையாக இணைகின்றன என்பதை ஆராய்வோம்.",
        'takeaways': [
            ("Collinear Forces:", "Forces in the same direction add up; forces in opposite directions subtract.",
             "ஒரே கோட்டு விசைகள்:", "ஒரே திசை விசைகள் கூடும்; எதிர் திசை விசைகள் கழிக்கப்படும்."),
            ("Parallel Forces:", "Parallel forces acting in the same sense have a resultant equal to their sum, acting between them.",
             "இணை விசைகள்:", "ஒரே திசை இணை விசைகளின் விளைவுள் அவற்றின் கூட்டுத்தொகைக்கு சமன்."),
            ("Equilibrium Condition:", "When the resultant force equals zero, the object remains in equilibrium without linear acceleration.",
             "சமநிலை நிபந்தனை:", "விளைவுள் விசை பூச்சியமாகும் போது பொருள் நேர்கோட்டு ஆர்முடுகலின்றி சமநிலையில் இருக்கும்.")
        ],
        'anchor_en': "In Sector 1, you observed forces pushing together and against each other. Below are the formulas and vector rules for calculating resultant forces!",
        'anchor_ta': "பகுதி 1-ல் பல விசைகளின் போட்டியை பார்த்தோம். அதற்கான விளைவுள் விசை கணித்தல் சூத்திரங்களையும் விதிகளையும் இங்கே கற்போம்!"
    },
    'chapter-11-turning-effect.html': {
        'quest_en': "In this module: learn how forces cause objects to rotate (turning effect / moment), how wrenches and see-saws work, and master the Principle of Moments.",
        'quest_ta': "இந்த பாடத்தில்: விசைகள் பொருட்களை எவ்வாறு சுழற்றுகின்றன (திருப்பம்), நெம்புகோல் தத்துவம் மற்றும் திருப்பங்களின் தத்துவத்தை கற்போம்.",
        'takeaways': [
            ("Moment of a Force:", "Moment = Force × Perpendicular distance from the pivot (M = F × d).",
             "விசையின் திருப்பம்:", "திருப்பம் = விசை × சுழற்சி அச்சிலிருந்து செங்குத்து தூரம் (M = F × d)."),
            ("Direction of Turning:", "Moments are classified into clockwise and anticlockwise directions.",
             "திருப்பத்தின் திசை:", "திருப்பங்கள் வலஞ்சுழி மற்றும் இடஞ்சுழி என வகைப்படுத்தப்படும்."),
            ("Principle of Moments:", "For a balanced body: Total Clockwise Moments = Total Anticlockwise Moments.",
             "திருப்பங்களின் தத்துவம்:", "சமநிலையில் உள்ள ஒரு பொருளுக்கு: வலஞ்சுழி திருப்பங்களின் கூட்டுத்தொகை = இடஞ்சுழி திருப்பங்களின் கூட்டுத்தொகை.")
        ],
        'anchor_en': "In Sector 1, you saw forces turning a lever and see-saw. Below are the moment equations (M = F × d) and textbook equilibrium calculations!",
        'anchor_ta': "பகுதி 1-ல் சுழலும் விசைகளை பார்த்தோம். அதற்கான திருப்ப சமன்பாடுகள் (M = F × d), சமநிலை கணித்தல்களை இங்கே கற்போம்!"
    },
    'chapter-12-equilibrium.html': {
        'quest_en': "In this module: master the conditions for complete equilibrium of rigid bodies under two forces, parallel forces, and three non-parallel forces.",
        'quest_ta': "இந்த பாடத்தில்: இரு விசைகள், இணை விசைகள் மற்றும் மூன்று விசைகளின் கீழ் பொருட்கள் சமநிலையில் இருப்பதற்கான நிபந்தனைகளை கற்போம்.",
        'takeaways': [
            ("Two-Force Equilibrium:", "Two forces must be equal in magnitude, opposite in direction, and share the same line of action.",
             "இரு விசை சமநிலை:", "இரு விசைகளும் சம பருமன், எதிர் திசை, ஒரே தொழிற்பாட்டுக் கோட்டில் அமைய வேண்டும்."),
            ("Three Parallel Forces:", "Upward forces must equal downward forces, and clockwise moments must equal anticlockwise moments.",
             "மூன்று இணை விசைகள்:", "மேல்நோக்கிய விசைகள் = கீழ்நோக்கிய விசைகள், மற்றும் சுழற்சி திருப்பங்கள் சமனாக வேண்டும்."),
            ("Centre of Gravity:", "The single point where the entire weight of the body appears to act.",
             "ஈர்ப்பு மையம்:", "பொருளின் முழு நிறையும் தொழிற்படுவதாக கருதப்படும் புள்ளி.")
        ],
        'anchor_en': "In Sector 1, you explored balancing objects. Below are the rigorous physics principles of translational and rotational equilibrium!",
        'anchor_ta': "பகுதி 1-ல் பொருட்கள் சமநிலை அடைவதை பார்த்தோம். அதற்கான அதிகாரப்பூர்வ நேர்கோட்டு மற்றும் சுழற்சி சமநிலை விதிகளை இங்கே கற்போம்!"
    },
    'g10-chapter-15-hydrostatic-pressure.html': {
        'quest_en': "In this module: discover how liquids exert pressure in all directions, calculate liquid pressure using P = hρg, and learn how hydraulic jacks lift heavy cars.",
        'quest_ta': "இந்த பாடத்தில்: திரவங்கள் அனைத்து திசைகளிலும் அழுத்தம் கொடுப்பதை அறிவோம், P = hρg சூத்திரத்தை கற்போம், மற்றும் நீரியல் உயர்த்தி எவ்வாறு செயல்படுகிறது என்பதை பார்ப்போம்.",
        'takeaways': [
            ("Pressure Formula:", "Pressure = Force ÷ Area (P = F / A), measured in Pascals (N/m²).",
             "அழுத்த சூத்திரம்:", "அழுத்தம் = விசை ÷ பரப்பளவு (P = F / A), பாஸ்கல் (Pa) அலகில் அளக்கப்படும்."),
            ("Hydrostatic Pressure:", "Liquid pressure depends on depth (h), density (ρ), and gravity (g): P = hρg.",
             "திரவ அழுத்தம்:", "திரவ அழுத்தம் ஆழம் (h), அடர்த்தி (ρ), ஈர்ப்பு (g) ஆகியவற்றில் தங்கியுள்ளது: P = hρg."),
            ("Pascal's Principle:", "Pressure applied to an enclosed liquid transmits equally in all directions without loss.",
             "பாஸ்கலின் தத்துவம்:", "மூடிய திரவத்தில் கொடுக்கப்படும் அழுத்தம் அனைத்து திசைகளிலும் சமமாக கடத்தப்படும்.")
        ],
        'anchor_en': "In Sector 1, you observed water pressure and hydraulic lifting. Below are the formulas (P = hρg), SI units, and exam calculations!",
        'anchor_ta': "பகுதி 1-ல் திரவ அழுத்த விளைவுகளை பார்த்தோம். அதற்கான சூத்திரங்கள் (P = hρg), அலகுகள், பரீட்சை கணித்தல்களை இங்கே கற்போம்!"
    },
    'g10-chapter-18-work-energy-power.html': {
        'quest_en': "In this module: learn the scientific definitions of Work (W = Fd), Kinetic Energy (½mv²), Gravitational Potential Energy (mgh), and Power (P = W/t).",
        'quest_ta': "இந்த பாடத்தில்: வேலை (W = Fd), இயக்கச் சக்தி (½mv²), அழுத்த சக்தி (mgh) மற்றும் வலு (P = W/t) ஆகியவற்றின் அறிவியல் விளக்கங்களை கற்போம்.",
        'takeaways': [
            ("Work Done:", "Work occurs only when a force moves an object in its direction: Work = F × d (Joules).",
             "செய்த வேலை:", "விசையின் திசையில் பொருள் நகரும்போது மட்டுமே வேலை நடக்கும்: வேலை = F × d (ஜூல்)."),
            ("Kinetic & Potential Energy:", "Moving energy: Ek = ½mv²; Stored gravitational energy: Ep = mgh.",
             "இயக்க & அழுத்த சக்தி:", "இயக்க ஆற்றல்: Ek = ½mv²; ஈர்ப்பு அழுத்த ஆற்றல்: Ep = mgh."),
            ("Power:", "Rate of doing work: Power = Work / time = Energy / time (Watts = J/s).",
             "வலு:", "வேலை செய்யப்படும் வீதம்: வலு = வேலை / நேரம் (வாட் = J/s).")
        ],
        'anchor_en': "In Sector 1, you watched work and energy transfers in action. Below are the exact formulas, Joules and Watts units, and step-by-step problem solving!",
        'anchor_ta': "பகுதி 1-ல் வேலையும் சக்தியும் மாறுவதை பார்த்தோம். அதற்கான சூத்திரங்கள், ஜூல்/வாட் அலகுகள், மாதிரி கணித்தல்களை இங்கே கற்போம்!"
    },
    'g10-chapter-19-current-electricity.html': {
        'quest_en': "In this module: explore electric charge, electric current (I = Q/t), potential difference (V), resistance (R), and Ohm's Law (V = IR).",
        'quest_ta': "இந்த பாடத்தில்: மின்னேற்றம், மின்னோட்டம் (I = Q/t), அழுத்த வேறுபாடு (V), தடை (R) மற்றும் ஓமின் விதியை (V = IR) கற்போம்.",
        'takeaways': [
            ("Electric Current:", "Rate of flow of charge: I = Q / t (Amperes).",
             "மின்னோட்டம்:", "மின்னேற்றம் பாயும் வீதம்: I = Q / t (அம்பியர்)."),
            ("Potential Difference:", "Work done per unit charge moving between two points: V = W / Q (Volts).",
             "அழுத்த வேறுபாடு:", "ஓரலகு மின்னேற்றத்தை நகர்த்த செய்யப்படும் வேலை: V = W / Q (வோல்ட்)."),
            ("Ohm's Law:", "At constant temperature, current through a conductor is proportional to potential difference: V = I × R.",
             "ஓமின் விதி:", "மாறா வெப்பநிலையில், கடத்தியினூடான மின்னோட்டம் அழுத்த வேறுபாட்டிற்கு நேர்விகிதமானது: V = I × R.")
        ],
        'anchor_en': "In Sector 1, you observed electrons flowing in circuits. Below are Ohm's Law, circuit diagrams, and resistance calculations!",
        'anchor_ta': "பகுதி 1-ல் மின்சுற்று பாய்வை பார்த்தோம். அதற்கான ஓமின் விதி, மின்சுற்று வரைபடங்கள், தடை கணித்தல்களை இங்கே கற்போம்!"
    },
    'g11-chapter-04-waves.html': {
        'quest_en': "In this module: discover transverse and longitudinal waves, wave properties (amplitude, frequency, wavelength), and the wave speed equation (v = fλ).",
        'quest_ta': "இந்த பாடத்தில்: குறுக்கலை மற்றும் நெட்டாங்கு அலைகள், அலையின் பண்புகள் (வீச்சம், மீடிறன், அலைநீளம்), மற்றும் அலை வேகச் சமன்பாட்டை (v = fλ) கற்போம்.",
        'takeaways': [
            ("Transverse vs Longitudinal:", "Transverse: particles vibrate perpendicular to wave direction; Longitudinal: particles vibrate parallel.",
             "குறுக்கலை & நெட்டாங்கு:", "குறுக்கலை: துகள்கள் செங்குத்தாக அதிரும்; நெட்டாங்கு: துகள்கள் இணைப்போக்கில் அதிரும்."),
            ("Wave Parameters:", "Wavelength (λ) is crest-to-crest distance; Frequency (f) is waves per second (Hz).",
             "அலை அளவீடுகள்:", "அலைநீளம் (λ) என்பது அடுத்தடுத்த முகடுகளுக்கு இடைப்பட்ட தூரம்; மீடிறன் (f) என்பது வினாடிக்கான அலைகள் (Hz)."),
            ("Wave Equation:", "Wave Speed = Frequency × Wavelength: v = f × λ.",
             "அலைச் சமன்பாடு:", "அலை வேகம் = மீடிறன் × அலைநீளம்: v = f × λ.")
        ],
        'anchor_en': "In Sector 1, you watched wave propagation and vibrations. Below are the official wave equations (v = fλ), diagrams, and sound calculations!",
        'anchor_ta': "பகுதி 1-ல் அலை இயக்கத்தை பார்த்தோம். அதற்கான அலைச் சமன்பாடுகள் (v = fλ), அலை வரைபடங்கள், ஒலி கணித்தல்களை இங்கே கற்போம்!"
    },
    'g11-chapter-05-geometrical-optics.html': {
        'quest_en': "In this module: master reflection at plane and curved mirrors, refraction at glass boundaries, Snell's Law, critical angle, and ray tracing through lenses.",
        'quest_ta': "இந்த பாடத்தில்: சமதள மற்றும் வளைந்த ஆடிகளில் ஒளித்தெறிப்பு, ஒளிமுறிவு, சினெல்லின் விதி, அவதி கோணம் மற்றும் வில்லைகளினூடான கதிர் வரைபடங்களை கற்போம்.",
        'takeaways': [
            ("Laws of Reflection:", "Angle of incidence = Angle of reflection (i = r) on the same plane.",
             "தெறிப்பு விதிகள்:", "படுகோணம் = தெறிப்புக் கோணம் (i = r), படுகதிர், செங்குத்து, தெறிப்புகதிர் ஒரே தளத்தில் அமையும்."),
            ("Refraction & Snell's Law:", "Light bends towards the normal when entering a denser medium: n = sin(i) / sin(r).",
             "ஒளிமுறிவு & சினெல்லின் விதி:", "ஒளி அடர்ந்த ஊடகத்திற்குள் செல்லும்போது செங்குத்தை நோக்கி வளையும்: n = sin(i) / sin(r)."),
            ("Lenses & Image Formation:", "Convex lenses converge light to form real or virtual images; concave lenses always diverge to form virtual images.",
             "வில்லைகள் & விம்பங்கள்:", "குவிவில்லை ஒளியை குவித்து மெய்/மாய விம்பங்களை உருவாக்கும்; குழிவில்லை எப்போதும் மாய விம்பங்களை உருவாக்கும்.")
        ],
        'anchor_en': "In Sector 1, you observed light rays bending and reflecting. Below are the ray diagrams, focal length rules, and refractive index calculations!",
        'anchor_ta': "பகுதி 1-ல் ஒளிக்கதிர்கள் வளைவதை பார்த்தோம். அதற்கான கதிர் வரைபடங்கள், குவியத்தூர விதிகள், முறிவுச்சுட்டி கணித்தல்களை இங்கே கற்போம்!"
    },
    'g11-chapter-09-heat.html': {
        'quest_en': "In this module: understand temperature scales, mechanisms of heat transfer (conduction, convection, radiation), and calculate heat capacity using Q = mcΔθ.",
        'quest_ta': "இந்த பாடத்தில்: வெப்பநிலை அளவீடுகள், வெப்பப் பெயர்ச்சி முறைகள் (கடத்தல், மேற்காவுகை, கதிர்வீச்சு), மற்றும் Q = mcΔθ சூத்திரத்தை கற்போம்.",
        'takeaways': [
            ("Heat vs Temperature:", "Temperature is degree of hotness; heat is thermal energy transferred between bodies.",
             "வெப்பமும் வெப்பநிலையும்:", "வெப்பநிலை என்பது சூட்டின் அளவு; வெப்பம் என்பது பரிமாறப்படும் வெப்ப ஆற்றல்."),
            ("Heat Transfer:", "Conduction occurs in solids without bulk motion; Convection occurs in fluids via density currents; Radiation travels via EM waves through vacuum.",
             "வெப்பப் பெயர்ச்சி:", "கடத்தல் திண்மங்களில் துகள் நகர்வின்றி நடக்கும்; மேற்காவுகை பாயிகளில் நடக்கும்; கதிர்வீச்சு வெற்றிடத்தினூடாகவும் செல்லும்."),
            ("Specific Heat Capacity:", "Heat energy required to raise 1 kg of a substance by 1 °C: Q = m × c × Δθ.",
             "தன்வெப்பக் கொள்ளளவு:", "1 kg பொருளின் வெப்பநிலையை 1 °C-ஆல் உயர்த்த தேவையான வெப்பம்: Q = m × c × Δθ.")
        ],
        'anchor_en': "In Sector 1, you saw heat expanding and transferring. Below are the thermal formulas (Q = mcΔθ), Joules per kilogram units, and calorimetry calculations!",
        'anchor_ta': "பகுதி 1-ல் வெப்பப் பரிமாற்றத்தை பார்த்தோம். அதற்கான வெப்பச் சமன்பாடுகள் (Q = mcΔθ), அலகுகள், கணித்தல்களை இங்கே கற்போம்!"
    },
    'g11-chapter-10-electric-appliances.html': {
        'quest_en': "In this module: learn how household electrical appliances convert energy, calculate electrical power (P = VI), energy consumed (E = Pt), and understand electrical safety and billing.",
        'quest_ta': "இந்த பாடத்தில்: வீட்டு மின்சாதனங்கள் ஆற்றலை எவ்வாறு மாற்றுகின்றன, மின்வலு (P = VI), நுகரப்படும் மின்சக்தி (E = Pt), மற்றும் மின் கட்டணம் கணிப்பதை கற்போம்.",
        'takeaways': [
            ("Electrical Power:", "Power consumed by an appliance: P = V × I = I²R = V² / R (Watts).",
             "மின்வலு:", "மின்சாதனம் நுகரும் வலு: P = V × I = I²R = V² / R (வாட்)."),
            ("Electrical Energy (Units):", "Energy = Power (kW) × Time (hours) = kWh (Electricity Units).",
             "மின்சக்தி (அலகுகள்):", "மின்சக்தி = வலு (kW) × நேரம் (மணிகள்) = kWh (மின்சார அலகுகள்)."),
            ("Electrical Safety:", "Fuses and circuit breakers protect against overload; earth wire directs leak currents safely into the ground.",
             "மின் பாதுகாப்பு:", "உருகி அதிக மின்னோட்டத்தை தடுக்கும்; புவித்தொடுப்பு கசிவு மின்னோட்டத்தை பாதுகாப்பாக தரைக்கு அனுப்பும்.")
        ],
        'anchor_en': "In Sector 1, you saw home appliances consuming power. Below are the power formulas (P = VI), kWh unit calculations, and safety rules!",
        'anchor_ta': "பகுதி 1-ல் மின்சாதனங்களின் செயல்பாட்டை பார்த்தோம். அதற்கான மின்வலு சூத்திரங்கள் (P = VI), மின் கட்டணக் கணித்தல்களை இங்கே கற்போம்!"
    },
    'g11-chapter-11-electronics.html': {
        'quest_en': "In this module: explore semiconductors (intrinsic, n-type, p-type), the p-n junction diode, rectification of AC to DC, and how transistors amplify and switch signals.",
        'quest_ta': "இந்த பாடத்தில்: குறைகடத்திகள் (n-வகை, p-வகை), p-n சந்தி இருமுனையம், ஆடலோட்டத்தை நேரோட்டமாக மாற்றுதல், மற்றும் திரிதடையின் செயல்பாடுகளை கற்போம்.",
        'takeaways': [
            ("Semiconductor Doping:", "Adding pentavalent impurity produces n-type (electrons); trivalent produces p-type (holes).",
             "மாசூட்டல்:", "ஐந்தொகைக் கூட்டல் n-வகையை (இலத்திரன்கள்) தரும்; முத்தொகைக் கூட்டல் p-வகையை (துளைகள்) தரும்."),
            ("p-n Junction Diode:", "Allows current to flow in forward bias; blocks current in reverse bias, acting as a one-way gate.",
             "இருமுனையம் (Diode):", "முன்னோக்கு கோடலில் மின்னோட்டத்தை அனுமதிக்கும்; பின்னோக்கு கோடலில் தடுத்து ஒருவழி கதவாக செயல்படும்."),
            ("Rectification:", "A diode converts alternating current (AC) into direct current (DC).",
             "செப்பமாக்கல்:", "ஆடலோட்டத்தை (AC) நேரோட்டமாக (DC) இருமுனையம் மாற்றும்.")
        ],
        'anchor_en': "In Sector 1, you observed electronic gates and diodes in action. Below are the semiconductor circuit diagrams, biasing rules, and transistor functions!",
        'anchor_ta': "பகுதி 1-ல் மின்னணுவியல் அமைப்புகளை பார்த்தோம். அதற்கான குறைகடத்தி மின்சுற்றுகள், இருமுனையக் கோட்பாடுகளை இங்கே கற்போம்!"
    },
    'g11-chapter-13-electromagnetism.html': {
        'quest_en': "In this module: discover how electric currents create magnetic fields, Fleming's Left-Hand Rule (motor effect), electromagnetic induction (generators), and how transformers work.",
        'quest_ta': "இந்த பாடத்தில்: மின்னோட்டம் எவ்வாறு காந்தப்புலத்தை உருவாக்குகிறது, பிளெமிங்கின் இடக்கை விதி, மின்காந்தத் தூண்டல், மற்றும் மின்மாற்றியின் செயல்பாடுகளை கற்போம்.",
        'takeaways': [
            ("Magnetic Effect of Current:", "Current flowing through a wire creates circular magnetic field lines (Right-Hand Grip Rule).",
             "மின்னோட்டத்தின் காந்த விளைவு:", "கம்பியினூடான மின்னோட்டம் வட்ட வடிவ காந்தப்புலத்தை உருவாக்குகிறது."),
            ("Motor Effect:", "A current-carrying conductor in a magnetic field experiences a perpendicular force: F = B I L (Fleming's Left-Hand Rule).",
             "மோட்டார் விளைவு:", "காந்தப்புலத்தில் உள்ள கடத்தி மீது விசை செயல்படும்: F = B I L (பிளெமிங்கின் இடக்கை விதி)."),
            ("Electromagnetic Induction:", "Moving a magnet near a coil induces an electromotive force (EMF) and current: Basis of electrical generators and transformers (Vp/Vs = Np/Ns).",
             "மின்காந்தத் தூண்டல்:", "சுருள் அருகே காந்தத்தை அசைத்தால் மின்னியக்கவிசை தூண்டப்படும்: மின்பிறப்பாக்கிகள் மற்றும் மின்மாற்றிகளின் அடிப்படை (Vp/Vs = Np/Ns).")
        ],
        'anchor_en': "In Sector 1, you saw magnets and coils generating motion and electricity. Below are the magnetic field rules, transformer equations (Vp/Vs = Np/Ns), and induction laws!",
        'anchor_ta': "பகுதி 1-ல் காந்தமும் சுருளும் இயங்குவதை பார்த்தோம். அதற்கான விதிகளும் (பிளெமிங்கின் விதி), மின்மாற்றி சூத்திரங்களும் இங்கே உள்ளன!"
    }
}

for fname, data in CHAPTER_DATA.items():
    fpath = os.path.join(LESSONS_DIR, fname)
    if not os.path.exists(fpath):
        print(f"File not found: {fname}")
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add so-quest in #story if not present
    if 'class="so-quest"' not in html:
        quest_html = f'''    <div class="so-quest">
      <div class="so-quest-head">🎯 <span data-ta="பாடக் கற்றல் நோக்கம்">Module Learning Quest</span></div>
      <p data-ta="{data['quest_ta']}">{data['quest_en']}</p>
    </div>'''
        # insert before <div class="so-stage">
        html = html.replace('<div class="so-stage">', quest_html + '\n    <div class="so-stage">', 1)

    # 2. Add watch-takeaways in #watch if not present
    if 'class="watch-takeaways"' not in html:
        items_html = ""
        for item in data['takeaways']:
            items_html += f'''          <li data-ta="<b>{item[2]}</b> {item[3]}"><b>{item[0]}</b> {item[1]}</li>\n'''
        takeaways_html = f'''      <div class="watch-takeaways">
        <div class="wt-head">💡 <span data-ta="முக்கிய விளக்கங்கள்">Key Demonstration Takeaways</span></div>
        <ul>
{items_html}        </ul>
      </div>'''
        # insert right before </div>\n  </section> of #watch
        # find id="watch" section
        w_match = re.search(r'(<section\b[^>]*id="watch"[^>]*>.*?</section>)', html, re.DOTALL)
        if w_match:
            orig_w = w_match.group(1)
            # find end of fw-anim / lab-card or before </section>
            if '</div>\n  </section>' in orig_w:
                new_w = orig_w.replace('</div>\n  </section>', takeaways_html + '\n    </div>\n  </section>', 1)
                html = html.replace(orig_w, new_w, 1)

    # 3. Add notes-anchor in #notes if not present
    if 'class="notes-anchor"' not in html:
        anchor_html = f'''    <div class="notes-anchor">
      <span class="na-badge">💡</span>
      <p data-ta="{data['anchor_ta']}">{data['anchor_en']}</p>
    </div>'''
        # insert right before <div class="path-row" id="notesPath"> or after <div class="section-label">...</div>
        if '<div class="path-row" id="notesPath">' in html:
            html = html.replace('<div class="path-row" id="notesPath">', anchor_html + '\n\n    <div class="path-row" id="notesPath">', 1)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Enriched with bridges: {fname}")
