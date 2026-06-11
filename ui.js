// ===== RETRO CRICKET — screens, hub, modals =====

let TS_KEEP=false; // team-select in "fired / new job" mode
let CURM=null;     // current media event

// ---- generic modal / toast
function showModal(html,buttons){
  document.getElementById("modal-root").innerHTML=
    '<div class="modal-bg"><div class="modal">'+html+
    '<div>'+(buttons||[]).map(b=>'<button class="btn" onclick="'+b[1]+'">'+b[0]+'</button>').join("")+
    '</div></div></div>';
}
function closeModal(){document.getElementById("modal-root").innerHTML="";}
function showToast(t){
  const el=document.getElementById("toast");
  el.textContent=t;el.style.display="block";
  clearTimeout(el._t);el._t=setTimeout(()=>el.style.display="none",1900);
}

// ---- title & team select
function renderTitle(hasSave){
  document.getElementById("app").innerHTML=
    '<div class="logo"><h1>RETRO<br>CRICKET</h1><div class="sub">★ IPL EDITION ★</div></div>'+
    '<div class="center">'+
    (hasSave?'<button class="btn primary" onclick="ui_continue()">CONTINUE CAREER</button>':"")+
    '<button class="btn primary" onclick="ui_new()">NEW CAREER</button>'+
    '<p class="dim" style="margin-top:26px" >10 REAL TEAMS • 130+ REAL PLAYERS • COACHES • MEDIA • TROPHIES</p>'+
    '<p class="dim blink" style="margin-top:14px">INSERT COIN</p></div>';
}
function ui_new(){sfx("ui");TS_KEEP=false;renderTeamSelect();}
function ui_continue(){sfx("ui");goHub(G.curTab||"SQUAD");}
function renderTeamSelect(){
  const cards=TEAMS.map(t=>{
    const r=teamRating(SQUADS[t.id]);
    return '<div class="tcard" style="--tc:'+t.c1+'" onclick="ui_pick(\''+t.id+'\')">'+
      '<div class="code">'+t.id+'</div><div class="nm">'+esc(t.name)+'</div>'+
      '<div class="ac sm">'+sstr(r)+'</div></div>';
  }).join("");
  document.getElementById("app").innerHTML=
    '<h3 style="margin:14px 0">'+(TS_KEEP?"CHOOSE YOUR NEXT JOB":"CHOOSE YOUR FRANCHISE")+'</h3>'+
    '<div class="grid">'+cards+'</div>'+
    (TS_KEEP?"":'<p class="dim sm" style="margin-top:10px">Tip: weaker squads earn the owner\'s patience slowly — pick a giant for an easier start.</p>');
}
function ui_pick(tid){
  sfx("ui");
  const sq=SQUADS[tid],meta=TEAMS.find(t=>t.id===tid);
  const top=[...sq].sort((a,b)=>Math.max(b[2],b[3])-Math.max(a[2],a[3])).slice(0,5)
    .map(r=>"<tr><td>"+esc(r[0])+"</td><td>"+r[1]+"</td><td>"+sstr(Math.max(r[2],r[3]))+"</td></tr>").join("");
  showModal('<h3>'+esc(meta.name)+'</h3><table>'+top+'</table>'+
    '<p class="sm dim" style="margin-top:8px">Squad rating: '+sstr(teamRating(sq))+'</p>',
    [["TAKE THE JOB","ui_confirmTeam('"+tid+"')"],["BACK","closeModal()"]]);
}
function ui_confirmTeam(tid){
  closeModal();sfx("win");
  if(TS_KEEP&&G)transferTeam(tid);else initGame(tid);
  goHub("SQUAD");
}

