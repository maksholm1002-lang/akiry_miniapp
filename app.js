const tg = window.Telegram?.WebApp;
if(tg){tg.expand();}
const SERVER_URL = 'https://akiry.ru';
const SERVER_TOKEN = 'mya';
const MY_USER_ID = tg?.initDataUnsafe?.user?.id || 0;
const MY_NAME = tg?.initDataUnsafe?.user?.first_name || 'Зритель';
const MY_USERNAME = tg?.initDataUnsafe?.user?.username || '';
let DB = {anime:{},actors:{},schedule:[],notifications:[],news:[]};
let curAnime = null, curEpIdx = 0;
let calY = new Date().getFullYear(), calM = new Date().getMonth();
let activeSource = 1, currentFilter = 'all';
let replyTo = null;
let autoRefreshTimer = null;
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const EM = ['🌀','⚔️','🔥','🌊','✨','🎭','🌙','💫','🗡️','🎯'];
const AEM = ['👤','🎙','🎭','🌟'];
const em = id => EM[Math.abs(parseInt(id||0))%EM.length];
const aem = id => AEM[Math.abs(parseInt(id||0))%AEM.length];
const REACTIONS = ['❤️','😂','🔥','😮','👏','😢'];
const getBM = () => {try{return JSON.parse(localStorage.getItem('bm')||'[]')}catch{return[]}};
const saveBM = a => {try{localStorage.setItem('bm',JSON.stringify(a))}catch{}};
const isBM = id => getBM().includes(id);
const getWL = () => {try{return JSON.parse(localStorage.getItem('wl')||'[]')}catch{return[]}};
const saveWL = a => {try{localStorage.setItem('wl',JSON.stringify(a))}catch{}};
const isWL = id => getWL().includes(id);
const getRat = () => {try{return JSON.parse(localStorage.getItem('rat')||'{}')}catch{return{}}};
const saveRat = r => {try{localStorage.setItem('rat',JSON.stringify(r))}catch{}};
const getViews = () => {try{return JSON.parse(localStorage.getItem('views')||'{}')}catch{return{}}};
const getViewedEps = () => {try{return JSON.parse(localStorage.getItem('viewed')||'[]')}catch{return[]}};
const addView = k => {
const viewed = getViewedEps();
if(viewed.includes(k)) return false;
viewed.push(k); try{localStorage.setItem('viewed',JSON.stringify(viewed.slice(-500)))}catch{}
let v = getViews(); v[k] = (v[k]||0)+1;
try{localStorage.setItem('views',JSON.stringify(v))}catch{}
const [aid,en] = k.split('_');
fetch(SERVER_URL+'/view?anime_id='+aid+'&ep_num='+en+'&user_id='+MY_USER_ID, {method:'POST'}).catch(()=>{});
return true;
};
const getHistory = () => {try{return JSON.parse(localStorage.getItem('hist')||'[]')}catch{return[]}};
const addHistory = (animeId, epIdx, progress) => {
let h = getHistory().filter(x => !(x.a===animeId&&x.i===epIdx));
h.unshift({a:animeId,i:epIdx,p:progress,ts:Date.now()});
try{localStorage.setItem('hist',JSON.stringify(h.slice(0,50)))}catch{}
};
const getCW = () => {try{return JSON.parse(localStorage.getItem('cw')||'[]')}catch{return[]}};
const saveCW = (aid,idx,p) => {
let d = getCW().filter(x=>x.a!==aid); d.unshift({a:aid,i:idx,p});
try{localStorage.setItem('cw',JSON.stringify(d.slice(0,5)))}catch{}
addHistory(aid,idx,p);
};
function toggleTheme(){
const th = document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
document.documentElement.setAttribute('data-theme',th);
try{localStorage.setItem('theme',th)}catch{}
if(tg){ th==='dark'?tg.setHeaderColor('#000000'):tg.setHeaderColor('#f2f2f7'); }
}
function initTheme(){
const saved = localStorage.getItem('theme')||'dark';
document.documentElement.setAttribute('data-theme',saved);
if(tg){ saved==='dark'?tg.setHeaderColor('#000000'):tg.setHeaderColor('#f2f2f7'); }
}
function hideSplash(){setTimeout(()=>{document.getElementById('splash').classList.add('hide');setTimeout(()=>{document.getElementById('splash').style.display='none'},500)},1800)}
async function loadDB(){
try{const r=await fetch(SERVER_URL+'/db?t='+Date.now());DB=await r.json()}
catch{DB={anime:{"1":{id:"1",title:"Jujutsu Kaisen",title_jp:"呪術廻戦",description:"Юдзи Итадори — сосуд для сильнейшего проклятого духа. Теперь его ждёт путь экзорциста.",genre:"Сёнен",year:2020,status:"ongoing",cover_file_id:"",episodes:[{num:1,title:"Рёмэн Сукуна",duration:"23:40",video_url:"",video_url_vk:"",cast:[]}]}},actors:{},schedule:[],notifications:[],news:[]}}
renderAll();
hideSplash();
startAutoRefresh();
}
function startAutoRefresh(){
if(autoRefreshTimer) clearInterval(autoRefreshTimer);
autoRefreshTimer = setInterval(async()=>{
try{const r=await fetch(SERVER_URL+'/db?t='+Date.now());const newDB=await r.json();
if(JSON.stringify(newDB)!==JSON.stringify(DB)){DB=newDB;renderAll();showToast('🔄 Данные обновлены');}}
catch{}
}, 5*60*1000);
}
function renderAll(){
renderCatalog(getFilteredAnime());
renderFeatured();
renderBookmarks();
renderActors();
renderCalendar();
renderNotifs();
renderCW();
renderNews();
renderWatchlist();
updateAbout();
initAdmin();
checkSmartNotifications();
}
function toggleSearch(){
const w=document.getElementById('srchWrap');w.classList.toggle('show');
if(w.classList.contains('show')) document.getElementById('searchInput').focus();
else{document.getElementById('searchInput').value='';renderCatalog(getFilteredAnime());}
}
function toggleFilter(){
const f=document.getElementById('filterBar');f.classList.toggle('show');
}
document.getElementById('searchInput').addEventListener('input',debounce(e=>{
const q=e.target.value.toLowerCase();
const list=getFilteredAnime().filter(a=>a.title.toLowerCase().includes(q)||(a.title_jp||'').toLowerCase().includes(q));
renderCatalog(list);
},200));
function setFilter(val,el){
currentFilter=val;
document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
el.classList.add('active');
renderCatalog(getFilteredAnime());
}
function getFilteredAnime(){
let list=Object.values(DB.anime||{});
if(currentFilter==='ongoing') list=list.filter(a=>a.status==='ongoing');
else if(currentFilter==='ended') list=list.filter(a=>a.status==='ended');
else if(currentFilter!=='all') list=list.filter(a=>a.genre===currentFilter);
return list;
}
function renderFeatured(){
const on=Object.values(DB.anime||{}).filter(a=>a.status==='ongoing');
const s=document.getElementById('featScroll');
document.getElementById('featWrap').style.display=on.length?'':'none';
s.innerHTML=on.map(a=>{
const img=a.cover_file_id?`<img class="feat-img" src="covers/${a.id}.jpg" onerror="this.outerHTML='<div class=\\'feat-ph\\'>${em(a.id)}</div>'">`:`<div class="feat-ph">${em(a.id)}</div>`;
return `<div class="feat-card" onclick="openAnime('${a.id}')">
${img}<div class="feat-grad"></div>
<div class="feat-info">
<div class="feat-badge on">● Озвучивается</div>
<div class="feat-title">${a.title}</div>
<div class="feat-sub">${a.episodes?.length||0} серий · ${a.genre}</div>
</div>
</div>`;
}).join('');
}
function getAvgR(id,r){
if(DB.ratings?.[id]){const avgs=Object.values(DB.ratings[id]).map(e=>e._avg).filter(Boolean);if(avgs.length)return(avgs.reduce((a,b)=>a+b,0)/avgs.length).toFixed(1);}
const v=r[id];if(!v||!Object.keys(v).length)return null;
return(Object.values(v).reduce((a,b)=>a+b,0)/Object.values(v).length).toFixed(1);
}
function renderCatalog(list){
const g=document.getElementById('catalogGrid');
if(!list.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>Ничего не найдено</p></div>`;return}
const r=getRat();
g.innerHTML=list.map((a,i)=>{
const eps=a.episodes?.length??0,on=a.status==='ongoing',bm=isBM(a.id),wl=isWL(a.id),avg=getAvgR(a.id,r);
const coverSrc=a.cover_file_id?`${SERVER_URL}/covers/${a.id}.jpg`:`covers/${a.id}.jpg`;const img=a.cover_file_id?`<img class="card-img" src="${coverSrc}" onerror="this.outerHTML='<div class=\\'card-ph\\'>${em(a.id)}<div class=\\'card-st ${on?'on':'off'}\\'>${on?'Озвучивается':'Озвучено'}</div></div>'">`:`<div class="card-ph">${em(a.id)}<div class="card-st ${on?'on':'off'}">${on?'Озвучивается':'Озвучено'}</div></div>`;
return `<div class="card" style="animation-delay:${i*.06}s" onclick="openAnime('${a.id}')">
<div class="card-img-w" style="position:relative">
${img}
<div class="card-bm ${bm?'saved':''}" onclick="event.stopPropagation();quickBM('${a.id}',this)">
<svg fill="${bm?'#fff':'none'}" viewBox="0 0 24 24" stroke="white" stroke-width="2" width="13" height="13"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
</div>
<div class="card-wl ${wl?'added':''}" onclick="event.stopPropagation();quickWL('${a.id}',this)">
<svg fill="${wl?'var(--purple)':'none'}" viewBox="0 0 24 24" stroke="${wl?'var(--purple)':'white'}" stroke-width="2" width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
</div>
<div class="card-preview">
<div class="card-preview-title">${a.title_jp||a.title}</div>
<div class="card-preview-desc">${a.description||''}</div>
</div>
</div>
<div class="card-body">
<div class="card-title">${a.title}</div>
<div class="card-row">
<div class="card-eps">${eps} серий</div>
${avg?`<div class="card-rat"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${avg}</div>`:''}
</div>
</div>
</div>`;
}).join('');
}
function quickBM(id,el){let b=getBM();const s=b.includes(id);if(s)b=b.filter(x=>x!==id);else b.push(id);saveBM(b);el.classList.toggle('saved',!s);el.querySelector('svg').setAttribute('fill',!s?'#fff':'none');renderBookmarks();showToast(s?'Удалено из закладок':'💾 Добавлено в закладки')}
function quickWL(id,el){let w=getWL();const s=w.includes(id);if(s)w=w.filter(x=>x!==id);else w.push(id);saveWL(w);el.classList.toggle('added',!s);el.querySelector('svg').setAttribute('fill',!s?'var(--purple)':'none');el.querySelector('svg').setAttribute('stroke',!s?'var(--purple)':'white');renderWatchlist();showToast(s?'Убрано из списка':'🔮 Добавлено в «Хочу посмотреть»')}
function renderBookmarks(){
}
function renderWatchlist(){
const list=getWL().map(id=>DB.anime[id]).filter(Boolean);
const g=document.getElementById('watchlistGrid');
if(!list.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔮</div><p>Список пуст — добавляй аниме через ⭐ в каталоге</p></div>`;return}
const r=getRat();
g.innerHTML=list.map((a,i)=>{
const eps=a.episodes?.length??0,on=a.status==='ongoing',avg=getAvgR(a.id,r);
const coverSrc=a.cover_file_id?`${SERVER_URL}/covers/${a.id}.jpg`:`covers/${a.id}.jpg`;const img=a.cover_file_id?`<img class="card-img" src="${coverSrc}" onerror="this.outerHTML='<div class=\\'card-ph\\'>${em(a.id)}</div>'">`:`<div class="card-ph">${em(a.id)}</div>`;
return `<div class="card" style="animation-delay:${i*.06}s" onclick="openAnime('${a.id}')">
<div class="card-img-w" style="position:relative">${img}<div class="card-st ${on?'on':'off'}">${on?'Озвучивается':'Озвучено'}</div></div>
<div class="card-body"><div class="card-title">${a.title}</div>
<div class="card-row"><div class="card-eps">${eps} серий</div>${avg?`<div class="card-rat"><svg viewBox="0 0 24 24" width="10" height="10" fill="var(--gold)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${avg}</div>`:''}</div></div>
</div>`;
}).join('');
}
function renderHistory(){
const hist=getHistory();
const el=document.getElementById('historyList');
if(!hist.length){el.innerHTML=`<div class="empty"><div class="empty-icon">📺</div><p>История пуста</p></div>`;return}
el.innerHTML=hist.map(x=>{
const a=DB.anime[x.a];if(!a)return'';const ep=a.episodes?.[x.i];if(!ep)return'';
const d=new Date(x.ts);const ds=d.toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
return `<div class="cw-card" style="flex:1;max-width:100%;margin-bottom:8px" onclick="openAnimePlay('${x.a}',${x.i})">
<div class="cw-thumb">${em(a.id)}</div>
<div class="cw-info">
<div class="cw-ttl">${a.title}</div>
<div class="cw-ep">Серия ${ep.num} — ${ep.title}</div>
<div class="cw-bar"><div class="cw-fill" style="width:${x.p||30}%"></div></div>
<div style="font-size:9px;color:var(--muted);margin-top:3px">${ds}</div>
</div>
<div class="cw-btn"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg></div>
</div>`;
}).join('');
}
function clearHistory(){if(confirm('Очистить историю?')){localStorage.removeItem('hist');localStorage.removeItem('cw');renderHistory();renderCW();showToast('🗑 История очищена')}}
function renderCW(){
const d=getCW();if(!d.length){document.getElementById('cwWrap').style.display='none';return}
document.getElementById('cwWrap').style.display='';
document.getElementById('cwScroll').innerHTML=d.map(x=>{
const a=DB.anime[x.a];if(!a)return'';const ep=a.episodes?.[x.i];if(!ep)return'';
return `<div class="cw-card" onclick="openAnimePlay('${x.a}',${x.i})">
<div class="cw-thumb">${em(a.id)}</div>
<div class="cw-info"><div class="cw-ttl">${a.title}</div><div class="cw-ep">Серия ${ep.num} — ${ep.title}</div>
<div class="cw-bar"><div class="cw-fill" style="width:${x.p||30}%"></div></div></div>
<div class="cw-btn"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg></div>
</div>`;
}).join('');
}
async function loadCmtCount(animeId,epNum){
try{
const r=await fetch(SERVER_URL+'/comments/'+animeId+'/'+epNum);
const d=await r.json();
const el=document.getElementById('cmtCnt_'+animeId+'_'+epNum);
if(el) el.textContent=d.total>0?d.total:'';
}catch{}
}
function rateEp(epNum,stars){
const a=curAnime;if(!a)return;
const r=getRat();if(!r[a.id])r[a.id]={};
r[a.id][epNum]=stars;saveRat(r);renderEpList();
showToast(`⭐ ${stars}/5`);
if(tg)tg.sendData(JSON.stringify({action:'rate',anime_id:a.id,ep_num:epNum,stars,user_id:MY_USER_ID}));
}
function watchFirst(){if(curAnime?.episodes?.length)openPlayer(0)}
function toggleBookmark(){
const a=curAnime;if(!a)return;
let b=getBM();const s=b.includes(a.id);
if(s)b=b.filter(x=>x!==a.id);else b.push(a.id);saveBM(b);
const bb=document.getElementById('bmBtn');bb.classList.toggle('saved',!s);bb.querySelector('svg').setAttribute('fill',!s?'var(--acc)':'none');
renderCatalog(getFilteredAnime());showToast(s?'Удалено из закладок':'💾 Добавлено в закладки');
}
function toggleWatchlist(){
const a=curAnime;if(!a)return;
let w=getWL();const s=w.includes(a.id);
if(s)w=w.filter(x=>x!==a.id);else w.push(a.id);saveWL(w);
const wb=document.getElementById('wlBtn');wb.classList.toggle('added',!s);wb.querySelector('svg').setAttribute('fill',!s?'var(--purple)':'none');
renderWatchlist();showToast(s?'Убрано из списка':'🔮 Добавлено в «Хочу посмотреть»');
}
function toggleSub(){const t=document.getElementById('subTgl');t.classList.toggle('on');showToast(t.classList.contains('on')?'🔔 Подписались':'🔕 Отписались')}
function shareAnime(){
const a=curAnime;if(!a)return;
const text=`🎌 ${a.title}\n${a.episodes?.length||0} серий · ${a.genre}\n\nСмотри на Акиру!`;
if(tg?.switchInlineQuery) tg.switchInlineQuery(a.title,'users');
else{showToast('🔗 Ссылка скопирована!')}
}
function openAnimePlay(id,idx){openAnime(id);setTimeout(()=>openPlayer(idx),120)}
function toggleComments(animeId,epNum){
const sec=document.getElementById('cmtSection_'+animeId+'_'+epNum);
if(sec.style.display==='none'){
sec.style.display='';
loadComments(animeId,epNum);
} else sec.style.display='none';
}
function renderComment(c,animeId,epNum,isAdm){
const ts=new Date(c.ts*1000).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const liked=c.likes.includes(MY_USER_ID);
const reactions=(c.reactions||{});
const reactionHtml=REACTIONS.map(r=>{
const count=(reactions[r]||[]).length;
const active=(reactions[r]||[]).includes(MY_USER_ID);
return count>0?`<div class="c-react ${active?'active':''}" onclick="addReaction('${c.id}','${animeId}',${epNum},'${r}',this)">
${r}<span class="c-react-count">${count}</span>
</div>`:'';
}).join('');
const text=c.text.replace(/@(\w+)/g,'<span class="c-mention">@$1</span>');
const repliesHtml=(c.replies||[]).map(rep=>renderComment(rep,animeId,epNum,isAdm)).join('');
return `<div class="cmt" id="cmt_${c.id}">
<div class="cmt-main">
<div class="c-av">${c.first_name?c.first_name[0]:'?'}</div>
<div class="c-body">
<div class="c-name">${c.first_name}${c.username?' · @'+c.username:''}</div>
<div class="c-text">${text}</div>
${reactionHtml?`<div class="c-reactions">${reactionHtml}</div>`:''}
<div class="c-meta">
<div class="c-time">${ts}</div>
<div class="c-like ${liked?'liked':''}" onclick="likeComment('${c.id}','${animeId}',${epNum},this)">
<svg fill="${liked?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
${c.likes.length}
</div>
<div class="c-reply-btn" onclick="showReplyInput('${c.id}','${animeId}',${epNum},'${c.first_name}')">Ответить</div>
<div class="react-pick" onclick="showReactPicker('${c.id}','${animeId}',${epNum},this)">😊</div>
${isAdm?`<div class="c-del" onclick="deleteCmt('${c.id}','${animeId}',${epNum})">Удалить</div>`:''}
</div>
<div id="reactPicker_${c.id}" style="display:none">
<div class="react-picker">
${REACTIONS.map(r=>`<span class="react-pick" onclick="addReaction('${c.id}','${animeId}',${epNum},'${r}',this);document.getElementById('reactPicker_${c.id}').style.display='none'">${r}</span>`).join('')}
</div>
</div>
<div id="replyInput_${c.id}" style="display:none">
<div class="reply-input-row">
<input class="reply-inp" id="replyInp_${c.id}" placeholder="Ответить @${c.first_name}...">
<button class="reply-send" onclick="sendReply('${c.id}','${animeId}',${epNum})">
<svg fill="currentColor" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
</button>
</div>
</div>
</div>
</div>
${repliesHtml?`<div class="c-replies">${repliesHtml}</div>`:''}
</div>`;
}
function showReactPicker(cmtId,animeId,epNum){
const el=document.getElementById('reactPicker_'+cmtId);
if(el)el.style.display=el.style.display==='none'?'':'none';
}
function showReplyInput(cmtId,animeId,epNum,name){
const el=document.getElementById('replyInput_'+cmtId);
if(el){el.style.display=el.style.display==='none'?'':'none';
const inp=document.getElementById('replyInp_'+cmtId);if(inp){inp.focus();inp.placeholder=`Ответить @${name}...`;}}
}
async function sendReply(parentId,animeId,epNum){
const inp=document.getElementById('replyInp_'+parentId);
const text=inp?.value.trim();if(!text)return;
inp.value='';
try{
await fetch(SERVER_URL+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({anime_id:animeId,ep_num:epNum,text,user_id:MY_USER_ID,username:MY_USERNAME,first_name:MY_NAME,reply_to:parentId})});
loadComments(animeId,epNum);
}catch{showToast('❌ Ошибка')}
}
async function sendComment(animeId,epNum){
const inp=document.getElementById('cmtInp_'+animeId+'_'+epNum);
const text=inp?.value.trim();if(!text)return;inp.value='';
try{
await fetch(SERVER_URL+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({anime_id:animeId,ep_num:epNum,text,user_id:MY_USER_ID,username:MY_USERNAME,first_name:MY_NAME})});
loadComments(animeId,epNum);
}catch{showToast('❌ Ошибка отправки')}
}
async function likeComment(id,animeId,epNum,el){
try{
const r=await fetch(SERVER_URL+'/like?comment_id='+id+'&user_id='+MY_USER_ID+'&anime_id='+animeId+'&ep_num='+epNum,{method:'POST'});
const d=await r.json();
el.classList.toggle('liked',d.liked);el.querySelector('svg').setAttribute('fill',d.liked?'currentColor':'none');
el.lastChild.textContent=' '+d.likes;
}catch{}
}
async function addReaction(cmtId,animeId,epNum,reaction,el){
try{
const r=await fetch(`${SERVER_URL}/react?comment_id=${cmtId}&anime_id=${animeId}&ep_num=${epNum}&user_id=${MY_USER_ID}&reaction=${encodeURIComponent(reaction)}`,{method:'POST'});
const d=await r.json();
loadComments(animeId,epNum);
}catch{}
}
async function deleteCmt(id,animeId,epNum){
if(!confirm('Удалить?'))return;
try{await fetch(`${SERVER_URL}/comment?comment_id=${id}&anime_id=${animeId}&ep_num=${epNum}&token=${SERVER_TOKEN}`,{method:'DELETE'});document.getElementById('cmt_'+id)?.remove();showToast('🗑 Удалено')}catch{}
}
function switchSource(src){
const ep=curAnime?.episodes?.[curEpIdx];if(!ep)return;
activeSource=src;
document.getElementById('srcBtn1').classList.toggle('active',src===1);
document.getElementById('srcBtn2').classList.toggle('active',src===2);
document.getElementById('plIframe').src=src===1?ep.video_url:ep.video_url_vk;
}
function shareEp(){
const a=curAnime;const ep=a?.episodes?.[curEpIdx];if(!ep)return;
if(tg?.switchInlineQuery)tg.switchInlineQuery(`${a.title} серия ${ep.num}`,'users');
else showToast('🔗 Ссылка скопирована!');
}
function renderActors(query=''){
let list=Object.values(DB.actors||{});
if(query)list=list.filter(a=>a.name.toLowerCase().includes(query)||a.role?.toLowerCase().includes(query));
const g=document.getElementById('actorsGrid');
if(!list.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🎙</div><p>${query?'Не найдено':'Актёры не добавлены'}</p></div>`;return}
const roleMap={lead:'ВЕДУЩИЙ',support:'ВТ. ПЛАН',director:'РЕЖИССЁР',sound:'ЗВУКОРЕЖ.',admin:'АДМИН'};
const badgeMap={lead:'ab-lead',support:'ab-sup',director:'ab-dir',sound:'ab-sound',admin:'ab-admin'};
g.innerHTML=list.map((a,i)=>{
const rl=roleMap[a.role]||'АКТЁР',rc=badgeMap[a.role]||'ab-sup';
const chars=(a.roles||[]).slice(0,3).map(r=>{const an=DB.anime?.[r.anime_id];return`${r.character}${an?` (${an.title.split(' ')[0]})`:''}`;}).join(', ')||'Роли не указаны';
return `<div class="act-card" style="animation-delay:${i*.06}s" onclick="openActor('${a.id}')">
${a.role==='lead'?'<div class="act-star">⭐</div>':''}
<div class="act-av-w"><div class="act-av">${a.photo?`<img src="${a.photo}">`:`${aem(a.id)}`}</div></div>
<div class="act-name">${a.name}</div>
<span class="act-badge ${rc}">${rl}</span>
<div class="act-chars">${chars}</div>
</div>`;
}).join('');
}
document.getElementById('actorSearch').addEventListener('input',e=>renderActors(e.target.value.toLowerCase()));
function openActor(id){
const a=DB.actors?.[id];if(!a)return;
const roleMap={lead:'ВЕДУЩИЙ АКТЁР',support:'ВТОРОЙ ПЛАН',director:'РЕЖИССЁР',sound:'ЗВУКОРЕЖИССЁР',admin:'АДМИНИСТРАТОР'};
const badgeMap={lead:'ab-lead',support:'ab-sup',director:'ab-dir',sound:'ab-sound',admin:'ab-admin'};
const rl=roleMap[a.role]||'АКТЁР',rc=badgeMap[a.role]||'ab-sup';
document.getElementById('adAva').innerHTML=a.photo?`<img src="${a.photo}">`:`${aem(a.id)}`;
document.getElementById('adName').textContent=a.name;
document.getElementById('adRole').innerHTML=`<span class="act-badge ${rc}" style="display:inline-block">${rl}</span>`;
document.getElementById('adBio').textContent=a.bio||'Биография не добавлена.';
const contacts=[];
if(a.telegram)contacts.push(`<a class="ad-ct-btn" href="https://t.me/${a.telegram.replace('@','')}"><div class="ad-ct-icon ct-tg">✈️</div><div><div class="ad-ct-lbl">Telegram</div><div class="ad-ct-val">${a.telegram}</div></div></a>`);
if(a.vk)contacts.push(`<a class="ad-ct-btn" href="${a.vk.startsWith('http')?a.vk:'https://vk.com/'+a.vk}"><div class="ad-ct-icon ct-vk">💙</div><div><div class="ad-ct-lbl">ВКонтакте</div><div class="ad-ct-val">${a.vk}</div></div></a>`);
if(a.email)contacts.push(`<a class="ad-ct-btn" href="mailto:${a.email}"><div class="ad-ct-icon ct-mail">✉️</div><div><div class="ad-ct-lbl">Почта</div><div class="ad-ct-val">${a.email}</div></div></a>`);
document.getElementById('adContacts').innerHTML=contacts.length?`<div style="padding:0 16px 4px;font-size:15px;font-weight:700">Контакты</div><div class="ad-contacts">${contacts.join('')}</div>`:'';
document.getElementById('adRoles').innerHTML=`
<div style="font-size:15px;font-weight:700;margin-bottom:10px">Роли</div>
${(a.roles||[]).map(r=>{const an=DB.anime?.[r.anime_id];return`<div class="ad-role-item"><div class="ad-em">${em(r.anime_id)}</div><div><div class="ad-an">${an?.title||'—'}</div><div class="ad-ch">${r.character}</div></div></div>`;}).join('')||`<div style="color:var(--muted2);font-size:13px">Роли не указаны</div>`}`;
document.getElementById('actOv').classList.add('open');if(tg)tg.BackButton.show();
setupActorComments(id);
}
function renderNews(){
const news=DB.news||[];
const el=document.getElementById('newsList');
if(!news.length){el.innerHTML='<div class="empty"><div class="empty-icon">📰</div><p>Новостей пока нет</p></div>';return}
el.innerHTML=news.map((n,i)=>`
<div class="news-card" style="animation-delay:${i*.05}s" onclick="${n.link?`openLink('${n.link}')`:''}" >
${n.photo?`<img class="news-img" src="${n.photo}">`:''}
<div class="news-body">
<div class="news-date">${n.date}</div>
<div class="news-text">${n.text}</div>
${n.link?`<span class="news-link">Читать полностью →</span>`:''}
</div>
</div>`).join('');
const ch=DB.news_channel;if(ch)document.getElementById('newsLink').innerHTML=`<a href="https://t.me/${ch.replace('@','')}" style="color:var(--muted2);text-decoration:none;font-size:12px;font-weight:600">Открыть канал →</a>`;
}
function openLink(url){if(tg)tg.openLink(url);else window.open(url,'_blank')}
function renderCalendar(){
document.getElementById('calLabel').textContent=`${MONTHS[calM]} ${calY}`;
const g=document.getElementById('calGrid');
const dows=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
let h=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
const first=new Date(calY,calM,1),start=(first.getDay()+6)%7,days=new Date(calY,calM+1,0).getDate();
const today=new Date();
for(let i=0;i<start;i++){const d=new Date(calY,calM,1-start+i);h+=`<div class="cal-day dim"><div class="cdn">${d.getDate()}</div></div>`}
for(let d=1;d<=days;d++){
const ds=`${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const has=(DB.schedule||[]).some(s=>s.date===ds);
const isT=today.getFullYear()===calY&&today.getMonth()===calM&&today.getDate()===d;
h+=`<div class="cal-day${isT?' today':''}"><div class="cdn">${d}</div>${has?'<div class="cdot"></div>':''}</div>`;
}
g.innerHTML=h;
const up=(DB.schedule||[]).filter(s=>new Date(s.date)>=new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
document.getElementById('calUpcoming').innerHTML=up.map(s=>{
const a=DB.anime?.[s.anime_id];const d=new Date(s.date);
const ds=`${d.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth()]}`;
return `<div class="cal-ep-item" onclick="openAnime('${s.anime_id}')">
<div class="cal-ep-thumb">${em(s.anime_id)}</div>
<div><div class="cal-ep-an">${a?.title||'—'}</div><div class="cal-ep-ep">Серия ${s.episode_num} — ${s.title}</div></div>
<div class="cal-ep-date">${ds}</div>
</div>`;
}).join('')||`<div class="empty"><div class="empty-icon">📅</div><p>Нет запланированных серий</p></div>`;
const uc=(DB.schedule||[]).filter(s=>new Date(s.date)>=new Date()).length;
const b=document.getElementById('calBadge');uc>0?(b.textContent=uc,b.classList.add('show')):b.classList.remove('show');
}
function calNav(d){calM+=d;if(calM>11){calM=0;calY++}else if(calM<0){calM=11;calY--}renderCalendar()}
let statsPeriod='all';
function setPeriod(period,el){
statsPeriod=period;
document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');
renderStats();
}
async function renderStats(){
try{
const r=await fetch(SERVER_URL+'/stats?period='+statsPeriod);
const d=await r.json();
const views=d.views||{};
let total=Object.values(views).reduce((s,v)=>s+v,0);
document.getElementById('stTotalV').textContent=total;
document.getElementById('stTotalA').textContent=Object.keys(DB.anime||{}).length;
document.getElementById('stTotalE').textContent=Object.values(DB.anime||{}).reduce((s,a)=>s+(a.episodes?.length||0),0);
const today=new Date();
const dayViews=[];
for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];const lbl=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d.getDay()===0?6:d.getDay()-1];dayViews.push({lbl,v:0})}
const maxDV=Math.max(...dayViews.map(x=>x.v),1);
document.getElementById('actBars').innerHTML=dayViews.map(x=>`
<div class="act-bar-wrap">
<div class="act-bar" style="height:${Math.max(x.v/maxDV*100,5)}%"></div>
<div class="act-bar-lbl">${x.lbl}</div>
</div>`).join('');
const animeStats={};
Object.entries(views).forEach(([k,v])=>{
const[aid,en]=k.split('_');if(!aid||!en)return;
if(!animeStats[aid])animeStats[aid]={total:0,eps:{}};
animeStats[aid].total+=v;animeStats[aid].eps[en]=v;
});
const sorted=Object.entries(animeStats).sort((a,b)=>b[1].total-a[1].total);
const maxV=sorted[0]?.[1]?.total||1;
document.getElementById('statsContent').innerHTML=sorted.slice(0,5).map(([aid,data])=>{
const a=DB.anime?.[aid];if(!a)return'';
const eps=Object.entries(data.eps).sort((a,b)=>b[1]-a[1]).slice(0,3);
return `<div class="stats-card">
<div class="stats-anime-title">${a.title} <span style="color:var(--gold);font-size:12px">${data.total} просм.</span></div>
${eps.map(([en,v])=>{const ep=a.episodes?.find(e=>e.num==en);const pct=Math.round(v/maxV*100);
return `<div class="stats-row"><div class="stats-ep">Серия ${en}${ep?' — '+ep.title.slice(0,20):''}</div>
<div class="stats-bar-wrap"><div class="stats-bar" style="width:${pct}%"></div></div>
<div class="stats-count">${v}</div></div>`;}).join('')}
</div>`;
}).join('')||'<div class="empty"><div class="empty-icon">📊</div><p>Нет данных</p></div>';
}catch{document.getElementById('statsContent').innerHTML='<div class="empty"><div class="empty-icon">📊</div><p>Нет данных за период</p></div>';}
loadLeaderboard();
}
let selectedRole='';
function selectRole(el,role){
selectedRole=role;
document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected'));el.classList.add('selected');
}
function submitApply(){
const fio=document.getElementById('applyFio').value.trim();
const age=document.getElementById('applyAge').value.trim();
const tz=document.getElementById('applyTz').value;
const exp=document.getElementById('applyExp').value.trim();
const edu=document.getElementById('applyEdu').value.trim();
const demo=document.getElementById('applyDemo').value.trim();
if(!fio){showToast('⚠️ Введи ФИО');return}
if(!age){showToast('⚠️ Введи возраст');return}
if(!tz){showToast('⚠️ Выбери часовой пояс');return}
if(!selectedRole){showToast('⚠️ Выбери роль');return}
const roleNames={actor:'Актёр',sound:'Звукорежиссёр',admin:'Администратор',other:'Другое'};
const tgUser=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user;
const lines=['📋 Новая заявка в команду','👤 ФИО: '+fio,'🎂 Возраст: '+age,'🌍 Часовой пояс: '+tz,'🎭 Претендует на: '+roleNames[selectedRole]];
if(exp)lines.push('💼 Опыт: '+exp);if(edu)lines.push('🎓 Образование: '+edu);if(demo)lines.push('🔗 Демо: '+demo);
lines.push('');lines.push('🆔 Telegram: '+(tgUser?.username?'@'+tgUser.username:'не указан'));
const applyData = {
fio, age, tz, role: selectedRole,
exp, edu, demo,
tg: tgUser?.username ? '@'+tgUser.username : '',
first_name: MY_NAME || '',
user_id: MY_USER_ID || 0
};
fetch(SERVER_URL+'/apply', {
method:'POST', headers:{'Content-Type':'application/json'},
body: JSON.stringify(applyData)
}).then(r=>{
if(r.ok) showToast('🎉 Заявка отправлена!');
else showToast('❌ Ошибка отправки');
}).catch(()=>showToast('❌ Ошибка отправки'));
document.getElementById('applyBtn').disabled=true;
document.getElementById('applyBtn').textContent='✅ Заявка отправлена!';
setTimeout(()=>{['applyFio','applyAge','applyExp','applyEdu','applyDemo'].forEach(id=>document.getElementById(id).value='');document.getElementById('applyTz').value='';selectedRole='';document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected'));document.getElementById('applyBtn').disabled=false;document.getElementById('applyBtn').textContent='Отправить заявку';},3000);
}
function renderNotifs(){
const u=(DB.notifications||[]).filter(n=>!n.read).length;
document.getElementById('notifPip').classList.toggle('show',u>0);
const nb=document.getElementById('notifBadge');if(nb){u>0?(nb.textContent=u,nb.classList.add('show')):nb.classList.remove('show')}
document.getElementById('notifList').innerHTML=(DB.notifications||[]).map(n=>`
<div class="notif-row ${n.read?'':'unread'}">
<div class="notif-icon">${em(n.anime_id||'0')}</div>
<div class="notif-body"><div class="notif-txt">${n.text}</div><div class="notif-time">${n.date}</div></div>
${!n.read?'<div class="npip"></div>':''}
</div>`).join('')||`<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Нет уведомлений</div>`;
}
function toggleNotif(){document.getElementById('notifPanel').classList.toggle('open')}
function markAllRead(){(DB.notifications||[]).forEach(n=>n.read=true);renderNotifs()}
document.addEventListener('click',e=>{
const p=document.getElementById('notifPanel');
if(p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('.hdr-btn'))p.classList.remove('open');
});
function updateAbout(){
const info=DB.team_info||{};
document.getElementById('abEps').textContent=Object.values(DB.anime||{}).reduce((s,a)=>s+(a.episodes?.length||0),0);
document.getElementById('abAnime').textContent=Object.keys(DB.anime||{}).length;
document.getElementById('abActors').textContent=Object.keys(DB.actors||{}).length;
const nameEl=document.getElementById('aboutTeamName');const descEl=document.getElementById('aboutTeamDesc');
if(nameEl&&info.name)nameEl.textContent=info.name;
if(descEl&&info.desc)descEl.textContent=info.desc;
const linksEl=document.getElementById('aboutLinks');
if(linksEl){
const links=[];
if(info.channel)links.push(`<a class="about-link-btn" href="https://t.me/${info.channel.replace('@','')}">✈️ Канал</a>`);
if(info.chat)links.push(`<a class="about-link-btn" href="https://t.me/${info.chat.replace('@','')}">💬 Чат</a>`);
if(info.email)links.push(`<a class="about-link-btn" href="mailto:${info.email}">✉️ Почта</a>`);
linksEl.innerHTML=links.join('');
}
}
function loadAboutForm(){
const info=DB.team_info||{};
document.getElementById('editTeamName').value=info.name||'Команда Акиру';
document.getElementById('editTeamDesc').value=info.desc||'';
document.getElementById('editChannel').value=info.channel||'';
document.getElementById('editChat').value=info.chat||'';
document.getElementById('editEmail').value=info.email||'';
}
async function saveAbout(){
const info={name:document.getElementById('editTeamName').value.trim(),desc:document.getElementById('editTeamDesc').value.trim(),channel:document.getElementById('editChannel').value.trim(),chat:document.getElementById('editChat').value.trim(),email:document.getElementById('editEmail').value.trim()};
DB.team_info=info;await pushDB();showToast('✅ Сохранено!');updateAbout();
}
function renderApplications(){
const apps=DB.applications||[];
const cnt=document.getElementById('appCount');if(cnt)cnt.textContent=apps.length+' шт.';
const badge=document.getElementById('appsBadge');const newApps=apps.filter(a=>!a.read).length;
if(badge&&newApps>0){badge.textContent=newApps;badge.classList.add('show')}
const roleNames={actor:'🎙 Актёр',sound:'🎚 Звукорежиссёр',admin:'⚙️ Администратор',other:'✨ Другое'};
const el=document.getElementById('appsList');
if(!apps.length){el.innerHTML='<div class="empty"><div class="empty-icon">📋</div><p>Заявок пока нет</p></div>';return}
el.innerHTML=[...apps].map((app,i)=>`
<div class="stats-card" style="animation-delay:${i*.05}s">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
<div style="font-size:14px;font-weight:700">${app.fio||'—'}</div>
<div style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--s3);color:var(--muted2)">${roleNames[app.role]||app.role||'—'}</div>
</div>
<div style="font-size:12px;color:var(--muted2);margin-bottom:3px">Возраст: <span style="color:var(--text)">${app.age||'—'}</span> · ${app.tz||'—'}</div>
${app.exp?`<div style="font-size:12px;color:var(--muted2);margin-bottom:3px">Опыт: <span style="color:var(--text)">${app.exp.slice(0,80)}</span></div>`:''}
${app.demo?`<div style="font-size:12px;color:var(--blue)">${app.demo}</div>`:''}
${app.tg?`<div style="font-size:11px;color:var(--teal);margin-top:6px">${app.tg}</div>`:''}
<div style="font-size:10px;color:var(--muted);margin-top:4px">${app.date||''}</div>
</div>`).join('');
}
function initAdmin(){
const isAdm=(DB.admin_ids||[]).includes(MY_USER_ID);
if(isAdm){
document.getElementById('navStats').style.display='';
document.getElementById('navApps').style.display='';
document.getElementById('adminFab').classList.add('show');
const eb=document.getElementById('editAboutBtn');if(eb)eb.style.display='';
}
}
function openAdmin(){document.getElementById('adminPanel').classList.add('open');adminTab('anime');if(tg)tg.BackButton.show()}
function closeAdmin(){document.getElementById('adminPanel').classList.remove('open')}
function adminTab(tab){
document.querySelectorAll('.admin-tab').forEach((el,i)=>el.classList.toggle('active',['anime','episodes','actors','schedule','push'][i]===tab));
const body=document.getElementById('adminBody');
if(tab==='anime')renderAdminAnime(body);
else if(tab==='episodes')renderAdminEpisodes(body);
else if(tab==='actors')renderAdminActors(body);
else if(tab==='schedule')renderAdminSchedule(body);
else if(tab==='push')renderAdminPush(body);
else if(tab==='users')renderAdminUsers(body);
}
function renderAdminAnime(body){
body.innerHTML=`
<div class="admin-sec-title">Добавить / редактировать аниме</div>
<div class="afield"><label>ID *</label><input id="aId" placeholder="1, 2, 3..."></div>
<div class="afield"><label>Название *</label><input id="aTitle" placeholder="Наруто"></div>
<div class="afield"><label>Японское название</label><input id="aJp" placeholder="NARUTO -ナルト-"></div>
<div class="afield"><label>Жанр</label><input id="aGenre" placeholder="Сёнен, Экшен..."></div>
<div class="afield"><label>Год</label><input id="aYear" type="number" placeholder="2024"></div>
<div class="afield"><label>Описание</label><textarea id="aDesc"></textarea></div>
<div class="afield"><label>Статус</label><select id="aStatus"><option value="ongoing">Озвучивается</option><option value="ended">Озвучено</option></select></div>
<button class="abtn primary" onclick="saveAnime()">💾 Сохранить аниме</button>
<button class="abtn secondary" id="posterUploadBtn" onclick="doPosterUpload()" style="display:none">🖼 Загрузить постер</button>
<div class="admin-sec-title" style="margin-top:16px">Список аниме</div>
${Object.values(DB.anime||{}).map(a=>`
<div class="admin-list-item" onclick="loadAnimeEdit('${a.id}')">
<div><div class="ali-title">${a.title}</div><div class="ali-sub">ID: ${a.id} · ${a.episodes?.length||0} серий</div></div>
<div style="display:flex;align-items:center;gap:8px">
<div style="color:var(--red);font-size:12px;font-weight:600;cursor:pointer" onclick="event.stopPropagation();deleteAnime('${a.id}')">✕</div>
<div class="ali-arr">›</div>
</div>
</div>`).join('')||'<div style="color:var(--muted);font-size:13px">Аниме не добавлено</div>'}`;
}
function loadAnimeEdit(id){
const a=DB.anime[id];if(!a)return;
document.getElementById('aId').value=a.id;document.getElementById('aTitle').value=a.title;
document.getElementById('aJp').value=a.title_jp||'';document.getElementById('aGenre').value=a.genre||'';
document.getElementById('aYear').value=a.year||'';document.getElementById('aDesc').value=a.description||'';
document.getElementById('aStatus').value=a.status||'ongoing';
document.getElementById('adminBody').scrollTop=0;showToast('📝 '+a.title);
}
async function saveAnime(){
const id=document.getElementById('aId').value.trim();const title=document.getElementById('aTitle').value.trim();
if(!id||!title){showToast('⚠️ Заполни ID и название');return}
if(!DB.anime)DB.anime={};
DB.anime[id]={id,title,title_jp:document.getElementById('aJp').value.trim(),genre:document.getElementById('aGenre').value.trim()||'Аниме',
year:parseInt(document.getElementById('aYear').value)||2024,description:document.getElementById('aDesc').value.trim()||'Описание не добавлено.',
status:document.getElementById('aStatus').value,cover_file_id:DB.anime[id]?.cover_file_id||'',episodes:DB.anime[id]?.episodes||[]};
await pushDB();showToast('✅ Аниме сохранено!');renderAdminAnime(document.getElementById('adminBody'));renderAll();
}
async function deleteAnime(id){
if(!confirm('Удалить аниме?'))return;delete DB.anime[id];await pushDB();showToast('🗑 Удалено');renderAdminAnime(document.getElementById('adminBody'));renderAll();
}
function renderAdminEpisodes(body){
const opts=Object.values(DB.anime||{}).map(a=>`<option value="${a.id}">${a.title}</option>`).join('');
body.innerHTML=`
<div class="admin-sec-title">Добавить серию</div>
<div class="afield"><label>Аниме *</label><select id="epAnime" onchange="loadEpList()">${opts}</select></div>
<div class="afield"><label>Номер *</label><input id="epNum" type="number" placeholder="1"></div>
<div class="afield"><label>Название *</label><input id="epTitle" placeholder="Название эпизода"></div>
<div class="afield"><label>Длительность</label><input id="epDur" placeholder="23:40"></div>
<div class="afield"><label>Sibnet URL</label><input id="epUrl" placeholder="https://video.sibnet.ru/shell.php?videoid=..."></div>
<div class="afield"><label>VK URL</label><input id="epVkUrl" placeholder="https://vk.com/video..."></div>
<div class="cast-editor">
<div class="cast-editor-title">Состав серии</div>
<button class="tg-parse-btn" onclick="parseCastFromTg()">📋 Вставить состав (Актёр — Персонаж)</button>
<div id="castEditorRows"></div>
<button class="cast-add-btn" onclick="addCastRow()">+ Добавить актёра</button>
</div>
<button class="abtn primary" onclick="saveEpisode()">💾 Сохранить серию</button>
<div class="admin-sec-title" style="margin-top:16px">Серии</div>
<div id="epListAdmin"></div>`;
if(Object.keys(DB.anime||{}).length)loadEpList();
}
async function deleteEpisode(animeId,num){
if(!confirm('Удалить серию?'))return;DB.anime[animeId].episodes=DB.anime[animeId].episodes.filter(e=>e.num!==num);await pushDB();showToast('🗑 Удалена');loadEpList();
}
function renderAdminActors(body){
body.innerHTML=`
<div class="admin-sec-title">Добавить / редактировать актёра</div>
<div class="afield"><label>ID *</label><input id="actId" placeholder="1" oninput="onActorIdChange(this.value)"></div>
<div class="photo-upload-area" id="actPhotoArea" onclick="uploadActorPhoto()">
<div class="photo-upload-icon">📷</div>
<div class="photo-upload-label">Нажми чтобы загрузить фото</div>
<div class="photo-upload-sub">JPG, PNG · до 5MB</div>
<img class="photo-preview" id="actPhotoPreview">
</div>
<div class="afield"><label>Имя *</label><input id="actName" placeholder="Иван Петров"></div>
<div class="afield"><label>Роль</label><select id="actRole"><option value="lead">Ведущий</option><option value="support">Второй план</option><option value="sound">Звукорежиссёр</option><option value="director">Режиссёр</option><option value="admin">Администратор</option></select></div>
<div class="afield"><label>Биография</label><textarea id="actBio"></textarea></div>
<div class="afield"><label>Telegram</label><input id="actTg" placeholder="@username"></div>
<div class="afield"><label>ВКонтакте</label><input id="actVk" placeholder="vkusername"></div>
<div class="afield"><label>Email</label><input id="actEmail" placeholder="mail@example.com"></div>
<button class="abtn primary" onclick="saveActor()">💾 Сохранить актёра</button>
<div class="admin-sec-title" style="margin-top:16px">Список актёров</div>
${Object.values(DB.actors||{}).map(a=>`<div class="admin-list-item" onclick="loadActorEdit('${a.id}')"><div><div class="ali-title">${a.name}</div><div class="ali-sub">ID: ${a.id} · ${a.role||'—'}</div></div><div class="ali-arr">›</div></div>`).join('')||'<div style="color:var(--muted);font-size:13px">Актёры не добавлены</div>'}`;
}
async function saveActor(){
const id=document.getElementById('actId')?.value.trim();const name=document.getElementById('actName')?.value.trim();
if(!id||!name){showToast('⚠️ Заполни ID и имя');return}
if(!DB.actors)DB.actors={};
DB.actors[id]={id,name,role:document.getElementById('actRole')?.value,bio:document.getElementById('actBio')?.value.trim(),telegram:document.getElementById('actTg')?.value.trim(),vk:document.getElementById('actVk')?.value.trim(),email:document.getElementById('actEmail')?.value.trim(),photo:DB.actors[id]?.photo||'',roles:DB.actors[id]?.roles||[]};
await pushDB();showToast('✅ Актёр сохранён!');renderAdminActors(document.getElementById('adminBody'));renderActors();
}
function renderAdminSchedule(body){
const opts=Object.values(DB.anime||{}).map(a=>`<option value="${a.id}">${a.title}</option>`).join('');
const schedule=DB.schedule||[];
body.innerHTML=`
<div class="admin-sec-title">Добавить в расписание</div>
<div class="afield"><label>Аниме *</label><select id="schAnime">${opts}</select></div>
<div class="afield"><label>Номер серии *</label><input id="schNum" type="number" placeholder="5"></div>
<div class="afield"><label>Название</label><input id="schTitle" placeholder="Название эпизода"></div>
<div class="afield"><label>Дата *</label><input id="schDate" type="date"></div>
<button class="abtn primary" onclick="saveSchedule()">💾 Добавить</button>
<div class="admin-sec-title" style="margin-top:16px">Расписание</div>
${schedule.map(s=>{const a=DB.anime[s.anime_id];return`<div class="admin-list-item"><div><div class="ali-title">${a?.title||s.anime_id} — Серия ${s.episode_num}</div><div class="ali-sub">${s.title} · ${s.date}</div></div><div style="color:var(--red);font-size:12px;font-weight:600;cursor:pointer" onclick="deleteSchedule('${s.anime_id}',${s.episode_num})">✕</div></div>`;}).join('')||'<div style="color:var(--muted);font-size:13px">Расписание пусто</div>'}`;
}
async function saveSchedule(){
const animeId=document.getElementById('schAnime')?.value;const epNum=parseInt(document.getElementById('schNum')?.value);const title=document.getElementById('schTitle')?.value.trim()||'Новая серия';const date=document.getElementById('schDate')?.value;
if(!animeId||!epNum||!date){showToast('⚠️ Заполни поля');return}
if(!DB.schedule)DB.schedule=[];DB.schedule=DB.schedule.filter(s=>!(s.anime_id===animeId&&s.episode_num===epNum));DB.schedule.push({date,anime_id:animeId,episode_num:epNum,title});DB.schedule.sort((a,b)=>a.date.localeCompare(b.date));
await pushDB();showToast('✅ Добавлено!');renderAdminSchedule(document.getElementById('adminBody'));renderCalendar();
}
async function deleteSchedule(animeId,epNum){
DB.schedule=(DB.schedule||[]).filter(s=>!(s.anime_id===animeId&&s.episode_num===epNum));await pushDB();showToast('🗑 Удалено');renderAdminSchedule(document.getElementById('adminBody'));
}
function renderAdminPush(body){
body.innerHTML=`
<div class="admin-sec-title">Рассылка всем подписчикам</div>
<div class="afield"><label>Текст *</label><textarea id="pushText" placeholder="Вышла новая серия..."></textarea></div>
<button class="abtn primary" onclick="sendPush()">📢 Разослать</button>
<div class="admin-sec-title" style="margin-top:16px">Уведомление о серии</div>
<div class="afield"><label>Аниме</label><select id="pushAnime">${Object.values(DB.anime||{}).map(a=>`<option value="${a.id}">${a.title}</option>`).join('')}</select></div>
<div class="afield"><label>Номер серии</label><input id="pushEpNum" type="number" placeholder="5"></div>
<button class="abtn secondary" onclick="sendEpPush()">🎌 Уведомить о серии</button>`;
}
function sendPush(){const text=document.getElementById('pushText')?.value.trim();if(!text){showToast('⚠️ Введи текст');return}if(tg)tg.sendData(JSON.stringify({action:'push',text}));showToast('📢 Отправлено боту!')}
function sendEpPush(){const animeId=document.getElementById('pushAnime')?.value;const epNum=parseInt(document.getElementById('pushEpNum')?.value);if(!animeId||!epNum){showToast('⚠️ Выбери аниме и серию');return}if(tg)tg.sendData(JSON.stringify({action:'push_ep',anime_id:animeId,ep_num:epNum}));showToast('🎌 Уведомление отправлено!')}
async function pushDB(){
try{
const r=await fetch(SERVER_URL+'/db?token='+SERVER_TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(DB)});
if(!r.ok)throw new Error('err');
}catch(e){showToast('❌ Ошибка сохранения');throw e;}
}
function showTab(tab){
['catalog','watchlist','history','actors','news','calendar','apply','about','editAbout','stats','applications','profile','hitparade','chat'].forEach(t=>{
const el=document.getElementById('view'+t.charAt(0).toUpperCase()+t.slice(1));
if(el)el.classList.toggle('hidden',t!==tab);
});
document.querySelectorAll('.bnav-btn').forEach(el=>{el.classList.toggle('active',(el.getAttribute('onclick')||'').includes("'"+tab+"'"))});
if(tab==='calendar')renderCalendar();
if(tab==='history')renderHistory();
if(tab==='watchlist')renderWatchlist();
if(tab==='stats')renderStats();
if(tab==='applications')renderApplications();
if(tab==='editAbout')loadAboutForm();
if(tab==='profile')renderProfile();
if(tab==='hitparade')renderHitparade();
if(tab==='chat'){
loadChat();startChatPolling();
document.getElementById('chatBadge')?.classList.remove('show');
} else {
stopChatPolling();
}
if(tab==='catalog'){document.getElementById('srchWrap').classList.remove('show');document.getElementById('filterBar').classList.remove('show');}
if(tab!=='catalog'){document.getElementById('filterBtn').style.display='none';}
else document.getElementById('filterBtn').style.display='';
}
function closeOv(id){document.getElementById(id).classList.remove('open')}
document.getElementById('detOv').addEventListener('click',e=>{if(e.target===document.getElementById('detOv'))closeOv('detOv')});
document.getElementById('actOv').addEventListener('click',e=>{if(e.target===document.getElementById('actOv'))closeOv('actOv')});
if(tg)tg.BackButton.onClick(()=>{
if(document.getElementById('adminPanel').classList.contains('open')){closeAdmin();return}
if(document.getElementById('playerOv').classList.contains('open')){closePlayer();return}
if(document.getElementById('actOv').classList.contains('open')){closeOv('actOv');return}
if(document.getElementById('detOv').classList.contains('open')){closeOv('detOv');tg.BackButton.hide();return}
tg.BackButton.hide();
});
let toastT;
function showToast(msg){clearTimeout(toastT);const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');toastT=setTimeout(()=>t.classList.remove('show'),2400)}
const BADGES = [
{id:'first_view', icon:'👁', name:'Первый взгляд', desc:'Посмотрел первую серию'},
{id:'fan10', icon:'🌟', name:'Фанат', desc:'Посмотрел 10 серий'},
{id:'legend50', icon:'🏆', name:'Легенда', desc:'Посмотрел 50 серий'},
{id:'master100', icon:'👑', name:'Мастер', desc:'Посмотрел 100 серий'},
{id:'first_cmt', icon:'💬', name:'Голос', desc:'Первый комментарий'},
{id:'active_cmt', icon:'🗣', name:'Активист', desc:'10 комментариев'},
{id:'early_bird', icon:'🌅', name:'Ранний зритель', desc:'Один из первых'},
{id:'bookmarker', icon:'🔖', name:'Коллекционер', desc:'5 закладок'},
{id:'rater', icon:'⭐', name:'Критик', desc:'Оценил 5 серий'},
];
const ACHIEVEMENTS = [
{id:'eps_1', icon:'🎬', name:'Первый эпизод', desc:'Посмотри 1 серию', req:1, type:'eps'},
{id:'eps_10', icon:'📺', name:'Марафон', desc:'Посмотри 10 серий', req:10, type:'eps'},
{id:'eps_50', icon:'🎭', name:'Заядлый зритель', desc:'Посмотри 50 серий', req:50, type:'eps'},
{id:'eps_100', icon:'👑', name:'Аниме-гуру', desc:'Посмотри 100 серий', req:100, type:'eps'},
{id:'cmt_1', icon:'💬', name:'Первое слово', desc:'Оставь 1 комментарий', req:1, type:'cmts'},
{id:'cmt_10', icon:'🗣', name:'Активный', desc:'Оставь 10 комментариев', req:10, type:'cmts'},
{id:'cmt_50', icon:'📢', name:'Голос сообщества', desc:'Оставь 50 комментариев', req:50, type:'cmts'},
{id:'bm_5', icon:'🔖', name:'Коллекционер', desc:'Добавь 5 аниме в закладки', req:5, type:'bm'},
{id:'rate_5', icon:'⭐', name:'Критик', desc:'Оцени 5 серий', req:5, type:'ratings'},
];
function getUnlockedBadges(stats){
const unlocked = new Set(JSON.parse(localStorage.getItem('badges')||'[]'));
if(stats.eps >= 1) unlocked.add('first_view');
if(stats.eps >= 10) unlocked.add('fan10');
if(stats.eps >= 50) unlocked.add('legend50');
if(stats.eps >= 100) unlocked.add('master100');
if(stats.cmts >= 1) unlocked.add('first_cmt');
if(stats.cmts >= 10) unlocked.add('active_cmt');
if(getBM().length >= 5) unlocked.add('bookmarker');
if(Object.keys(getRat()).length >= 5) unlocked.add('rater');
try{localStorage.setItem('badges',JSON.stringify([...unlocked]))}catch{}
return unlocked;
}
function getUserLevel(eps){
if(eps >= 100) return {name:'Легенда 👑', color:'#ffd60a'};
if(eps >= 50) return {name:'Мастер 🏆', color:'#bf5af2'};
if(eps >= 20) return {name:'Фанат 🌟', color:'#30d158'};
if(eps >= 5) return {name:'Зритель 👁', color:'#0a84ff'};
return {name:'Новичок 🌱', color:'#aeaeb2'};
}
function getFavoriteGenre(history){
const genres = {};
history.forEach(h=>{
const a = DB.anime[h.a]; if(!a) return;
genres[a.genre] = (genres[a.genre]||0)+1;
});
const sorted = Object.entries(genres).sort((a,b)=>b[1]-a[1]);
return sorted[0]?.[0] || null;
}
async function renderProfile(){
const views = getViews();
const eps = Object.values(views).reduce((s,v)=>s+v,0);
const hist = getHistory();
const bm = getBM();
const rat = getRat();
const ratCount = Object.values(rat).reduce((s,v)=>s+Object.keys(v).length,0);
let serverStats = {comments:0, likes:0};
try{
const r = await fetch(SERVER_URL+'/leaderboard?limit=100');
const d = await r.json();
const me = (d.leaderboard||[]).find(u=>u.user_id===MY_USER_ID);
if(me){serverStats.comments=me.comments||0; serverStats.points=me.points||0;}
}catch{}
const stats = {eps, cmts:serverStats.comments, likes:serverStats.likes||0};
const unlocked = getUnlockedBadgesAnimated({...stats, ratings:ratCount, bm:bm.length});
const level = getUserLevel(eps);
const favGenre = getFavoriteGenre(hist);
const user = tg?.initDataUnsafe?.user;
document.getElementById('profileName').textContent = user?.first_name || MY_NAME || 'Зритель';
document.getElementById('profileUsername').textContent = user?.username ? '@'+user.username : '';
const avEl = document.getElementById('profileAv');
if(user?.photo_url){avEl.innerHTML=`<img src="${user.photo_url}"><div class="profile-level" id="profileLevel" style="color:#000;background:${level.color}">${level.name}</div>`;}
else{avEl.innerHTML=`${(user?.first_name||'?')[0]}<div class="profile-level" style="color:#000;background:${level.color}">${level.name}</div>`;}
const sinceKey = 'joinDate';
let since = localStorage.getItem(sinceKey);
if(!since){since=new Date().toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'});try{localStorage.setItem(sinceKey,since)}catch{}}
document.getElementById('profileSince').textContent = 'С нами с '+since;
document.getElementById('profileGenre').textContent = favGenre ? '🎌 Любимый жанр: '+favGenre : '🎌 Смотри больше для определения жанра';
document.getElementById('pStatEps').textContent = eps;
document.getElementById('pStatCmts').textContent = serverStats.comments;
document.getElementById('pStatLikes').textContent = serverStats.points||0;
document.getElementById('badgesGrid').innerHTML = BADGES.map(b=>`
<div class="badge-item ${unlocked.has(b.id)?'unlocked':'locked'}">
<div class="badge-icon">${b.icon}</div>
<div class="badge-name">${b.name}</div>
<div class="badge-desc">${b.desc}</div>
</div>`).join('');
const achievData = {eps, cmts:serverStats.comments, bm:bm.length, ratings:ratCount};
document.getElementById('achievList').innerHTML = ACHIEVEMENTS.map(a=>{
const cur = achievData[a.type]||0;
const done = cur >= a.req;
const pct = Math.min(Math.round(cur/a.req*100),100);
return `<div class="achiev-item ${done?'unlocked':'locked'}">
<div class="achiev-icon">${a.icon}</div>
<div class="achiev-info">
<div class="achiev-name">${a.name}</div>
<div class="achiev-desc">${a.desc}</div>
${!done?`<div class="achiev-progress">
<div class="achiev-bar"><div class="achiev-fill" style="width:${pct}%"></div></div>
<div class="achiev-pct">${cur} / ${a.req}</div>
</div>`:''}
</div>
<div class="achiev-check">${done?'✅':''}</div>
</div>`;
}).join('');
const prev = new Set(JSON.parse(localStorage.getItem('prevBadges')||'[]'));
unlocked.forEach(b=>{
if(!prev.has(b)){
const badge = BADGES.find(x=>x.id===b);
if(badge) setTimeout(()=>showToast(`🏅 Новый бейдж: ${badge.name}!`),500);
}
});
try{localStorage.setItem('prevBadges',JSON.stringify([...unlocked]))}catch{}
}
async function renderAdminUsers(body){
body.innerHTML=`<div class="admin-sec-title">Загрузка пользователей...</div>`;
try{
const subs = DB.subscribers || [];
const banned = DB.banned_users || [];
const total = subs.length;
body.innerHTML=`
<div class="admin-sec-title">Всего подписчиков: <span style="color:var(--gold)">${total}</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
<div class="pstat"><div class="pstat-v" style="font-size:16px">${total}</div><div class="pstat-l">Подписчиков</div></div>
<div class="pstat"><div class="pstat-v" style="font-size:16px;color:var(--red)">${banned.length}</div><div class="pstat-l">Забанено</div></div>
</div>
<div class="admin-sec-title">Таблица лидеров — управление</div>
<div id="adminUsersList"></div>
<div class="admin-sec-title" style="margin-top:16px">Забанить по ID</div>
<div class="afield"><label>User ID</label><input id="banUserId" type="number" placeholder="123456789"></div>
<button class="abtn danger" onclick="adminBanUser()">🚫 Забанить пользователя</button>
<button class="abtn secondary" onclick="adminUnbanUser()">✅ Разбанить пользователя</button>`;
const r = await fetch(SERVER_URL+'/leaderboard?limit=50');
const d = await r.json();
const lb = d.leaderboard||[];
document.getElementById('adminUsersList').innerHTML = lb.map(u=>{
const isBanned = banned.includes(u.user_id);
return `<div class="user-item">
<div class="user-av">${u.first_name?u.first_name[0]:'?'}</div>
<div class="user-info">
<div class="user-name">${u.first_name||'—'}${u.username?' @'+u.username:''}</div>
<div class="user-meta">ID: ${u.user_id} · ${u.comments||0} комм. · ${u.points||0} очков</div>
</div>
<button class="user-ban-btn ${isBanned?'unban':'ban'}" onclick="toggleBanUser(${u.user_id},'${u.first_name||''}',this)">${isBanned?'Разбанить':'Бан'}</button>
</div>`;
}).join('')||'<div style="color:var(--muted);font-size:13px">Нет данных</div>';
}catch(e){body.innerHTML=`<div style="color:var(--muted2);font-size:13px">Ошибка загрузки: ${e.message}</div>`;}
}
async function toggleBanUser(userId,name,btn){
const isBanned = btn.textContent.trim()==='Бан'?false:true;
try{
if(!isBanned){
await fetch(`${SERVER_URL}/ban?user_id=${userId}&token=${SERVER_TOKEN}`,{method:'POST'});
btn.textContent='Разбанить';btn.className='user-ban-btn unban';
showToast(`🚫 ${name} забанен`);
if(tg)tg.sendData(JSON.stringify({action:'ban_user',user_id:userId}));
}else{
await fetch(`${SERVER_URL}/ban?user_id=${userId}&token=${SERVER_TOKEN}`,{method:'DELETE'});
btn.textContent='Бан';btn.className='user-ban-btn ban';
showToast(`✅ ${name} разбанен`);
if(tg)tg.sendData(JSON.stringify({action:'unban_user',user_id:userId}));
}
}catch{showToast('❌ Ошибка')}
}
async function adminBanUser(){
const uid = parseInt(document.getElementById('banUserId')?.value);
if(!uid){showToast('⚠️ Введи User ID');return}
try{
await fetch(`${SERVER_URL}/ban?user_id=${uid}&token=${SERVER_TOKEN}`,{method:'POST'});
if(tg)tg.sendData(JSON.stringify({action:'ban_user',user_id:uid}));
showToast('🚫 Пользователь забанен');
}catch{showToast('❌ Ошибка')}
}
async function adminUnbanUser(){
const uid = parseInt(document.getElementById('banUserId')?.value);
if(!uid){showToast('⚠️ Введи User ID');return}
try{
await fetch(`${SERVER_URL}/ban?user_id=${uid}&token=${SERVER_TOKEN}`,{method:'DELETE'});
if(tg)tg.sendData(JSON.stringify({action:'unban_user',user_id:uid}));
showToast('✅ Пользователь разбанен');
}catch{showToast('❌ Ошибка')}
}
function checkSmartNotifications(){
const hist = getHistory();
if(!hist.length) return;
const unfinished = hist.filter(h=>h.p<90);
if(unfinished.length > 0){
const h = unfinished[0];
const a = DB.anime[h.a]; const ep = a?.episodes?.[h.i];
if(a && ep){
const lastNotif = localStorage.getItem('lastContinueNotif');
const now = Date.now();
if(!lastNotif || now - parseInt(lastNotif) > 24*60*60*1000){
if(tg) tg.sendData(JSON.stringify({
action:'smart_notif',
type:'continue',
text:`Не забудь досмотреть «${a.title}» — Серия ${ep.num}: ${ep.title}`,
anime_id:h.a
}));
try{localStorage.setItem('lastContinueNotif',now.toString())}catch{}
}
}
}
const watchedAnime = [...new Set(hist.map(h=>h.a))];
const today = new Date().toISOString().split('T')[0];
const upcoming = (DB.schedule||[]).filter(s=>s.date===today && watchedAnime.includes(s.anime_id));
upcoming.forEach(s=>{
const notifKey = 'notif_'+s.anime_id+'_'+s.episode_num;
if(!localStorage.getItem(notifKey)){
const a = DB.anime[s.anime_id];
if(a) showToast(`🔔 Вышла серия ${s.episode_num} аниме «${a.title}»!`);
try{localStorage.setItem(notifKey,'1')}catch{}
}
});
}
let curActorId = null;
function setupActorComments(actorId){
curActorId = actorId;
loadActorComments(actorId);
const sendBtn = document.getElementById('actorCmtSend');
if(sendBtn) sendBtn.onclick = () => sendActorComment(actorId);
}
async function loadActorComments(actorId){
const el = document.getElementById('actorCmtList');
if(!el) return;
el.innerHTML = '<div style="color:var(--muted);font-size:13px">Загрузка...</div>';
try{
const r = await fetch(SERVER_URL+'/comments/actor_'+actorId+'/0');
const d = await r.json();
const isAdm = (DB.admin_ids||[]).includes(MY_USER_ID);
if(!d.comments?.length){el.innerHTML='<div style="color:var(--muted2);font-size:13px;padding:4px 0">Будь первым кто оставит комментарий!</div>';return}
el.innerHTML = d.comments.map(c=>{
const ts = new Date(c.ts*1000).toLocaleDateString('ru',{day:'numeric',month:'short'});
const liked = c.likes.includes(MY_USER_ID);
return `<div class="cmt" id="acmt_${c.id}">
<div class="cmt-main">
<div class="c-av">${c.first_name?c.first_name[0]:'?'}</div>
<div class="c-body">
<div class="c-name">${c.first_name}${c.username?' · @'+c.username:''}</div>
<div class="c-text">${c.text}</div>
<div class="c-meta">
<div class="c-time">${ts}</div>
<div class="c-like ${liked?'liked':''}" onclick="likeActorComment('${c.id}','${actorId}',this)">
<svg fill="${liked?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
${c.likes.length}
</div>
${isAdm?`<div class="c-del" onclick="deleteActorComment('${c.id}','${actorId}')">Удалить</div>`:''}
</div>
</div>
</div>
</div>`;
}).join('');
}catch{el.innerHTML='<div style="color:var(--muted2);font-size:13px">Ошибка загрузки</div>';}
}
async function sendActorComment(actorId){
const inp = document.getElementById('actorCmtInp');
const text = inp?.value.trim(); if(!text) return;
inp.value = '';
try{
await fetch(SERVER_URL+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({anime_id:'actor_'+actorId,ep_num:0,text,user_id:MY_USER_ID,username:MY_USERNAME,first_name:MY_NAME})});
loadActorComments(actorId);
showToast('💬 Комментарий добавлен!');
}catch{showToast('❌ Ошибка')}
}
async function likeActorComment(id,actorId,el){
try{
const r=await fetch(SERVER_URL+'/like?comment_id='+id+'&user_id='+MY_USER_ID+'&anime_id=actor_'+actorId+'&ep_num=0',{method:'POST'});
const d=await r.json();
el.classList.toggle('liked',d.liked);el.querySelector('svg').setAttribute('fill',d.liked?'currentColor':'none');
el.lastChild.textContent=' '+d.likes;
}catch{}
}
async function deleteActorComment(id,actorId){
if(!confirm('Удалить?'))return;
try{await fetch(SERVER_URL+'/comment?comment_id='+id+'&anime_id=actor_'+actorId+'&ep_num=0&token='+SERVER_TOKEN,{method:'DELETE'});document.getElementById('acmt_'+id)?.remove();showToast('🗑 Удалено')}catch{}
}
function openPosterUpload(animeId){
const inp = document.createElement('input');
inp.type = 'file'; inp.accept = 'image/*';
inp.onchange = async(e) => {
const file = e.target.files[0]; if(!file) return;
if(file.size > 5*1024*1024){showToast('❌ Файл слишком большой (макс 5MB)');return}
showToast('⏳ Загружаю постер...');
try{
const fd = new FormData();
fd.append('file', file);
fd.append('token', SERVER_TOKEN);
fd.append('anime_id', animeId);
const r = await fetch(SERVER_URL+'/upload_cover', {method:'POST', body:fd});
const d = await r.json();
if(d.ok){
showToast('✅ Постер загружен!');
if(DB.anime[animeId]) DB.anime[animeId].cover_file_id = animeId+'.jpg';
renderAll();
}else showToast('❌ Ошибка загрузки');
}catch(e){showToast('❌ Ошибка: '+e.message)}
};
inp.click();
}
document.addEventListener('input', e=>{
if(e.target.id==='aId'){
const btn=document.getElementById('posterUploadBtn');
if(btn) btn.style.display=e.target.value.trim()?'':'none';
}
});
function doPosterUpload(){
const animeId=document.getElementById('aId')?.value.trim();
if(!animeId){showToast('⚠️ Сначала введи ID аниме');return}
openPosterUpload(animeId);
}
const TAB_ORDER = ['catalog','watchlist','history','actors','news','calendar','apply','about','editAbout','stats','applications','profile','hitparade','chat'];
let lastTabIndex = 0;
function showTabAnimated(tab){
const newIdx = TAB_ORDER.indexOf(tab);
const oldIdx = lastTabIndex;
const goRight = newIdx >= oldIdx;
const views = document.querySelectorAll('.view:not(.hidden)');
views.forEach(v=>{
v.classList.add(goRight?'slide-out-left':'slide-out-right');
setTimeout(()=>v.classList.remove('slide-out-left','slide-out-right'),300);
});
setTimeout(()=>{
showTab(tab);
const newView = document.getElementById('view'+tab.charAt(0).toUpperCase()+tab.slice(1));
if(newView){
newView.classList.add(goRight?'slide-in-right':'slide-in-left');
setTimeout(()=>newView.classList.remove('slide-in-right','slide-in-left'),400);
}
}, 80);
lastTabIndex = newIdx;
}
function launchConfetti(duration=2500){
const canvas = document.getElementById('confettiCanvas');
if(!canvas) return;
canvas.style.display = 'block';
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d');
const pieces = [];
const colors = ['#ffd60a','#30d158','#0a84ff','#bf5af2','#ff453a','#ff9f0a','#fff'];
const shapes = ['circle','rect','triangle'];
for(let i=0;i<120;i++){
pieces.push({
x: Math.random()*canvas.width,
y: -20 - Math.random()*canvas.height*0.5,
vx: (Math.random()-0.5)*6,
vy: 2+Math.random()*5,
rot: Math.random()*360,
vrot: (Math.random()-0.5)*10,
color: colors[Math.floor(Math.random()*colors.length)],
shape: shapes[Math.floor(Math.random()*shapes.length)],
size: 5+Math.random()*8,
alpha: 1
});
}
const start = Date.now();
function draw(){
ctx.clearRect(0,0,canvas.width,canvas.height);
const elapsed = Date.now()-start;
const progress = elapsed/duration;
pieces.forEach(p=>{
p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.rot+=p.vrot;
p.alpha = Math.max(0, 1-(progress*1.5));
ctx.globalAlpha = p.alpha;
ctx.fillStyle = p.color;
ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
if(p.shape==='circle'){ctx.beginPath();ctx.arc(0,0,p.size/2,0,Math.PI*2);ctx.fill();}
else if(p.shape==='rect'){ctx.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);}
else{ctx.beginPath();ctx.moveTo(0,-p.size/2);ctx.lineTo(p.size/2,p.size/2);ctx.lineTo(-p.size/2,p.size/2);ctx.closePath();ctx.fill();}
ctx.restore();
});
ctx.globalAlpha=1;
if(elapsed<duration) requestAnimationFrame(draw);
else{ctx.clearRect(0,0,canvas.width,canvas.height);canvas.style.display='none';}
}
requestAnimationFrame(draw);
}
function addRipple(el, e){
const rect = el.getBoundingClientRect();
const size = Math.max(rect.width, rect.height)*2;
const x = (e.clientX-rect.left) - size/2;
const y = (e.clientY-rect.top) - size/2;
const ripple = document.createElement('span');
ripple.className = 'ripple';
ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
el.style.position='relative';el.style.overflow='hidden';
el.appendChild(ripple);
setTimeout(()=>ripple.remove(), 600);
}
document.addEventListener('click',e=>{
const btn = e.target.closest('.watch-btn,.abtn,.submit-btn,.cal-btn,.bnav-btn');
if(btn) addRipple(btn, e);
});
const origOpenAnime = openAnime;
function openAnime(id){
origOpenAnime(id);
const sheet = document.querySelector('#detOv .sheet');
if(sheet){
sheet.style.animation='none';
sheet.offsetHeight;
sheet.style.animation='sheetUp .35s cubic-bezier(.2,1.05,.4,1) both';
}
}
function animateNumber(el, target, duration=800){
if(!el) return;
const start = parseInt(el.textContent)||0;
const startTime = Date.now();
function update(){
const elapsed = Date.now()-startTime;
const progress = Math.min(elapsed/duration,1);
const eased = 1-Math.pow(1-progress,3);
el.textContent = Math.round(start+(target-start)*eased);
if(progress<1) requestAnimationFrame(update);
else el.textContent = target;
}
requestAnimationFrame(update);
}
const origGetUnlocked = getUnlockedBadges;
let prevUnlockedSet = new Set(JSON.parse(localStorage.getItem('prevBadges')||'[]'));
function getUnlockedBadgesAnimated(stats){
const unlocked = origGetUnlocked(stats);
const newOnes = [...unlocked].filter(b=>!prevUnlockedSet.has(b));
if(newOnes.length > 0){
launchConfetti(3000);
newOnes.forEach((b,i)=>{
const badge = BADGES.find(x=>x.id===b);
if(badge) setTimeout(()=>showToast(`🏅 Бейдж разблокирован: ${badge.name}!`), i*1000);
});
}
prevUnlockedSet = unlocked;
try{localStorage.setItem('prevBadges',JSON.stringify([...unlocked]))}catch{}
return unlocked;
}
function onActorIdChange(val){
const area = document.getElementById('actPhotoArea');
if(area) area.dataset.actorId = val;
if(val && DB.actors?.[val]?.photo){
const prev = document.getElementById('actPhotoPreview');
if(prev){prev.src=DB.actors[val].photo;prev.classList.add('show');}
document.getElementById('actPhotoArea')?.classList.add('has-photo');
}
}
function uploadActorPhoto(){
const area = document.getElementById('actPhotoArea');
const actorId = document.getElementById('actId')?.value.trim() || area?.dataset.actorId;
if(!actorId){showToast('⚠️ Сначала введи ID актёра');return}
const inp = document.createElement('input');
inp.type='file';inp.accept='image/*';
inp.onchange = async(e)=>{
const file = e.target.files[0]; if(!file) return;
if(file.size > 5*1024*1024){showToast('❌ Файл слишком большой');return}
showToast('⏳ Загружаю фото...');
try{
const fd = new FormData();
fd.append('file', file);
fd.append('token', SERVER_TOKEN);
fd.append('actor_id', actorId);
const r = await fetch(SERVER_URL+'/upload_actor_photo', {method:'POST', body:fd});
const d = await r.json();
if(d.ok){
showToast('✅ Фото загружено!');
const prev = document.getElementById('actPhotoPreview');
if(prev){prev.src=d.url;prev.classList.add('show');}
document.getElementById('actPhotoArea')?.classList.add('has-photo');
if(!DB.actors) DB.actors={};
if(!DB.actors[actorId]) DB.actors[actorId]={};
DB.actors[actorId].photo = d.url;
await pushDB();
}else showToast('❌ Ошибка загрузки');
}catch(e){showToast('❌ Ошибка: '+e.message)}
};
inp.click();
}
function loadActorEdit(id){
const a = DB.actors[id]; if(!a) return;
document.getElementById('actId').value = a.id;
document.getElementById('actName').value = a.name;
document.getElementById('actRole').value = a.role||'support';
document.getElementById('actBio').value = a.bio||'';
document.getElementById('actTg').value = a.telegram||'';
document.getElementById('actVk').value = a.vk||'';
document.getElementById('actEmail').value = a.email||'';
const prev = document.getElementById('actPhotoPreview');
const area = document.getElementById('actPhotoArea');
if(prev && a.photo){prev.src=a.photo;prev.classList.add('show');area?.classList.add('has-photo');}
else if(prev){prev.classList.remove('show');area?.classList.remove('has-photo');}
if(area) area.dataset.actorId = id;
document.getElementById('adminBody').scrollTop=0;
showToast('📝 '+a.name);
}
let castRows = [];
function initCastEditor(animeId, epNum){
castRows = [];
const a = DB.anime?.[animeId];
if(a && epNum){
const ep = a.episodes?.find(e=>e.num===parseInt(epNum));
if(ep?.cast) castRows = ep.cast.map(c=>({actor_id:c.actor_id, character:c.character}));
}
renderCastRows();
}
function renderCastRows(){
const el = document.getElementById('castEditorRows'); if(!el) return;
const actors = Object.values(DB.actors||{});
el.innerHTML = castRows.map((row,i)=>{
const actorMatch = DB.actors?.[row.actor_id];
const hint = row.actor_name && !actorMatch ? `<div style="font-size:10px;color:var(--red);margin-top:2px">⚠️ ${row.actor_name} не найден в базе</div>` : '';
return `<div class="cast-row" style="flex-direction:column;align-items:stretch;gap:4px">
<div style="display:flex;gap:8px">
<select style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:Inter,sans-serif;font-size:12px;outline:none;-webkit-appearance:none" onchange="castRows[${i}].actor_id=this.value">
<option value="">— Выбери актёра —</option>
${actors.map(a=>`<option value="${a.id}" ${row.actor_id===a.id?'selected':''}>${a.name}</option>`).join('')}
</select>
<input style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:Inter,sans-serif;font-size:12px;outline:none" placeholder="Персонаж" value="${row.character||''}" oninput="castRows[${i}].character=this.value">
<button class="cast-row-del" onclick="castRows.splice(${i},1);renderCastRows()">×</button>
</div>
${hint}
</div>`;
}).join('');
}
function addCastRow(){
castRows.push({actor_id:'',character:''});
renderCastRows();
}
async function parseCastFromTg(){
const url = prompt('Вставь ссылку на пост в канале:
https://t.me/имя_канала/123');
if(!url) return;
showToast('⏳ Читаю пост...');
try{
const r = await fetch(SERVER_URL+'/parse_tg_post?url='+encodeURIComponent(url)+'&token='+SERVER_TOKEN);
const d = await r.json();
if(d.cast && d.cast.length){
castRows = d.cast;
renderCastRows();
showToast('✅ Состав загружен из поста!');
} else {
showToast('⚠️ Состав не найден в посте');
}
}catch{showToast('❌ Ошибка загрузки поста')}
}
const origSaveEpisode = saveEpisode;
async function saveEpisode(){
const animeId = document.getElementById('epAnime')?.value;
const num = parseInt(document.getElementById('epNum')?.value);
const title = document.getElementById('epTitle')?.value.trim();
if(!animeId||!num||!title){showToast('⚠️ Заполни обязательные поля');return}
const validCast = castRows.filter(r=>r.actor_id&&r.character);
const ep={
num, title,
duration: document.getElementById('epDur')?.value.trim()||'—',
video_url: document.getElementById('epUrl')?.value.trim(),
video_url_vk: document.getElementById('epVkUrl')?.value.trim(),
cast: validCast
};
const eps = DB.anime[animeId].episodes.filter(e=>e.num!==num);
eps.push(ep); eps.sort((a,b)=>a.num-b.num);
DB.anime[animeId].episodes = eps;
await pushDB();
showToast('✅ Серия сохранена!');
loadEpList();
}
function loadEpForEdit(animeId, epNum){
document.getElementById('epNum').value = epNum;
const a = DB.anime?.[animeId];
const ep = a?.episodes?.find(e=>e.num===epNum);
if(ep){
document.getElementById('epTitle').value = ep.title||'';
document.getElementById('epDur').value = ep.duration||'';
document.getElementById('epUrl').value = ep.video_url||'';
document.getElementById('epVkUrl').value = ep.video_url_vk||'';
initCastEditor(animeId, epNum);
}
}
function openTgProfile(username){
if(!username) return;
const clean = username.replace('@','');
if(tg) tg.openLink('https://t.me/'+clean);
else window.open('https://t.me/'+clean,'_blank');
}
function openTgById(userId){
if(!userId) return;
if(tg) tg.openLink('tg://user?id='+userId);
else showToast('Используй Telegram чтобы открыть профиль');
}
const origLoadLeaderboard = loadLeaderboard;
async function loadLeaderboard(){
try{
const r = await fetch(SERVER_URL+'/leaderboard?limit=10');
const d = await r.json();
const lb = d.leaderboard||[];
const medals = ['🥇','🥈','🥉'];
document.getElementById('leaderboardList').innerHTML = lb.map((u,i)=>`
<div class="lb-item" style="animation-delay:${i*.05}s">
<div class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</div>
<div class="lb-info">
<div class="lb-name">${u.first_name||'—'}${u.username?` <span style="color:var(--muted2)">@${u.username}</span>`:''}</div>
<div class="lb-pts">${u.comments||0} комментариев · ${u.points||0} очков</div>
</div>
<div style="display:flex;gap:6px;align-items:center">
${i<3?`<div class="lb-badge">${['Топ 1','Топ 2','Топ 3'][i]}</div>`:''}
${u.username?`<a class="lb-tg-btn" onclick="openTgProfile('${u.username}')">✈️ Написать</a>`:''}
</div>
</div>`).join('')||'<div class="empty"><div class="empty-icon">🏆</div><p>Пока никто не комментировал</p></div>';
}catch{}
}
function renderCommentWithTg(c, animeId, epNum, isAdm){
const ts = new Date(c.ts*1000).toLocaleDateString('ru',{day:'numeric',month:'short'});
const liked = c.likes.includes(MY_USER_ID);
const text = c.text.replace(/@(\w+)/g,'<span class="c-mention">@$1</span>');
const repliesHtml = (c.replies||[]).map(rep=>renderCommentWithTg(rep,animeId,epNum,isAdm)).join('');
return `<div class="cmt" id="cmt_${c.id}">
<div class="cmt-main">
<div class="c-av" style="cursor:pointer" onclick="${c.username?`openTgProfile('${c.username}')`:`openTgById(${c.user_id})`}">${c.first_name?c.first_name[0]:'?'}</div>
<div class="c-body">
<div class="c-name" style="display:flex;align-items:center;gap:6px">
${c.first_name}
${c.username?`<a class="c-tg-link" onclick="openTgProfile('${c.username}')"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.482c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.144 14.33l-2.972-.924c-.645-.204-.657-.645.136-.953l11.57-4.463c.537-.194 1.006.131.684.258z"/></svg>Написать</a>`:''}
</div>
<div class="c-text">${text}</div>
<div class="c-meta">
<div class="c-time">${ts}</div>
<div class="c-like ${liked?'liked':''}" onclick="likeComment('${c.id}','${animeId}',${epNum},this)">
<svg fill="${liked?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
${c.likes.length}
</div>
<div class="c-reply-btn" onclick="showReplyInput('${c.id}','${animeId}',${epNum},'${c.first_name}')">Ответить</div>
<div class="react-pick" onclick="showReactPicker('${c.id}','${animeId}',${epNum})">😊</div>
${isAdm?`<div class="c-del" onclick="deleteCmt('${c.id}','${animeId}',${epNum})">Удалить</div>`:''}
</div>
<div id="reactPicker_${c.id}" style="display:none">
<div class="react-picker">${REACTIONS.map(r=>`<span class="react-pick" onclick="addReaction('${c.id}','${animeId}',${epNum},'${r}',this);document.getElementById('reactPicker_${c.id}').style.display='none'">${r}</span>`).join('')}</div>
</div>
<div id="replyInput_${c.id}" style="display:none">
<div class="reply-input-row">
<input class="reply-inp" id="replyInp_${c.id}" placeholder="Ответить...">
<button class="reply-send" onclick="sendReply('${c.id}','${animeId}',${epNum})">
<svg fill="currentColor" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
</button>
</div>
</div>
</div>
</div>
${repliesHtml?`<div class="c-replies">${repliesHtml}</div>`:''}
</div>`;
}
const origLoadComments = loadComments;
async function loadComments(animeId, epNum, offset=0){
const el = document.getElementById('cmtList_'+animeId+'_'+epNum); if(!el) return;
if(offset===0) el.innerHTML='<div class="cmt-loading">Загрузка...</div>';
try{
const r = await fetch(SERVER_URL+'/comments/'+animeId+'/'+epNum+'?offset='+offset+'&limit=20');
const d = await r.json();
const isAdm = (DB.admin_ids||[]).includes(MY_USER_ID);
const html = d.comments.map(c=>renderCommentWithTg(c,animeId,epNum,isAdm)).join('');
if(offset===0) el.innerHTML = html||'<div style="color:var(--muted2);font-size:13px;padding:8px 0">Будь первым кто оставит комментарий!</div>';
else el.innerHTML = el.innerHTML.replace('<div class="cmt-load-more"', html+'<div class="cmt-load-more"');
if(d.has_more) el.innerHTML+=`<div class="cmt-load-more" onclick="loadComments('${animeId}',${epNum},${offset+20})">Загрузить ещё</div>`;
const cnt = document.getElementById('cmtCnt_'+animeId+'_'+epNum);
if(cnt) cnt.textContent = d.total>0?d.total:'';
}catch{el.innerHTML='<div style="color:var(--muted2);font-size:13px">Ошибка загрузки</div>';}
}
const origLoadEpList = loadEpList;
function loadEpList(){
origLoadEpList();
const animeId = document.getElementById('epAnime')?.value;
if(!animeId) return;
const rows = document.querySelectorAll('#epListAdmin .admin-list-item');
rows.forEach(row=>{
row.onclick = ()=>{
const num = parseInt(row.querySelector('.ali-title')?.textContent);
if(num) loadEpForEdit(animeId, num);
};
});
initCastEditor(animeId, null);
}
async function syncNewsFromChannel(){
showToast('⏳ Синхронизирую новости...');
if(tg) tg.sendData(JSON.stringify({action:'sync_news'}));
setTimeout(async()=>{
await loadDB();
renderNews();
showToast('✅ Новости обновлены!');
}, 3000);
}
let ptrStartY = 0, ptrDist = 0, ptrActive = false;
const PTR_THRESHOLD = 80;
document.addEventListener('touchstart', e=>{
const view = document.querySelector('.view:not(.hidden)');
if(!view || view.scrollTop > 0) return;
ptrStartY = e.touches[0].clientY;
ptrActive = true;
}, {passive:true});
document.addEventListener('touchmove', e=>{
if(!ptrActive) return;
const view = document.querySelector('.view:not(.hidden)');
if(!view || view.scrollTop > 0){ptrActive=false;return}
ptrDist = Math.max(0, e.touches[0].clientY - ptrStartY);
if(ptrDist > 10){
const ind = document.getElementById('ptrIndicator');
const txt = document.getElementById('ptrText');
if(ind){
ind.classList.add('show');
if(ptrDist > PTR_THRESHOLD){
txt.textContent = '↑ Отпусти для обновления';
ind.style.background='rgba(48,209,88,.15)';
ind.style.borderColor='rgba(48,209,88,.3)';
ind.style.color='var(--teal)';
} else {
txt.textContent = '↓ Потяни чтобы обновить';
ind.style.background='';ind.style.borderColor='';ind.style.color='';
}
}
}
}, {passive:true});
document.addEventListener('touchend', async e=>{
if(!ptrActive) return;
ptrActive = false;
const ind = document.getElementById('ptrIndicator');
const txt = document.getElementById('ptrText');
if(ptrDist > PTR_THRESHOLD){
if(txt) txt.innerHTML='<span class="ptr-spin">🔄</span> Обновляем...';
try{
const r = await fetch(SERVER_URL+'/db?t='+Date.now());
const newDB = await r.json();
DB = newDB; renderAll();
showToast('✅ Данные обновлены!');
}catch{showToast('❌ Ошибка обновления')}
}
setTimeout(()=>{
if(ind) ind.classList.remove('show');
ptrDist=0;
if(txt) txt.textContent='Потяни чтобы обновить';
if(ind){ind.style.background='';ind.style.borderColor='';ind.style.color='';}
}, 400);
});
let watchingTimer = null;
function startWatching(animeId, epNum){
stopWatching();
fetch(SERVER_URL+'/watching', {
method:'POST', headers:{'Content-Type':'application/json'},
body: JSON.stringify({user_id:MY_USER_ID, username:MY_USERNAME, first_name:MY_NAME, anime_id:animeId, ep_num:epNum})
}).catch(()=>{});
watchingTimer = setInterval(()=>{
fetch(SERVER_URL+'/watching', {
method:'POST', headers:{'Content-Type':'application/json'},
body: JSON.stringify({user_id:MY_USER_ID, username:MY_USERNAME, first_name:MY_NAME, anime_id:animeId, ep_num:epNum})
}).catch(()=>{});
}, 120000);
loadWatchingNow(animeId, epNum);
}
function stopWatching(){
if(watchingTimer){clearInterval(watchingTimer);watchingTimer=null;}
if(MY_USER_ID) fetch(SERVER_URL+'/watching/'+MY_USER_ID, {method:'DELETE'}).catch(()=>{});
}
async function loadWatchingNow(animeId, epNum){
try{
const r = await fetch(SERVER_URL+'/watching/'+animeId+'/'+epNum);
const d = await r.json();
const el = document.getElementById('watchingBar_'+animeId+'_'+epNum);
if(!el) return;
if(d.count > 0){
const others = d.watchers.filter(w=>w.user_id!==MY_USER_ID);
const avs = others.slice(0,4).map(w=>`<div class="watching-av">${w.first_name?w.first_name[0]:'?'}</div>`).join('');
const txt = d.count===1 ? 'Только ты смотришь' : `${d.count} смотрят сейчас`;
el.innerHTML=`<div class="watching-dot"></div><div class="watching-avs">${avs}</div><div class="watching-txt">${txt}</div>`;
el.style.display='flex';
} else el.style.display='none';
}catch{}
}
const origOpenPlayer = openPlayer;
function openPlayer(idx){
origOpenPlayer(idx);
const a = curAnime; const ep = a?.episodes?.[idx];
if(a && ep) startWatching(a.id, ep.num);
}
const origClosePlayer = closePlayer;
function closePlayer(){
origClosePlayer();
stopWatching();
}
let hitPeriod = 'week';
function setHitPeriod(period, el){
hitPeriod = period;
document.querySelectorAll('.stats-period .period-btn').forEach(b=>b.classList.remove('active'));
el.classList.add('active');
renderHitparade();
}
async function renderHitparade(){
const el = document.getElementById('hitList'); if(!el) return;
el.innerHTML='<div class="empty"><div class="empty-icon">⏳</div><p>Загрузка...</p></div>';
try{
const r = await fetch(SERVER_URL+'/hitparade');
const d = await r.json();
const list = d[hitPeriod] || [];
if(!list.length){
el.innerHTML='<div class="empty"><div class="empty-icon">📊</div><p>Нет данных за этот период</p></div>';
return;
}
const maxV = list[0]?.views || 1;
el.innerHTML = list.map((item,i)=>{
const a = DB.anime?.[item.anime_id];
if(!a) return '';
const ranks = ['🥇','🥈','🥉'];
const rankClass = i<3 ? ['r1','r2','r3'][i] : 'other';
const pct = Math.round(item.views/maxV*100);
const thumb = a.cover_file_id
? `<img src="${SERVER_URL}/covers/${a.id}.jpg" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
: '';
return `<div class="hit-card" style="animation-delay:${i*.05}s" onclick="openAnime('${a.id}')">
<div class="hit-rank ${rankClass}">${i<3?ranks[i]:i+1}</div>
<div class="hit-thumb">${thumb}<span style="${a.cover_file_id?'display:none':''}">${em(a.id)}</span></div>
<div class="hit-info">
<div class="hit-title">${a.title}</div>
<div class="hit-views">👁 ${item.views} просмотров</div>
<div class="hit-bar"><div class="hit-bar-fill" style="width:${pct}%"></div></div>
</div>
</div>`;
}).join('');
}catch{el.innerHTML='<div class="empty"><div class="empty-icon">📊</div><p>Нет данных</p></div>';}
}
let chatOffset = 0, chatReplying = null, chatPollTimer = null;
let lastChatMsgCount = 0;
async function loadChat(append=false){
const el = document.getElementById('chatMsgs'); if(!el) return;
if(!append) el.innerHTML='<div class="empty"><div class="empty-icon">💬</div><p>Загрузка...</p></div>';
try{
const r = await fetch(SERVER_URL+'/chat?offset=0&limit=50');
const d = await r.json();
const isAdm = (DB.admin_ids||[]).includes(MY_USER_ID);
const msgs = d.messages || [];
if(msgs.length > lastChatMsgCount && lastChatMsgCount > 0){
const badge = document.getElementById('chatBadge');
const diff = msgs.length - lastChatMsgCount;
if(badge && !document.getElementById('viewChat')?.classList.contains('hidden')===false){
badge.textContent = diff; badge.classList.add('show');
}
}
lastChatMsgCount = msgs.length;
el.innerHTML = msgs.map(m=>{
const isOwn = m.user_id === MY_USER_ID;
const ts = new Date(m.ts*1000).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
const text = m.text.replace(/@(\w+)/g,'<span class="c-mention">@$1</span>');
return `<div class="chat-msg ${isOwn?'own':''}" id="cmsg_${m.id}">
<div class="chat-av" onclick="${m.username?`openTgProfile('${m.username}')`:`openTgById(${m.user_id})`}">${m.first_name?m.first_name[0]:'?'}</div>
<div>
<div class="chat-bubble" onclick="setChatReply('${m.id}','${m.first_name}')">
${!isOwn?`<div class="chat-bubble-name">${m.first_name}${m.username?' @'+m.username:''}</div>`:''}
${m.reply_to?`<div class="chat-reply-preview">↩ Ответ</div>`:''}
<div class="chat-bubble-text">${text}</div>
<div class="chat-bubble-time">${ts}${isAdm?` <span class="chat-del" onclick="event.stopPropagation();deleteChatMsg('${m.id}')">✕</span>`:''}</div>
</div>
</div>
</div>`;
}).join('');
if(!append) setTimeout(()=>el.scrollTop=el.scrollHeight,100);
const onlineEl = document.getElementById('chatOnlineCount');
if(onlineEl) onlineEl.textContent = '';
}catch{if(!append)el.innerHTML='<div class="empty"><div class="empty-icon">💬</div><p>Ошибка загрузки</p></div>';}
}
function setChatReply(msgId, name){
chatReplying = msgId;
const inp = document.getElementById('chatInp');
if(inp){inp.placeholder=`Ответить @${name}...`;inp.focus();}
showToast('↩ Отвечаешь @'+name);
}
async function sendChatMsg(){
const inp = document.getElementById('chatInp');
const text = inp?.value.trim(); if(!text) return;
inp.value=''; chatReplying=null; inp.placeholder='Написать в чат...';
try{
await fetch(SERVER_URL+'/chat',{
method:'POST', headers:{'Content-Type':'application/json'},
body: JSON.stringify({user_id:MY_USER_ID, username:MY_USERNAME, first_name:MY_NAME, text, reply_to:chatReplying})
});
loadChat();
}catch{showToast('❌ Ошибка отправки')}
}
document.getElementById('chatInp')?.addEventListener('keydown', e=>{
if(e.key==='Enter' && !e.shiftKey){e.preventDefault();sendChatMsg();}
});
async function deleteChatMsg(msgId){
if(!confirm('Удалить сообщение?')) return;
try{
await fetch(SERVER_URL+'/chat/'+msgId+'?token='+SERVER_TOKEN, {method:'DELETE'});
document.getElementById('cmsg_'+msgId)?.remove();
showToast('🗑 Удалено');
}catch{}
}
function startChatPolling(){
if(chatPollTimer) clearInterval(chatPollTimer);
chatPollTimer = setInterval(()=>loadChat(), 10000);
}
function stopChatPolling(){
if(chatPollTimer){clearInterval(chatPollTimer);chatPollTimer=null;}
}
const origRenderEpList = renderEpList;
function renderEpList(){
origRenderEpList();
if(curAnime){
curAnime.episodes?.forEach(ep=>{
const epEl = document.getElementById('ep_'+ep.num);
if(epEl && !epEl.querySelector('.watching-bar')){
const bar = document.createElement('div');
bar.className='watching-bar';
bar.id='watchingBar_'+curAnime.id+'_'+ep.num;
bar.style.display='none';
epEl.insertBefore(bar, epEl.firstChild);
loadWatchingNow(curAnime.id, ep.num);
}
});
}
}
const lazyLoaded = {};
function lazyLoad(key, fn){
if(!lazyLoaded[key]){lazyLoaded[key]=true;fn();}
}
function debounce(fn, delay){
let t; return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),delay)};
}
function rafRender(fn){ requestAnimationFrame(fn) }
const CARD_HEIGHT = 250;
function getVisibleCount(){
return Math.ceil(window.innerHeight / CARD_HEIGHT) + 4;
}
const imgObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries)=>{
entries.forEach(e=>{
if(e.isIntersecting){
const img = e.target;
if(img.dataset.src){img.src=img.dataset.src;imgObserver.unobserve(img);}
}
});
},{rootMargin:'100px'}) : null;
function lazyImg(src, fallback){
if(!imgObserver) return `<img src="${src}" onerror="${fallback}">`;
return `<img data-src="${src}" src="" style="background:var(--s2)" onload="this.style.background=''" onerror="${fallback}">`;
}
initTheme();
loadDB();