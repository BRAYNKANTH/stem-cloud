"""Apply reviewed teaching-copy corrections to lesson source and Sinhala memory."""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]

def edit(name, replacements):
    path = ROOT / 'site/lessons' / (name + '.html')
    text = path.read_text(encoding='utf-8')
    memory_path = ROOT / 'public/static/si' / (name + '.json')
    memory = json.loads(memory_path.read_text(encoding='utf-8'))
    for old, en, ta, si in replacements:
        pattern = re.compile(r'(<(?P<tag>h3|p)[^>]*?data-ta=")[^"]*("[^>]*>)' + re.escape(old) + r'(</(?P=tag)>)')
        text, count = pattern.subn(lambda m: m[1] + ta + m[3] + en + m[4], text)
        if count != 1: raise ValueError((name, old, count))
        memory.pop(old, None); memory[en] = si
    path.write_text(text, encoding='utf-8')
    memory_path.write_text(json.dumps(memory, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__':
    edit('chapter-09-resultant-force', [
        ('Equal and opposite: nothing moves', 'Balanced pushes do not change motion', 'சமமான எதிர் விசைகள் இயக்கத்தை மாற்றாது', 'සමබර බල චලිතය වෙනස් නොකරයි'),
        ('If both sides pull the same, the rope stays still. One single force that does the same job is the resultant.', 'Equal pushes in opposite directions do not change motion. A still box stays still; a moving box keeps the same speed and direction. The combined force is called the resultant. N means newton, a unit of force.', 'சமமான எதிர் விசைகள் இயக்கத்தை மாற்றாது. நின்ற பெட்டி நின்றே இருக்கும்; நகரும் பெட்டி அதே கதியிலும் திசையிலும் நகரும். மொத்த விசை விளையுள் விசை. N என்பது விசையின் அலகான நியூற்றன்.', 'ප්‍රතිවිරුද්ධ දිශාවල සමාන බල චලිතය වෙනස් නොකරයි. නිශ්චල පෙට්ටිය නිශ්චලව පවතී; චලනය වන පෙට්ටිය එකම වේගයෙන් සහ දිශාවෙන් ගමන් කරයි. එකතු වූ බලය සම්ප්‍රයුක්ත බලයයි. N යනු බලයේ ඒකකය වන නිව්ටන්ය.')])
    edit('chapter-12-equilibrium', [
        ('A wide base and low weight make things hard to tip over.', 'A wide base and a low balance point make things harder to tip over. This balance point is called the centre of gravity.', 'அகலமான அடியும் தாழ்ந்த சமநிலைப் புள்ளியும் பொருள் கவிழ்வதைத் தடுக்கும். இந்தப் புள்ளி புவியீர்ப்பு மையம் எனப்படும்.', 'පළල් පාදමක් සහ පහළ සමබර ලක්ෂ්‍යයක් ඇති දේ පෙරළීම අපහසුය. මේ ලක්ෂ්‍යය ගුරුත්ව කේන්ද්‍රය ලෙස හඳුන්වයි.')])
    edit('g10-chapter-15-hydrostatic-pressure', [
        ('Press a pencil on your palm with the sharp end, then the blunt end. Which hurts more?', 'With an adult, press the broad and narrow ends of a blunt block into modelling clay using the same gentle push. Which makes a deeper dent? Never press a sharp object into your skin.', 'பெரியவர் உதவியுடன் மழுங்கிய கட்டையின் அகலமான, குறுகிய முனைகளை ஒரே மென்மையான விசையால் களிமண்ணில் அழுத்து. எது ஆழமான பள்ளம் தருகிறது? கூரிய பொருளைத் தோலில் அழுத்தாதே.', 'වැඩිහිටියෙකු සමඟ මොට කුට්ටියක පළල් සහ පටු අග එකම මෘදු තල්ලුවකින් මැටි තුළට ඔබන්න. ගැඹුරු සලකුණක් ඇති වන්නේ කුමන අගෙන්ද? තියුණු දේ සමට ඔබන්න එපා.'),
        ('Make holes in a bottle. The lowest hole squirts the farthest.', 'Ask an adult to prepare a bottle with holes. Watch only: water from the lowest hole squirts farthest.', 'සිදුරු ඇති බෝතලයක් වැඩිහිටියෙකු ලවා සකස් කරගන්න. නරඹන්න පමණයි: පහළ සිදුරෙන් ජලය වැඩි දුරක් විදියි.', 'සිදුරු ඇති බෝතලයක් වැඩිහිටියෙකු ලවා සකස් කරගන්න. නරඹන්න පමණයි: පහළ සිදුරෙන් ජලය වැඩි දුරක් විදියි.')])
    # Correct Tamil separately for the bottle demonstration.
    path=ROOT/'site/lessons/g10-chapter-15-hydrostatic-pressure.html'
    t=path.read_text(encoding='utf-8').replace('data-ta="සිදුරු ඇති බෝතලයක් වැඩිහිටියෙකු ලවා සකස් කරගන්න. නරඹන්න පමණයි: පහළ සිදුරෙන් ජලය වැඩි දුරක් විදියි."', 'data-ta="துளையுள்ள பாட்டிலைப் பெரியவர் தயாரிக்கட்டும். நீ பார்த்தால் போதும்: கீழ் துளையிலிருந்து நீர் அதிக தூரம் பாயும்."')
    path.write_text(t,encoding='utf-8')
    edit('g10-chapter-18-work-energy-power', [
        ('Energy: the power to do work', 'Energy helps things change', 'சக்தி மாற்றங்களுக்கு உதவும்', 'ශක්තිය වෙනස්කම් කිරීමට උපකාරී වේ'),
        ('Food gives you energy. A charged phone has energy. Doing work uses energy up.', 'Food and batteries store energy. Energy can move things or warm them up. When you do work, energy is transferred or changes form; it does not disappear.', 'உணவும் மின்கலமும் சக்தியைச் சேமிக்கும். சக்தி பொருளை நகர்த்தவும் சூடாக்கவும் உதவும். வேலை செய்யும்போது சக்தி இடமாறும் அல்லது வடிவம் மாறும்; அது மறையாது.', 'ආහාර සහ බැටරි ශක්තිය ගබඩා කරයි. ශක්තියෙන් දේ චලනය කිරීමට හෝ රත් කිරීමට හැකිය. කාර්යය කරන විට ශක්තිය මාරු වේ හෝ ආකාරය වෙනස් වේ; එය නැති නොවේ.')])
    edit('g11-chapter-10-electric-appliances', [
        ('A fuse is a thin wire that melts if too much current flows, so it protects you. Never touch plugs with wet hands.', 'A fuse breaks the circuit if too much current flows, helping stop wires overheating. It does not make sockets safe to touch. Ask an adult for appliance activities; never touch plugs with wet hands.', 'அதிக மின்னோட்டம் பாய்ந்தால் உருகி சுற்றைத் துண்டித்து கம்பி அதிகம் சூடாவதைத் தடுக்க உதவும். அது மின் துளைகளைத் தொடப் பாதுகாப்பாக்காது. உபகரணச் செயல்களுக்கு பெரியவரின் உதவி கேள்; ஈரக் கைகளால் பிளக்கைத் தொடாதே.', 'අධික ධාරාවක් ගලා යන විට ෆියුසය පරිපථය බිඳ දමා කම්බි අධික ලෙස රත් වීම වැළැක්වීමට උපකාරී වේ. එයින් සොකට් ස්පර්ශ කිරීම ආරක්ෂිත නොවේ. උපකරණ ක්‍රියාකාරකම් සඳහා වැඩිහිටියෙකුගේ උදව් ගන්න; තෙත් අතින් පේනු අල්ලන්න එපා.')])
    edit('g11-chapter-05-geometrical-optics', [
        ('A lens bends light to a point', 'Lenses change light direction', 'வில்லை ஒளியின் திசையை மாற்றும்', 'කාච ආලෝකයේ දිශාව වෙනස් කරයි'),
        ('A magnifying glass or spectacles bend light on purpose, to make things look bigger or clearer.', 'Some lenses bring light rays together; others spread them apart. We will first explore a lens that brings rays together. Never look at the Sun through a lens.', 'சில வில்லைகள் ஒளிக்கதிர்களைச் சேர்க்கும்; சில விரிக்கும். முதலில் கதிர்களைச் சேர்க்கும் வில்லையைப் பார்ப்போம். வில்லை வழியாக சூரியனைப் பார்க்காதே.', 'සමහර කාච ආලෝක කිරණ එක් කරයි; අනෙක්වා විසුරුවයි. මුලින්ම කිරණ එක් කරන කාචයක් බලමු. කාචයකින් සූර්යයා දෙස බලන්න එපා.')])
    path=ROOT/'site/lessons/chapter-04-newtons-laws.html'
    text=path.read_text(encoding='utf-8').replace('What decides &quot;does it move or not&quot; is whether there\'s an unbalanced force acting.', 'An unbalanced force changes an object’s speed or direction.')
    text=text.replace('What decides "does it move or not" is whether there\'s an unbalanced force acting.', 'For this still table, a larger push can start movement. More generally, an unbalanced force changes speed or direction.')
    path.write_text(text,encoding='utf-8')
    for path in (ROOT/'site/lessons').glob('*.html'):
        text=path.read_text(encoding='utf-8')
        if 'fw_path' not in text: continue
        text=text.replace("if(e.isIntersecting && h >= Math.min(e.boundingClientRect.height * 0.3, window.innerHeight * 0.3) && !document.documentElement.classList.contains('stem-player')){ mark(e.target.id); }", "/* Viewing a section is recorded separately; only deliberate actions complete it. */")
        text=text.replace("window.__fwMark = function(id){ if(document.documentElement.classList.contains('stem-player')) return; mark(id); };", "window.__fwMark = function(id){ if(!window.StemPlayer || !window.StemPlayer.active) mark(id); };")
        if path.name=='g11-chapter-04-waves.html':
            text=text.replace('Shrill, high pitch!', 'More vibrations each second!').replace('கீச்சு, உயர் சுருதி!', 'ஒவ்வொரு வினாடியும் அதிக அதிர்வுகள்!')
            text=text.replace("H.chittu(580, 292, 0.45,", "H.text(320, 284, APP_LANG === 'ta' ? 'காட்சி: உண்மை நேரத்தின் 1/8 வேகம்' : ((window.STEM_LANG === 'si') ? 'දර්ශනය: සැබෑ වේගයෙන් 1/8' : 'Display: one-eighth of real speed'), '#1b2236', 12);\n  H.chittu(580, 292, 0.45,")
        path.write_text(text,encoding='utf-8')
    print('Updated all 15 lessons and affected Sinhala dictionaries.')