// ---- hub
function goHub(tab){
  if(!G){renderTitle(false);return;}
  G.curTab=tab||G.curTab||"SQUAD";
  if(G.po&&!G.po.champ&&!G.off)advancePO();
  renderHub();
  processQueue();
}
function playLabel(){
  if(G.off)return "START SEASON "+(G.season+1);
  if(G.po){
    const slot=G.po.slots[G.po.idx];
    if(!slot||G.po.champ)return null;
    const opp=slot.a===G.my?slot.b:slot.a;
    return "PLAY "+slot.k+" • vs "+opp;
  }
  if(G.round>=9)return null;
  const pr=userPair();const opp=pr[0]===G.my?pr[1]:pr[0];
  return "MATCH "+(G.round+1)+"/9 • vs "+opp;
}
function ui_play(){
  sfx("ui");
  if(G.off){startNextSeason();goHub("SQUAD");return;}
  if(G.po){
    const slot=G.po.slots[G.po.idx];
    if(slot&&(slot.a===G.my||slot.b===G.my)){startMatch(slot.a===G.my?slot.b:slot.a,slot.k);return;}
    goHub();return;
  }
  const pr=userPair();
  startMatch(pr[0]===G.my?pr[1]:pr[0],"league");
}
function barCls(v){return v<30?"bad":(v<55?"warn":"");}
function renderHub(){
  const t=myTeam();
  const used=capUsed(t);
  const lbl=playLabel();
  const tabs=["SQUAD","LINEUP","FACILITIES","STAFF","OFFICE","TABLE","STATS","NEWS"];
  document.getElementById("app").innerHTML=
    '<div class="hdr" style="--c1:'+t.c1+'">'+
      '<div class="top"><h2>'+esc(t.name)+'</h2>'+
      '<span class="sm">SEASON '+G.season+(G.off?" • OFFSEASON":(G.po?" • PLAYOFFS":" • LEAGUE"))+'</span></div>'+
      '<div class="meters">'+
        '<div>CREDITS<br><span class="stat-big">'+G.credits+' CC</span></div>'+
        '<div>SALARY CAP<br><span class="'+(used>CAP?"red":"ac")+'">₹'+used+'cr / ₹'+CAP+'cr</span></div>'+
        '<div>OWNER TRUST ('+G.trust+')<div class="bar"><i class="'+barCls(G.trust)+'" style="width:'+G.trust+'%"></i></div></div>'+
        '<div>FAN SUPPORT ('+G.fans+')<div class="bar"><i class="'+barCls(G.fans)+'" style="width:'+G.fans+'%"></i></div></div>'+
      '</div>'+
      '<div style="margin-top:6px"><button class="btn mini" onclick="ui_settings()">⚙ OPTIONS</button></div>'+
    '</div>'+
    '<div class="tabs">'+tabs.map(x=>'<div class="tab '+(x===G.curTab?"on":"")+'" onclick="goHub(\''+x+'\')">'+x+'</div>').join("")+'</div>'+
    '<div id="hub-content">'+hubContent(G.curTab)+'</div>'+
    (lbl?'<button class="btn primary" onclick="ui_play()">▶ '+lbl+'</button>':"");
}
function hubContent(tab){
  switch(tab){
    case "SQUAD":return tabSquad();
    case "LINEUP":return tabLineup();
    case "FACILITIES":return tabFac();
    case "STAFF":return tabStaff();
    case "OFFICE":return tabOffice();
    case "TABLE":return tabTable();
    case "STATS":return tabStats();
    case "NEWS":return tabNews();
  }
  return "";
}
function formArrow(p){return p.form>0.4?"<span class='grn'>▲</span>":(p.form<-0.4?"<span class='red'>▼</span>":"<span class='dim'>—</span>");}
function pBadges(p){return (p.inj>0?' <span class="red sm">INJ'+p.inj+'</span>':"")+(p.exp?' <span class="ac sm">EXP</span>':"");}

