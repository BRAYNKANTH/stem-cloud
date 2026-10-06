/* Authenticated pilot question bank. Its attempts/drafts are separate from lesson XP. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), H = {'Content-Type':'application/json','X-Requested-With':'stemcloud'};
  const user = window.SCX_USER;
  if (!user) { $('pp-status').textContent='Please sign in to use Past Papers.'; return; }
  const legacyKey = 'stem_pp_' + user.id, key = 'stem_pp_physics_' + user.id;
  let state, bank, catalog, current, banks={}, year=2015, visible=[], lesson=new URLSearchParams(location.search).get('lesson')||'', syncing=false;
  const yearBank=()=>banks[year];
  let lang=localStorage.getItem('lessonLang')==='ta'?'ta':'en';
  try { state=JSON.parse(localStorage.getItem(key)||localStorage.getItem(legacyKey)||'{}'); } catch (_) { state={}; }
  state=Object.assign({drafts:{},events:[],pending:[],bookmarks:[],bookmarkPending:{},exam:null},state);
  if(state.exam)delete state.exam.finishing; // a reload must not retain an in-memory submission lock
  const t=(en,ta)=>lang==='ta'?ta:en, tr=o=>o?.[lang]||o?.en||'', esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const subject=s=>({biology:t('Biology','உயிரியல்'),chemistry:t('Chemistry','இரசாயனவியல்'),physics:t('Physics','பௌதிகவியல்')}[s]||s);
  const topicLabels={'Acids and bases':'அமிலங்களும் காரங்களும்','Atomic structure':'அணுக் கட்டமைப்பு','Biodiversity':'உயிர்ப்பல்வகைமை','Bonding':'பிணைப்பு','Buoyancy':'மேலுதைப்பு','Carbon':'காபன்','Cells':'கலங்கள்','Chemical reactions':'இரசாயனத் தாக்கங்கள்','Circuits':'மின்சுற்றுகள்','Classification':'வகைப்பாடு','Coastal environment':'கரையோரச் சூழல்','Combustion':'தகனம்','Density':'அடர்த்தி','Diffusion':'பரவல்','Digestion':'சமிபாடு','Ecology':'சூழலியல்','Ecosystems':'சூழற்றொகுதிகள்','Electrical heating':'மின் வெப்பமாக்கல்','Electrical safety':'மின்சாரப் பாதுகாப்பு','Electrochemistry':'மின்இரசாயனம்','Electronics':'இலத்திரனியல்','Energy changes':'சக்தி மாற்றங்கள்','Environment':'சூழல்','Evolution':'கூர்ப்பு','Forces':'விசைகள்','Gas laws':'வாயு விதிகள்','Gas tests':'வாயுச் சோதனைகள்','Gases':'வாயுக்கள்','Heat':'வெப்பம்','Human body':'மனித உடல்','Human physiology':'மனித உடற்றொழிலியல்','Inheritance':'மரபுரிமை','Liquid pressure':'திரவ அமுக்கம்','Materials':'பொருள்கள்','Metals':'உலோகங்கள்','Moles and energy':'மூல்களும் சக்தியும்','Motion':'இயக்கம்','Motion and momentum':'இயக்கமும் உந்தமும்','Nervous system':'நரம்புத் தொகுதி','Optics':'ஒளியியல்','Plant classification':'தாவர வகைப்பாடு','Plant growth':'தாவர வளர்ச்சி','Plant tissues':'தாவர இழையங்கள்','Potential energy':'அழுத்தச் சக்தி','Reaction rates':'தாக்க வீதங்கள்','Refraction':'முறிவு','Reproduction':'இனப்பெருக்கம்','Respiratory system':'சுவாசத் தொகுதி','Science and society':'விஞ்ஞானமும் சமூகமும்','Semiconductors':'அரைக்கடத்திகள்','Simple machines':'எளிய பொறிகள்','Solutions':'கரைசல்கள்','Sound':'ஒலி','Sustainable technology':'நிலைத்த தொழில்நுட்பம்','Technology':'தொழில்நுட்பம்','Temperature':'வெப்பநிலை','Transpiration':'ஆவியுயிர்ப்பு','Vertebrates':'முள்ளந்தண்டுளிகள்','Vision':'பார்வை','Waves':'அலைகள்'};
  const topic=s=>lang==='ta'?(topicLabels[s]||s):s;
  Object.assign(topicLabels,{'Measurement':'அளவீடு','Energy':'சக்தி','Friction':'உராய்வு','Electromagnetism':'மின்காந்தவியல்','Electromagnetic induction':'மின்காந்தத் தூண்டல்','Transformers':'நிலைமாற்றிகள்','Electrical energy':'மின் சக்தி'});
  const active=()=>!!state.exam && !state.exam.submitted;
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(state)); }
    catch (_) { status(t('Device storage is full. Keep this page open and connect to save your answers.','சாதனச் சேமிப்பு நிரம்பியுள்ளது. பக்கத்தைத் திறந்தபடி வைத்து இணைப்பைப் பெற்று விடைகளைச் சேமிக்கவும்.')); }
  }
  function status(s, retry=false) {
    $('pp-status').textContent=s;
    if (retry) { const b=document.createElement('button'); b.textContent=t('Retry sync','மீண்டும் ஒத்திசைக்கவும்'); b.onclick=()=>sync(); $('pp-status').append(' ',b); }
  }
  function id() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2); }
  function hasResponse(r) { return r && (r.type==='mcq'?Number.isInteger(r.choice):Object.values(r.answers||{}).some(s=>s.trim())); }
  function latest(q) {
    const events=state.events.filter(e=>e.question===q.id);
    // An unanswered exam entry must not erase a previous written response in review.
    return [...events].reverse().find(e=>hasResponse(e.result))||events.at(-1);
  }
  function weak(q) { const r=latest(q)?.result; return r && (r.type==='mcq'?!r.correct:r.selfCheck==='needs-work'); }
  function mergeEvents(rows) {
    const m=new Map(state.events.map(e=>[e.id,e])); rows.forEach(e=>m.set(e.id,e));
    state.events=[...m.values()].sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id));
  }
  async function api(path, method='GET',data) {
    const r=await fetch('/api/past-papers/'+path,{method,headers:H,credentials:'same-origin',body:data?JSON.stringify(data):undefined});
    if (!r.ok) { let msg=''; try { msg=(await r.json()).detail; } catch (_) {}
      const e=new Error(msg||'Sync failed'); e.code=r.status; throw e; }
    return r.json();
  }
  async function sync() {
    if (syncing) return; syncing=true;
    try {
      while (state.pending.length) {
        const batch=[];
        for(const event of state.pending.slice(0,50)) {
          if(batch.length&&new TextEncoder().encode(JSON.stringify({events:[...batch,event]})).length>500000)break;
          batch.push(event);
        }
        const result=await api('attempts','POST',{events:batch});
        mergeEvents(result.attempts); const sent=new Set(batch.map(e=>e.id)); state.pending=state.pending.filter(e=>!sent.has(e.id)); persist();
      }
      for (const q of Object.keys(state.bookmarkPending)) {
        const saved=state.bookmarkPending[q]; await api('bookmark','PUT',{question:q,saved});
        if (state.bookmarkPending[q]===saved) delete state.bookmarkPending[q]; persist();
      }
      status(t('Saved to your account. Unsubmitted drafts stay on this device.','உங்கள் கணக்கில் சேமிக்கப்பட்டது. சமர்ப்பிக்காத வரைவுகள் இச்சாதனத்தில் உள்ளன.'));
    } catch(e) {
      status(e.code===401?t('Session expired. Sign in again to sync; drafts remain on this device.','அமர்வு காலாவதியானது. ஒத்திசைக்க மீண்டும் உள்நுழைக; வரைவு சாதனத்தில் உள்ளது.'):
        t('Saved on this device; account sync is pending.','இச்சாதனத்தில் சேமிக்கப்பட்டது; கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.'),true);
    } finally { syncing=false; stats(); }
  }
  function enqueue(events) {
    events.forEach(e=> {
      const q=bank.questions.find(q=>q.id===e.question);
      const result=q.type==='mcq'?{type:'mcq',choice:e.choice,correct:e.choice===q.correct,correctChoice:q.correct,mode:e.mode}:
        {type:'written',answers:e.answers,selfCheck:e.selfCheck,mode:e.mode};
      mergeEvents([{id:e.id,question:e.question,result,at:Date.now()}]);
    });
    state.pending.push(...events); persist(); sync();
  }
  function stats() {
    if (!bank) return;
    const rows=yearBank().questions, attempts=rows.filter(q=>hasResponse(latest(q)?.result)), mcqs=attempts.filter(q=>q.type==='mcq'), saved=rows.filter(q=>state.bookmarks.includes(q.id)).length;
    $('pp-stats').textContent=t(`${attempts.length}/${rows.length} questions attempted · ${mcqs.filter(q=>latest(q).result.correct).length}/${mcqs.length} latest MCQs correct · ${saved} bookmarked`,
      `${rows.length} இல் ${attempts.length} வினாக்கள் முயற்சிக்கப்பட்டன · அண்மைய தெரிவு விடைகள் ${mcqs.filter(q=>latest(q).result.correct).length}/${mcqs.length} சரி · ${saved} சேமிப்புகள்`);
  }
  function applyLang(l) {
    lang=l==='ta'?'ta':'en'; localStorage.setItem('lessonLang',lang); document.documentElement.lang=lang;
    document.querySelectorAll('[data-en][data-ta]').forEach(e=>e.textContent=e.dataset[lang]);
    $('pp-en').setAttribute('aria-pressed',lang==='en'); $('pp-ta').setAttribute('aria-pressed',lang==='ta');
    const sets={
      'pp-type':['All types','MCQ','Written'],
      'pp-review':['All questions','Bookmarked','Needs practice','Not attempted']};
    const tas={'pp-type':['எல்லா வகைகளும்','தெரிவு','எழுத்து'], 'pp-review':['எல்லா வினாக்களும்','சேமிப்புகள்','பயிற்சி தேவை','முயற்சிக்காதவை']};
    Object.keys(sets).forEach(k=>[...$(k).options].forEach((o,i)=>o.textContent=lang==='ta'?tas[k][i]:sets[k][i]));
    if (bank) {
      $('pp-note').textContent=tr(yearBank().editorialNote);
      $('pp-coverage').textContent=tr(yearBank().coverageNote);$('pp-coverage').hidden=!tr(yearBank().coverageNote);
      [...$('pp-topic').options].forEach(o=>o.textContent=o.value?topic(o.value):t('All topics','எல்லாத் தலைப்புகளும்'));
      [...$('pp-year').options].forEach(o=> {const p=catalog.papers.find(p=>String(p.year)===o.value);if(p)o.textContent=p.examLabel;});
      status(t('Drafts save on this device. Saved attempts sync to your account.','வரைவுகள் இச்சாதனத்தில் சேமிக்கப்படும். சேமித்த முயற்சிகள் கணக்கிற்கு ஒத்திசைக்கப்படும்.'));
      if(state.exam?.submitted&&state.exam.score!==undefined){$('pp-result').textContent=examResult(state.exam);$('pp-result').hidden=(state.exam.year||2015)!==year;}
      filters(false); examBar();
    }
  }
  window.applyLang=applyLang;
  $('pp-en').onclick=()=>applyLang('en'); $('pp-ta').onclick=()=>applyLang('ta');
  function filters(reset=true) {
    if (!bank) return;
    const type=$('pp-type').value, topic=$('pp-topic').value, review=$('pp-review').value, search=$('pp-search').value.trim().toLowerCase();
    visible=bank.questions.filter(q=>q.year===year && (active()?q.paper===state.exam.paper:
      (!type||q.type===type)&&(!topic||q.topics.includes(topic))&&(!lesson||q.lessons.includes(lesson))&&
      (!search||JSON.stringify([q.prompt,q.topics,q.parts?.map(p=>p.prompt)]).toLowerCase().includes(search))&&
      (!review||review==='saved'&&state.bookmarks.includes(q.id)||review==='weak'&&weak(q)||review==='unattempted'&&!hasResponse(latest(q)?.result))));
    if (reset||!visible.some(q=>q.id===current)) current=visible[0]?.id;
    $('pp-lesson').hidden=!lesson; $('pp-lesson').textContent=t('Showing questions linked to this lesson. Clear filters to see the whole paper.','இப்பாடத்துடன் இணைந்த வினாக்கள். முழுத்தாளுக்கும் வடிகட்டிகளை நீக்கவும்.');
    $('pp-list').innerHTML=visible.map(q=>`<button type="button" data-q="${q.id}" tabindex="${q.id===current?0:-1}" aria-current="${q.id===current}">${esc(qLabel(q))}<span class="pp-nav-meta">${esc(q.subjects.map(subject).join(' · '))}${active()&&q.paper==='II'?(state.exam.selected.includes(q.id)?' ✓':t(' · optional',' · தெரிவு')):latest(q)?(weak(q)?' · ↻':hasResponse(latest(q).result)?' · ✓':t(' · not answered',' · விடையில்லை')):''}</span></button>`).join('');
    $('pp-list').querySelectorAll('button').forEach(b=> {
      b.onclick=()=>{current=b.dataset.q; filters(false); $('pp-question').focus();};
      b.onkeydown=e=> {if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key))return;
        e.preventDefault(); const i=visible.findIndex(q=>q.id===current), next=Math.max(0,Math.min(visible.length-1,i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)));
        current=visible[next].id; filters(false); const selected=$('pp-list').querySelector('[aria-current=true]');selected.focus();selected.scrollIntoView({block:'nearest',inline:'nearest'});
      };
    });
    render(); stats();
  }
  function qLabel(q) { return t(`Paper ${q.paper} · Q${q.number}`,`தாள் ${q.paper} · வினா ${q.number}`); }
  function draft(q) {
    if (active()) return state.exam.responses[q.id]||(state.exam.responses[q.id]={answers:{}});
    const d=state.drafts[q.id]||(state.drafts[q.id]={answers:{},choice:null});
    if(!d.touched && latest(q)) {
      if(q.type==='mcq')d.choice=latest(q).result.choice;
      else d.answers=structuredClone(latest(q).result.answers||{});
    }
    return d;
  }
  function scan(q) {
    return `<details class="pp-scan" ><summary>${esc(t('Original Science source pages · may include other subjects','மூலத் தமிழ் பக்கங்கள் · பெரிதாக்க முழுப்படத்தைத் திறக்கவும்'))}</summary>${q.pages.map(n=>{
      const url='/lessons/past-papers/'+q.year+'/page-'+String(n).padStart(2,'0')+'.jpg';
      return `<a href="${url}" target="_blank" rel="noopener">${esc(t('Open source page '+n+' ↗','மூலப் பக்கம் '+n+' ↗'))}</a><img src="${url}" loading="lazy" alt="${esc(t('Original Tamil paper, PDF page '+n+'; digital question text follows the scan.','மூலத் தமிழ் வினாத்தாள், PDF பக்கம் '+n+'; இலக்க வினா உரை கீழே உள்ளது.'))}">`;
    }).join('')}</details>`;
  }
  function steps(list) { return list?.length?'<ol>'+list.map(s=>'<li>'+esc(tr(s))+'</li>').join('')+'</ol>':''; }
  function workedSteps(list) {
    return list?.length?'<h4>'+esc(t('Worked steps','விடை காணும் படிகள்'))+'</h4>'+steps(list):'';
  }
  function teachingIntro(item) {
    const d=item.detailedExplanation;
    if(!d)return '';
    return `<div class="pp-teaching"><h4>${esc(t('Concept to understand','புரிந்துகொள்ள வேண்டிய கருத்து'))}</h4><p>${esc(tr(d.concept))}</p><h4>${esc(t('Why this works','இது ஏன் பொருந்துகிறது'))}</h4><p>${esc(tr(d.reasoning))}</p></div>`;
  }
  function teachingTail(item) {
    const d=item.detailedExplanation;
    if(!d)return links(item.lessons);
    const refs=(item.references||[]).filter(r=>r.kind==='lesson').map(r=>`<li><a href="${esc(r.url)}">${esc(t(`Grade ${r.grade} · Chapter ${r.chapter}: `,`தரம் ${r.grade} · அத்தியாயம் ${r.chapter}: `)+tr(r.title))}</a></li>`).join('');
    const books=(item.references||[]).filter(r=>r.kind==='textbook').sort((a,b)=>(a.language===lang?0:1)-(b.language===lang?0:1));
    const pageRange=r=>r.printedPages[0]===r.printedPages[1]?String(r.printedPages[0]):r.printedPages.join('–');
    const bookRows=books.map(r=>`<li><a class="pp-book-ref" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(tr(r.title)+' · '+(r.language==='ta'?t('Tamil','தமிழ்'):t('English','ஆங்கிலம்'))+' · '+t('printed p. ','அச்சுப் ப. ')+pageRange(r))} ↗</a><p>${esc(tr(r.section))} · ${esc(r.support==='direct'?t('Supports this answer','இவ்விடையை ஆதரிக்கிறது'):t('Related reading','தொடர்புடைய வாசிப்பு'))}</p>${r.note?'<p class="pp-muted">'+esc(tr(r.note))+'</p>':''}</li>`).join('');
    const coverage=item.textbookReferenceStatus==='not-matched'?t('No matching passage verified in the supplied textbooks for this answer.','இவ்விடைக்கு வழங்கிய பாடநூல்களில் பொருத்தமான பகுதி உறுதிப்படுத்தப்படவில்லை.'):item.textbookReferenceStatus==='related-only'?t('The linked pages explain related principles; they do not directly verify the complete answer.','இணைத்த பக்கங்கள் தொடர்புடைய தத்துவங்களை விளக்குகின்றன; முழு விடையையும் நேரடியாக உறுதிப்படுத்தவில்லை.'):'';
    return `<aside class="pp-mistake"><h4>${esc(t('Common mistake','பொதுவான தவறு'))}</h4><p>${esc(tr(d.commonMistake))}</p></aside><details class="pp-similar"><summary>${esc(t('Try a similar question','இதே போன்ற வினாவை முயற்சிக்கவும்'))}</summary><p>${esc(tr(d.practice.question))}</p><details><summary>${esc(t('Show practice answer','பயிற்சி விடையைக் காட்டவும்'))}</summary><p>${esc(tr(d.practice.answer))}</p></details></details><div class="pp-references">${refs?'<h4>'+esc(t('Lesson chapter references','பாட அத்தியாய மேற்கோள்கள்'))+'</h4><ul>'+refs+'</ul>':''}<h4>${esc(t('Textbook references','பாடநூல் மேற்கோள்கள்'))}</h4>${bookRows?'<ul class="pp-book-references">'+bookRows+'</ul>':''}${coverage?'<p class="pp-muted">'+esc(coverage)+'</p>':''}${books.length?'<p class="pp-muted">'+esc(t('Links open the matching PDF page. Printed page numbers differ between Tamil and English editions. These pages support learning; the worked solution remains a model answer.','இணைப்புகள் பொருத்தமான PDF பக்கத்தைத் திறக்கும். தமிழ், ஆங்கிலப் பதிப்புகளில் அச்சுப் பக்க எண்கள் வேறுபடும். இவை கற்றலை ஆதரிக்கும்; விடை மாதிரி விடையாகவே உள்ளது.'))+'</p>':''}</div>`;
  }
  function modelDiagram(q,p) {
    if(q.year!==2015)return '';
    if(q.number===3&&p.label==='C(iii)') return '<svg class="pp-model-diagram" viewBox="0 0 400 260" role="img" aria-label="Charles law graph: volume V vertically, absolute temperature T in kelvin horizontally; straight line through origin"><g fill="none" stroke="black" stroke-width="2"><path d="M60 30V215H360 M55 40L60 30L65 40 M350 210L360 215L350 220 M60 215L320 50"/></g><g font-size="17" fill="black"><text x="28" y="35">V</text><text x="300" y="245">T (K)</text><text x="42" y="240">0</text><text x="100" y="55">Constant pressure</text></g></svg>';
    if(q.number===4&&p.label==='C(ii)') return '<svg class="pp-model-diagram" viewBox="0 0 400 160" role="img" aria-label="Two-input OR gate: inputs A and B, output Q"><path d="M105 35 Q150 80 105 125 Q220 135 260 80 Q220 25 105 35Z" fill="none" stroke="black" stroke-width="3"/><path d="M40 55H120 M40 105H120 M260 80H350" stroke="black" stroke-width="3"/><text x="15" y="60">A</text><text x="15" y="110">B</text><text x="360" y="85">Q</text></svg>';
    if(q.number===4&&p.label==='B(v)(a)') return '<svg class="pp-model-diagram" viewBox="0 0 480 260" role="img" aria-label="Ohm law model circuit: battery switch rheostat ammeter and resistor in series; voltmeter across resistor"><g fill="none" stroke="black" stroke-width="2"><path d="M45 60H110 M110 45V75 M122 35V85 M122 60H170 M170 60L200 40 M200 60H230 M280 60H335 M375 60H430V205H330 M255 205H45V60 M255 205V140H278 M307 140H330V205"/><rect x="230" y="49" width="50" height="22"/><path d="M235 82L275 38 M267 40L275 38L274 47"/><circle cx="355" cy="60" r="20"/><rect x="255" y="193" width="75" height="24"/><circle cx="292" cy="140" r="16"/></g><g fill="black" font-size="17"><text x="349" y="66">A</text><text x="286" y="146">V</text><text x="270" y="239">R</text><text x="90" y="112">Battery</text><text x="160" y="25">Switch</text><text x="230" y="112">Rheostat</text></g></svg>';
    if(q.number===10&&p.label==='iii(a)') return '<svg class="pp-model-diagram" viewBox="0 0 440 170" role="img" aria-label="Photodiode: incoming light arrows, anode left positive, cathode bar right negative; conventional terminal labels"><g fill="none" stroke="black" stroke-width="3"><path d="M35 110H170 M220 110H400 M170 85L215 110L170 135Z M220 83V137 M210 25L182 64 M238 30L210 68 M183 52L182 64L194 60 M211 56L210 68L222 64"/></g><g font-size="16" fill="black"><text x="20" y="150">Anode (+)</text><text x="300" y="150">Cathode (−)</text><text x="40" y="25">Incoming light</text></g></svg>';
    return '';
  }
  function render() {
    const q=visible.find(q=>q.id===current), area=$('pp-question');
    if (!q) { area.innerHTML='<p>'+esc(t('No matching questions. Try clearing the filters.','பொருந்தும் வினாக்கள் இல்லை. வடிகட்டிகளை நீக்கவும்.'))+'</p>'; return; }
    const d=draft(q), previous=latest(q), reveal=!active()&&previous;
    area.setAttribute('aria-label',qLabel(q)); document.title=qLabel(q)+' · Past Papers · STEM Cloud';
    let html=`<div class="pp-qhead"><div><h2>${esc(qLabel(q))}</h2><span class="pp-tag">${esc(q.topics.map(topic).join(' · '))}${q.marks?' · '+q.marks+' '+esc(t('source marks','மூலப் புள்ளிகள்')):''}</span></div><button type="button" id="pp-bookmark" aria-pressed="${state.bookmarks.includes(q.id)}">${esc(t('Bookmark','சேமிக்கவும்'))}</button></div><p>${esc(tr(q.prompt))}</p>`;
    if (q.figure) html+=`<figure><a href="${q.figure}" target="_blank" rel="noopener"><img src="${q.figure}" alt="${esc(t('Original diagram or typography for question '+q.number+'; open image for detail.','வினா '+q.number+' இன் மூலப் படம்; விவரத்திற்கு படத்தைத் திறக்கவும்.'))}"></a><figcaption>${esc(t('Original question panel — option numbers follow the scan.','மூல வினாப் பகுதி — தெரிவு எண்கள் மூலத்தாளின் வரிசையில்.'))}</figcaption></figure>`;
    if(q.sourceDescription)html+='<p class="pp-muted">'+esc(tr(q.sourceDescription))+'</p>';
    if (q.type==='mcq') {
      html+=`<fieldset class="pp-options"><legend>${esc(t('Choose one answer','ஒரு விடையைத் தேர்க'))}</legend>${q.options.map((o,i)=>`<label><input type="radio" name="pp-choice" value="${i}" ${d.choice===i?'checked':''}><span>${i+1}. ${esc(tr(o))}</span></label>`).join('')}</fieldset>`;
      if(!active()) html+=`<button type="button" id="pp-check" ${Number.isInteger(d.choice)?'':'disabled'}>${esc(t('Check answer','விடையைச் சரிபார்க்கவும்'))}</button><details><summary>${esc(t('Hint','குறிப்பு'))}</summary><p>${esc(tr(q.hint))}</p></details>`;
      if(reveal) html+=`<section class="pp-feedback"><h3>${esc(previous.result.correct?t('Correct on your last attempt','அண்மைய முயற்சி சரி'):t('Review your last attempt','அண்மைய முயற்சியை மீள்பார்க'))}</h3><p>${esc(t('Correct option','சரியான தெரிவு'))}: ${q.correct+1}</p>${q.editorialWarning?'<p class="pp-notice">'+esc(tr(q.editorialWarning))+'</p>':''}<p>${esc(tr(q.explanation))}</p>${teachingIntro(q)}${workedSteps(q.steps)}<details><summary>${esc(t('Why the other options do not fit','ஏனைய தெரிவுகள் ஏன் பொருந்தவில்லை'))}</summary><ol>${q.optionExplanations.map(o=>'<li>'+esc(tr(o))+'</li>').join('')}</ol></details>${teachingTail(q)}</section>`;
      html+=scan(q);
    } else {
      html+=scan(q);
      html+=q.parts.map((p,i)=>`<section class="pp-part"><h3>${esc(p.label)} · ${esc(subject(p.subject))}</h3><p>${esc(tr(p.prompt))}</p><label for="pp-answer-${i}">${esc(t('Your answer','உங்கள் விடை'))}</label><textarea id="pp-answer-${i}" data-part="${esc(p.label)}" maxlength="2000">${esc(d.answers[p.label]||'')}</textarea>${active()?'':`<details><summary>${esc(t('Hint','குறிப்பு'))}</summary><p>${esc(tr(p.hint))}</p></details><details class="pp-solution"><summary>${esc(t('Show model answer · self-check','மாதிரி விடை · தன்னிலை மதிப்பீடு'))}</summary><div class="pp-feedback"><p>${esc(tr(p.answer))}</p>${teachingIntro(p)}${workedSteps(p.steps)}${modelDiagram(q,p)}${teachingTail(p)}</div></details>`}</section>`).join('');
      if(!active()) html+=`<div class="pp-row"><button type="button" id="pp-save-written">${esc(t('Save written attempt','எழுத்து முயற்சியைச் சேமிக்கவும்'))}</button><button type="button" data-self="needs-work">${esc(t('Needs more practice','மேலும் பயிற்சி தேவை'))}</button><button type="button" data-self="understood">${esc(t('I understand after checking','சரிபார்த்த பின் புரிந்தது'))}</button></div><p>${esc(t('Self-check only; no automatic written marks.','தன்னிலை மதிப்பீடு மட்டும்; தானியங்கி எழுத்துப் புள்ளிகள் இல்லை.'))}</p>`;
    }
    html+=`<div class="pp-row"><button type="button" id="pp-prev">${esc(t('Previous question','முந்தைய வினா'))}</button><button type="button" id="pp-next">${esc(t('Next question','அடுத்த வினா'))}</button></div>`;
    area.innerHTML=html;
    $('pp-bookmark').onclick=()=> { const saved=!state.bookmarks.includes(q.id); state.bookmarks=state.bookmarks.filter(x=>x!==q.id); if(saved)state.bookmarks.push(q.id); state.bookmarkPending[q.id]=saved; persist(); filters(false); sync(); };
    area.querySelectorAll('[name=pp-choice]').forEach(r=>r.onchange=()=> { d.choice=Number(r.value); d.touched=true; persist(); if($('pp-check'))$('pp-check').disabled=false; examProgress(); });
    if($('pp-check')) $('pp-check').onclick=()=> { enqueue([{id:id(),question:q.id,mode:'practice',choice:d.choice}]); filters(false); };
    area.querySelectorAll('textarea').forEach(a=>a.oninput=()=> {d.answers[a.dataset.part]=a.value; d.touched=true; persist(); examProgress(); status(t('Draft saved on this device. Submit or save an attempt to sync it.','வரைவு இச்சாதனத்தில் சேமிக்கப்பட்டது. ஒத்திசைக்க முயற்சியைச் சேமிக்கவும் அல்லது சமர்ப்பிக்கவும்.'));});
    const saveWritten=check=> { if(!Object.values(d.answers).some(a=>a.trim())) {status(t('Write an answer before saving an attempt.','முயற்சியைச் சேமிக்குமுன் விடை எழுதவும்.')); return;}
      enqueue([{id:id(),question:q.id,mode:'practice',answers:structuredClone(d.answers),selfCheck:check}]); filters(false); };
    if($('pp-save-written')) $('pp-save-written').onclick=()=>saveWritten(null);
    area.querySelectorAll('[data-self]').forEach(b=>b.onclick=()=>saveWritten(b.dataset.self));
    const index=visible.indexOf(q); $('pp-prev').disabled=index===0; $('pp-next').disabled=index===visible.length-1;
    $('pp-prev').onclick=()=>navigate(index-1); $('pp-next').onclick=()=>navigate(index+1);
  }
  function navigate(i) { current=visible[i].id; filters(false); $('pp-question').focus(); }
  function links(ids) { return ids?.length?'<p>'+esc(t('Review lesson: ','பாடத்தை மீள்பார்க: '))+ids.map(s=>`<a href="/lessons/${encodeURIComponent(s)}.html">${esc(s.replace(/^(g\d+-)?(chapter|unit)-\d+-/,'').replaceAll('-',' '))}</a>`).join(' · ')+'</p>':''; }
  function confirm(title,text) {
    $('pp-confirm-title').textContent=title; $('pp-confirm-text').textContent=text;
    return new Promise(resolve=> { const dialog=$('pp-confirm'); dialog.returnValue='cancel'; dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true}); dialog.showModal(); });
  }
  async function startExam(paper) {
    const p=yearBank().papers.find(x=>x.id===paper);
    if(!await confirm(t('Start paper practice '+paper,'தாள் பயிற்சி '+paper+' தொடங்குக'),tr(p.instructions)))return;
    state.exam={scope:"physics",year,paper,responses:{},selected:yearBank().questions.filter(q=>q.paper===paper).map(q=>q.id)};
    $('pp-result').hidden=true; persist(); examBar(); filters();
  }
  function examBar() {
    $('pp-controls').hidden=active(); $('pp-exam-bar').hidden=!active();
    if(active()) { $('pp-exam-title').textContent=year+' · '+t('Paper practice ','தாள் பயிற்சி ')+state.exam.paper; $('pp-instructions').textContent=tr(yearBank().papers.find(p=>p.id===state.exam.paper).instructions); examProgress(); }
  }
  function examProgress() {
    if(!active())return;
    const e=state.exam, answered=e.selected.filter(id=> {const r=e.responses[id]; return e.paper==='I'?Number.isInteger(r?.choice):Object.values(r?.answers||{}).some(s=>s.trim());}).length;
    $('pp-answered').textContent=t(`${answered}/${e.selected.length} selected questions have a response.`,`${e.selected.length} தெரிவு வினாக்களில் ${answered} இற்கு விடை உள்ளது.`);
  }
  function examResult(e) {
    return (e.year||2015)+' · '+t('Paper submitted. ','தாள் சமர்ப்பிக்கப்பட்டது. ')+(e.paper==='I'?t(`${e.score}/${e.selected.length} correct. Review individual explanations below.`,`${e.score}/${e.selected.length} சரி. கீழே தனித்தனி விளக்கங்களை மீள்பார்க.`):t(`${e.selected.length} written questions saved for self-checking; no automatic marks.`,`${e.selected.length} எழுத்து வினாக்கள் தன்னிலை மதிப்பீட்டிற்குச் சேமிக்கப்பட்டன; தானியங்கி புள்ளிகள் இல்லை.`));
  }
  async function finishExam() {
    if(!active()||state.exam.finishing)return;
    const e=state.exam;
    e.finishing=true;
    if(!await confirm(t('Submit this paper?','இத்தாளைச் சமர்ப்பிக்கவா?'),t('Unanswered MCQs receive zero. Model answers become available after submission.','விடையற்ற தெரிவு வினாக்களுக்கு பூச்சியம். சமர்ப்பித்த பின் மாதிரி விடைகள் கிடைக்கும்.'))) {delete e.finishing;return;}
    const events=e.selected.map(q=> {const r=e.responses[q]||{};return Object.assign({id:id(),question:q,mode:'exam'},e.paper==='I'?{choice:r.choice??null}:{answers:structuredClone(r.answers||{}),selfCheck:null});});
    const score=e.paper==='I'?events.filter(a=>a.choice===bank.questions.find(q=>q.id===a.question).correct).length:null;
    e.score=score; const result=examResult(e);
    e.submitted=true; delete e.finishing; e.result=result;
    // Keep submitted responses as practice drafts so students can review what they wrote.
    for(const q of e.selected) {
      const r=e.responses[q];
      if(r&&(Number.isInteger(r.choice)||Object.values(r.answers||{}).some(s=>s.trim())))state.drafts[q]=structuredClone(r);
    }
    enqueue(events); $('pp-result').textContent=result; $('pp-result').hidden=false; persist(); examBar(); filters();
  }
  $('pp-exam-i').onclick=()=>startExam('I'); $('pp-exam-ii').onclick=()=>startExam('II');
  $('pp-submit').onclick=()=>finishExam();
  $('pp-exit').onclick=async()=> {if(await confirm(t('Leave paper practice?','தாள் பயிற்சியிலிருந்து வெளியேறவா?'),t('Your responses remain as drafts; no score will be recorded.','விடைகள் வரைவாக இருக்கும்; புள்ளிகள் பதிவாகாது.'))) {for(const q of Object.keys(state.exam.responses))state.drafts[q]=state.exam.responses[q]; state.exam=null; persist(); examBar(); filters();}};
  ['pp-type','pp-topic','pp-review'].forEach(k=>$(k).onchange=()=>filters());
  $('pp-search').oninput=()=>filters();
  $('pp-clear').onclick=()=> {['pp-type','pp-topic','pp-review','pp-search'].forEach(k=>$(k).value=''); lesson=''; filters();};
  function setYear() {
    $('pp-year').value=String(year);state.year=year;persist();
    $('pp-topic').innerHTML='<option value="">'+esc(t('All topics','எல்லாத் தலைப்புகளும்'))+'</option>'+[...new Set(yearBank().questions.flatMap(q=>q.topics))].sort().map(s=>`<option value="${esc(s)}">${esc(topic(s))}</option>`).join('');
    $('pp-key').hidden=!yearBank().keySource;
    if(yearBank().keySource)$('pp-key').href=yearBank().keySource;
    $('pp-pdf').href=yearBank().sourcePdf;
    $('pp-note').textContent=tr(yearBank().editorialNote);
    $('pp-coverage').textContent=tr(yearBank().coverageNote);$('pp-coverage').hidden=!tr(yearBank().coverageNote);
  }
  $('pp-year').onchange=()=> {year=Number($('pp-year').value);setYear();$('pp-result').hidden=state.exam?.year!==year||!state.exam?.submitted;filters();};
  window.addEventListener('online',()=>sync());
  async function init() {
    try {
      const response=await fetch('/lessons/past-papers/catalog.json');
      if(!response.ok||response.redirected)throw new Error('Catalog not available');
      catalog=await response.json();
      const entries=catalog.papers.filter(p=>p.bank&&p.scope==='physics');
      const loaded=await Promise.all(entries.map(async p=> {
        const r=await fetch(p.bank);if(!r.ok||r.redirected)throw new Error('Bank not available');
        const b=await r.json();if(b.scope!=='physics')throw new Error('Physics bank requires refresh');
        b.questions.forEach(q=>q.year=b.year);banks[b.year]=b;return b;
      }));
      bank={questions:loaded.flatMap(b=>b.questions)};
      const byId=new Map(bank.questions.map(q=>[q.id,q]));
      const cleanAnswers=(qid,answers)=>Object.fromEntries(Object.entries(answers||{}).filter(([label])=>byId.get(qid)?.parts?.some(p=>p.label===label)));
      state.drafts=Object.fromEntries(Object.entries(state.drafts).filter(([qid])=>byId.has(qid)).map(([qid,d])=>[qid,{...d,answers:cleanAnswers(qid,d.answers)}]));
      state.events=state.events.filter(e=>byId.has(e.question)).map(e=>({...e,result:{...e.result,...(e.result.type==='written'?{answers:cleanAnswers(e.question,e.result.answers)}:{})}}));
      state.pending=state.pending.filter(e=>byId.has(e.question)).map(e=> {
        if(!e.answers)return e;
        const answers=cleanAnswers(e.question,e.answers);
        return {...e,answers,id:JSON.stringify(answers)===JSON.stringify(e.answers)?e.id:id()};
      });
      state.bookmarks=state.bookmarks.filter(qid=>byId.has(qid));
      state.bookmarkPending=Object.fromEntries(Object.entries(state.bookmarkPending).filter(([qid])=>byId.has(qid)));
      if(state.exam&&state.exam.scope!=='physics') {
        for(const [qid,d] of Object.entries(state.exam.responses||{}))if(byId.has(qid))state.drafts[qid]={...d,answers:cleanAnswers(qid,d.answers)};
        state.exam=null;
      }
      if(state.exam){state.exam.year=state.exam.year||2015;delete state.exam.deadline;delete state.exam.expired;}
      year=Number(active()?state.exam.year:state.year||2015);if(!banks[year])year=2015;
      persist();
      $('pp-filter-panel').open=innerWidth>760;
      $('pp-year').innerHTML=entries.map(p=>`<option value="${p.year}">${esc(p.examLabel)}</option>`).join('');
      setYear();
      applyLang(lang); examBar(); filters();
      if(state.exam?.submitted) {$('pp-result').textContent=state.exam.score!==undefined?examResult(state.exam):state.exam.result; $('pp-result').hidden=(state.exam.year||2015)!==year;}
      try {
        const remote=await api('state'); mergeEvents(remote.attempts);
        state.bookmarks=remote.bookmarks;
        Object.entries(state.bookmarkPending).forEach(([q,v])=>{state.bookmarks=state.bookmarks.filter(x=>x!==q);if(v)state.bookmarks.push(q);});
        persist(); filters(false); sync();
      } catch (_) {status(t('Using saved device data. Account sync is pending.','சாதனத் தரவு பயன்படுகிறது. கணக்கு ஒத்திசைவு நிலுவையில் உள்ளது.'),true);}
    } catch (_) {status(t('Question bank could not load. Connect and reload this page.','வினா வங்கி ஏற்றப்படவில்லை. இணைப்பைப் பெற்று மீளேற்றவும்.'));}
  }
  init();
})();
