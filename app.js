/* 영수증 다이어리 app.js v12 */
(function(){
'use strict';

var PALS=[
  {bg:'#fde8f0',tx:'#8a1a3a',bd:'#f0a0c0'},{bg:'#e8f0fd',tx:'#1a3a8a',bd:'#90b0f0'},
  {bg:'#e8fdf0',tx:'#1a6030',bd:'#80d8a0'},{bg:'#fff8e0',tx:'#6a4800',bd:'#f0d060'},
  {bg:'#f0e8fd',tx:'#4a1a8a',bd:'#c0a0f0'},{bg:'#e8fdfd',tx:'#0a5050',bd:'#70d8d8'},
  {bg:'#fdf0e8',tx:'#6a2a00',bd:'#f0b880'},{bg:'#fde8e8',tx:'#8a1818',bd:'#f09090'},
  {bg:'#e8fde8',tx:'#185818',bd:'#90f090'},{bg:'#f8f8e8',tx:'#4a4800',bd:'#d8d870'}
];
var CPALS=[
  ['#f090b0','#90b0f0','#70c890'],['#e07090','#7090e0','#50b870'],
  ['#f0c050','#c050f0','#50d0c0'],['#e09060','#60a0e0','#90e060'],
  ['#f070a0','#70a0f0','#a0f070']
];

/* ── 상태 ── */
var ROW=32, sS=6, sE=22;
var todos=[], pT=['','',''], pD=[false,false,false];
var blocks=[], bId=0, cMap={}, cN=0;
var entries=[], calY, calM, selDate=null;
var sCtx=null, editBid=null, deferredInstall=null;
var _editingDate=null;

/* ── 유틸 ── */
function pad(n){return String(n).padStart(2,'0');}
/* 핵심: 로컬 날짜 키 (UTC 아님) */
function ldk(d){var t=d||new Date();return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());}
function snap(h){return Math.round(h*2)/2;}
function hY(h){return(h-sS)*ROW;}
function hL(h){var hh=Math.floor(h),mm=Math.round((h-hh)*60);return pad(hh)+':'+(mm?'30':'00');}
function gc(t){if(cMap[t]===undefined){cMap[t]=cN%PALS.length;cN++;}return cMap[t];}
function fmtD(d){var ds=['일','월','화','수','목','금','토'];return d.getFullYear()+'.'+pad(d.getMonth()+1)+'.'+pad(d.getDate())+' ('+ds[d.getDay()]+')';}
function gCP(k){var d=new Date(k+'T00:00:00');return CPALS[Math.floor((d-new Date(d.getFullYear(),0,1))/864e5)%CPALS.length];}
function qs(s,c){return(c||document).querySelector(s);}
function ce(t){return document.createElement(t);}
var _tt;
function toast(m){var t=qs('#toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(_tt);_tt=setTimeout(function(){t.classList.remove('on');},2500);}
function openModal(id){var m=qs('#'+id);if(m)m.classList.add('on');}
function closeModal(id){var m=qs('#'+id);if(m)m.classList.remove('on');}

/* ── 저장/불러오기 ── */
function load(){
  try{entries=JSON.parse(localStorage.getItem('de')||'[]');}catch(e){entries=[];}
  var today=ldk();
  var workDay=localStorage.getItem('work_day')||'';
  /* 날짜가 바뀌었으면 작업공간(todos/pT/pD/blocks) 자동 초기화 */
  if(workDay && workDay!==today){
    todos=[]; pT=['','','']; pD=[false,false,false]; blocks=[];
    ['dt','pd','pt','db'].forEach(function(k){localStorage.removeItem(k);});
  } else {
    try{todos=JSON.parse(localStorage.getItem('dt')||'[]');}catch(e){todos=[];}
    try{pD=JSON.parse(localStorage.getItem('pd')||'[false,false,false]');}catch(e){pD=[false,false,false];}
    try{pT=JSON.parse(localStorage.getItem('pt')||'["","",""]');}catch(e){pT=['','',''];}
    try{blocks=JSON.parse(localStorage.getItem('db')||'[]');bId=blocks.reduce(function(m,b){return Math.max(m,parseInt(b.id.replace('b',''))||0);},0);}catch(e){blocks=[];}
    try{var r=JSON.parse(localStorage.getItem('dr')||'null');if(r){sS=r.s;sE=r.e;}}catch(e){}
  }
  localStorage.setItem('work_day',today);
  /* 달력에서 오늘 날짜가 아닌 스케줄 블록 제거 (이전 날 누적 방지) */
  entries.forEach(function(ent){
    if(ent.date!==today && ent.blocks) ent.blocks=[];
  });
}
function save(){
  try{
    localStorage.setItem('dt',JSON.stringify(todos));
    localStorage.setItem('pd',JSON.stringify(pD));
    localStorage.setItem('pt',JSON.stringify(pT));
    localStorage.setItem('db',JSON.stringify(blocks));
    localStorage.setItem('dr',JSON.stringify({s:sS,e:sE}));
    if(!_editingDate) localStorage.setItem('work_day',ldk());
  }catch(e){}
}
function sync(){
  var today=ldk(), dk=_editingDate||today;
  var now=new Date();
  var pr=pT.map(function(t,i){return{text:t,done:pD[i]};});
  var has=pr.some(function(p){return p.text;})||todos.length||blocks.length;
  if(!has){entries=entries.filter(function(e){return e.date!==dk;});}
  else{
    var ent={date:dk,displayDate:fmtD(new Date(dk+'T12:00:00')),priorities:pr,
      todos:JSON.parse(JSON.stringify(todos)),
      blocks:JSON.parse(JSON.stringify(blocks))};
    var ix=entries.findIndex(function(e){return e.date===dk;});
    if(ix>=0)entries[ix]=ent; else entries.unshift(ent);
  }
  try{localStorage.setItem('de',JSON.stringify(entries));}catch(e){}
  renderCal();
}

/* ── INIT ── */
function init(){
  var now=new Date(); calY=now.getFullYear(); calM=now.getMonth();
  load();
  buildPrioUI();
  renderTodos();
  buildSchedAxis();
  renderBlocksFromData();
  renderCal();
  bindTabs();
  bindTodo();
  bindReset();
  bindReceiptView();
  bindSign();
  bindSchedModal();
  bindCalNav();
  bindPWA();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
}

/* ── 탭 ── */
function bindTabs(){
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      var tgt=btn.dataset.pg; if(!tgt)return;
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
      document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
      btn.classList.add('on');
      var pg=qs('#'+tgt); if(pg)pg.classList.add('on');
      if(tgt==='pg-cal') renderCal();
      if(tgt==='pg-sched'){
        refreshSchedPrio();
        /* 스케줄 탭 진입 시 드래그 이벤트 등록 (DOM이 보일 때) */
        attachSchedDrop();
      }
    });
  });
}