function tabSquad(){
  const t=myTeam();
  const rows=[...t.players].sort((a,b)=>ovr(b)-ovr(a)).map(p=>
    '<tr class="click" onclick="ui_player('+p.id+')"><td>'+esc(p.name)+pBadges(p)+'</td><td>'+p.role+'</td>'+
    '<td>'+sstr(p.bat)+'</td><td>'+sstr(p.bowl)+'</td><td>'+p.age+'</td><td>'+formArrow(p)+'</td>'+
    '<td class="r">₹'+p.sal+'cr/'+Math.max(p.yrs,0)+'y</td></tr>').join("");
  return '<div class="panel"><table><tr><th>PLAYER</th><th>ROLE</th><th>BAT</th><th>BOWL</th><th>AGE</th><th>FORM</th><th class="r">DEAL</th></tr>'+rows+'</table></div>';
}
function tabLineup(){
  const t=myTeam();
  const xi=G.lineup.map(id=>t.players.find(p=>p.id===id)).filter(Boolean);
  const bench=t.players.filter(p=>!G.lineup.includes(p.id));
  const row=(p,i)=>'<tr class="click '+(G.sel===p.id?"sel":"")+'" onclick="ui_slot('+p.id+')"><td>'+(i!=null?(i+1)+".":"")+'</td>'+
    '<td>'+esc(shortName(p.name))+pBadges(p)+'</td><td>'+p.role+'</td><td>'+sstr(Math.max(p.bat,p.bowl))+'</td></tr>';
  return '<div class="panel"><p class="sm dim">Click two players to swap batting order or bring in from the bench. Top of the order faces most balls.</p>'+
    '<table>'+xi.map((p,i)=>row(p,i)).join("")+'</table>'+
    '<h3 style="margin-top:10px">BENCH</h3><table>'+(bench.map(p=>row(p,null)).join("")||"<tr><td class='dim'>empty</td></tr>")+'</table>'+
    '<button class="btn mini" style="margin-top:8px" onclick="ui_autoXI()">AUTO-PICK BEST XI</button></div>';
}
function ui_slot(pid){
  pid=+pid;
  if(G.sel==null){G.sel=pid;}
  else if(G.sel===pid){G.sel=null;}
  else{
    const li=G.lineup.indexOf(G.sel),lj=G.lineup.indexOf(pid);
    if(li>=0&&lj>=0){G.lineup[li]=pid;G.lineup[lj]=G.sel;}
    else if(li>=0)G.lineup[li]=pid;
    else if(lj>=0)G.lineup[lj]=G.sel;
    G.sel=null;sfx("ui");save();
  }
  goHub("LINEUP");
}
function ui_autoXI(){G.lineup=autoXI(myTeam()).map(p=>p.id);G.sel=null;sfx("ui");save();goHub("LINEUP");}

const FAC_INFO={
  train:["TRAINING GROUND","Players develop skills faster after matches."],
  physio:["PHYSIO ROOM","Fewer injuries, faster recovery."],
  academy:["YOUTH ACADEMY","Better academy prospects every offseason."],
};
function tabFac(){
  return Object.keys(FAC_INFO).map(k=>{
    const lvl=G.fac[k],cost=lvl*25;
    return '<div class="fcard"><b>'+FAC_INFO[k][0]+'</b> <span class="pips">'+"●".repeat(lvl)+"○".repeat(5-lvl)+'</span>'+
    '<p class="sm dim">'+FAC_INFO[k][1]+'</p>'+
    (lvl<5?'<button class="btn mini" onclick="ui_fac(\''+k+'\')">UPGRADE — '+cost+' CC</button>':'<span class="grn sm">MAXED OUT</span>')+
    '</div>';
  }).join("");
}
function ui_fac(k){
  const cost=G.fac[k]*25;
  if(G.credits<cost){showToast("Not enough credits");return;}
  G.credits-=cost;G.fac[k]++;sfx("win");save();goHub("FACILITIES");
}
const COACH_INFO={
  bat:["BATTING COACH","Boosts your batters in every innings."],
  bowl:["BOWLING COACH","Sharpens your attack when defending."],
  fld:["FIELDING COACH","Tighter fielding, more chances taken."],
};
function tabStaff(){
  return Object.keys(COACH_INFO).map(k=>{
    const lvl=G.coach[k],cost=lvl*12;
    return '<div class="fcard"><b>'+COACH_INFO[k][0]+'</b> <span class="pips">'+"★".repeat(lvl)+"☆".repeat(5-lvl)+'</span>'+
    '<p class="sm dim">'+COACH_INFO[k][1]+'</p>'+
    (lvl<5?'<button class="btn mini" onclick="ui_coach(\''+k+'\')">PROMOTE — '+cost+' CC</button>':'<span class="grn sm">WORLD CLASS</span>')+
    '</div>';
  }).join("");
}
function ui_coach(k){
  const cost=G.coach[k]*12;
  if(G.credits<cost){showToast("Not enough credits");return;}
  G.credits-=cost;G.coach[k]++;sfx("win");save();goHub("STAFF");
}

