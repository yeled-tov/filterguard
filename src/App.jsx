import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   AUTO-UPDATING FILTER LISTS — github.com/yeled-tov/filterguard
═══════════════════════════════════════════════════════ */
const BUILTIN = {
  adult:["pornhub.com","xvideos.com","xnxx.com","xhamster.com","redtube.com","youporn.com","onlyfans.com","chaturbate.com","spankbang.com","eporner.com","beeg.com","tnaflix.com","nhentai.net","rule34.xxx","brazzers.com","bangbros.com","cam4.com","bongacams.com","livejasmin.com","myfreecams.com","stripchat.com","faphouse.com","drtuber.com","tube8.com","slutload.com","adultfriendfinder.com","hclips.com","empflix.com","youjizz.com","imagefap.com","xempire.com","tubegalore.com","bigfuck.tv","perfectgirls.net","fetlife.com","alt.com","fling.com"],
  gambling:["bet365.com","888casino.com","pokerstars.com","partypoker.com","betway.com","draftkings.com","fanduel.com","bovada.lv","mybookie.ag","1xbet.com","22bet.com","betsson.com","casumo.com","leovegas.com","williamhill.com","bwin.com","unibet.com","betfair.com","paddypower.com","coral.co.uk","ladbrokes.com","betvictor.com","skybet.com","mrgreen.com","rizk.com","sportingbet.com","stake.com","bitstarz.com","cloudbet.com"],
  social:["facebook.com","instagram.com","twitter.com","x.com","tiktok.com","snapchat.com","reddit.com","tumblr.com","pinterest.com","linkedin.com","discord.com","twitch.tv","threads.net","bsky.app","mastodon.social","vk.com","weibo.com","ok.ru","quora.com","clubhouse.com","mewe.com","gab.com","triller.co","likee.com","kwai.com"],
  ads:["doubleclick.net","googlesyndication.com","googletagmanager.com","googletagservices.com","adnxs.com","adroll.com","criteo.com","taboola.com","outbrain.com","rubiconproject.com","openx.com","pubmatic.com","appnexus.com","scorecardresearch.com","comscore.com","quantserve.com","chartbeat.com","moatads.com","advertising.com","adsrvr.org","casalemedia.com","serving-sys.com","revcontent.com","mgid.com","sharethrough.com","amazon-adsystem.com","media.net","adsterra.com","propellerads.com","exoclick.com","juicyads.com","smartadserver.com","sovrn.com","33across.com","triplelift.com","bidswitch.net"],
};
const BLOCKLIST_URL = "https://raw.githubusercontent.com/yeled-tov/filterguard/main/blocklist.json";
const CACHE_KEY = "fg_bl_v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;
let LIVE = { ...BUILTIN };

async function fetchLists() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) { LIVE = { ...BUILTIN, ...data }; return data._updated || "cache"; }
    }
    const res = await fetch(BLOCKLIST_URL, { cache: "no-cache" });
    if (!res.ok) return "built-in";
    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    LIVE = { ...BUILTIN, ...data };
    return data._updated || "עדכני";
  } catch { return "built-in"; }
}

/* ═══════════════════════════════════════════════════════
   FILTER ENGINE
═══════════════════════════════════════════════════════ */
const KW_BLOCK = ["porn","xxx","nude","naked","hentai","erotic","fetish","nsfw","casino-","gambling","poker-room","wager","escort-"];

function checkUrl(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const [cat, list] of Object.entries(LIVE)) {
      if (cat.startsWith("_") || cat === "keywords_block") continue;
      if (list.some(b => h === b || h.endsWith("." + b))) return { blocked: true, cat, domain: h };
    }
    if (KW_BLOCK.some(k => url.toLowerCase().includes(k))) return { blocked: true, cat: "content", domain: h };
    return { blocked: false, domain: h };
  } catch { return { blocked: false, domain: "" }; }
}
function getDomain(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }
function isYT(url) { try { const h = new URL(url).hostname; return h.includes("youtube.com") || h.includes("youtu.be"); } catch { return false; } }
function normalizeUrl(v) {
  v = v.trim(); if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.includes(".") && !v.includes(" ")) return "https://" + v.replace(/^www\./,"www.");
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
}
const HEBREW_SITES = ["ynet.co.il","walla.co.il","mako.co.il","maariv.co.il","haaretz.co.il","reshet.tv","kan.org.il","sport5.co.il","one.co.il","google.com","wikipedia.org","mail.google"];
function isNonHebrew(url) {
  try { const h = new URL(url).hostname; return !HEBREW_SITES.some(s => h.includes(s)); }
  catch { return false; }
}