/* ── 전체 리셋 ── */
function doReset(){
  todos=[]; pT=['','','']; pD=[false,false,false]; blocks=[];
  sS=6; sE=22;
  save(); sync();
  buildPrioUI(); renderTodos();
  var cv=qs('#stCv'); if(cv)cv.querySelectorAll('.sb').forEach(function(el){el.remove();});
  buildSchedAxis(); refreshSchedPrio();
  var st=qs('#bstamp'); if(st)st.classList.remove('on');
}
function bindReset(){
  /* 오늘 탭 리셋 */
  var btn=qs('#btnReset');
  if(btn)btn.addEventListener('click',function(){openModal('mReset');});
  qs('#mResetCancel').addEventListener('click',function(){closeModal('mReset');});
  qs('#mResetOk').addEventListener('click',function(){doReset();closeModal('mReset');toast('초기화됐습니다 ↺');});
  /* 스케줄 리셋 */
  var sbtn=qs('#btnResetSched');
  if(sbtn)sbtn.addEventListener('click',function(){openModal('mSchedReset');});
  qs('#mSchedResetCancel').addEventListener('click',function(){closeModal('mSchedReset');});
  qs('#mSchedResetOk').addEventListener('click',function(){
    blocks=[]; save(); sync();
    var cv=qs('#stCv'); if(cv)cv.querySelectorAll('.sb').forEach(function(el){el.remove();});
    closeModal('mSchedReset'); toast('스케줄이 삭제됐습니다 ↺');
  });
}

/* ── 핵심 3가지 ── */
function buildPrioUI(){
  buildPC('plTodo',true);
  buildPC('plSched',false);
}
function buildPC(cid,withInp){
  var pl=qs('#'+cid); if(!pl)return;
  pl.innerHTML='';
  if(withInp){
    var st=ce('div');st.className='bstamp';st.id='bstamp';
    st.innerHTML='<div class="bstamp-i"><span class="bs1">참 잘했어요</span><span class="bs2">★ ★ ★</span></div>';
    pl.appendChild(st);
  }
  for(var i=0;i<3;i++){
    (function(idx){
      var row=ce('div');row.className='pi'+(pD[idx]?' dp':'');row.id='pi-'+idx+'-'+cid;
      var cb=ce('div');cb.className='pcb'+(pD[idx]?' on':'');cb.id='pcb-'+idx+'-'+cid;
      cb.addEventListener('click',function(){togP(idx);});
      var tw=ce('div');tw.className='ptw';
      if(withInp){
        var inp=ce('input');inp.className='pinp';inp.id='pin'+idx;
        inp.placeholder=['가장 중요한 일','두 번째 중요한 일','세 번째 중요한 일'][idx];
        inp.value=pT[idx]||'';
        inp.addEventListener('input',(function(ii){return function(){pT[ii]=inp.value;save();sync();refreshSchedPrio();};})(idx));
        tw.appendChild(inp);
        var dh=ce('span');dh.className='pdh';dh.setAttribute('draggable','true');dh.textContent='⠿';
        dh.addEventListener('dragstart',(function(ii){return function(e){
          var v=pT[ii];if(!v){e.preventDefault();return;}
          e.dataTransfer.setData('text/plain',v);
          e.dataTransfer.effectAllowed='copy';
        };})(idx));
        row.appendChild(cb);row.appendChild(tw);row.appendChild(dh);
      } else {
        /* 스케줄 탭: 탭하면 스케줄에 추가 + 드래그도 가능 */
        var sp=ce('span');sp.className='pmirror';sp.id='pm-'+idx;
        sp.textContent=pT[idx]||'(비어있음)';
        sp.style.cssText='flex:1;font-size:12px;color:var(--tx2);font-family:inherit;cursor:pointer;';
        tw.appendChild(sp);
        /* + 버튼: 탭하면 빈 슬롯에 추가 */
        var addBtn=ce('button');addBtn.className='prio-add-btn';
        addBtn.textContent='+ 추가';
        addBtn.style.cssText='font-size:11px;font-family:inherit;background:var(--blue);color:#fff;border:none;border-radius:12px;padding:3px 10px;cursor:pointer;flex-shrink:0;margin-left:6px;';
        var addFn=(function(ii){return function(e){
          e.stopPropagation();
          var v=pT[ii];
          if(!v||v==='(비어있음)'){toast('오늘 탭에서 먼저 핵심 '+(ii+1)+'을 입력하세요');return;}
          var sh=findFreeSlot();
          addBlock(v,sh,Math.min(sh+1,sE));
          toast('"'+v.slice(0,10)+'" 스케줄에 추가됨 ✓');
        };})(idx);
        addBtn.addEventListener('click',addFn);
        /* 드래그 (PC) */
        row.setAttribute('draggable','true');
        row.addEventListener('dragstart',(function(ii){return function(e){
          var v=pT[ii];if(!v){e.preventDefault();return;}
          e.dataTransfer.setData('text/plain',v);
          e.dataTransfer.effectAllowed='copy';
        };})(idx));
        /* 터치 드래그 (모바일) — touchstart로 dragTxt 세팅 */
        (function(ii){
          var touchTimer=null;
          row.addEventListener('touchstart',function(e){
            var v=pT[ii];if(!v)return;
            /* 길게 누르면 드래그 모드 힌트 */
            touchTimer=setTimeout(function(){
              toast('"'+v.slice(0,10)+'" — 스케줄 빈 칸을 탭하세요');
              window._pendingPrio=v;
            },400);
          },{passive:true});
          row.addEventListener('touchend',function(){clearTimeout(touchTimer);});
          row.addEventListener('touchmove',function(){clearTimeout(touchTimer);},{passive:true});
        })(idx);
        row.appendChild(cb);row.appendChild(tw);row.appendChild(addBtn);
      }
      pl.appendChild(row);
    })(i);
  }
}
function refreshSchedPrio(){
  for(var i=0;i<3;i++){
    var m=qs('#pm-'+i);if(m)m.textContent=pT[i]||'(비어있음)';
    ['plTodo','plSched'].forEach(function(cid){
      var cb=qs('#pcb-'+i+'-'+cid),it=qs('#pi-'+i+'-'+cid);
      if(!cb||!it)return;
      if(pD[i]){cb.classList.add('on');it.classList.add('dp');}
      else{cb.classList.remove('on');it.classList.remove('dp');}
    });
  }
  var st=qs('#bstamp');
  if(st){if(pD.every(Boolean))st.classList.add('on');else st.classList.remove('on');}
}
function togP(i){
  if(!pT[i])return;
  pD[i]=!pD[i];refreshSchedPrio();
  if(pD[i])fireConf();
  save();sync();
}

