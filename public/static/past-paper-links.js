/* Add relevant paper practice to the existing physics practice sections. */
(function () {
  'use strict';
  const lesson=location.pathname.split('/').pop().replace(/\.html$/,'');
  const mapped=['chapter-04-newtons-laws','chapter-05-friction','chapter-09-resultant-force','chapter-11-turning-effect','chapter-12-equilibrium',
    'unit-02-motion-in-a-straight-line','g10-chapter-15-hydrostatic-pressure','g10-chapter-18-work-energy-power','g10-chapter-19-current-electricity',
    'g11-chapter-04-waves','g11-chapter-05-geometrical-optics','g11-chapter-09-heat','g11-chapter-10-electric-appliances','g11-chapter-11-electronics','g11-chapter-13-electromagnetism'];
  if(!mapped.includes(lesson)||document.getElementById('stem-past-link'))return;
  const parent=document.getElementById('practice')||document.getElementById('exercises');
  if(!parent)return;
  const p=document.createElement('p'), a=document.createElement('a'); a.id='stem-past-link';a.className='btn';
  a.href='/lessons/past-papers.html?lesson='+encodeURIComponent(lesson);
  a.dataset.ta='இத்தலைப்பின் கடந்த பரீட்சை வினாக்களைப் பயிற்சி செய்க';
  a.dataset.si='මෙම මාතෘකාවට අදාළ පසුගිය විභාග ප්‍රශ්න පුහුණු වන්න';
  const en='Practise past-paper questions on this topic';
  function label(){const l=localStorage.getItem('lessonLang')||'en'; a.textContent=a.dataset[l]||en;}
  label();p.appendChild(a);parent.appendChild(p);
  document.addEventListener('click',()=>setTimeout(label,0));
})();