/* ═══════════════════════════════════════════════════════
   AI SCRIPTS
═══════════════════════════════════════════════════════ */
const GENERAL_AI = `(function(){
  if(window.__fg_init)return;window.__fg_init=true;
  function rmAds(){var s='[id*="google_ad"],[class*="banner-ad"],[class*="advertisement"],iframe[src*="doubleclick"],[data-ad],[class*="dfp-"],[class*="sponsored"]';try{document.querySelectorAll(s).forEach(function(e){e.remove()});}catch(e){}}
  setTimeout(rmAds,800);setTimeout(rmAds,3000);
  function blurIt(img){if(img.__fg)return;img.__fg=true;img.style.cssText+='filter:blur(35px) brightness(0.1)!important;transition:filter .3s;';window.__fg_count=(window.__fg_count||0)+1;}
  var nsfwModel=null,faceReady=false;
  (function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/nsfwjs.min.js';s.onload=function(){nsfwjs.load('https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/').then(function(m){nsfwModel=m;scanAll();}).catch(function(){});};document.head.appendChild(s);})();
  (function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';s.onload=function(){Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),faceapi.nets.ageGenderNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/')]).then(function(){faceReady=true;scanAll();}).catch(function(){});};document.head.appendChild(s);})();
  async function checkImg(img){
    if(img.__fg_chk||img.__fg)return;if(!img.complete||img.naturalWidth<80||img.naturalHeight<80)return;img.__fg_chk=true;
    if(nsfwModel){try{var p=await nsfwModel.classify(img);var sexy=(p.find(function(x){return x.className==='Sexy';})||{probability:0}).probability;var porn=(p.find(function(x){return x.className==='Porn';})||{probability:0}).probability;var hent=(p.find(function(x){return x.className==='Hentai';})||{probability:0}).probability;if(sexy>.15||porn>.04||hent>.04){blurIt(img);return;}}catch(e){}}
    if(faceReady&&img.naturalWidth>100){try{var d=await faceapi.detectAllFaces(img,new faceapi.TinyFaceDetectorOptions({scoreThreshold:0.4})).withAgeAndGender();for(var i=0;i<d.length;i++){if(d[i].gender==='female'&&d[i].genderProbability>.75){blurIt(img);return;}}}catch(e){}}
  }
  function scanAll(){document.querySelectorAll('img').forEach(function(img){if(img.complete)checkImg(img);else img.addEventListener('load',function(){checkImg(img);},{once:true});})}
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.tagName==='IMG')checkImg(n);if(n.querySelectorAll)n.querySelectorAll('img').forEach(checkImg);});});}).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(scanAll,1500);
})();`;

const YT_AI = `(function(){
  if(window.__yt_init)return;window.__yt_init=true;
  var KW=['woman','women','girl','female','she','her','lady','אשה','נשים','בחורה','ילדה','mrs','ms','miss','mom','mama','sister','wife','daughter','queen','princess','actress','singer','model','girlfriend','hot girl','sexy','babe','beauty','pretty girl','cute girl','milf'];
  var nsfwModel=null,faceReady=false;
  (function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/nsfwjs.min.js';s.onload=function(){nsfwjs.load('https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/').then(function(m){nsfwModel=m;scan();}).catch(function(){});};document.head.appendChild(s);})();
  (function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';s.onload=function(){Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),faceapi.nets.ageGenderNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/')]).then(function(){faceReady=true;scan();}).catch(function(){});};document.head.appendChild(s);})();
  function hasKw(el){var t=(el.textContent||'').toLowerCase();return KW.some(function(k){return t.indexOf(k)>-1;});}
  function blockCard(c){if(c.__b)return;c.__b=true;c.style.cssText+='position:relative!important;';var o=document.createElement('div');o.style.cssText='position:absolute;inset:0;background:rgba(10,10,20,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;border-radius:12px;pointer-events:none;gap:6px;';o.innerHTML='<div style="font-size:24px">🛡️</div><div style="color:#94a3b8;font-size:11px;font-family:sans-serif">חסום - FilterGuard</div>';c.appendChild(o);window.__yt_blocked=(window.__yt_blocked||0)+1;}
  async function processCard(c){
    if(c.__proc)return;c.__proc=true;
    if(hasKw(c)){blockCard(c);return;}
    var img=c.querySelector('img#img,img.yt-core-image,ytd-thumbnail img');
    if(img&&img.complete&&img.naturalWidth>60&&nsfwModel){try{var p=await nsfwModel.classify(img);var sexy=(p.find(function(x){return x.className==='Sexy';})||{probability:0}).probability;var porn=(p.find(function(x){return x.className==='Porn';})||{probability:0}).probability;if(sexy>.12||porn>.04){blockCard(c);return;}}catch(e){}}
    if(img&&img.complete&&img.naturalWidth>60&&faceReady){try{var d=await faceapi.detectAllFaces(img,new faceapi.TinyFaceDetectorOptions({scoreThreshold:0.4})).withAgeAndGender();for(var i=0;i<d.length;i++){if(d[i].gender==='female'&&d[i].genderProbability>.72){blockCard(c);return;}}}catch(e){}}
  }
  var SEL=['ytd-rich-item-renderer','ytd-video-renderer','ytd-compact-video-renderer','ytd-grid-video-renderer','ytd-reel-item-renderer'];
  function scan(){SEL.forEach(function(s){document.querySelectorAll(s).forEach(processCard);});}
  new MutationObserver(function(){setTimeout(scan,350);}).observe(document.body||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('yt-navigate-finish',function(){setTimeout(scan,600);});
  [800,2000,4000,8000].forEach(function(d){setTimeout(scan,d);});
})();`;