/* ── TODO ── */
function bindTodo(){
  qs('#todoAddBtn').addEventListener('click',addTodo);
  qs('#todoInp').addEventListener('keydown',function(e){if(e.key==='Enter')addTodo();});
}
function addTodo(){
  var inp=qs('#todoInp'),v=inp.value.trim();if(!v)return;
  todos.push({text:v,done:false});inp.value='';renderTodos();save();sync();
}
function renderTodos(){
  var l=qs('#tlist');l.innerHTML='';
  if(!todos.length){var e=ce('div');e.className='empty';e.textContent='할 일을 추가해보세요 ✏️';l.appendChild(e);return;}
  todos.forEach(function(t,i){
    var row=ce('div');row.className='ti'+(t.done?' dn':'');
    var cb=ce('div');cb.className='tcb';
    cb.addEventListener('click',function(ev){ev.stopPropagation();todos[i].done=!todos[i].done;renderTodos();save();sync();});
    var sp=ce('span');sp.className='titxt';sp.textContent=t.text;
    var ia=ce('div');ia.className='tia';
    var eb=ce('button');eb.className='tib';eb.textContent='✏️';
    eb.addEventListener('click',function(ev){ev.stopPropagation();var nv=prompt('수정:',t.text);if(nv&&nv.trim()){todos[i].text=nv.trim();renderTodos();save();sync();}});
    var db=ce('button');db.className='tib del';db.textContent='🗑️';
    db.addEventListener('click',function(ev){ev.stopPropagation();todos.splice(i,1);renderTodos();save();sync();});
    ia.appendChild(eb);ia.appendChild(db);
    row.appendChild(cb);row.appendChild(sp);row.appendChild(ia);
    /* To-Do → 스케줄 드래그 (PC) */
    row.setAttribute('draggable','true');
    row.addEventListener('dragstart',(function(txt){return function(e){
      e.dataTransfer.setData('text/plain',txt);
      e.dataTransfer.effectAllowed='copy';
    };})(t.text));
    /* To-Do → 스케줄 터치 (모바일) */
    (function(txt){
      var tt=null;
      row.addEventListener('touchstart',function(){
        tt=setTimeout(function(){
          window._pendingPrio=txt;
          toast('"'+txt.slice(0,10)+'" — 스케줄 탭 빈 칸을 탭하세요');
        },400);
      },{passive:true});
      row.addEventListener('touchend',function(){clearTimeout(tt);},{passive:true});
      row.addEventListener('touchmove',function(){clearTimeout(tt);},{passive:true});
    })(t.text);
    l.appendChild(row);
  });
}