function tabOffice(){
  const t=myTeam();
  const used=capUsed(t);
  let h='<div class="panel"><b>FRONT OFFICE</b><p class="sm">Cap space: <span class="'+(used>CAP?"red":"grn")+'">₹'+(CAP-used)+'cr</span> • Squad: '+t.players.length+' players</p></div>';
  const exp=t.players.filter(p=>p.exp);
  if(exp.length){
    h+='<div class="panel"><b class="ac">EXPIRING CONTRACTS</b><table>'+exp.map(p=>
      '<tr><td>'+esc(p.name)+'</td><td>'+sstr(ovr(p))+'</td><td class="r">'+
      '<button class="btn mini" onclick="ui_resign('+p.id+')">RE-SIGN ₹'+Math.max(1,Math.round(p.sal*1.2))+'cr</button> '+
      '<button class="btn mini danger" onclick="ui_releaseExp('+p.id+')">LET GO</button></td></tr>').join("")+'</table></div>';
  }
  if(G.off&&G.prospects.length){
    h+='<div class="panel"><b class="ac">ACADEMY PROSPECTS</b><table>'+G.prospects.map((p,i)=>
      '<tr><td>'+esc(p.name)+'</td><td>'+p.role+'</td><td>'+sstr(ovr(p))+'</td><td>'+p.age+'y</td><td class="r">'+
      '<button class="btn mini" onclick="ui_signProspect('+i+')">SIGN — 5 CC</button></td></tr>').join("")+'</table></div>';
  }
  const fa=[...G.fa].sort((a,b)=>ovr(b)-ovr(a)).slice(0,20);
  h+='<div class="panel"><b>FREE AGENTS</b><p class="sm dim">Signing fee in credits, salary hits your cap.</p><table>'+
    '<tr><th>PLAYER</th><th>ROLE</th><th>SKILL</th><th>AGE</th><th class="r"></th></tr>'+
    fa.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+p.role+'</td><td>'+sstr(ovr(p))+'</td><td>'+p.age+'</td>'+
    '<td class="r"><button class="btn mini" onclick="ui_signFA('+p.id+')">'+Math.ceil(p.sal/2)+' CC + ₹'+p.sal+'cr</button></td></tr>').join("")+
    '</table></div>';
  return h;
}
function ui_signFA(pid){
  const p=G.fa.find(x=>x.id===pid);if(!p)return;
  const fee=Math.ceil(p.sal/2);
  if(G.credits<fee){showToast("Not enough credits");return;}
  if(capUsed(myTeam())+p.sal>CAP){showToast("Over the salary cap");return;}
  G.credits-=fee;G.fa.splice(G.fa.indexOf(p),1);
  p.tid=G.my;p.yrs=2;p.exp=0;myTeam().players.push(p);
  news("Signed "+p.name+" for ₹"+p.sal+"cr!");
  sfx("win");save();goHub("OFFICE");
}
function ui_signProspect(i){
  const p=G.prospects[i];if(!p)return;
  if(G.credits<5){showToast("Not enough credits");return;}
  if(capUsed(myTeam())+p.sal>CAP){showToast("Over the salary cap");return;}
  G.credits-=5;G.prospects.splice(i,1);
  p.tid=G.my;myTeam().players.push(p);
  news("Academy product "+p.name+" signs his first deal!");
  sfx("win");save();goHub("OFFICE");
}
function ui_resign(pid){
  const p=myTeam().players.find(x=>x.id===pid);if(!p)return;
  const ns=Math.max(1,Math.round(p.sal*1.2));
  if(capUsed(myTeam())-p.sal+ns>CAP){showToast("Over the salary cap");return;}
  p.sal=ns;p.yrs=2;p.exp=0;
  news(p.name+" re-signs for ₹"+ns+"cr.");
  sfx("win");save();goHub("OFFICE");
}
function ui_releaseExp(pid){
  const t=myTeam();const p=t.players.find(x=>x.id===pid);if(!p)return;
  t.players.splice(t.players.indexOf(p),1);
  G.lineup=G.lineup.filter(id=>id!==pid);
  p.tid=null;p.exp=0;G.fa.push(p);
  news(p.name+" released into free agency.");
  save();goHub("OFFICE");
}