/* ═══════════════════════════════════════════════════════
   CHROME DESIGN
═══════════════════════════════════════════════════════ */
const C = {
  tabBar:"#dee1e6", tabActive:"#ffffff", tabHover:"rgba(255,255,255,0.55)",
  toolbar:"#ffffff", omni:"#f1f3f4", border:"#c4c7cc",
  text:"#202124", muted:"#5f6368", blue:"#1a73e8",
  red:"#d93025", green:"#1e8e3e", surf:"#f8f9fa", warn:"#e37400",
};
const PATHS = {
  back:"M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  forward:"M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  reload:"M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  stop:"M6 6h12v12H6z", home:"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  star:"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  starO:"M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z",
  menu:"M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  close:"M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  lock:"M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  search:"M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  plus:"M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  translate:"M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z",
  shield:"M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  find:"M20 19.59V8l-6-6H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c.45 0 .85-.15 1.19-.4l-4.43-4.43c-.8.52-1.74.83-2.76.83-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 1.02-.31 1.96-.83 2.75L20 19.59z",
  history:"M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
  download:"M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  settings:"M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.56-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.07.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  share:"M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z",
};
function Ico({ n, size=16, color=C.muted, style={} }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block",flexShrink:0,...style}}><path d={PATHS[n]||PATHS.search} fill={color}/></svg>;
}