/* ── 영수증 ── */
function bindReceiptView(){
  qs('#btnCheckout').addEventListener('click',showRcpt);
  qs('#btnBack').addEventListener('click',function(){
    qs('#pg-rcpt').classList.remove('on');qs('#pg-todo').classList.add('on');
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
    var t=qs('.tab[data-pg="pg-todo"]');if(t)t.classList.add('on');
    _editingDate=null;var ph=qs('.ph h2');if(ph)ph.textContent='오늘의 기록';
  });
  qs('#btnSaveImg').addEventListener('click',saveImg);
}
function showRcpt(){
  var now=new Date(),dk=_editingDate||ldk(now);
  var d=_editingDate?new Date(dk+'T12:00:00'):now;
  qs('#rvDate').textContent=fmtD(d);
  qs('#rvNo').textContent='NO.'+dk.replace(/-/g,'');
  var tc=qs('#rvTodos');tc.innerHTML='';
  if(!todos.length){var n=ce('div');n.style.cssText='padding:4px 16px;font-size:12px;color:var(--tx3)';n.textContent='(없음)';tc.appendChild(n);}
  todos.forEach(function(t){
    var r=ce('div');r.className='rti';
    var ck=ce('span');ck.className='rtick';ck.textContent=t.done?'☑':'☐';
    var tx=ce('span');tx.className='rtxt'+(t.done?' dn':'');tx.textContent=t.text;
    r.appendChild(ck);r.appendChild(tx);tc.appendChild(r);
  });
  var pc=qs('#rvPrios');pc.innerHTML='';var pdc=0;
  pT.forEach(function(v,i){
    if(!v)return;if(pD[i])pdc++;
    var r=ce('div');r.className='rpi';
    var n=ce('span');n.className='rpn';n.textContent=(i+1)+'.';
    var tx=ce('span');tx.className='rpt'+(pD[i]?' dn':'');tx.textContent=v;
    var ck=ce('span');ck.className='rpck';ck.textContent=pD[i]?'✅':'⬜';
    r.appendChild(n);r.appendChild(tx);r.appendChild(ck);pc.appendChild(r);
  });
  var dc=todos.filter(function(t){return t.done;}).length;
  qs('#rvRate').textContent='To-Do '+dc+'/'+todos.length+' ('+(todos.length?Math.round(dc/todos.length*100):0)+'%)';
  var tot=pT.filter(function(t){return t;}).length;
  qs('#rvScore').textContent='핵심 '+pdc+'/'+tot;
  qs('#pg-todo').classList.remove('on');qs('#pg-rcpt').classList.add('on');
  sync();
}
function saveImg(){
  var btn=qs('#btnSaveImg');btn.textContent='저장 중...';btn.disabled=true;
  var area=qs('#rcptArea'),sc=qs('.signcard');
  var wrap=ce('div');
  wrap.style.cssText='position:fixed;top:-9999px;left:-9999px;width:'+area.offsetWidth+'px;background:#f0f0f0;padding:14px;font-family:Courier New,monospace;';
  var ac=area.cloneNode(true),scc=sc.cloneNode(true);
  var oc=qs('#scv-prev'),cc=scc.querySelector('canvas');
  if(oc&&cc){cc.width=oc.width;cc.height=oc.height;cc.getContext('2d').drawImage(oc,0,0);}
  scc.querySelectorAll('button,.sighint').forEach(function(b){b.style.display='none';});
  wrap.appendChild(ac);wrap.appendChild(scc);document.body.appendChild(wrap);
  setTimeout(function(){
    html2canvas(wrap,{backgroundColor:'#f0f0f0',scale:2,useCORS:true,allowTaint:true,logging:false})
    .then(function(c){
      document.body.removeChild(wrap);btn.textContent='⬇ 이미지 저장';btn.disabled=false;
      _editingDate=null;var ph=qs('.ph h2');if(ph)ph.textContent='오늘의 기록';
      var name='diary-'+ldk()+'.png';
      function dlUrl(u){var a=ce('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){try{document.body.removeChild(a);}catch(e){}},300);}
      if(c.toBlob){c.toBlob(function(blob){var u=URL.createObjectURL(blob);dlUrl(u);setTimeout(function(){URL.revokeObjectURL(u);},1000);},'image/png');}
      else dlUrl(c.toDataURL('image/png'));
      toast('PNG 저장 완료! 📸');
    }).catch(function(err){document.body.removeChild(wrap);btn.textContent='⬇ 이미지 저장';btn.disabled=false;console.error(err);toast('저장 실패');});
  },120);
}

/* ── 서명 ── */
function bindSign(){
  var card=qs('#signPreviewCard'),prev=qs('#scv-prev');
  if(card)card.addEventListener('click',openSign);
  if(prev)prev.addEventListener('click',openSign);
  qs('#signClr').addEventListener('click',function(){var cv=qs('#scv');if(cv&&sCtx)sCtx.clearRect(0,0,cv.offsetWidth,cv.offsetHeight);});
  qs('#signOk').addEventListener('click',function(){closeSign(true);});
  qs('#mSign').addEventListener('click',function(e){if(e.target===this)closeSign(false);});
}
function openSign(){
  openModal('mSign');
  setTimeout(function(){
    var cv=qs('#scv');if(!cv)return;
    var dpr=window.devicePixelRatio||1,w=cv.parentElement.clientWidth||340,h=200;
    var fr=ce('canvas');fr.id='scv';
    fr.style.cssText='display:block;width:'+w+'px;height:'+h+'px;cursor:crosshair;touch-action:none;background:#fff;';
    fr.width=Math.round(w*dpr);fr.height=Math.round(h*dpr);
    cv.parentNode.replaceChild(fr,cv);
    var ctx=fr.getContext('2d');ctx.scale(dpr,dpr);
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
    sCtx=ctx;var drawing=false;
    function gp(e){var r=fr.getBoundingClientRect(),src=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top};}
    fr.addEventListener('mousedown',function(e){drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fr.addEventListener('mousemove',function(e){if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);});
    fr.addEventListener('mouseup',function(){drawing=false;});
    fr.addEventListener('mouseleave',function(){drawing=false;});
    fr.addEventListener('touchstart',function(e){e.preventDefault();drawing=true;var p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fr.addEventListener('touchmove',function(e){e.preventDefault();if(!drawing)return;var p=gp(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);},{passive:false});
    fr.addEventListener('touchend',function(){drawing=false;});
  },80);
}
function closeSign(save){
  if(save){
    var src=qs('#scv'),dst=qs('#scv-prev');
    if(src&&dst){
      var dpr=window.devicePixelRatio||1,dw=dst.offsetWidth*dpr,dh=dst.offsetHeight*dpr;
      dst.width=dw;dst.height=dh;
      var ctx=dst.getContext('2d');ctx.clearRect(0,0,dw,dh);
      var sa=src.width/src.height,da=dw/dh,W,H,X,Y;
      if(sa>da){W=dw;H=dw/sa;X=0;Y=(dh-H)/2;}else{H=dh;W=dh*sa;Y=0;X=(dw-W)/2;}
      ctx.drawImage(src,X,Y,W,H);
      var h=qs('#signHint');if(h)h.style.display='none';
    }
  }
  closeModal('mSign');
}

/* ── 스케줄 ── */
function buildSchedAxis(){
  var ax=qs('#stAx'),cv=qs('#stCv');if(!ax||!cv)return;
  var th=(sE-sS)*ROW;
  ax.style.height=th+'px';cv.style.height=th+'px';
  var wrap=qs('#stWrap');if(wrap)wrap.style.height=th+'px';
  ax.innerHTML='';
  cv.querySelectorAll('.sthl').forEach(function(el){el.remove();});
  for(var hr=sS;hr<=sE;hr++){
    var lb=ce('div');lb.className='staxl';lb.textContent=pad(hr)+':00';lb.style.top=hY(hr)+'px';ax.appendChild(lb);
    var ln=ce('div');ln.className='sthl';ln.style.top=hY(hr)+'px';cv.appendChild(ln);
    if(hr<sE){var hl=ce('div');hl.className='sthl h';hl.style.top=(hY(hr)+ROW/2)+'px';cv.appendChild(hl);}
  }
  /* 드래그 이벤트는 여기서 등록 */
  attachSchedDrop();
}
var _dropAttached=false;
function attachSchedDrop(){
  var cv=qs('#stCv');if(!cv||_dropAttached)return;
  _dropAttached=true;

  /* PC: HTML5 drag & drop */
  cv.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='copy';});
  cv.addEventListener('drop',function(e){
    e.preventDefault();
    var txt=e.dataTransfer.getData('text/plain');
    if(!txt)return;
    var r=cv.getBoundingClientRect(),sh=snap(Math.max(sS,Math.min(sE-.5,(e.clientY-r.top)/ROW+sS)));
    addBlock(txt,sh,Math.min(sh+1,sE));
    toast('"'+txt.slice(0,10)+'" 추가됨 ✓');
  });

  /* 모바일: 핵심3가지 + 버튼 탭 + 빈칸 탭 처리 */
  var tapT=null,tapY=0;
  cv.addEventListener('pointerdown',function(e){
    if(e.target!==cv&&!e.target.classList.contains('sthl'))return;
    tapY=e.clientY;tapT=setTimeout(function(){tapT=null;},400);
  });
  cv.addEventListener('pointerup',function(e){
    if(!tapT)return;clearTimeout(tapT);tapT=null;
    if(Math.abs(e.clientY-tapY)>8)return;
    var r=cv.getBoundingClientRect(),sh=snap(Math.max(sS,Math.min(sE-.5,(e.clientY-r.top)/ROW+sS)));
    /* _pendingPrio가 있으면 (모바일 핵심3가지 탭 후 빈칸 탭) */
    if(window._pendingPrio){
      addBlock(window._pendingPrio,sh,Math.min(sh+1,sE));
      toast('"'+window._pendingPrio.slice(0,10)+'" 추가됨 ✓');
      window._pendingPrio=null;
    } else {
      openBM(null,sh,Math.min(sh+1,sE),'');
    }
  });
}
function applyBS(el,b){
  var ci=gc(b.text),col=PALS[ci],top=hY(b.startH),ht=Math.max(hY(b.endH)-top,18);
  el.style.top=top+'px';el.style.height=ht+'px';
  el.style.background=col.bg;el.style.color=col.tx;
  el.style.border='.5px solid '+col.bd;el.style.borderLeft='3px solid '+col.tx;
}
function createBEl(b){
  if(document.getElementById('bel-'+b.id))return;
  var cv=qs('#stCv');if(!cv)return;
  var el=ce('div');el.className='sb';el.id='bel-'+b.id;
  var rht=ce('div');rht.className='rht';
  var nm=ce('span');nm.className='sbn';nm.textContent=b.text;
  var mv=ce('div');mv.className='sbm';mv.textContent='⋮';
  var rhb=ce('div');rhb.className='rhb';
  el.appendChild(rht);el.appendChild(nm);el.appendChild(mv);el.appendChild(rhb);
  applyBS(el,b);attachBH(el,b);cv.appendChild(el);
}
function renderBlocksFromData(){
  var cv=qs('#stCv');if(!cv)return;
  cv.querySelectorAll('.sb').forEach(function(el){el.remove();});
  blocks.forEach(function(b){createBEl(b);});
}
function findFreeSlot(){
  for(var h=sS;h<sE;h+=1){
    var occ=blocks.some(function(b){return h<b.endH&&(h+1)>b.startH;});
    if(!occ)return h;
  }
  return sS;
}
function addBlock(txt,sh,eh){
  var b={id:'b'+(++bId),text:txt,startH:sh,endH:eh};
  blocks.push(b);createBEl(b);save();sync();
}
function attachBH(el,b){
  var pt=null,py=0;
  el.addEventListener('pointerdown',function(e){
    if(e.target.classList.contains('rht')||e.target.classList.contains('rhb')||e.target.classList.contains('sbm'))return;
    py=e.clientY;pt=setTimeout(function(){pt=null;openBM(b.id,b.startH,b.endH,b.text);},500);
  });
  el.addEventListener('pointermove',function(e){if(pt&&Math.abs(e.clientY-py)>8){clearTimeout(pt);pt=null;}});
  el.addEventListener('pointerup',function(){if(pt){clearTimeout(pt);pt=null;}});
  var rht=el.querySelector('.rht'),rhb=el.querySelector('.rhb'),mv=el.querySelector('.sbm'),y0,s0,e0;
  rht.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rht.setPointerCapture(e.pointerId);});
  rht.addEventListener('pointermove',function(e){if(!rht.hasPointerCapture(e.pointerId))return;b.startH=Math.max(sS,Math.min(b.endH-.5,snap(s0+(e.clientY-y0)/ROW)));applyBS(el,b);});
  rht.addEventListener('pointerup',function(e){if(rht.hasPointerCapture(e.pointerId)){rht.releasePointerCapture(e.pointerId);save();sync();}});
  rhb.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;rhb.setPointerCapture(e.pointerId);});
  rhb.addEventListener('pointermove',function(e){if(!rhb.hasPointerCapture(e.pointerId))return;b.endH=Math.min(sE,Math.max(b.startH+.5,snap(e0+(e.clientY-y0)/ROW)));applyBS(el,b);});
  rhb.addEventListener('pointerup',function(e){if(rhb.hasPointerCapture(e.pointerId)){rhb.releasePointerCapture(e.pointerId);save();sync();}});
  mv.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();y0=e.clientY;s0=b.startH;e0=b.endH;mv.setPointerCapture(e.pointerId);});
  mv.addEventListener('pointermove',function(e){if(!mv.hasPointerCapture(e.pointerId))return;var dur=e0-s0,ns=snap(s0+(e.clientY-y0)/ROW);ns=Math.max(sS,Math.min(sE-dur,ns));b.startH=ns;b.endH=ns+dur;applyBS(el,b);});
  mv.addEventListener('pointerup',function(e){if(mv.hasPointerCapture(e.pointerId)){mv.releasePointerCapture(e.pointerId);save();sync();}});
}