function tabTable(){
  let h='<div class="panel"><table><tr><th>#</th><th>TEAM</th><th>P</th><th>W</th><th>L</th><th>PTS</th><th class="r">NRR</th></tr>'+
    standings().map((t,i)=>'<tr class="'+(t.id===G.my?"me":"")+'"><td>'+(i+1)+'</td><td>'+t.id+'</td><td>'+t.p+'</td><td>'+t.w+'</td><td>'+(t.p-t.w)+'</td><td><b>'+t.pts+'</b></td><td class="r">'+(nrr(t)>=0?"+":"")+nrr(t).toFixed(2)+'</td></tr>').join("")+
    '</table></div>';
  if(G.po){
    const s=G.po.slots;
    h+='<div class="panel"><b class="ac">PLAYOFFS</b><table>'+
      s.map((sl,i)=>'<tr><td>'+sl.k+'</td><td>'+(sl.a||"?")+' v '+(sl.b||"?")+'</td><td class="r">'+
      (i===0&&G.po.q1w?G.po.q1w+" ✔":i===1&&G.po.elw?G.po.elw+" ✔":i===2&&G.po.q2w?G.po.q2w+" ✔":i===3&&G.po.champ?G.po.champ+" 🏆":"")+'</td></tr>').join("")+
      '</table></div>';
  }
  return h;
}
function tabStats(){
  const all=[];G.teams.forEach(t=>t.players.forEach(p=>all.push([p,t.id])));
  const orange=[...all].sort((a,b)=>b[0].s.runs-a[0].s.runs).slice(0,5);
  const purple=[...all].sort((a,b)=>b[0].s.wkts-a[0].s.wkts).slice(0,5);
  const mine=myTeam().players.filter(p=>p.s.m>0);
  const batRows=[...mine].sort((a,b)=>b.s.runs-a.s.runs).slice(0,8).map(p=>
    '<tr><td>'+esc(shortName(p.name))+'</td><td>'+p.s.runs+'</td><td>'+p.s.hs+'</td><td>'+
    (p.s.balls?Math.round(p.s.runs/p.s.balls*100):0)+'</td></tr>').join("");
  const bwlRows=[...mine].filter(p=>p.s.bb>0).sort((a,b)=>b.s.wkts-a.s.wkts).slice(0,8).map(p=>
    '<tr><td>'+esc(shortName(p.name))+'</td><td>'+p.s.wkts+'</td><td>'+
    (p.s.bb?(p.s.conc/(p.s.bb/6)).toFixed(1):"-")+'</td></tr>').join("");
  return '<div class="panel"><b style="color:#f08018">🟠 ORANGE CAP RACE</b><table>'+
    orange.map(([p,tid],i)=>'<tr><td>'+(i+1)+'.</td><td>'+esc(shortName(p.name))+' ('+tid+')</td><td class="r">'+p.s.runs+'</td></tr>').join("")+'</table></div>'+
    '<div class="panel"><b style="color:#b06ee7">🟣 PURPLE CAP RACE</b><table>'+
    purple.map(([p,tid],i)=>'<tr><td>'+(i+1)+'.</td><td>'+esc(shortName(p.name))+' ('+tid+')</td><td class="r">'+p.s.wkts+'</td></tr>').join("")+'</table></div>'+
    '<div class="panel"><b>MY SQUAD — SEASON</b>'+
    '<table><tr><th>BATTER</th><th>RUNS</th><th>HS</th><th>SR</th></tr>'+(batRows||"")+'</table>'+
    '<table style="margin-top:8px"><tr><th>BOWLER</th><th>WKTS</th><th>ECON</th></tr>'+(bwlRows||"")+'</table></div>'+
    '<div class="panel"><b class="ac">🏆 TROPHY CABINET</b>'+
    (G.history.length?G.history.map(x=>'<div class="newsline">'+esc(x)+'</div>').join(""):'<p class="sm dim">Nothing yet. Win something.</p>')+'</div>';
}
function tabNews(){
  return '<div class="panel">'+(G.news.length?G.news.map(n=>'<div class="newsline">'+esc(n)+'</div>').join(""):'<p class="dim">Quiet out there.</p>')+'</div>';
}

