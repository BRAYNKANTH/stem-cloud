/* Beginner comparisons, understanding checks, resume, and accessibility shared by both views. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, basics = doc.getElementById('basics');
  if (!basics || !window.StemLearningContent) return;
  var file = location.pathname.split('/').pop(), name = file.replace(/\.html$/, '');
  var lessonIds = {'unit-02-motion-in-a-straight-line':'u2','chapter-04-newtons-laws':'c4','chapter-05-friction':'c5','chapter-09-resultant-force':'c9','chapter-11-turning-effect':'c11','chapter-12-equilibrium':'c12','g10-chapter-15-hydrostatic-pressure':'g10c15','g10-chapter-18-work-energy-power':'g10c18','g10-chapter-19-current-electricity':'g10c19','g11-chapter-04-waves':'g11c04','g11-chapter-05-geometrical-optics':'g11c05','g11-chapter-09-heat':'g11c09','g11-chapter-10-electric-appliances':'g11c10','g11-chapter-11-electronics':'g11c11','g11-chapter-13-electromagnetism':'g11c13'};
  var id = lessonIds[name], data = window.StemLearningContent[id]; if (!data) return;
  function get(k,d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch(e) { return d; } }
  function save(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch(e) {} }
  function lang() { return window.stemLang ? window.stemLang() : root.lang; }
  function t(a) { return a[lang()==='ta'?1:lang()==='si'?2:0]; }
  function el(tag,cls,text) { var n=doc.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n; }
  var checked = get('scx_path_checks_'+id,{}), answers={}, comparisons={};
  var position=get('scx_position_'+id,{}), route=position.route==='explore'?'explore':'study', savedStory=position.story||0, resuming=/[?&]resume=1\b/.test(location.search);
  var start=doc.querySelector('#fw_path'), chooser=el('div','learning-chooser'); chooser.setAttribute('data-no-si','');
  var box=el('div','learning-checks'); box.setAttribute('data-no-si',''); basics.appendChild(box);
  var progress=el('p','learning-status'); progress.setAttribute('data-no-si',''); basics.insertBefore(progress,basics.firstChild);
  start.insertBefore(chooser,start.firstChild);
  var copy={explore:['Explore the idea','கருத்தை ஆராய்','අදහස ගවේෂණය කරන්න'],study:['Study for O/L','சா/த கற்க','සා/පෙ සඳහා ඉගෙන ගන්න'],choose:['Choose your learning path','கற்றல் பாதையைத் தேர்ந்தெடு','ඉගෙනුම් මාර්ගය තෝරන්න'],hint:['New to this? Start with a short story, a comparison and two questions. You can study the formulas afterwards.','புதியவரா? சிறிய கதை, ஒப்பீடு, இரு கேள்விகளுடன் தொடங்கு. பிறகு சூத்திரங்களைக் கற்கலாம்.','අලුත්ද? කෙටි කතාවකින්, සැසඳීමකින් සහ ප්‍රශ්න දෙකකින් අරඹන්න. පසුව සූත්‍ර ඉගෙන ගත හැකිය.'],check:['Check the idea','கருத்தைச் சரிபார்','අදහස පරීක්ෂා කරන්න'],try:['Try the comparison','ஒப்பிட்டுப் பாரு','සැසඳීම කර බලන්න'],illustration:['Illustrated comparison — select each case and read what changes.','விளக்க ஒப்பீடு — ஒவ்வொரு நிலையையும் தேர்ந்தெடுத்து மாற்றத்தைப் படி.','නිදර්ශන සැසඳීම — එක් එක් අවස්ථාව තෝරා වෙනස කියවන්න.'],correct:['✓ You explained this idea.','✓ இந்த கருத்தை விளக்கினாய்.','✓ ඔබ මේ අදහස පැහැදිලි කළා.'],retry:['Try again. Think about the explanation below.','மீண்டும் முயற்சி செய். கீழே உள்ள விளக்கத்தை நினைத்துப் பாரு.','නැවත උත්සාහ කරන්න. පහත පැහැදිලි කිරීම ගැන සිතන්න.'],ready:['Understanding checked: 2 of 2 ideas. Try explaining them to someone in your own words.','புரிதல் சரிபார்க்கப்பட்டது: 2 கருத்துகள். உன் சொந்த வார்த்தைகளில் ஒருவருக்கு விளக்கு.','අදහස් 2ක් පරීක්ෂා කළා. ඔබේම වචනවලින් කෙනෙකුට පැහැදිලි කරන්න.'],pending:['Understanding check: ','புரிதல் சரிபார்ப்பு: ','අවබෝධ පරීක්ෂාව: '],prereq:['Helpful lessons before the formulas','சூத்திரங்களுக்கு முன் உதவும் பாடங்கள்','සූත්‍රවලට පෙර උපකාරී පාඩම්'],break:['One idea at a time. Take a break after this card, or explain the idea in your own words before continuing.','ஒரு நேரத்தில் ஒரு கருத்து. இந்த அட்டைக்குப் பின் ஓய்வெடு அல்லது தொடரும் முன் உன் வார்த்தைகளில் விளக்கு.','වරකට එක් අදහසක්. මේ කාඩ්පතෙන් පසු විවේකයක් ගන්න හෝ ඉදිරියට යෑමට පෙර ඔබේ වචනවලින් අදහස පැහැදිලි කරන්න.']};
  function paintStatus(){ var n=Object.keys(checked).filter(function(k){return checked[k];}).length; progress.textContent=n===2?t(copy.ready):t(copy.pending)+n+' / 2'; }
  function paintChooser(){
    chooser.textContent=''; chooser.appendChild(el('h2','',t(copy.choose))); chooser.appendChild(el('p','',t(copy.hint)));
    ['explore','study'].forEach(function(mode){ var b=el('button','btn learning-route',t(copy[mode])); b.type='button'; b.dataset.route=mode; b.setAttribute('aria-pressed',String(route===mode)); b.onclick=function(){ route=mode; position.route=mode; save('scx_position_'+id,position); paintChooser(); if(window.StemPlayer&&window.StemPlayer.setRoute)window.StemPlayer.setRoute(mode); }; chooser.appendChild(b); });
  }
  function paintChecks(){
    box.textContent=''; box.appendChild(el('h3','',t(copy.check)));
    data.questions.forEach(function(q,i){
      var card=el('div','learning-question'), heading=el('h4','', (i+1)+'. '+t(q.q)); card.appendChild(heading);
      var feedback=el('p','learning-feedback'); feedback.setAttribute('role','status'); feedback.setAttribute('aria-live','polite');
      // Alternate order by question and lesson; correctness is attached to the original option, not its position.
      var order=(i+id.length)%2?[1,0]:[0,1];
      order.forEach(function(j){ var b=el('button','btn learning-option',t(q.o[j])); b.type='button'; b.dataset.question=i; b.dataset.option=j; b.setAttribute('aria-pressed',String(answers[i]===j)); b.onclick=function(){answers[i]=j; if(j===q.c){checked['q'+i]=true; save('scx_path_checks_'+id,checked);} feedback.textContent=t(j===q.c?copy.correct:copy.retry)+' '+t(q.why); card.querySelectorAll('.learning-option').forEach(function(n){n.setAttribute('aria-pressed',String(+n.dataset.option===j));}); paintStatus(); doc.dispatchEvent(new CustomEvent('stem-understanding',{detail:{id:id,complete:!!checked.q0&&!!checked.q1}}));}; card.appendChild(b); });
      if(answers[i]!==undefined)feedback.textContent=t(answers[i]===q.c?copy.correct:copy.retry)+' '+t(q.why);
      card.appendChild(feedback); box.appendChild(card);
      if(i===0){ var compare=el('div','learning-compare'); compare.appendChild(el('h4','',t(copy.try))); compare.appendChild(el('p','',t(copy.illustration))); var output=el('p','learning-observation'); output.setAttribute('role','status');
        q.o.forEach(function(a,j){var b=el('button','btn',t(a));b.type='button'; b.dataset.case=j;b.setAttribute('aria-pressed',String(comparisons[i]===j));b.onclick=function(){comparisons[i]=j;output.textContent=t(a)+' — '+t(q.why); compare.querySelectorAll('button').forEach(function(n){n.setAttribute('aria-pressed',String(+n.dataset.case===j));});};compare.appendChild(b);});
        if(comparisons[i]!==undefined)output.textContent=t(q.o[comparisons[i]])+' — '+t(q.why); compare.appendChild(output); box.appendChild(compare);
      }
    });
  }
  var prereq=el('div','learning-prereq'); prereq.setAttribute('data-no-si',''); var notes=doc.getElementById('notes'); if(notes)notes.insertBefore(prereq,notes.firstChild);
  function paintPrereq(){prereq.textContent=''; if(!data.prereq.length)return; prereq.appendChild(el('h3','',t(copy.prereq)));data.prereq.forEach(function(key){var nm=Object.keys(lessonIds).filter(function(k){return lessonIds[k]===key;})[0],a=el('a','btn',nm.replace(/^(g\d+-)?(chapter-\d+-|unit-\d+-)/,'').replace(/-/g,' '));a.href=nm+'.html';a.dataset.lesson=key; if(window.StemSI&&lang()==='si')a.textContent=window.StemSI.t(a.textContent);prereq.appendChild(a);});}
  var breaks=[]; [].forEach.call(doc.querySelectorAll('#notesStage > .card'),function(card){var p=el('p','learning-break'); p.setAttribute('data-no-si','');card.appendChild(p);breaks.push(p);});
  function paint(){paintChooser();paintChecks();paintStatus();paintPrereq();breaks.forEach(function(p){p.textContent=t(copy.break);});}
  window.StemLearning={id:id,route:function(){return route;},complete:function(){return !!checked.q0&&!!checked.q1;},position:function(){return position;}, savedStory:savedStory,resuming:resuming};
  function rememberNotes(){var cards=[].slice.call(doc.querySelectorAll('#notesStage > .card')),active=doc.querySelector('#notesStage > .card.stage-active');if(active){position.note=cards.indexOf(active);save('scx_position_'+id,position);}}
  function restoreNotes(){if(!/[?&]resume=1\b/.test(location.search)||!(position.note>0))return;var b=doc.querySelector('#notesPath .path-stone[data-idx="'+position.note+'"]'); if(b)b.click();}
  restoreNotes();
  doc.addEventListener('click',function(e){if(e.target.closest('.path-stone,.sns-pill,#noteNextBtn,#notePrevBtn,.sb-next,.sb-back,.se-next,.se-back'))setTimeout(rememberNotes,80);});
  window.addEventListener('stem-story-line',function(e){if(e.detail){position.story=e.detail.i;save('scx_position_'+id,position);}});
  // Accessibility must also work when the user chooses the entire-page view.
  var gameSel='.match-tile,.sort-chip,[id^="bin_"]';
  function games(){[].forEach.call(doc.querySelectorAll(gameSel),function(n){n.setAttribute('role','button');n.tabIndex=0;n.setAttribute('aria-pressed',String(n.classList.contains('selected')));if(n.classList.contains('matched'))n.setAttribute('aria-disabled','true');else n.removeAttribute('aria-disabled');});}
  doc.addEventListener('keydown',function(e){if(window.StemPlayer&&window.StemPlayer.active)return;var n=e.target.closest(gameSel);if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();n.click();}});
  doc.addEventListener('click',function(e){if(e.target.closest(gameSel))setTimeout(games,30);});
  var pool=doc.getElementById('sortPool');if(pool)new MutationObserver(function(){games();if(doc.activeElement===doc.body&&pool.offsetParent){var n=pool.querySelector('.sort-chip')||doc.querySelector('[id^="bin_"]');if(n)n.focus({preventScroll:true});}}).observe(pool,{childList:true,subtree:true});games();
  // All lesson diagrams have an educational text equivalent nearby.
  [].forEach.call(doc.querySelectorAll('#fw_svg,#ls_svg'),function(svg){svg.setAttribute('aria-describedby','basics'); svg.setAttribute('aria-label',doc.title.replace(/\s*[—·].*$/,''));});
  var watch=doc.getElementById('watch'); if(watch){var p=el('p','learning-model-description');p.setAttribute('data-no-si',''); var hook=basics.querySelector('.bs-bridge p');p.textContent=hook?hook.textContent:'';watch.appendChild(p);}
  if(notes){var pause=el('button','btn learning-read-complete');pause.type='button';pause.setAttribute('data-no-si','');pause.onclick=function(){if(window.__fwMarkReal)window.__fwMarkReal('notes');};notes.appendChild(pause);function labelRead(){pause.textContent=t(['I have read these ideas','இந்த கருத்துகளைப் படித்தேன்','මම මේ අදහස් කියෙව්වා']);}labelRead();window.addEventListener('stem-lang',labelRead);}
  var fullPage=false;try{fullPage=localStorage.getItem('stem_view')==='scroll';}catch(e){}
  if(fullPage){
    ['activities','examples','practice','exercises','walkthroughs','recap','summary'].forEach(function(key){var section=doc.getElementById(key);if(!section)return;var b=el('button','btn learning-read-complete');b.type='button';b.textContent=t(['I have read this step','இந்த படியைப் படித்தேன்','මම මේ පියවර කියෙව්වා']);b.onclick=function(){if(window.__fwMarkReal)window.__fwMarkReal(key);};section.appendChild(b);});
    window.addEventListener('stem-story-line',function(e){if(e.detail&&e.detail.i===doc.querySelectorAll('.so-dots i').length-1&&window.__fwMarkReal)window.__fwMarkReal('story');});
    doc.addEventListener('stem-understanding',function(e){if(e.detail.complete&&window.__fwMarkReal)window.__fwMarkReal('basics');});
    doc.addEventListener('click',function(e){if(!e.target.closest('.qz-opt'))return;setTimeout(function(){var cards=doc.querySelectorAll('.qz-card');if(cards.length&&[].every.call(cards,function(c){return c.querySelector('.qz-opt:disabled');})&&window.__fwMarkReal)window.__fwMarkReal('quiz');},150);});
    var missions=doc.getElementById('ls_miss'); if(missions)new MutationObserver(function(){var all=missions.querySelectorAll('.ls-m');if(all.length===missions.querySelectorAll('.ls-m.ok').length&&window.__fwMarkReal)window.__fwMarkReal('lab');}).observe(missions,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    setInterval(function(){var s=doc.getElementById('fw_scrub');if(s&&+s.value>=995&&window.__fwMarkReal)window.__fwMarkReal('watch');},800);
  }
  window.addEventListener('stem-lang',function(){setTimeout(paint,120);});paint();
})();