/* ── 스케줄 시간 범위 모달 ── */
function bindSchedModal(){
  qs('#btnTR').addEventListener('click',openTR);
  qs('#mTRCancel').addEventListener('click',function(){closeModal('mTR');});
  qs('#mTROk').addEventListener('click',applyTR);
}
function openTR(){
  var ss=qs('#trS'),se=qs('#trE');ss.innerHTML='';se.innerHTML='';
  for(var h=1;h<=23;h++){var o=ce('option');o.value=h;o.textContent=pad(h)+':00';if(h===sS)o.selected=true;ss.appendChild(o);}
  for(var h2=2;h2<=24;h2++){var o2=ce('option');o2.value=h2;o2.textContent=h2===24?'24:00':pad(h2)+':00';if(h2===sE)o2.selected=true;se.appendChild(o2);}
  openModal('mTR');
}
function applyTR(){
  var s=parseInt(qs('#trS').value),e=parseInt(qs('#trE').value);
  if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  sS=s;sE=e;
  blocks.forEach(function(b){b.startH=Math.max(b.startH,sS);b.endH=Math.min(b.endH,sE);if(b.endH<=b.startH)b.endH=Math.min(b.startH+.5,sE);var el=document.getElementById('bel-'+b.id);if(el)applyBS(el,b);});
  closeModal('mTR');_dropAttached=false;buildSchedAxis();save();
}
function fillSel(id,def){
  var s=qs('#'+id);if(!s)return;s.innerHTML='';
  for(var h=sS;h<=sE;h+=.5){var hh=Math.floor(h),mm=Math.round((h-hh)*60),o=ce('option');o.value=h;o.textContent=pad(hh)+':'+(mm?'30':'00');if(Math.abs(h-def)<.01)o.selected=true;s.appendChild(o);}
}
function openBM(bid,sh,eh,txt){
  editBid=bid;
  var t=qs('#mBlockTitle');if(t)t.textContent=bid?'블록 수정':'블록 추가';
  var bt=qs('#blTxt');if(bt)bt.value=txt||'';
  fillSel('blS',sh);fillSel('blE',eh);
  var btns=qs('#blBtns');if(!btns)return;btns.innerHTML='';
  if(bid){
    var dl=ce('button');dl.className='mdel';dl.textContent='삭제';
    dl.addEventListener('click',function(){if(editBid){var el=document.getElementById('bel-'+editBid);if(el)el.remove();blocks=blocks.filter(function(b){return b.id!==editBid;});save();sync();}closeModal('mBlock');});
    btns.appendChild(dl);
  }
  var ca=ce('button');ca.textContent='취소';ca.addEventListener('click',function(){closeModal('mBlock');});
  var ok=ce('button');ok.className='mok';ok.textContent=bid?'저장':'추가';ok.addEventListener('click',confirmB);
  btns.appendChild(ca);btns.appendChild(ok);
  openModal('mBlock');setTimeout(function(){var bt=qs('#blTxt');if(bt)bt.focus();},50);
}
function confirmB(){
  var bt=qs('#blTxt');if(!bt)return;
  var txt=bt.value.trim();if(!txt){toast('내용을 입력해 주세요');return;}
  var bs=qs('#blS'),be=qs('#blE');if(!bs||!be)return;
  var s=parseFloat(bs.value),e=parseFloat(be.value);
  if(e<=s){toast('종료 시간이 시작 시간보다 늦어야 합니다');return;}
  if(editBid){var b=blocks.find(function(x){return x.id===editBid;});if(b){b.text=txt;b.startH=s;b.endH=e;var el=document.getElementById('bel-'+editBid);if(el){el.querySelector('.sbn').textContent=txt;applyBS(el,b);}}}
  else addBlock(txt,s,e);
  save();sync();closeModal('mBlock');
}