// ---- player card
function ui_player(pid){
  const p=findP(pid);if(!p)return;
  const mine=p.tid===G.my;
  const avg=p.s.outs?(p.s.runs/p.s.outs).toFixed(1):p.s.runs;
  const cavg=p.c.outs?(p.c.runs/p.c.outs).toFixed(1):p.c.runs;
  showModal('<h3>'+esc(p.name)+'</h3>'+
    '<p class="sm">'+p.role+' • AGE '+p.age+' • '+(p.spin?"SPIN":"PACE/BAT")+pBadges(p)+'</p>'+
    '<p>BAT '+sstr(p.bat)+'<br>BOWL '+sstr(p.bowl)+'</p>'+
    '<p class="sm">MORALE <span class="'+(p.morale<55?"red":"grn")+'">'+Math.round(p.morale)+'%</span> • FORM '+formArrow(p)+'</p>'+
    '<p class="sm dim">CONTRACT ₹'+p.sal+'cr × '+Math.max(p.yrs,0)+'yr</p>'+
    '<p class="sm">SEASON: '+p.s.runs+' runs / '+p.s.wkts+' wkts (avg '+avg+')<br>'+
    'CAREER: '+p.c.runs+' runs / '+p.c.wkts+' wkts (avg '+cavg+', HS '+Math.max(p.c.hs,p.s.hs)+')</p>',
    mine?[["EXTEND +2YR","ui_extend("+p.id+")"],["RELEASE","ui_release("+p.id+")"],["CLOSE","closeModal()"]]
        :[["CLOSE","closeModal()"]]);
}
function ui_extend(pid){
  const p=myTeam().players.find(x=>x.id===pid);if(!p)return;
  const ns=Math.max(1,Math.round(p.sal*1.2));
  if(capUsed(myTeam())-p.sal+ns>CAP){showToast("Over the salary cap");return;}
  p.sal=ns;p.yrs+=2;p.morale=CL(p.morale+6,30,100);
  news(p.name+" extends until "+(2026+G.season+p.yrs)+".");
  sfx("win");save();closeModal();goHub(G.curTab);
}
function ui_release(pid){
  const t=myTeam();const p=t.players.find(x=>x.id===pid);if(!p)return;
  if(t.players.length<=12){showToast("Squad too small to release");return;}
  t.players.splice(t.players.indexOf(p),1);
  G.lineup=G.lineup.filter(id=>id!==pid);
  p.tid=null;G.fa.push(p);
  news(p.name+" released. Dressing room shaken.");
  t.players.forEach(x=>x.morale=CL(x.morale-2,30,100));
  save();closeModal();goHub(G.curTab);
}