/* ─── All interactive components extracted (no hooks inside .map) ─── */
function IBtn({ n, color, onClick, title, disabled, active, size=28, is=16 }) {
  const [h,sH] = useState(false);
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
      style={{width:size,height:size,borderRadius:size/2,border:"none",
        background:active?"#e8f0fe":h?"rgba(32,33,36,.1)":"transparent",
        cursor:disabled?"default":"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,transition:"background .1s",padding:0}}>
      <Ico n={n} size={is} color={disabled?"#bdc1c6":active?C.blue:(color||C.muted)}/>
    </button>
  );
}
function Tab({ t, isA, onSelect, onClose }) {
  const [h,sH] = useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
      style={{display:"flex",alignItems:"center",gap:6,
        height:isA?36:32,padding:"0 8px 0 12px",
        background:isA?C.tabActive:h?C.tabHover:"transparent",
        borderRadius:"8px 8px 0 0",
        border:isA?`1px solid ${C.border}`:"1px solid transparent",
        borderBottom:isA?`1px solid ${C.tabActive}`:"1px solid transparent",
        cursor:"pointer",maxWidth:220,minWidth:72,flexShrink:1,
        transition:"all .12s",alignSelf:"flex-end",marginTop:isA?2:6}}>
      <div style={{width:16,height:16,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {t.loading?<div style={{width:13,height:13,border:"2px solid #dadce0",borderTopColor:C.blue,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          :t.blocked?<span style={{fontSize:11}}>🚫</span>
          :<span style={{fontSize:11}}>{t.fav||"🌐"}</span>}
      </div>
      <span style={{fontSize:12,color:isA?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{t.title}</span>
      {(h||isA)&&<div onClick={e=>{e.stopPropagation();onClose();}} style={{width:16,height:16,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:h?"rgba(0,0,0,.1)":"transparent"}}><Ico n="close" size={12}/></div>}
    </div>
  );
}
function BmItem({ b, onGo }) {
  const [h,sH] = useState(false);
  return <div onClick={()=>onGo(b.url)} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:4,cursor:"pointer",background:h?"#e8eaed":"transparent",maxWidth:140,flexShrink:0}}>
    <span style={{fontSize:12}}>{b.e||"🌐"}</span>
    <span style={{fontSize:12,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}</span>
  </div>;
}
function QuickTile({ s, onGo }) {
  const [h,sH] = useState(false);
  return <div onClick={()=>onGo(s.url)} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,width:80,padding:"10px 4px",borderRadius:10,background:h?"#f1f3f4":"transparent",cursor:"pointer",transition:"background .15s"}}>
    <div style={{width:48,height:48,borderRadius:12,background:"#f1f3f4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{s.e}</div>
    <span style={{fontSize:12,color:C.muted,textAlign:"center"}}>{s.name}</span>
  </div>;
}
function HistRow({ url, onGo }) {
  const [h,sH] = useState(false);
  return <div onClick={()=>onGo(url)} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderRadius:8,background:h?"#f1f3f4":"transparent",cursor:"pointer"}}>
    <Ico n="history" size={16}/>
    <span style={{fontSize:13,color:C.blue,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
  </div>;
}
function SuggestItem({ s, onPick }) {
  const [h,sH] = useState(false);
  return <div onClick={()=>onPick(s.text)} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:h?"#f1f3f4":"#fff",cursor:"pointer"}}>
    <Ico n={s.type==="url"?"lock":"search"} size={16}/>
    <span style={{fontSize:13,color:C.text,flex:1}}>{s.text}</span>
  </div>;
}
function MenuRow({ n, label, short, onClick, sep }) {
  const [h,sH] = useState(false);
  if (sep) return <div style={{height:1,background:"#e8eaed",margin:"4px 0"}}/>;
  return <div onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{display:"flex",alignItems:"center",gap:12,padding:"7px 16px",background:h?"#f1f3f4":"transparent",cursor:"pointer"}}>
    <Ico n={n} size={16}/><span style={{flex:1,fontSize:13,color:C.text}}>{label}</span>
    {short&&<span style={{fontSize:12,color:C.muted}}>{short}</span>}
  </div>;
}
function FilterToggle({ r, cats, sCats }) {
  return <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 6px",borderRadius:6,background:cats[r.k]?`${r.c}0a`:"transparent",marginBottom:2}}>
    <span style={{fontSize:15}}>{r.i}</span>
    <span style={{flex:1,fontSize:13,color:cats[r.k]?C.text:C.muted}}>{r.l}</span>
    <div onClick={()=>sCats(c=>({...c,[r.k]:!c[r.k]}))}
      style={{width:36,height:20,borderRadius:10,cursor:"pointer",background:cats[r.k]?r.c:"#dadce0",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{position:"absolute",width:16,height:16,borderRadius:8,background:"#fff",top:2,left:cats[r.k]?18:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
    </div>
  </div>;
}
function ZoomBtn({ label, onClick }) {
  const [h,sH] = useState(false);
  return <button onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{width:28,height:26,border:`1px solid ${C.border}`,background:h?"#f1f3f4":"#fff",cursor:"pointer",fontSize:typeof label==="string"&&label.length>1?11:17,color:C.text,borderLeft:"none"}}>{label}</button>;
}

/* ═══════════════════════════════════════════════════════
   TRANSLATE BAR
═══════════════════════════════════════════════════════ */
function TranslateBar({ url, onTranslate, onDismiss }) {
  return <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"7px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
    <Ico n="translate" size={18} color={C.blue}/>
    <span style={{fontSize:13,color:C.text,flex:1,direction:"rtl"}}>האם לתרגם את הדף הזה לעברית? <span style={{color:C.muted}}>({getDomain(url)})</span></span>
    <button onClick={onTranslate} style={{padding:"5px 14px",background:C.blue,border:"none",borderRadius:4,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>תרגם</button>
    <button onClick={onDismiss} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:C.muted,cursor:"pointer",fontSize:13}}>לא</button>
    <IBtn n="close" onClick={onDismiss} size={24} is={14}/>
  </div>;
}

/* ═══════════════════════════════════════════════════════
   BLOCKED PAGE
═══════════════════════════════════════════════════════ */
const CATS = {adult:{label:"תוכן למבוגרים",icon:"🔞",color:C.red},gambling:{label:"הימורים",icon:"🎰",color:C.warn},social:{label:"רשתות חברתיות",icon:"📵",color:"#7627bb"},ads:{label:"פרסומות",icon:"🛡️",color:C.blue},content:{label:"תוכן חסום",icon:"⛔",color:C.red}};
function BlockedPage({ info }) {
  const c = CATS[info.cat]||CATS.content;
  return <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#fff",fontFamily:"-apple-system,sans-serif",padding:32,textAlign:"center"}}>
    <div style={{fontSize:72,opacity:.09,marginBottom:16}}>🚫</div>
    <h1 style={{fontSize:22,fontWeight:400,color:C.text,marginBottom:8}}>לא ניתן לגשת לאתר זה</h1>
    <p style={{fontSize:14,color:C.muted,maxWidth:400,lineHeight:1.7,direction:"rtl",marginBottom:24}}>האתר <strong style={{color:C.text}}>{info.domain}</strong> חסום.<br/>קטגוריה: <span style={{color:c.color,fontWeight:600}}>{c.icon} {c.label}</span></p>
    <div style={{padding:"12px 20px",background:C.surf,borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.muted,direction:"rtl",lineHeight:1.8}}><strong style={{color:C.text}}>ERR_BLOCKED_BY_FILTERGUARD</strong><br/>הרשימות מתעדכנות אוטומטית מ-GitHub כל 24 שעות.</div>
  </div>;
}

/* ═══════════════════════════════════════════════════════
   SUGGEST / FIND / BM / NEWTAB / MENU / FILTER PANEL
═══════════════════════════════════════════════════════ */
function Suggest({ q, onPick }) {
  if (!q||q.length<2) return null;
  const isUrl = q.includes(".")&&!q.includes(" ");
  const items = isUrl?[{type:"url",text:"https://"+q.replace(/^https?:\/\//,"")}]:[{type:"search",text:q},{type:"search",text:q+" עברית"},{type:"search",text:q+" חינם"}];
  return <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:9999,background:"#fff",border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",boxShadow:"0 4px 12px rgba(0,0,0,.12)"}}>
    {items.map((s,i)=><SuggestItem key={i} s={s} onPick={onPick}/>)}
  </div>;
}
function FindBar({ onClose }) {
  const [q,sQ] = useState("");
  return <div style={{position:"absolute",top:0,right:12,zIndex:999,background:"#fff",border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 4px 4px",display:"flex",alignItems:"center",padding:"5px 8px",gap:6,boxShadow:"0 2px 8px rgba(0,0,0,.12)"}}>
    <input autoFocus value={q} onChange={e=>sQ(e.target.value)} placeholder="חיפוש בדף..."
      style={{width:180,padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:13,outline:"none",color:C.text}}/>
    <IBtn n="close" onClick={onClose} size={24} is={14}/>
  </div>;
}
const INIT_BM=[{name:"חדשות",url:"https://www.ynet.co.il",e:"📰"},{name:"גוגל",url:"https://www.google.com",e:"🔍"},{name:"ויקי",url:"https://he.wikipedia.org",e:"📚"},{name:"Gmail",url:"https://mail.google.com",e:"✉️"},{name:"Maps",url:"https://maps.google.com",e:"🗺️"}];
function BMBar({ bms, onGo }) {
  return <div style={{height:32,background:C.surf,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 6px",gap:1,flexShrink:0,overflow:"hidden"}}>
    {bms.map((b,i)=><BmItem key={i} b={b} onGo={onGo}/>)}
  </div>;
}
const QUICK=[{name:"Google",url:"https://google.com",e:"🔍"},{name:"חדשות",url:"https://www.ynet.co.il",e:"📰"},{name:"ויקיפדיה",url:"https://he.wikipedia.org",e:"📚"},{name:"Gmail",url:"https://mail.google.com",e:"✉️"},{name:"Maps",url:"https://maps.google.com",e:"🗺️"},{name:"Walla",url:"https://www.walla.co.il",e:"🌐"}];
function NewTab({ onGo, hist }) {
  const [q,sQ] = useState("");
  const recent = useMemo(()=>[...new Set(hist)].slice(0,5),[hist]);
  return <div style={{height:"100%",background:"#fff",display:"flex",flexDirection:"column",alignItems:"center",paddingTop:72,overflow:"auto",fontFamily:"-apple-system,'Segoe UI',sans-serif"}}>
    <div style={{fontSize:52,fontWeight:900,letterSpacing:-2,marginBottom:24,userSelect:"none"}}>
      {"FilterGuard".split("").map((ch,i)=>{const cols=["#4285f4","#ea4335","#fbbc05","#4285f4","#34a853","#ea4335","#4285f4","#fbbc05","#34a853","#ea4335","#4285f4"];return <span key={i} style={{color:cols[i%cols.length]}}>{ch}</span>;})}
    </div>
    <div style={{width:568,maxWidth:"92vw"}}>
      <div style={{display:"flex",alignItems:"center",background:"#fff",border:"1px solid #dfe1e5",borderRadius:24,height:46,padding:"0 16px",gap:12,boxShadow:"0 1px 6px rgba(32,33,36,.1)"}}>
        <Ico n="search" size={20}/>
        <input value={q} onChange={e=>sQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onGo(normalizeUrl(q))} placeholder="חפש ב-Google או הכנס כתובת"
          style={{flex:1,border:"none",outline:"none",fontSize:16,color:C.text,background:"transparent",direction:"rtl",fontFamily:"inherit"}}/>
        {q&&<IBtn n="close" onClick={()=>sQ("")} size={24} is={14}/>}
      </div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:32,flexWrap:"wrap",justifyContent:"center",maxWidth:520}}>
      {QUICK.map(s=><QuickTile key={s.url} s={s} onGo={onGo}/>)}
    </div>
    {recent.length>0&&<div style={{marginTop:32,width:568,maxWidth:"92vw"}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:8,direction:"rtl"}}>ביקרת לאחרונה</div>
      {recent.map((url,i)=><HistRow key={i} url={url} onGo={onGo}/>)}
    </div>}
    <div style={{display:"flex",gap:8,marginTop:24,flexWrap:"wrap",justifyContent:"center"}}>
      {[{l:"עדכון 24שע",c:"#34a853",i:"🔄"},{l:"AI תמונות",c:C.blue,i:"🤖"},{l:"YT מסונן",c:"#ea4335",i:"▶️"},{l:"תרגום",c:C.warn,i:"🌐"}].map(b=><div key={b.l} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:12,border:`1px solid ${b.c}30`,background:`${b.c}0a`,fontSize:12,color:b.c,fontWeight:600}}><span>{b.i}</span><span>{b.l}</span></div>)}
    </div>
  </div>;
}
function ChromeMenu({ onClose, onFind, onZoom, zoom, onNewTab, onToggleBM, onSettings, onTranslate }) {
  const ref = useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))onClose();};setTimeout(()=>document.addEventListener("mousedown",h),0);return()=>document.removeEventListener("mousedown",h);},[]);
  const w = fn => ()=>{fn?.();onClose();};
  return <div ref={ref} style={{position:"absolute",top:36,right:0,width:248,zIndex:9999,background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 20px rgba(0,0,0,.2)",padding:"6px 0",overflow:"hidden"}}>
    <div style={{display:"flex",alignItems:"center",padding:"4px 16px 8px",gap:8}}>
      <Ico n="find" size={16}/><span style={{flex:1,fontSize:13,color:C.text}}>זום</span>
      <div style={{display:"flex"}}>
        <ZoomBtn label="-" onClick={()=>onZoom(-10)}/>
        <ZoomBtn label={zoom+"%"} onClick={()=>onZoom(0)}/>
        <ZoomBtn label="+" onClick={()=>onZoom(10)}/>
      </div>
    </div>
    <div style={{height:1,background:"#e8eaed",margin:"0 0 4px"}}/>
    <MenuRow n="plus"      label="כרטיסייה חדשה"  short="Ctrl+T" onClick={w(onNewTab)}/>
    <MenuRow n="find"      label="חיפוש בדף"       short="Ctrl+F" onClick={w(onFind)}/>
    <MenuRow n="translate" label="תרגם דף"                        onClick={w(onTranslate)}/>
    <MenuRow n="download"  label="הורדות"          short="Ctrl+J"/>
    <MenuRow sep/>
    <MenuRow n="history"   label="היסטוריה"        short="Ctrl+H"/>
    <MenuRow n="star"      label="סימניות"                         onClick={w(onToggleBM)}/>
    <MenuRow sep/>
    <MenuRow n="shield"    label="FilterGuard"                     onClick={w(onSettings)}/>
    <MenuRow n="settings"  label="הגדרות"/>
  </div>;
}
function FilterPanel({ onClose, listVer }) {
  const [cats,sCats] = useState({adult:true,gambling:true,social:true,ads:true,ai:true,yt:true,translate:true});
  const ref = useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))onClose();};setTimeout(()=>document.addEventListener("mousedown",h),0);return()=>document.removeEventListener("mousedown",h);},[]);
  const rows=[{k:"adult",l:"פורנו ותוכן למבוגרים",i:"🔞",c:C.red},{k:"gambling",l:"הימורים",i:"🎰",c:C.warn},{k:"social",l:"רשתות חברתיות",i:"📵",c:"#7627bb"},{k:"ads",l:"פרסומות",i:"🛡️",c:C.blue},{k:"ai",l:"תמונות נשים (AI)",i:"🤖",c:"#34a853"},{k:"yt",l:"סרטוני נשים ביוטיוב",i:"▶️",c:"#ea4335"},{k:"translate",l:"תרגום אוטומטי",i:"🌐",c:C.warn}];
  return <div ref={ref} style={{position:"absolute",top:40,right:0,width:290,zIndex:9999,background:"#fff",border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,.18)",padding:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <span style={{fontSize:14,fontWeight:600,color:C.text}}>🛡️ FilterGuard</span>
      <IBtn n="close" onClick={onClose} size={24} is={14}/>
    </div>
    {rows.map(r=><FilterToggle key={r.k} r={r} cats={cats} sCats={sCats}/>)}
    <div style={{marginTop:10,padding:"8px 10px",background:C.surf,borderRadius:8,fontSize:11,color:C.muted,direction:"rtl",lineHeight:1.7}}>🔄 גרסת רשימות: <strong>{listVer}</strong><br/>מתעדכן מ-GitHub כל 24 שעות</div>
  </div>;
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
let _tid = 1;
const mkTab = (url="",title="כרטיסייה חדשה") => ({id:++_tid,url,title,loading:false,blocked:null,fav:""});

export default function App() {
  const [tabs,sT]       = useState([mkTab()]);
  const [aId,sA]        = useState(1);
  const [bms,sBms]      = useState(INIT_BM);
  const [showBM,sShowBM]      = useState(true);
  const [showMenu,sMenu]      = useState(false);
  const [showFind,sFind]      = useState(false);
  const [showFilter,sFilter]  = useState(false);
  const [zoom,sZoom]          = useState(100);
  const [hist,sHist]          = useState([]);
  const [hIdx,sHIdx]          = useState(-1);
  const [omni,sOmni]          = useState("");
  const [omniF,sOmniF]        = useState(false);
  const [saved,sSaved]        = useState("");
  const [frameErr,sFrameErr]  = useState(false);
  const [ytBlocked,sYtB]      = useState(0);
  const [aiCount,sAiC]        = useState(0);
  const [tranBar,sTranBar]    = useState(false);
  const [listVer,sListVer]    = useState("built-in");
  const frameRef = useRef(null);
  const omniRef  = useRef(null);
  const pollRef  = useRef(null);

  const tab = useMemo(()=>tabs.find(t=>t.id===aId)||tabs[0],[tabs,aId]);

  useEffect(()=>{fetchLists().then(v=>sListVer(v));},[]);

  const go = useCallback((raw,fromHist=false)=>{
    const url=normalizeUrl(raw);if(!url)return;
    const chk=checkUrl(url);
    sFrameErr(false);sOmni(url);sSaved(url);sOmniF(false);
    sYtB(0);sAiC(0);sTranBar(false);
    clearInterval(pollRef.current);
    sT(p=>p.map(t=>t.id===aId?{...t,url,loading:!chk.blocked,blocked:chk.blocked?chk:null,title:chk.blocked?"חסום":(getDomain(url)||"כרטיסייה חדשה"),fav:isYT(url)?"▶️":""}:t));
    if(!fromHist){const nh=[...hist.slice(0,hIdx+1),url];sHist(nh);sHIdx(nh.length-1);}
  },[aId,hist,hIdx]);

  const goBack = ()=>{if(hIdx>0){sHIdx(i=>i-1);go(hist[hIdx-1],true);}};
  const goFwd  = ()=>{if(hIdx<hist.length-1){sHIdx(i=>i+1);go(hist[hIdx+1],true);}};
  const reload = ()=>{if(tab.url)go(tab.url,true);};

  const newTab = useCallback(()=>{
    const t=mkTab();sT(p=>[...p,t]);sA(t.id);
    sOmni("");sSaved("");sFrameErr(false);sTranBar(false);
  },[]);

  const closeTab = id=>{
    if(tabs.length===1){const t=mkTab();sT([t]);sA(t.id);sOmni("");return;}
    const next=tabs.filter(t=>t.id!==id);sT(next);
    if(aId===id)sA(next[Math.min(tabs.findIndex(t=>t.id===id),next.length-1)].id);
  };

  useEffect(()=>{sOmni(tab.url||"");sSaved(tab.url||"");},[aId]);

  useEffect(()=>{
    const h=e=>{
      if(e.ctrlKey||e.metaKey){
        if(e.key==="t"){e.preventDefault();newTab();}
        if(e.key==="f"){e.preventDefault();sFind(x=>!x);}
        if(e.key==="r"){e.preventDefault();reload();}
        if(e.key==="l"){e.preventDefault();omniRef.current?.select();omniRef.current?.focus();}
      }
      if(e.key==="F5"){e.preventDefault();reload();}
      if(e.key==="Escape")sFind(false);
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[newTab,reload]);

  const onLoad=()=>{
    sT(p=>p.map(t=>t.id===aId?{...t,loading:false}:t));
    sFrameErr(false);clearInterval(pollRef.current);
    if(tab.url&&isNonHebrew(tab.url))setTimeout(()=>sTranBar(true),900);
    try{
      const doc=frameRef.current?.contentDocument;if(!doc?.body)return;
      const sc=doc.createElement("script");sc.textContent=isYT(tab.url)?YT_AI:GENERAL_AI;doc.body.appendChild(sc);
      pollRef.current=setInterval(()=>{try{const w=frameRef.current?.contentWindow;if(w?.__yt_blocked)sYtB(w.__yt_blocked);if(w?.__fg_count)sAiC(w.__fg_count);}catch{clearInterval(pollRef.current);}},1500);
    }catch{}
  };

  const applyZoom=dz=>{const nz=dz===0?100:Math.min(200,Math.max(25,zoom+dz));sZoom(nz);try{if(frameRef.current?.contentDocument?.body)frameRef.current.contentDocument.body.style.zoom=nz/100;}catch{}};

  const translatePage=()=>{if(!tab.url)return;go(`https://translate.google.com/translate?sl=auto&tl=he&u=${encodeURIComponent(tab.url)}`);sTranBar(false);};

  const isBm=bms.some(b=>b.url===tab.url);
  const toggleBm=()=>{if(!tab.url)return;isBm?sBms(b=>b.filter(x=>x.url!==tab.url)):sBms(b=>[...b,{name:getDomain(tab.url)||tab.url,url:tab.url,e:"🌐"}]);};

  const isLoading=tab.loading,isHttps=tab.url?.startsWith("https://"),blocked=tab.blocked,ytMode=isYT(tab.url);

  return <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:C.tabBar,fontFamily:"-apple-system,'Segoe UI','Helvetica Neue',sans-serif",overflow:"hidden",userSelect:"none"}}>

    {/* TAB BAR */}
    <div style={{height:38,display:"flex",alignItems:"flex-end",background:C.tabBar,padding:"0 0 0 8px",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"flex-end",flex:1,overflow:"hidden",height:"100%"}}>
        {tabs.map(t=><Tab key={t.id} t={t} isA={t.id===aId} onSelect={()=>sA(t.id)} onClose={()=>closeTab(t.id)}/>)}
        <div onClick={newTab} style={{width:28,height:28,marginLeft:4,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",alignSelf:"flex-end",marginBottom:4,flexShrink:0}}>
          <Ico n="plus" size={16}/>
        </div>
      </div>
    </div>

    {/* TOOLBAR */}
    <div style={{height:48,background:C.toolbar,display:"flex",alignItems:"center",padding:"0 8px",gap:2,flexShrink:0,borderBottom:showBM?`1px solid ${C.border}`:"none"}}>
      <IBtn n="back"    onClick={goBack}  title="אחורה"  disabled={hIdx<=0}/>
      <IBtn n="forward" onClick={goFwd}   title="קדימה"  disabled={hIdx>=hist.length-1}/>
      <IBtn n={isLoading?"stop":"reload"} onClick={isLoading?()=>{}:reload} title="רענן"/>
      <IBtn n="home"    onClick={()=>{sOmni("");newTab();}} title="דף הבית"/>
      <div style={{width:6}}/>
      {/* Omnibox */}
      <div style={{flex:1,position:"relative",display:"flex",alignItems:"center",background:omniF?"#fff":C.omni,borderRadius:omniF?"16px 16px 0 0":24,height:36,padding:"0 12px",gap:8,border:omniF?`2px solid ${C.blue}`:"1px solid transparent",transition:"all .15s",cursor:"text"}} onClick={()=>omniRef.current?.focus()}>
        {omni&&!omniF?<Ico n={blocked?"shield":isHttps?"lock":"shield"} size={15} color={blocked?C.red:isHttps?C.muted:C.warn}/>:<Ico n="search" size={15}/>}
        <input ref={omniRef} value={omni} onChange={e=>sOmni(e.target.value)}
          onFocus={()=>{sSaved(omni);sOmniF(true);omniRef.current?.select();}}
          onBlur={()=>setTimeout(()=>{sOmniF(false);sOmni(saved||tab.url||"");},160)}
          onKeyDown={e=>{if(e.key==="Enter"){go(omni);omniRef.current?.blur();}if(e.key==="Escape"){sOmni(saved);omniRef.current?.blur();}}}
          placeholder="חיפוש Google או הכנסת כתובת"
          style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:14,color:blocked?"#d93025":C.text,direction:"ltr",fontFamily:"inherit"}}/>
        {tab.url&&!omniF&&<IBtn n={isBm?"star":"starO"} color={isBm?C.blue:C.muted} onClick={e=>{e.stopPropagation();toggleBm();}} title={isBm?"הסר סימניה":"הוסף סימניה"} active={isBm} size={24} is={16}/>}
        {omniF&&<Suggest q={omni} onPick={v=>{sOmni(v);go(v);}}/>}
      </div>
      <div style={{width:6}}/>
      {ytMode&&ytBlocked>0&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",background:"#fce8e6",borderRadius:12,fontSize:11,color:C.red,fontWeight:600,flexShrink:0}}><span>▶️</span><span>{ytBlocked} חסומו</span></div>}
      {aiCount>0&&!ytMode&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",background:"#e6f4ea",borderRadius:12,fontSize:11,color:C.green,fontWeight:600,flexShrink:0}}><span>🤖</span><span>{aiCount}</span></div>}
      <div style={{position:"relative"}}>
        <IBtn n="shield" color={C.green} title="FilterGuard" active={showFilter} onClick={()=>{sFilter(x=>!x);sMenu(false);}}/>
        {showFilter&&<FilterPanel onClose={()=>sFilter(false)} listVer={listVer}/>}
      </div>
      <div style={{position:"relative"}}>
        <IBtn n="menu" title="הגדרות ועוד" active={showMenu} onClick={()=>{sMenu(x=>!x);sFilter(false);}}/>
        {showMenu&&<ChromeMenu onClose={()=>sMenu(false)} onFind={()=>sFind(true)} onZoom={applyZoom} zoom={zoom} onNewTab={newTab} onToggleBM={()=>sShowBM(x=>!x)} onSettings={()=>sFilter(true)} onTranslate={translatePage}/>}
      </div>
    </div>

    {showBM&&<BMBar bms={bms} onGo={go}/>}
    {tranBar&&tab.url&&!blocked&&<TranslateBar url={tab.url} onTranslate={translatePage} onDismiss={()=>sTranBar(false)}/>}

    {/* CONTENT */}
    <div style={{flex:1,position:"relative",overflow:"hidden",background:"#fff"}}>
      {showFind&&<FindBar onClose={()=>sFind(false)}/>}
      {!tab.url?<NewTab onGo={go} hist={hist}/>
      :blocked?<BlockedPage info={blocked}/>
      :<>
        {frameErr&&<div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,background:"#fff3e0",borderBottom:"1px solid #ffe0b2",padding:"7px 14px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:"#bf360c"}}>
          <span>⚠️</span><span>האתר חסם טעינה במסגרת — הסינון פועל ברמת VPN.</span>
          <a href={tab.url} target="_blank" rel="noopener noreferrer" style={{color:C.blue,marginLeft:"auto",textDecoration:"none"}}>פתח בחלון נפרד ↗</a>
        </div>}
        <iframe key={tab.url} ref={frameRef} src={tab.url}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          allow="fullscreen"
          style={{width:"100%",height:"100%",border:"none",marginTop:frameErr?40:0,zoom:zoom/100}}
          onLoad={onLoad} onError={()=>{sFrameErr(true);sT(p=>p.map(t=>t.id===aId?{...t,loading:false}:t));}}/>
      </>}
    </div>

    {tab.url&&!omniF&&<div style={{position:"absolute",bottom:0,left:0,padding:"2px 8px",background:"#f1f3f4",borderRadius:"0 4px 0 0",fontSize:11,color:C.muted,maxWidth:"55%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",pointerEvents:"none",border:`1px solid ${C.border}`,borderLeft:"none",borderBottom:"none",zIndex:5}}>{tab.url}</div>}

    <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}input::placeholder{color:#9aa0a6}::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#dadce0;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#bdc1c6}button:focus{outline:none}`}</style>
  </div>;
}