/* ── 달력 ── */
function bindCalNav(){
  qs('#calPrev').addEventListener('click',function(){chCal(-1);});
  qs('#calNext').addEventListener('click',function(){chCal(1);});
}
function chCal(d){calM+=d;if(calM<0){calM=11;calY--;}if(calM>11){calM=0;calY++;}selDate=null;renderCal();}
function renderCal(){
  var lbl=qs('#calLbl');if(lbl)lbl.textContent=calY+'년 '+(calM+1)+'월';
  var byD={};entries.forEach(function(e){byD[e.date]=e;});
  var g=qs('#cgrid');if(!g)return;g.innerHTML='';
  ['일','월','화','수','목','금','토'].forEach(function(l){var d=ce('div');d.className='cdl';d.textContent=l;g.appendChild(d);});
  var first=new Date(calY,calM,1).getDay(),days=new Date(calY,calM+1,0).getDate();
  var today=ldk();
  for(var i=0;i<first;i++){var emp=ce('div');emp.className='cc emp';g.appendChild(emp);}
  for(var dy=1;dy<=days;dy++){
    (function(day){
      var key=calY+'-'+pad(calM+1)+'-'+pad(day),e=byD[key],pal=gCP(key);
      var cls='cc'+(e?' has':'')+(selDate===key?' sel':'')+(key===today?' today':'');
      var cell=ce('div');cell.className=cls;
      var dn=ce('span');dn.className='dn';dn.textContent=day;cell.appendChild(dn);
      if(e&&e.priorities){
        var dd=ce('div');dd.className='dots';
        e.priorities.forEach(function(p,pi){var dot=ce('div');dot.className='dot';dot.style.background=p.done?pal[pi]:'#ddd';dd.appendChild(dot);});
        cell.appendChild(dd);
      }
      cell.addEventListener('click',function(){showCalDet(key);});
      g.appendChild(cell);
    })(dy);
  }
  var det=qs('#cdet');if(det){if(selDate)showCalDet(selDate,true);else det.innerHTML='';}
}
function schedSum(bks){
  if(!bks||!bks.length)return[];
  var s=bks.slice().sort(function(a,b){return a.startH-b.startH;}),res=[];
  s.forEach(function(b){var l=res[res.length-1];if(l&&l.text===b.text&&Math.abs(l.endH-b.startH)<.01)l.endH=b.endH;else res.push({text:b.text,startH:b.startH,endH:b.endH});});
  return res;
}
function showCalDet(key,noR){
  selDate=key;
  var e=entries.find(function(x){return x.date===key;}),det=qs('#cdet');if(!det)return;
  if(!e){det.innerHTML='<div style="padding:14px;text-align:center;color:var(--tx3);font-size:13px;">'+key+' — 기록 없음</div>';if(!noR)renderCal();return;}
  var dc=e.priorities.filter(function(p){return p.done;}).length,tot=e.priorities.filter(function(p){return p.text;}).length,pal=gCP(key),sg=schedSum(e.blocks||[]);
  var h='<div class="cdet"><div class="cdh"><span class="cddate">'+(e.displayDate||key)+'</span><span class="cdscore">'+dc+'/'+tot+'</span></div>';
  h+='<div class="cdsec">★ 핵심 3가지</div>';
  e.priorities.filter(function(p){return p.text;}).forEach(function(p,pi){h+='<div class="cdpi"><div class="cdpd" style="background:'+(p.done?pal[pi]:'#ddd')+'"></div><span class="cdpt'+(p.done?' dn':'')+'">'+p.text+'</span></div>';});
  if(sg.length){h+='<div class="cdsec">⏱ 스케줄</div><div>';sg.forEach(function(gp){var col=PALS[gc(gp.text)%PALS.length];h+='<span class="cstag" style="background:'+col.bg+';color:'+col.tx+';">'+hL(gp.startH)+'~'+hL(gp.endH)+' '+gp.text+'</span>';});h+='</div>';}
  /* 수정/삭제 버튼 */
  h+='<div style="display:flex;gap:8px;margin-top:12px;">';
  h+='<button class="btn-edit-day" style="flex:1;padding:9px;font-size:12px;font-family:inherit;background:var(--tx);color:var(--bg);border:none;border-radius:8px;cursor:pointer;font-weight:600;">→ 이 날짜로 이동</button>';
  h+='<button class="btn-del-day" style="flex:1;padding:9px;font-size:12px;font-family:inherit;background:#fff0f0;border:1px solid #fcc;border-radius:8px;cursor:pointer;color:#c00;">🗑️ 기록 삭제</button>';
  h+='</div></div>';
  det.innerHTML=h;
  det.querySelector('.btn-edit-day').addEventListener('click',function(){switchToDay(key);});
  det.querySelector('.btn-del-day').addEventListener('click',function(){
    if(!confirm(key+' 기록을 삭제할까요?'))return;
    entries=entries.filter(function(x){return x.date!==key;});
    try{localStorage.setItem('de',JSON.stringify(entries));}catch(e){}
    selDate=null;qs('#cdet').innerHTML='';renderCal();toast(key+' 기록 삭제됨');
  });
  if(!noR)renderCal();
}
/* 달력 날짜 클릭 → 해당 날짜로 오늘/스케줄 탭 즉시 전환
   - 오늘 작업 중인 내용은 오늘 날짜로 자동 저장
   - 선택 날짜 기록이 없으면 빈 상태로 새로 작성 가능 */
