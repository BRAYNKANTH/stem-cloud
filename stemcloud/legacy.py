"""Serving the generated lesson pages: the app layer and the student's saved progress are injected into each page."""
import json, re
from pathlib import Path

from fastapi.responses import HTMLResponse

from .security import public


def safe_next(n: str) -> str:
    return n if n and n.startswith('/') and not n.startswith('//') and '\\' not in n else '/lessons/index.html'

def js_json(o) -> str:
    return json.dumps(o, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')

BOOT = '''<script>(function(){try{
var U=%s,S=%s;
var T=function(k){return /^(scx_|lessonLang$|lessonTheme$)/.test(k)};
var owner=localStorage.getItem('acct_owner');
if(owner&&owner!==String(U.id)){Object.keys(localStorage).filter(function(k){return T(k)||/^stem_(step_|last_lesson|swipes|next_taps|coach_done)/.test(k)}).forEach(function(k){localStorage.removeItem(k)})}
localStorage.setItem('acct_owner',String(U.id));
function J(v,d){try{return JSON.parse(v)}catch(e){return d}}
function M(k,o,n){if(o===null||o===undefined)return n;try{
if(k==='lessonLang'||k==='lessonTheme')return o;
if(k.indexOf('scx_topics_')===0){var dm=function(a,b){if(a&&b&&typeof a==='object'&&typeof b==='object'){var r={},x;for(x in a)r[x]=a[x];for(x in b)r[x]=(x in a)?dm(a[x],b[x]):b[x];return r}if(typeof a==='number'&&typeof b==='number')return Math.max(a,b);return b};return JSON.stringify(dm(J(o,{}),J(n,{})))}
if(k==='scx_xp_total')return String(Math.max(parseInt(o,10)||0,parseInt(n,10)||0));
if(k==='scx_badges'||/_activities$/.test(k)){var s={};J(o,[]).concat(J(n,[])).forEach(function(x){s[x]=1});return JSON.stringify(Object.keys(s).sort())}
if(k==='scx_visit_dates'){var s2={};J(o,[]).concat(J(n,[])).forEach(function(x){s2[x]=1});return JSON.stringify(Object.keys(s2).sort().slice(-400))}
if(/_stars$/.test(k)){var a=J(o,[]),b=J(n,[]),m=Math.max(a.length,b.length),r=[];for(var i=0;i<m;i++)r.push(Math.max(a[i]||0,b[i]||0));return JSON.stringify(r)}
if(k.indexOf('scx_path_')===0){var d=J(o,{}),e=J(n,{});for(var x in e){if(e[x])d[x]=e[x]}return JSON.stringify(d)}
if(/_done$/.test(k)||/^scx_(done|story|lab)_/.test(k))return (o==='1'||n==='1')?'1':n;
}catch(e){}return n}
Object.keys(S).forEach(function(k){if(T(k))localStorage.setItem(k,M(k,localStorage.getItem(k),S[k]))});
window.SCX_USER=U;window.__acctBoot=true;
}catch(e){}})();</script>'''

APP_HEAD = (
    '<link rel="manifest" href="/manifest.webmanifest">'
    '<meta name="theme-color" content="#F3F5FF">'
    '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-title" content="STEM Cloud">'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700;800&display=swap" media="print" onload="this.media=&quot;all&quot;">'
    '<link rel="icon" type="image/png" sizes="32x32" href="/static/icons/favicon-32.png">'
    '<link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192.png">'
    '<link rel="icon" type="image/png" href="/static/brand/logo-mark.png">'
    # bright theme: rounded display + text fonts, and bright is the default look (dark is still in the account menu)
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap" media="print" onload="this.media=\'all\'">'
    '<script>try{if(!localStorage.getItem("stem_bright_v1")){localStorage.setItem("lessonTheme","light");localStorage.setItem("stem_theme","light");localStorage.setItem("stem_bright_v1","1")}document.documentElement.setAttribute("data-theme",localStorage.getItem("lessonTheme")||"light")}catch(e){}</script>'
    # the chosen language is set before first paint and the page stays hidden until it has been applied (lessons: when the player has started, and for Sinhala when its words are in),
    # so a page never shows English for a moment and then flips; a failsafe shows it after 4 seconds whatever happens
    '<style>html.stem-boot body{visibility:hidden}</style>'
    '<script>try{var _l=localStorage.getItem("lessonLang")||"en",_h=document.documentElement;_h.lang=_l;_h.classList.add("stem-boot");'
    '(function(){var d=false,w=_l==="si";function go(){if(d)return;d=true;_h.classList.remove("stem-boot")}'
    'document.addEventListener("stem-step",function(){if(!w)setTimeout(go,250)},{once:true});window.addEventListener("stem-si-coverage",function(){setTimeout(go,250)},{once:true});'
    'document.addEventListener("DOMContentLoaded",function(){setTimeout(go,document.getElementById("fw_path")?1800:40)});setTimeout(go,4000)})()}catch(e){}</script>'
    # animations are ON unless the student switched them off in the account menu (applied before first paint)
    '<script>try{var m=localStorage.getItem("stem_motion"),q=matchMedia("(prefers-reduced-motion: reduce)");function motion(){document.documentElement.classList.toggle("stem-calm",m==="off"||(m!=="on"&&q.matches));window.dispatchEvent(new Event("stem-calm-change"))}motion();q.addEventListener("change",function(){m=localStorage.getItem("stem_motion");motion()})}catch(e){}</script>'
)
APP_TAIL_CSS = '<link rel="stylesheet" href="/static/app-layer.css"><link rel="stylesheet" href="/static/player.css"><link rel="stylesheet" href="/static/theme-bright.css">'
# order matters: player.js builds the lesson bar that voice.js adds its button to
APP_TAIL_JS = ('<script src="/static/pwa.js"></script><script src="/static/si.js"></script><script src="/static/ui-icons.js"></script><script src="/static/embed.js"></script><script src="/static/app-layer.js"></script>'
               '<script src="/static/learning-content.js"></script><script src="/static/learning.js"></script>'
               '<script src="/static/player.js"></script><script src="/static/story.js"></script>'
               '<script src="/static/voice.js"></script><script src="/static/questions.js"></script><script src="/static/icons.js"></script>'
               '<script src="/static/account.js"></script><script src="/static/past-paper-links.js"></script>'
               '<script src="/static/hub-topics.js"></script><script src="/static/quiz-sheet.js"></script><script src="/static/nav.js"></script>')
VIEWPORT_RE = re.compile(r'<meta\s+name="viewport"[^>]*>', re.I)

_MARK = '<!--STEM-BOOT-->'
_tpl = {}

def _template(path: Path) -> str:
    """The lesson with everything that is the same for every student already inserted (cached per instance)."""
    key = (str(path), path.stat().st_mtime_ns)
    html = _tpl.get(key)
    if html is None:
        html = path.read_text(encoding='utf-8')
        vp = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        html = VIEWPORT_RE.sub(vp, html, 1) if VIEWPORT_RE.search(html) else html.replace('<head>', '<head>' + vp, 1)
        html = html.replace('<head>', '<head>' + _MARK + APP_HEAD, 1) if '<head>' in html else _MARK + html
        html = html.replace('</head>', APP_TAIL_CSS + '</head>', 1)
        html = html.replace('</body>', APP_TAIL_JS + '</body>', 1) if '</body>' in html else html + APP_TAIL_JS
        _tpl.clear(); _tpl[key] = html
    return html

def render_lesson(path: Path, user: dict, progress: dict) -> HTMLResponse:
    boot = BOOT % (js_json(public(user)), js_json(progress))
    return HTMLResponse(_template(path).replace(_MARK, boot, 1))
