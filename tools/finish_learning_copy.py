# -*- coding: utf-8 -*-
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
labels={
 'Sector 1: Foundations':('Meet the idea','கருத்தை அறி','අදහස හඳුනා ගන්න'),
 'Sector 2: Theory & Principles':('Learn step by step','படிப்படியாகக் கற்க','පියවරෙන් පියවර ඉගෙන ගන්න'),
 'Sector 3: Interactive Simulation':('Try and explore','முயற்சி செய்து ஆராய்','කර බලමින් ගවේෂණය කරන්න'),
 'Sector 4: Assessment & Mastery':('Check and practise','சரிபார்த்துப் பயிற்சி செய்','පරීක්ෂා කර පුහුණු වන්න'),
 '1.1 Overview':('Story','கதை','කතාව'),
 '1.2 Fundamentals':('Basics','அடிப்படை','මූලික කරුණු'),
 '1.3 Demonstration':('Watch it','பார்த்தறி','බලන්න'),
 '2.1 Theory & Formulas':('Notes','குறிப்புகள்','සටහන්'),
 '2.2 Practical Activity':('Try it','செய்து பாரு','කර බලමු'),
 '3.1 Physics Lab':('Lab','ஆய்வகம்','විද්‍යාගාරය'),
 '3.2 Concept Challenge':('Challenge','சவால்','අභියෝගය'),
 '3.3 Classification':('Sort game','வகைப்படுத்தும் விளையாட்டு','වර්ග කිරීමේ ක්‍රීඩාව'),
 '4.1 Knowledge Check':('Quiz','வினாடி வினா','ප්‍රශ්නාවලිය'),
 '4.2 Worked Problems':('Examples','உதாரணங்கள்','නිදසුන්'),
 '4.3 Exam Practice':('Exam practice','பரீட்சைப் பயிற்சி','විභාග පුහුණුව'),
 '4.4 Key Review':('Recap','மீள்பார்வை','සාරාංශය'),
}
for p in (root/'site/lessons').glob('*.html'):
 t=p.read_text(encoding='utf-8')
 if 'fw_path' not in t:continue
 for old,(en,ta,si) in labels.items():
  t=re.sub(r"en:'"+re.escape(old)+r"',\s*ta:'[^']*'",lambda m:"en:'"+en+"', ta:'"+ta+"'",t)
 p.write_text(t,encoding='utf-8')
p=root/'public/static/si/_ui.json';d=json.loads(p.read_text(encoding='utf-8'))
for old,(en,ta,si) in labels.items():d[en]=si;d[old]=si;d['~'+en]=si
extras={
'Explore the idea':'අදහස ගවේෂණය කරන්න','Study for O/L':'සා/පෙ සඳහා ඉගෙන ගන්න','Estimated time':'ඇස්තමේන්තු කාලය','Activities finished':'අවසන් කළ ක්‍රියාකාරකම්','steps':'පියවර','Lessons':'පාඩම්','Check the idea':'අදහස පරීක්ෂා කරන්න','Your exploration':'ඔබේ ගවේෂණය','Listen':'සවන් දෙන්න','Pause':'නවත්වන්න','Back':'ආපසු','Next':'ඊළඟ','Replay':'නැවත බලන්න','Animation time':'සජීවිකරණ කාලය','Read this step aloud':'මෙම පියවර කියවන්න','Previous subtopic':'පෙර අදහස','Next subtopic (':'ඊළඟ අදහස (','Next subtopic ({0}/{1})':'ඊළඟ අදහස ({0}/{1})','Got it, start learning':'තේරුණා, ඉගෙන ගනිමු','One idea at a time':'වරකට එක් අදහසක්','You checked two ideas. Explain them in your own words, then try the formulas when you are ready.':'අදහස් දෙකක් පරීක්ෂා කළා. ඔබේ වචනවලින් පැහැදිලි කර, සූදානම් විට සූත්‍ර උත්සාහ කරන්න.','You explored the lesson. Return to Basics to try the two understanding questions.':'ඔබ පාඩම ගවේෂණය කළා. අවබෝධ ප්‍රශ්න දෙක උත්සාහ කිරීමට මූලික කරුණු වෙත යන්න.','More vibrations each second!':'තත්පරයකට වැඩි කම්පන!','No recordings for this story; using a phone voice when available.':'මේ කතාවට පටිගත හඬ නැත; තිබේ නම් දුරකථන හඬ භාවිත කරයි.',
'compression':'සම්පීඩනය','rarefaction':'විරලනය','direction of wave propagation':'තරංගය ගමන් කරන දිශාව','particles move back and forth, parallel to the wave':'අංශු තරංගයට සමාන්තරව ඉදිරියට සහ පසුපසට චලනය වේ','wave direction':'තරංග දිශාව','transverse':'තිරස්','longitudinal':'අන්වායාම','virtual image':'අතාත්වික රුව','real image':'තාත්වික රුව','Sound: off':'ශබ්දය: අක්‍රියයි','Sound: on':'ශබ්දය: සක්‍රියයි','Slow: on':'මන්දගාමී: සක්‍රියයි','Slow: off':'මන්දගාමී: අක්‍රියයි'
}
d.update(extras)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Simplified lesson navigation in all lessons and added Sinhala UI translations.')
