import type { Pair } from '../shared';

/*
 * The levels of "Cycling to the Bus Stop" (BusStopLab.tsx): Nimal's ride from home to the school bus along a straight
 * road (east is +), one stop per level. Each level has a ride to predict (with a bet), a graph of that ride to read, and
 * a goal the student reaches by setting the ride themselves. A ride is legs of constant acceleration.
 */

/** One part of a ride: velocity at its start (m/s, east +), acceleration (m/s²) and how long it lasts (s). */
export interface Leg { v: number; a: number; d: number }
export interface Pt { s: number; v: number; dist: number }
export interface Control { key: string; l: Pair; min: number; max: number; step: number; unit: string; start: number }
export type Vals = Record<string, number>;

export interface Level {
  /** The syllabus sections it covers. */
  sec: string;
  stop: Pair;
  /** The place at the end of the ride (drawn on the road). */
  place: Pair;
  story: Pair;
  legs: Leg[];
  ask: { q: Pair; opts: Pair[]; right: number; why: Pair };
  read: { graph: 's' | 'v'; q: Pair; ok: (t: number) => boolean; why: Pair };
  goal: { q: Pair; controls: Control[]; legs: (c: Vals) => Leg[]; ok: (c: Vals, end: Pt, T: number) => boolean; say: (c: Vals, end: Pt, T: number) => Pair; why: Pair; target?: number };
}

const sOf = (u: number, a: number, k: number) => u * k + 0.5 * a * k * k;
/** Distance travelled in one leg: the path length, split where the velocity changes sign. */
function legDist(u: number, a: number, k: number) {
  if (a !== 0) {
    const t0 = -u / a;
    if (t0 > 0 && t0 < k) return Math.abs(sOf(u, a, t0)) + Math.abs(sOf(u, a, k) - sOf(u, a, t0));
  }
  return Math.abs(sOf(u, a, k));
}
export const total = (legs: Leg[]) => legs.reduce((n, l) => n + l.d, 0);
/** Where the ride is at time t: displacement s, velocity v, distance travelled. */
export function at(legs: Leg[], t: number): Pt {
  let s = 0, dist = 0, left = Math.max(0, t), v = legs[0]?.v ?? 0;
  for (const l of legs) {
    if (l.d <= 0) continue;
    const k = Math.min(left, l.d);
    s += sOf(l.v, l.a, k); dist += legDist(l.v, l.a, k); v = l.v + l.a * k; left -= k;
    if (left <= 0) break;
  }
  return { s, v, dist };
}

const n = (x: string): Pair => [x, x, x];
const near = (x: number, y: number, tol: number) => Math.abs(x - y) <= tol;
const r1 = (x: number) => { const v = Math.round(x * 10) / 10; return (Object.is(v, -0) ? 0 : v).toString(); };
/** "50 m east", "30 m west", "0 m". */
export const dirn = (s: number): Pair => {
  const m = r1(Math.abs(s));
  if (Math.abs(s) < 0.05) return n('0 m');
  return s > 0 ? [m + ' m east', m + ' m கிழக்கு', 'නැගෙනහිරට m ' + m] : [m + ' m west', m + ' m மேற்கு', 'බටහිරට m ' + m];
};