function switchToDay(key){
  /* 1. 현재 오늘 데이터 저장 */
  var todayKey=ldk();
  if(!_editingDate){
    var pr=pT.map(function(t,i){return{text:t,done:pD[i]};});
    var has=pr.some(function(p){return p.text;})||todos.length||blocks.length;
    if(has){
      var ent={date:todayKey,displayDate:fmtD(new Date(todayKey+'T12:00:00')),
        priorities:pr,todos:JSON.parse(JSON.stringify(todos)),
        blocks:JSON.parse(JSON.stringify(blocks))};
      var ix=entries.findIndex(function(x){return x.date===todayKey;});
      if(ix>=0)entries[ix]=ent; else entries.unshift(ent);
      try{localStorage.setItem('de',JSON.stringify(entries));}catch(err){}
    }
  }
  /* 2. 해당 날짜 기록 로드 (없으면 빈 상태) */
  var e=entries.find(function(x){return x.date===key;});
  if(e){
    todos=JSON.parse(JSON.stringify(e.todos||[]));
    pT=e.priorities.map(function(p){return p.text||'';});
    pD=e.priorities.map(function(p){return p.done||false;});
    blocks=JSON.parse(JSON.stringify(e.blocks||[]));
  } else {
    /* 해당 날짜 기록 없음 → 빈 상태로 새로 작성 */
    todos=[]; pT=['','','']; pD=[false,false,false]; blocks=[];
  }
  _editingDate=(key===todayKey)?null:key;
  save();
  buildPrioUI(); renderTodos(); renderBlocksFromData(); refreshSchedPrio();
  /* 3. 오늘 탭으로 이동 */
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  var t=qs('.tab[data-pg="pg-todo"]');if(t)t.classList.add('on');
  qs('#pg-todo').classList.add('on');
  /* 4. 헤더 날짜 표시 */
  var ph=qs('.ph h2');
  if(ph){
    if(key===todayKey) ph.textContent='오늘의 기록';
    else ph.textContent='📅 '+key.replace(/-/g,'.');
  }
  var msg=e?('📅 '+key+' 기록으로 이동했습니다'):('📅 '+key+' — 새로 작성하세요');
  toast(msg);
}