// ---- queue: media / awards / champ / fired
function processQueue(){
  if(!G.q||!G.q.length)return;
  const m=G.q.shift();save();
  if(m.k==="media"){
    CURM=m.d;
    showModal('<h3>PRESS CONFERENCE</h3><p>"'+esc(m.d.q)+'"</p>',
      m.d.o.map((o,i)=>[esc(o.t),"ui_media("+i+")"]));
  }else if(m.k==="awards"){
    const d=m.d;
    showModal('<h3>END OF SEASON AWARDS</h3>'+
      '<p>🟠 ORANGE CAP: '+(d.or?esc(d.or.n)+" ("+d.or.t+") — "+d.or.v+" runs":"—")+'</p>'+
      '<p>🟣 PURPLE CAP: '+(d.pu?esc(d.pu.n)+" ("+d.pu.t+") — "+d.pu.v+" wkts":"—")+'</p>'+
      '<p>⭐ YOUR MVP: '+(d.mv?esc(d.mv.n):"—")+'</p>',
      [["TO THE OFFSEASON","ui_qNext()"]]);
  }else if(m.k==="champ"){
    showModal('<div class="center"><h3>🏆 CHAMPIONS 🏆</h3>'+
      '<p>'+esc(team(m.d.tid).name)+'</p>'+
      '<p class="grn">+100 CC • The city is yours, coach.</p></div>',
      [["LIFT THE TROPHY","ui_qNext()"]]);
  }else if(m.k==="fired"){
    showModal('<h3 class="red">SACKED!</h3><p class="sm">Missed playoffs, owner trust gone. Security wants your car park pass back.</p><p class="sm dim">Your credits travel with you.</p>',
      [["FIND A NEW JOB","ui_fired()"]]);
  }
}
function ui_qNext(){closeModal();sfx("ui");goHub(G.curTab);}
function ui_fired(){closeModal();TS_KEEP=true;renderTeamSelect();}
function ui_media(i){
  const o=CURM.o[i],fx=o.fx||{};
  const star=CURM.star?findP(CURM.star):null;
  const bits=[];
  if(fx.fans){G.fans=CL(G.fans+fx.fans,0,100);bits.push("FANS "+(fx.fans>0?"+":"")+fx.fans);}
  if(fx.trust){G.trust=CL(G.trust+fx.trust,0,100);bits.push("TRUST "+(fx.trust>0?"+":"")+fx.trust);}
  if(fx.tm){myTeam().players.forEach(p=>p.morale=CL(p.morale+fx.tm,30,100));bits.push("TEAM MORALE "+(fx.tm>0?"+":"")+fx.tm);}
  if(fx.star&&star){star.morale=CL(star.morale+fx.star,30,100);bits.push(shortName(star.name).toUpperCase()+" "+(fx.star>0?"+":"")+fx.star);}
  closeModal();sfx("ui");save();
  showToast(bits.join(" • ")||"No reaction");
  goHub(G.curTab);
}

// ---- settings
function ui_settings(){
  showModal('<h3>OPTIONS</h3>'+
    '<p class="sm">OVERS PER INNINGS (applies next match)</p>'+
    [5,10,20].map(n=>'<button class="btn mini" style="'+(G.overs===n?"background:var(--ac);color:#000":"")+'" onclick="ui_setOvers('+n+')">'+n+' OV</button>').join(" ")+
    '<p class="sm" style="margin-top:12px">SOUND: <button class="btn mini" onclick="ui_mute()">'+(MUTE?"OFF — TURN ON":"ON — TURN OFF")+'</button></p>'+
    '<p class="sm" style="margin-top:12px"><button class="btn mini danger" onclick="ui_wipe()">DELETE CAREER</button></p>',
    [["CLOSE","closeModal()"]]);
}
function ui_setOvers(n){G.overs=n;save();sfx("ui");ui_settings();}
function ui_mute(){MUTE=!MUTE;localStorage.setItem("rc_mute",MUTE?"1":"0");ui_settings();}
function ui_wipe(){
  showModal('<h3 class="red">DELETE CAREER?</h3><p class="sm">Everything goes. No takesies-backsies.</p>',
    [["DELETE","ui_wipe2()"],["KEEP PLAYING","closeModal()"]]);
}
function ui_wipe2(){wipeSave();closeModal();renderTitle(false);}

// ---- boot
window.addEventListener("load",()=>{renderTitle(load());});