export const LEVELS: Level[] = [
  {
    sec: '2.1',
    stop: ['Corner shop', 'மூலைக் கடை', 'කෙළවරේ කඩේ'],
    place: ["Kamal's house", 'கமலின் வீடு', 'කමල්ගේ ගෙදර'],
    story: [
      'Nimal rides 80 m east to the corner shop. Then he remembers his pen is at Kamal\'s house, so he rides 30 m back west.',
      'நிமல் 80 m கிழக்கே மூலைக் கடைக்கு சைக்கிள் ஓட்டுகிறான். பிறகு தன் பேனா கமலின் வீட்டில் இருப்பது நினைவுக்கு வர, 30 m திரும்பி மேற்கே போகிறான்.',
      'නිමල් නැගෙනහිරට m 80ක් කෙළවරේ කඩේට පදිනවා. ඊට පස්සේ ඔහුගේ පෑන කමල්ගේ ගෙදර බව මතක් වෙලා, m 30ක් ආපසු බටහිරට පදිනවා.',
    ],
    legs: [{ v: 4, a: 0, d: 20 }, { v: -3, a: 0, d: 10 }],
    ask: {
      q: ['At Kamal\'s house, what is Nimal\'s displacement from home?', 'கமலின் வீட்டில், வீட்டிலிருந்து நிமலின் இடப்பெயர்ச்சி என்ன?', 'කමල්ගේ ගෙදරදී, ගෙදර සිට නිමල්ගේ විස්ථාපනය කීයද?'],
      opts: [n('110 m'), dirn(50), dirn(-30), dirn(80)],
      right: 1,
      why: [
        'Distance adds up every metre ridden: 80 + 30 = 110 m. Displacement is only from start to finish, with a direction: 80 − 30 = 50 m east.',
        'தூரம் ஓட்டிய ஒவ்வொரு மீட்டரையும் கூட்டும்: 80 + 30 = 110 m. இடப்பெயர்ச்சி தொடக்கத்திலிருந்து முடிவு வரை மட்டும், திசையுடன்: 80 − 30 = 50 m கிழக்கு.',
        'දුර කියන්නේ පැද්ද සෑම මීටරයකම එකතුව: 80 + 30 = m 110. විස්ථාපනය ආරම්භයේ සිට අවසානයට පමණයි, දිශාවත් සමඟ: 80 − 30 = නැගෙනහිරට m 50.',
      ],
    },
    read: {
      graph: 's',
      q: ['Tap the moment Nimal turned back.', 'நிமல் திரும்பிய நேரத்தைத் தொடு.', 'නිමල් ආපසු හැරුණු මොහොත තට්ටු කරන්න.'],
      ok: (t) => near(t, 20, 1.5),
      why: [
        'At t = 20 s the displacement–time graph stops going up and starts going down: he changed direction.',
        't = 20 s-இல் இடப்பெயர்ச்சி–நேர வரைபு ஏறுவது நின்று இறங்கத் தொடங்குகிறது: அவன் திசை மாறினான்.',
        't = 20 s දී විස්ථාපන–කාල ප්‍රස්තාරය ඉහළ යාම නවත්වා පහළට යන්න පටන් ගන්නවා: ඔහු දිශාව වෙනස් කළා.',
      ],
    },
    goal: {
      q: [
        'Plan a ride at 5 m/s with a distance of 120 m but a displacement of only 40 m east.',
        '5 m/s வேகத்தில், தூரம் 120 m ஆனால் இடப்பெயர்ச்சி 40 m கிழக்கு மட்டும் வரும்படி ஒரு பயணம் திட்டமிடு.',
        'm/s 5න්, දුර m 120ක් නමුත් විස්ථාපනය නැගෙනහිරට m 40ක් පමණක් වන ගමනක් සැලසුම් කරන්න.',
      ],
      controls: [
        { key: 'e', l: ['Ride east', 'கிழக்கே ஓட்டு', 'නැගෙනහිරට පදින්න'], min: 0, max: 150, step: 10, unit: 'm', start: 60 },
        { key: 'w', l: ['Then ride back west', 'பிறகு மேற்கே திரும்பு', 'ඉන්පසු බටහිරට ආපසු'], min: 0, max: 150, step: 10, unit: 'm', start: 20 },
      ],
      legs: (c) => [{ v: 5, a: 0, d: c.e! / 5 }, { v: -5, a: 0, d: c.w! / 5 }],
      ok: (_c, e) => near(e.dist, 120, 0.5) && near(e.s, 40, 0.5),
      say: (_c, e) => {
        const d = dirn(e.s);
        return ['Distance ' + r1(e.dist) + ' m, displacement ' + d[0] + '.', 'தூரம் ' + r1(e.dist) + ' m, இடப்பெயர்ச்சி ' + d[1] + '.', 'දුර m ' + r1(e.dist) + ', විස්ථාපනය ' + d[2] + '.'];
      },
      why: ['80 m east and 40 m back: 80 + 40 = 120 m ridden, but he ends 80 − 40 = 40 m east of home.', '80 m கிழக்கு, 40 m திரும்பி: ஓட்டியது 80 + 40 = 120 m, ஆனால் அவன் வீட்டிலிருந்து 80 − 40 = 40 m கிழக்கில் முடிக்கிறான்.', 'නැගෙනහිරට m 80ක් සහ ආපසු m 40ක්: පැද්දේ 80 + 40 = m 120, නමුත් ඔහු අවසන් වන්නේ ගෙදර සිට නැගෙනහිරට 80 − 40 = m 40.'],
    },
  },
  {
    sec: '2.2',
    stop: ['Paddy field', 'வயல்', 'කුඹුර'],
    place: ['Temple', 'கோயில்', 'පන්සල'],
    story: [
      'The road beside the paddy field is straight and flat. Nimal rides at a steady speed and covers 150 m in 30 s.',
      'வயல் அருகிலுள்ள சாலை நேரானது, சமதளமானது. நிமல் சீரான வேகத்தில் 30 s-இல் 150 m போகிறான்.',
      'කුඹුර අයිනේ පාර කෙළින්ම සහ තැනිතලායි. නිමල් ඒකාකාර වේගයෙන් s 30කදී m 150ක් යනවා.',
    ],
    legs: [{ v: 5, a: 0, d: 30 }],
    ask: {
      q: ['What is his speed?', 'அவனுடைய வேகம் என்ன?', 'ඔහුගේ වේගය කීයද?'],
      opts: [n('3 m/s'), n('5 m/s'), n('15 m/s'), n('180 m/s')],
      right: 1,
      why: ['Speed = distance ÷ time = 150 m ÷ 30 s = 5 m/s.', 'வேகம் = தூரம் ÷ நேரம் = 150 m ÷ 30 s = 5 m/s.', 'වේගය = දුර ÷ කාලය = m 150 ÷ s 30 = m/s 5.'],
    },
    read: {
      graph: 's',
      q: ['Tap the moment Nimal had ridden 100 m.', 'நிமல் 100 m ஓட்டி முடித்த நேரத்தைத் தொடு.', 'නිමල් m 100ක් පැදගෙන ගිය මොහොත තට්ටු කරන්න.'],
      ok: (t) => near(t, 20, 1.5),
      why: ['Go across from 100 m to the line, then down: t = 20 s. A straight line on a displacement–time graph means a steady velocity.', '100 m-இலிருந்து கோடு வரை குறுக்கே போய், கீழே இறங்கு: t = 20 s. இடப்பெயர்ச்சி–நேர வரைபில் நேர்கோடு என்றால் சீரான திசைவேகம்.', 'm 100 සිට රේඛාවට හරහට ගොස් පහළට එන්න: t = 20 s. විස්ථාපන–කාල ප්‍රස්තාරයක සරල රේඛාවක් යනු ඒකාකාර ප්‍රවේගයකි.'],
    },
    goal: {
      q: ['The temple is 200 m away and the bell rings in 25 s. Set a steady speed so Nimal gets there just as it rings.', 'கோயில் 200 m தூரத்தில், மணி 25 s-இல் ஒலிக்கும். மணி ஒலிக்கும்போதே நிமல் அங்கே சேரும்படி சீரான வேகத்தை வை.', 'පන්සල m 200ක් දුරින්, සීනුව s 25කින් නාද වෙනවා. සීනුව නාද වන විටම නිමල් එතැනට යන ලෙස ඒකාකාර වේගයක් තෝරන්න.'],
      controls: [{ key: 'v', l: ['Speed', 'வேகம்', 'වේගය'], min: 1, max: 12, step: 0.5, unit: 'm/s', start: 5 }],
      legs: (c) => [{ v: c.v!, a: 0, d: 25 }],
      ok: (c) => near(c.v! * 25, 200, 0.01),
      say: (_c, e) => ['After 25 s he was ' + r1(e.s) + ' m from home.', '25 s-க்குப் பிறகு அவன் வீட்டிலிருந்து ' + r1(e.s) + ' m தூரத்தில் இருந்தான்.', 's 25කට පසු ඔහු ගෙදර සිට m ' + r1(e.s) + ' දුරින් සිටියා.'],
      why: ['Speed = 200 m ÷ 25 s = 8 m/s.', 'வேகம் = 200 m ÷ 25 s = 8 m/s.', 'වේගය = m 200 ÷ s 25 = m/s 8.'],
      target: 200,
    },
  },
  {
    sec: '2.2',
    stop: ['Temple', 'கோயில்', 'පන්සල'],
    place: ['Home', 'வீடு', 'ගෙදර'],
    story: [
      'Nimal rides 120 m east to the temple at 6 m/s, then rides 120 m back west at 4 m/s to pick up his little sister.',
      'நிமல் 6 m/s வேகத்தில் 120 m கிழக்கே கோயிலுக்குப் போகிறான், பிறகு தங்கையை அழைத்துவர 4 m/s வேகத்தில் 120 m மேற்கே திரும்புகிறான்.',
      'නිමල් m/s 6න් නැගෙනහිරට m 120ක් පන්සලට පදිනවා, ඊට පස්සේ නංගිව එක්කගෙන එන්න m/s 4න් බටහිරට m 120ක් ආපසු පදිනවා.',
    ],
    legs: [{ v: 6, a: 0, d: 20 }, { v: -4, a: 0, d: 30 }],
    ask: {
      q: ['What is his average velocity for the whole ride?', 'முழுப் பயணத்துக்கும் அவனுடைய சராசரி திசைவேகம் என்ன?', 'මුළු ගමනටම ඔහුගේ සාමාන්‍ය ප්‍රවේගය කීයද?'],
      opts: [n('5 m/s'), n('4.8 m/s'), n('0 m/s'), n('2 m/s')],
      right: 2,
      why: [
        'He ends where he started, so his displacement is 0 and his average velocity is 0 ÷ 50 s = 0. His average speed is 240 m ÷ 50 s = 4.8 m/s.',
        'தொடங்கிய இடத்திலேயே முடிக்கிறான், எனவே இடப்பெயர்ச்சி 0, சராசரி திசைவேகம் 0 ÷ 50 s = 0. சராசரி வேகம் 240 m ÷ 50 s = 4.8 m/s.',
        'ඔහු පටන් ගත් තැනම නවතිනවා, එනිසා විස්ථාපනය 0 යි, සාමාන්‍ය ප්‍රවේගය 0 ÷ s 50 = 0. සාමාන්‍ය වේගය m 240 ÷ s 50 = m/s 4.8.',
      ],
    },
    read: {
      graph: 'v',
      q: ['Tap a moment when Nimal\'s velocity was negative.', 'நிமலின் திசைவேகம் எதிர்மறையாக இருந்த ஒரு நேரத்தைத் தொடு.', 'නිමල්ගේ ප්‍රවේගය සෘණ වූ මොහොතක් තට්ටු කරන්න.'],
      ok: (t) => t > 20.3 && t <= 50,
      why: ['From 20 s to 50 s the line is below zero: −4 m/s. The minus sign means he was riding west.', '20 s முதல் 50 s வரை கோடு பூஜ்ஜியத்துக்குக் கீழே: −4 m/s. கழித்தல் குறி அவன் மேற்கே போனான் என்று காட்டுகிறது.', 's 20 සිට s 50 දක්වා රේඛාව බිංදුවට පහළින්: −4 m/s. සෘණ ලකුණෙන් කියන්නේ ඔහු බටහිරට පැද්ද බවයි.'],
    },
    goal: {
      q: ['Nimal rides 150 m east at 5 m/s (30 s), then waits for his friend. How long must he wait so his average velocity is 2 m/s east?', 'நிமல் 5 m/s வேகத்தில் 150 m கிழக்கே (30 s) போய், நண்பனுக்காகக் காத்திருக்கிறான். சராசரி திசைவேகம் 2 m/s கிழக்கு ஆக எவ்வளவு நேரம் காத்திருக்க வேண்டும்?', 'නිමල් m/s 5න් නැගෙනහිරට m 150ක් (s 30) පැදලා යාළුවා එනකම් ඉන්නවා. සාමාන්‍ය ප්‍රවේගය නැගෙනහිරට m/s 2 වෙන්න ඔහු කොච්චර වෙලා ඉන්න ඕනද?'],
      controls: [{ key: 'w', l: ['Wait', 'காத்திரு', 'රැඳී සිටින්න'], min: 0, max: 60, step: 5, unit: 's', start: 10 }],
      legs: (c) => [{ v: 5, a: 0, d: 30 }, { v: 0, a: 0, d: c.w! }],
      ok: (c) => near(150 / (30 + c.w!), 2, 0.001),
      say: (_c, e, T) => ['Average velocity = ' + r1(e.s) + ' m ÷ ' + r1(T) + ' s = ' + r1(e.s / T) + ' m/s.', 'சராசரி திசைவேகம் = ' + r1(e.s) + ' m ÷ ' + r1(T) + ' s = ' + r1(e.s / T) + ' m/s.', 'සාමාන්‍ය ප්‍රවේගය = m ' + r1(e.s) + ' ÷ s ' + r1(T) + ' = m/s ' + r1(e.s / T) + '.'],
      why: ['150 m ÷ 2 m/s = 75 s in all, so he waits 75 − 30 = 45 s. Waiting adds time but no displacement.', '150 m ÷ 2 m/s = மொத்தம் 75 s, எனவே 75 − 30 = 45 s காத்திருக்கிறான். காத்திருப்பது நேரத்தைக் கூட்டும், இடப்பெயர்ச்சியை அல்ல.', 'm 150 ÷ m/s 2 = මුළු s 75, එනිසා ඔහු 75 − 30 = s 45ක් රැඳී සිටිනවා. රැඳී සිටීමෙන් කාලය වැඩි වේ, විස්ථාපනය නොවේ.'],
      target: 150,
    },
  },
  {
    sec: '2.3',
    stop: ['Hill road', 'மலைச் சாலை', 'කඳු පාර'],
    place: ['Bottom of the hill', 'மலையின் அடிவாரம்', 'කන්ද පාමුල'],
    story: [
      'At the top of the hill Nimal is moving at 2 m/s. He freewheels down, and his velocity goes up by 1.5 m/s every second for 6 s.',
      'மலை உச்சியில் நிமல் 2 m/s வேகத்தில் போகிறான். பெடல் மிதிக்காமல் இறங்குகிறான்; 6 s வரை ஒவ்வொரு விநாடியும் திசைவேகம் 1.5 m/s கூடுகிறது.',
      'කන්ද මුදුනේදී නිමල් m/s 2න් යනවා. ඔහු පැඩල් නොකර පහළට යනවා; s 6ක් පුරා සෑම තත්පරයකම ප්‍රවේගය m/s 1.5කින් වැඩි වෙනවා.',
    ],
    legs: [{ v: 2, a: 1.5, d: 6 }],
    ask: {
      q: ['What is his velocity at the bottom, after 6 s?', '6 s-க்குப் பிறகு, அடிவாரத்தில் அவனுடைய திசைவேகம் என்ன?', 's 6කට පසු, කන්ද පාමුලදී ඔහුගේ ප්‍රවේගය කීයද?'],
      opts: [n('9 m/s'), n('11 m/s'), n('3.5 m/s'), n('13 m/s')],
      right: 1,
      why: ['v = u + at = 2 + 1.5 × 6 = 11 m/s. The acceleration, 1.5 m/s², is how much the velocity grows each second.', 'v = u + at = 2 + 1.5 × 6 = 11 m/s. முடுக்கம் 1.5 m/s² என்றால் ஒவ்வொரு விநாடியும் திசைவேகம் அவ்வளவு கூடுகிறது.', 'v = u + at = 2 + 1.5 × 6 = m/s 11. ත්වරණය m/s² 1.5 යනු සෑම තත්පරයකම ප්‍රවේගය වැඩි වන ප්‍රමාණයයි.'],
    },
    read: {
      graph: 'v',
      q: ['Tap the moment his velocity was 8 m/s.', 'அவனுடைய திசைவேகம் 8 m/s ஆக இருந்த நேரத்தைத் தொடு.', 'ඔහුගේ ප්‍රවේගය m/s 8 වූ මොහොත තට්ටු කරන්න.'],
      ok: (t) => near(t, 4, 0.4),
      why: ['At t = 4 s: 2 + 1.5 × 4 = 8 m/s. The gradient of the velocity–time graph is the acceleration.', 't = 4 s-இல்: 2 + 1.5 × 4 = 8 m/s. திசைவேக–நேர வரைபின் சாய்வு முடுக்கம் ஆகும்.', 't = 4 s දී: 2 + 1.5 × 4 = m/s 8. ප්‍රවේග–කාල ප්‍රස්තාරයේ අනුක්‍රමණය ත්වරණයයි.'],
    },
    goal: {
      q: ['A new hill takes 5 s to ride down, starting at 2 m/s. Set the acceleration so Nimal reaches 12 m/s at the bottom.', 'புதிய மலையில் இறங்க 5 s ஆகும், 2 m/s-இல் தொடங்குகிறான். அடிவாரத்தில் 12 m/s அடையும்படி முடுக்கத்தை வை.', 'අලුත් කන්දෙන් බැසීමට s 5ක් ගතවේ, m/s 2න් පටන් ගනී. කන්ද පාමුලදී m/s 12ට ළඟා වන ලෙස ත්වරණය තෝරන්න.'],
      controls: [{ key: 'a', l: ['Acceleration', 'முடுக்கம்', 'ත්වරණය'], min: 0, max: 3, step: 0.25, unit: 'm/s²', start: 1 }],
      legs: (c) => [{ v: 2, a: c.a!, d: 5 }],
      ok: (_c, e) => near(e.v, 12, 0.01),
      say: (_c, e) => ['At the bottom his velocity was ' + r1(e.v) + ' m/s.', 'அடிவாரத்தில் அவனுடைய திசைவேகம் ' + r1(e.v) + ' m/s.', 'කන්ද පාමුලදී ඔහුගේ ප්‍රවේගය m/s ' + r1(e.v) + '.'],
      why: ['a = (v − u) ÷ t = (12 − 2) ÷ 5 = 2 m/s².', 'a = (v − u) ÷ t = (12 − 2) ÷ 5 = 2 m/s².', 'a = (v − u) ÷ t = (12 − 2) ÷ 5 = m/s² 2.'],
    },
  },
  {
    sec: '2.3 · 2.5',
    stop: ['Bus stop', 'பஸ் நிறுத்தம்', 'බස් නැවතුම'],
    place: ['Bus stop', 'பஸ் நிறுத்தம்', 'බස් නැවතුම'],
    story: [
      'Nimal is riding at 8 m/s when he sees the bus stop. He brakes, and his velocity drops by 2 m/s every second until he stops.',
      'பஸ் நிறுத்தத்தைப் பார்க்கும்போது நிமல் 8 m/s வேகத்தில் போகிறான். பிரேக் போடுகிறான்; நிற்கும் வரை ஒவ்வொரு விநாடியும் திசைவேகம் 2 m/s குறைகிறது.',
      'බස් නැවතුම දකින විට නිමල් m/s 8න් යනවා. ඔහු තිරිංග තදකරනවා; නවතින තුරු සෑම තත්පරයකම ප්‍රවේගය m/s 2කින් අඩු වෙනවා.',
    ],
    legs: [{ v: 8, a: -2, d: 4 }],
    ask: {
      q: ['How far does he travel while braking?', 'பிரேக் போடும்போது அவன் எவ்வளவு தூரம் போகிறான்?', 'තිරිංග තද කරන අතරේ ඔහු කොච්චර දුරක් යනවාද?'],
      opts: [n('8 m'), n('16 m'), n('32 m'), n('4 m')],
      right: 1,
      why: ['He stops after 8 ÷ 2 = 4 s. The distance is the area under the velocity–time graph: ½ × 4 s × 8 m/s = 16 m.', '8 ÷ 2 = 4 s-இல் நிற்கிறான். தூரம் திசைவேக–நேர வரைபின் கீழுள்ள பரப்பு: ½ × 4 s × 8 m/s = 16 m.', 'ඔහු 8 ÷ 2 = s 4කින් නවතිනවා. දුර යනු ප්‍රවේග–කාල ප්‍රස්තාරය යට වර්ගඵලයයි: ½ × s 4 × m/s 8 = m 16.'],
    },
    read: {
      graph: 'v',
      q: ['Tap the moment Nimal stopped.', 'நிமல் நின்ற நேரத்தைத் தொடு.', 'නිමල් නැවතුණු මොහොත තට්ටු කරන්න.'],
      ok: (t) => near(t, 4, 0.35),
      why: ['He stops where the line reaches v = 0, at t = 4 s. The area of the triangle under the line is the 16 m he travelled.', 'கோடு v = 0-ஐத் தொடும் இடத்தில், t = 4 s-இல் நிற்கிறான். கோட்டின் கீழுள்ள முக்கோணத்தின் பரப்புதான் அவன் போன 16 m.', 'රේඛාව v = 0 වෙත ළඟා වන තැන, t = 4 s දී ඔහු නවතිනවා. රේඛාව යට ත්‍රිකෝණයේ වර්ගඵලය ඔහු ගිය m 16යි.'],
    },
    goal: {
      q: ['The bus stop is 40 m ahead and Nimal rides at 8 m/s. How long should he keep riding before he brakes (2 m/s² as before) to stop right at the bus stop?', 'பஸ் நிறுத்தம் 40 m முன்னால், நிமல் 8 m/s-இல் போகிறான். பஸ் நிறுத்தத்திலேயே நிற்க (முன்பு போல 2 m/s²) பிரேக் போடுவதற்கு முன் எவ்வளவு நேரம் ஓட்ட வேண்டும்?', 'බස් නැවතුම m 40ක් ඉදිරියෙන්, නිමල් m/s 8න් යනවා. බස් නැවතුමේම නවතින්න (පෙර පරිදි m/s² 2) තිරිංග තද කිරීමට පෙර ඔහු කොච්චර වෙලා පදින්න ඕනද?'],
      controls: [{ key: 'r', l: ['Ride before braking', 'பிரேக்குக்கு முன் ஓட்டு', 'තිරිංගයට පෙර පදින්න'], min: 0, max: 5, step: 0.5, unit: 's', start: 1 }],
      legs: (c) => [{ v: 8, a: 0, d: c.r! }, { v: 8, a: -2, d: 4 }],
      ok: (_c, e) => near(e.s, 40, 1),
      say: (_c, e) => {
        const off = e.s - 40;
        return Math.abs(off) <= 1
          ? ['He stopped at ' + r1(e.s) + ' m, right at the bus stop.', 'அவன் ' + r1(e.s) + ' m-இல், சரியாக பஸ் நிறுத்தத்தில் நின்றான்.', 'ඔහු m ' + r1(e.s) + ' දී, හරියටම බස් නැවතුමේ නැවතුණා.']
          : off < 0
            ? ['He stopped at ' + r1(e.s) + ' m: ' + r1(-off) + ' m short of the bus stop.', 'அவன் ' + r1(e.s) + ' m-இல் நின்றான்: பஸ் நிறுத்தத்துக்கு ' + r1(-off) + ' m முன்னால்.', 'ඔහු m ' + r1(e.s) + ' දී නැවතුණා: බස් නැවතුමට m ' + r1(-off) + 'ක් මෙපිටින්.']
            : ['He stopped at ' + r1(e.s) + ' m: ' + r1(off) + ' m past the bus stop.', 'அவன் ' + r1(e.s) + ' m-இல் நின்றான்: பஸ் நிறுத்தத்தைத் தாண்டி ' + r1(off) + ' m.', 'ඔහු m ' + r1(e.s) + ' දී නැවතුණා: බස් නැවතුම පසුකර m ' + r1(off) + 'ක්.'];
      },
      why: ['Braking always takes 16 m, so he rides 40 − 16 = 24 m first: 24 m ÷ 8 m/s = 3 s.', 'பிரேக்குக்கு எப்போதும் 16 m ஆகும், எனவே முதலில் 40 − 16 = 24 m ஓட்டுகிறான்: 24 m ÷ 8 m/s = 3 s.', 'තිරිංග කිරීමට සැමවිටම m 16ක් යයි, එනිසා ඔහු මුලින් 40 − 16 = m 24ක් පදිනවා: m 24 ÷ m/s 8 = s 3.'],
      target: 40,
    },
  },
];