function loadDayForEdit(key){
  var e=entries.find(function(x){return x.date===key;});if(!e)return;
  /* 1. 현재 오늘 데이터를 먼저 달력에 저장 (덮어쓰기 방지) */
  var todayKey=ldk();
  if(!_editingDate){
    /* 오늘 작업 중이던 내용을 오늘 날짜로 저장 */
    var pr=pT.map(function(t,i){return{text:t,done:pD[i]};});
    var has=pr.some(function(p){return p.text;})||todos.length||blocks.length;
    if(has){
      var ent={date:todayKey,displayDate:fmtD(new Date(todayKey+'T12:00:00')),
        priorities:pr,todos:JSON.parse(JSON.stringify(todos)),
        blocks:JSON.parse(JSON.stringify(blocks))};
      var ix=entries.findIndex(function(x){return x.date===todayKey;});
      if(ix>=0)entries[ix]=ent; else entries.unshift(ent);
      try{localStorage.setItem('de',JSON.stringify(entries));}catch(err){}
    }
  }
  /* 2. 선택한 날짜 기록 불러오기 */
  todos=JSON.parse(JSON.stringify(e.todos||[]));
  pT=e.priorities.map(function(p){return p.text||'';});
  pD=e.priorities.map(function(p){return p.done||false;});
  blocks=JSON.parse(JSON.stringify(e.blocks||[]));
  _editingDate=key;
  save();buildPrioUI();renderTodos();renderBlocksFromData();refreshSchedPrio();
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  var t=qs('.tab[data-pg="pg-todo"]');if(t)t.classList.add('on');
  qs('#pg-todo').classList.add('on');
  var ph=qs('.ph h2');if(ph)ph.textContent='✏️ 수정 중: '+key;
  toast('📅 '+key+' 기록을 불러왔습니다 — 수정 후 결제하기로 저장하세요');
}

/* ── PWA ── */
function bindPWA(){
  var urlEl=qs('#pwaUrl');if(urlEl)urlEl.textContent=location.hostname;
  var installBtn=qs('#btnInstall');
  var instStatus=qs('#instStatus');
  var iosGuide=qs('#iosGuide');

  /* ── 이미 설치된 경우 ── */
  if(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone){
    setInstalled(); return;
  }

  /* ── iOS 감지: beforeinstallprompt 지원 안 함 → iOS 안내 표시 ── */
  var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
  if(isIOS){
    if(installBtn){installBtn.disabled=true;installBtn.textContent='Safari에서 설치';}
    if(instStatus)instStatus.textContent='아래 방법으로 홈 화면에 추가하세요.';
    if(iosGuide)iosGuide.style.display='block';
    return;
  }

  /* ── Chrome/Edge/Android: beforeinstallprompt 대기 ── */
  /* 버튼 초기 상태: 준비 중 (이벤트 오면 활성화) */
  if(installBtn){installBtn.disabled=true;installBtn.textContent='준비 중...';}
  if(instStatus)instStatus.textContent='설치 버튼이 활성화될 때까지 잠시 기다리세요.';

  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    deferredInstall=e;
    /* 버튼 즉시 활성화 */
    if(installBtn){
      installBtn.disabled=false;
      installBtn.textContent='📲 설치하기';
      installBtn.style.cssText='background:#0071e3;color:#fff;border:none;border-radius:20px;padding:10px 22px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:transform .1s;';
    }
    if(instStatus)instStatus.textContent='버튼을 눌러 홈 화면에 설치하세요!';
  });

  /* ── 설치 버튼 클릭 → 브라우저 설치 다이얼로그 즉시 호출 ── */
  if(installBtn)installBtn.addEventListener('click',function(){
    if(!deferredInstall){
      if(instStatus)instStatus.textContent='잠시 후 다시 시도해주세요.';
      return;
    }
    deferredInstall.prompt(); /* ← 이 한 줄이 설치 창을 엶 */
    deferredInstall.userChoice.then(function(r){
      deferredInstall=null;
      if(r.outcome==='accepted'){
        toast('앱이 설치됐습니다! 🎉');
        setInstalled();
      } else {
        if(instStatus)instStatus.textContent='설치를 취소했습니다. 언제든 다시 누르세요.';
        /* 취소 후 재설치 가능하도록 이벤트 다시 대기 */
        window.addEventListener('beforeinstallprompt',function(e2){
          e2.preventDefault(); deferredInstall=e2;
        },{once:true});
      }
    });
  });

  /* ── 설치 완료 이벤트 ── */
  window.addEventListener('appinstalled',function(){
    toast('앱 설치 완료! 🎉');
    setInstalled();
  });
}
function setInstalled(){
  var c=qs('#pwaCard'),b=qs('#instDone'),s=qs('#instStatus');
  if(c)c.style.display='none';if(b)b.classList.add('on');if(s)s.textContent='홈 화면에서 앱을 실행하세요.';
}

/* ── 폭죽 ── */
function fireConf(){
  var cv=qs('#confcv');if(!cv)return;
  cv.style.display='block';cv.width=window.innerWidth;cv.height=window.innerHeight;
  var ctx=cv.getContext('2d'),cols=['#f9a8c9','#7ec8e3','#90e0af','#ffd580','#b5a0f7','#e74c3c'],ps=[];
  for(var i=0;i<90;i++)ps.push({x:Math.random()*cv.width,y:cv.height*.4,vx:(Math.random()-.5)*10,vy:-(Math.random()*10+4),r:Math.random()*4+2,c:cols[i%cols.length],rot:Math.random()*360,rv:(Math.random()-.5)*12,life:1});
  var raf;(function anim(){ctx.clearRect(0,0,cv.width,cv.height);var alive=false;
    ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=.3;p.rot+=p.rv;p.life-=.02;if(p.life>0){alive=true;ctx.save();ctx.globalAlpha=p.life;ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);ctx.restore();}});
    if(alive)raf=requestAnimationFrame(anim);else{cv.style.display='none';cancelAnimationFrame(raf);}
  })();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
