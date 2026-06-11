// ===== RETRO CRICKET — core engine: state, simulation, season, economy =====

const CAP = 110; // salary cap in crores
let G = null;    // the whole game state (JSON-serializable)
let PID = 1;
let RESUME_M = null; // mid-match snapshot loaded from save, consumed by resumeMatch()

// ---- utils
const R  = (n=1)=>Math.random()*n;
const RI = (a,b)=>a+Math.floor(Math.random()*(b-a+1));
const CH = a=>a[Math.floor(Math.random()*a.length)];
const CL = (v,a,b)=>Math.max(a,Math.min(b,v));
function shortName(n){const p=n.split(" ");return p.length>1?p[0][0]+". "+p.slice(1).join(" "):n;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

// ---- audio (tiny chiptune bleeps)
let AC = null;
let MUTE = localStorage.getItem("rc_mute")==="1";
const SFX = {
  ui:   [[880,.05]],
  hit:  [[620,.06]],
  four: [[523,.07],[659,.07],[784,.12]],
  six:  [[523,.06],[659,.06],[784,.06],[1047,.16]],
  wkt:  [[440,.09],[330,.09],[210,.2]],
  win:  [[523,.1],[659,.1],[784,.1],[1047,.25]],
  loss: [[330,.12],[262,.12],[196,.25]],
};
function sfx(name){
  if(MUTE) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    let t = AC.currentTime;
    for(const [f,d] of SFX[name]||[]){
      const o=AC.createOscillator(), g=AC.createGain();
      o.type="square"; o.frequency.value=f;
      g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+d);
      t += d*0.9;
    }
  }catch(e){}
}

// ---- players
function blankS(){return {m:0,runs:0,balls:0,outs:0,hs:0,wkts:0,conc:0,bb:0};}
function ovr(p){return Math.max(p.bat,p.bowl,(p.bat+p.bowl)/2+1.5);}
function sstr(v){ // skill (1-10) -> star string out of 5
  const s=CL(Math.round(v)/2,0.5,5); const f=Math.floor(s);
  return "★".repeat(f)+(s-f>=0.5?"½":"")+"<i class='dim'>"+"☆".repeat(5-Math.ceil(s))+"</i>";
}
function salOf(p){return Math.max(1,Math.round((ovr(p)-4)*1.6));}
function mkP(row,tid){
  const [name,role,bat,bowl,age]=row;
  const p={id:PID++,name,role,tid,bat,bowl,fld:RI(4,9),age,
    spin:SPINNERS.has(name),form:0,morale:70,inj:0,yrs:RI(1,3),exp:0,sal:0,
    s:blankS(),c:blankS()};
  p.sal=salOf(p);
  return p;
}
function mkYouth(){
  const role=CH(["BAT","BAT","BWL","BWL","AR","WK"]);
  const base=CL(3+(G?G.fac.academy:1)*0.6+R(2),3,8);
  const p={id:PID++,name:CH(YOUTH_FIRST)+" "+CH(YOUTH_LAST),role,tid:null,
    bat:role==="BWL"?CL(base-3,1,5):base, bowl:(role==="BWL"||role==="AR")?base:1,
    fld:RI(4,8),age:RI(18,21),spin:R()<0.4,form:0,morale:70,inj:0,yrs:3,exp:0,sal:0,
    s:blankS(),c:blankS()};
  if(p.role==="AR")p.bat=CL(base-0.5,1,8);
  p.sal=Math.max(1,Math.round((ovr(p)-4)*1.2));
  return p;
}
function effBat(p){return CL(p.bat+p.form+(p.morale-70)/40,1,11);}
function effBowl(p){return CL(p.bowl+p.form*0.7+(p.morale-70)/50,1,11);}

// ---- lookups
function team(tid){return G.teams.find(t=>t.id===tid);}
function myTeam(){return team(G.my);}
function findP(pid){
  for(const t of G.teams){const p=t.players.find(p=>p.id===pid);if(p)return p;}
  return G.fa.find(p=>p.id===pid);
}
function capUsed(t){return t.players.reduce((s,p)=>s+p.sal,0);}
function teamRating(squad){
  const top=squad.map(r=>Array.isArray(r)?Math.max(r[2],r[3],(r[2]+r[3])/2+1.5):ovr(r))
    .sort((a,b)=>b-a).slice(0,11);
  return top.reduce((s,v)=>s+v,0)/top.length;
}

// ---- XIs
function autoXI(t){
  let av=t.players.filter(p=>p.inj===0);
  if(av.length<11) av=t.players.slice();
  const sorted=[...av].sort((a,b)=>ovr(b)-ovr(a));
  let xi=sorted.slice(0,11);
  const need=()=>5-xi.filter(p=>p.bowl>=6).length;
  if(need()>0){
    const pool=av.filter(p=>!xi.includes(p)&&p.bowl>=6).sort((a,b)=>b.bowl-a.bowl);
    while(need()>0&&pool.length){
      const inn=pool.shift();
      const out=[...xi].filter(p=>p.bowl<6).sort((a,b)=>ovr(a)-ovr(b))[0];
      if(!out)break;
      xi[xi.indexOf(out)]=inn;
    }
  }
  if(!xi.some(p=>p.role==="WK")){
    const wk=av.filter(p=>p.role==="WK"&&!xi.includes(p)).sort((a,b)=>ovr(b)-ovr(a))[0];
    if(wk){const out=[...xi].sort((a,b)=>ovr(a)-ovr(b))[0];xi[xi.indexOf(out)]=wk;}
  }
  xi.sort((a,b)=>b.bat-a.bat);
  return xi;
}
function userXI(){
  const t=myTeam();
  let xi=G.lineup.map(id=>t.players.find(p=>p.id===id)).filter(p=>p&&p.inj===0);
  if(xi.length<11){
    const extra=t.players.filter(p=>p.inj===0&&!xi.includes(p)).sort((a,b)=>ovr(b)-ovr(a));
    while(xi.length<11&&extra.length)xi.push(extra.shift());
  }
  if(xi.length<11){
    const extra=t.players.filter(p=>!xi.includes(p)).sort((a,b)=>ovr(b)-ovr(a));
    while(xi.length<11&&extra.length)xi.push(extra.shift());
  }
  return xi.slice(0,11);
}
function bowlersOf(xi){
  let bs=xi.filter(p=>p.bowl>=6).sort((a,b)=>effBowl(b)-effBowl(a));
  if(bs.length<5){
    const more=xi.filter(p=>!bs.includes(p)).sort((a,b)=>b.bowl-a.bowl);
    while(bs.length<5&&more.length)bs.push(more.shift());
  }
  return bs.slice(0,5);
}
function batBonus(t){return t.id===G.my?G.coach.bat*0.25:0.5;}
function bowlBonus(t){return t.id===G.my?G.coach.bowl*0.25+(G.coach.fld-1)*0.08:0.5;}

// ---- ball-by-ball simulation
function simBall(be,bo,aggr){
  const d=(be-bo)/10;
  const pW =CL(0.075-d*0.05,0.03,0.14)*(aggr>1.1?1.3:1);
  const p6 =CL(0.06+d*0.06,0.01,0.2)*aggr;
  const p4 =CL(0.10+d*0.07,0.03,0.24)*aggr;
  const pwd=0.03,p3=0.015,p2=0.085,p1=0.33;
  const r=Math.random();let acc=0;
  for(const [pp,v] of [[pwd,"wd"],[pW,"W"],[p6,6],[p4,4],[p3,3],[p2,2],[p1,1]]){
    acc+=pp; if(r<acc)return v;
  }
  return 0;
}
function simInnings(xi,bws,target,balls,bBat,bBowl){
  const perB=Math.max(1,Math.ceil(G.overs/5));
  let runs=0,w=0,b=0,st=0,ns=1,nx=2;
  const ev=[],innR={};
  while(b<balls&&w<10&&(target==null||runs<target)){
    const over=Math.floor(b/6);
    const bw=bws[Math.floor(over/perB)%bws.length];
    let aggr;
    if(target!=null){const need=target-runs,bl=balls-b;aggr=CL(0.8+(need/(bl/6))*0.06,0.85,1.7);}
    else aggr=over>=G.overs-2?1.25:1;
    const out=simBall(effBat(xi[st])+bBat,effBowl(bw)+bBowl,aggr);
    if(out==="wd"){runs++;bw.s.conc++;ev.push({t:"wide, +1",s:runs,w});continue;}
    b++; bw.s.bb++;
    const bat=xi[st]; bat.s.balls++;
    if(out==="W"){
      w++; bat.s.outs++; bw.s.wkts++;
      ev.push({t:"OUT! "+shortName(bat.name)+" "+(innR[bat.id]||0)+" — b "+shortName(bw.name),s:runs,w,k:1});
      st=nx; nx++;
      if(w>=10)break;
    }else{
      runs+=out; bat.s.runs+=out; innR[bat.id]=(innR[bat.id]||0)+out; bw.s.conc+=out;
      if(out>=4)ev.push({t:shortName(bat.name)+(out===6?" SIX!":" FOUR!"),s:runs,w,b4:1});
      else ev.push({t:out===0?"dot ball":out+" run"+(out>1?"s":""),s:runs,w});
      if(out%2===1){const tmp=st;st=ns;ns=tmp;}
    }
    if(b%6===0&&b<balls){const tmp=st;st=ns;ns=tmp;ev.push({t:"— end of over "+(over+1)+" —",s:runs,w,o:1});}
  }
  for(const pid in innR){const p=xi.find(x=>x.id==pid);if(p&&innR[pid]>p.s.hs)p.s.hs=innR[pid];}
  return {runs,w,balls:b,ev};
}
function simMatch(tA,tB,league){
  const xiA=tA.id===G.my?userXI():autoXI(tA);
  const xiB=tB.id===G.my?userXI():autoXI(tB);
  [...xiA,...xiB].forEach(p=>p.s.m++);
  const balls=G.overs*6;
  const flip=Math.random()<.5;
  const [t1,x1,t2,x2]=flip?[tA,xiA,tB,xiB]:[tB,xiB,tA,xiA];
  const i1=simInnings(x1,bowlersOf(x2),null,balls,batBonus(t1),bowlBonus(t2));
  const i2=simInnings(x2,bowlersOf(x1),i1.runs+1,balls,batBonus(t2),bowlBonus(t1));
  let winner,margin;
  if(i2.runs>i1.runs){winner=t2;margin="by "+(10-i2.w)+" wickets";}
  else if(i2.runs<i1.runs){winner=t1;margin="by "+(i1.runs-i2.runs)+" runs";}
  else {winner=Math.random()<.5?t1:t2;margin="in a Super Over";}
  if(league!==false){
    applyStd(t1,i1.runs,i1.balls,i2.runs,i2.balls,winner===t1);
    applyStd(t2,i2.runs,i2.balls,i1.runs,i1.balls,winner===t2);
  }
  return {t1,t2,i1,i2,winner,margin};
}
function applyStd(t,rf,bf,ra,ba,won){
  t.p++; if(won){t.w++;t.pts+=2;}
  t.rf+=rf;t.bf+=Math.max(bf,1);t.ra+=ra;t.ba+=Math.max(ba,1);
}
function nrr(t){return (t.bf&&t.ba)?(t.rf/(t.bf/6)-t.ra/(t.ba/6)):0;}
function standings(){return [...G.teams].sort((a,b)=>b.pts-a.pts||nrr(b)-nrr(a));}

// ---- fixtures (round robin, circle method)
function makeFixtures(){
  const ids=G.teams.map(t=>t.id);
  const arr=ids.slice(1), rounds=[];
  for(let r=0;r<9;r++){
    const pairs=[[ids[0],arr[0]]];
    for(let i=1;i<5;i++)pairs.push([arr[i],arr[9-i]]);
    rounds.push(pairs);
    arr.push(arr.shift());
  }
  return rounds;
}
function userPair(){return G.fixtures[G.round].find(pr=>pr.includes(G.my));}
function simRoundOthers(){
  for(const pr of G.fixtures[G.round]){
    if(pr.includes(G.my))continue;
    const r=simMatch(team(pr[0]),team(pr[1]),true);
    news(r.winner.id+" beat "+(r.winner===r.t1?r.t2.id:r.t1.id)+" "+r.margin+
      " ("+r.t1.id+" "+r.i1.runs+"/"+r.i1.w+" v "+r.t2.id+" "+r.i2.runs+"/"+r.i2.w+")");
  }
  // light form shuffle for AI players
  for(const t of G.teams){
    if(t.id===G.my)continue;
    t.players.forEach(p=>p.form=CL(p.form+R(0.6)-0.3,-1.5,1.5));
  }
}
function advanceRound(){
  simRoundOthers();
  G.round++;
  if(G.round>=9)setupPlayoffs();
}

// ---- playoffs
function setupPlayoffs(){
  const s=standings().slice(0,4).map(t=>t.id);
  G.po={slots:[
    {k:"QUALIFIER 1",a:s[0],b:s[1]},
    {k:"ELIMINATOR", a:s[2],b:s[3]},
    {k:"QUALIFIER 2",a:null,b:null},
    {k:"FINAL",      a:null,b:null},
  ],idx:0,champ:null,q1w:null,q1l:null,elw:null,q2w:null};
  G.madePO=s.includes(G.my);
  news("PLAYOFFS! Qualified: "+s.join(", "));
  if(!G.madePO){
    G.trust=CL(G.trust-10,0,100);
    news("The owner is furious about missing the playoffs.");
  }
}
function advancePO(){
  const po=G.po;
  if(!po||po.champ)return null;
  while(po.idx<4){
    const slot=po.slots[po.idx];
    if(po.idx===2){slot.a=po.q1l;slot.b=po.elw;}
    if(po.idx===3){slot.a=po.q1w;slot.b=po.q2w;}
    if(slot.a===G.my||slot.b===G.my)return slot;
    const r=simMatch(team(slot.a),team(slot.b),false);
    const loser=r.winner.id===slot.a?slot.b:slot.a;
    news(slot.k+": "+r.winner.id+" beat "+loser+" "+r.margin);
    recordPO(po.idx,r.winner.id,loser);
    po.idx++;
  }
  return null;
}
function recordPO(i,wId,lId){
  const po=G.po;
  if(i===0){po.q1w=wId;po.q1l=lId;}
  else if(i===1){po.elw=wId;}
  else if(i===2){po.q2w=wId;}
  else {po.champ=wId;handleChampion();}
}
function handleChampion(){
  const c=G.po.champ;
  if(c===G.my){
    G.credits+=100;G.trust=CL(G.trust+25,0,100);G.fans=CL(G.fans+15,0,100);
    G.history.push("S"+G.season+": "+team(c).name+" — CHAMPIONS (YOU!)");
    news("CHAMPIONS! "+team(c).name+" win the title! +100 CC");
    G.q.push({k:"champ",d:{tid:c}});
  }else{
    G.history.push("S"+G.season+": "+team(c).name+" — champions");
    news(team(c).name+" are the champions.");
  }
  offseasonStart();
}

// ---- offseason
function offseasonStart(){
  // awards from season stats (before folding into career)
  let or=null,pu=null,mv=null,best=-1;
  for(const t of G.teams)for(const p of t.players){
    if(!or||p.s.runs>or.v)or={n:p.name,v:p.s.runs,t:t.id};
    if(!pu||p.s.wkts>pu.v)pu={n:p.name,v:p.s.wkts,t:t.id};
    if(t.id===G.my){const sc=p.s.runs+22*p.s.wkts;if(sc>best){best=sc;mv={n:p.name,v:sc};}}
  }
  if(or&&or.t===G.my){G.credits+=20;news(or.n+" wins the ORANGE CAP! +20 CC");}
  if(pu&&pu.t===G.my){G.credits+=20;news(pu.n+" wins the PURPLE CAP! +20 CC");}
  G.q.push({k:"awards",d:{or,pu,mv}});

  // fold season stats into career
  for(const t of G.teams)for(const p of t.players)foldStats(p);
  for(const p of G.fa)foldStats(p);

  // aging, growth/decline, retirement
  for(const t of G.teams){
    const keep=[];
    for(const p of t.players){
      p.age++;
      if(p.age<=24&&R()<0.7){if(p.bat>=p.bowl)p.bat=CL(p.bat+0.3,1,10);else p.bowl=CL(p.bowl+0.3,1,10);}
      if(p.age>=33&&R()<0.6){p.bat=CL(p.bat-0.3,1,10);p.bowl=CL(p.bowl-0.3,1,10);}
      if(p.age>=37&&R()<(p.age-36)*0.25){
        if(ovr(p)>=7.5||t.id===G.my)news(p.name+" ("+t.id+") retires from the league. Legend.");
        if(t.id===G.my)G.lineup=G.lineup.filter(id=>id!==p.id);
        continue;
      }
      keep.push(p);
    }
    t.players=keep;
  }
  G.fa=G.fa.filter(p=>{p.age++;return p.age<39;});

  // contracts
  for(const t of G.teams){
    if(t.id===G.my){
      for(const p of t.players){p.yrs--;if(p.yrs<=0)p.exp=1;}
    }else{
      const move=[];
      for(const p of t.players){
        p.yrs--;
        if(p.yrs<=0){if(R()<0.85)p.yrs=RI(1,3);else move.push(p);}
      }
      for(const p of move){t.players.splice(t.players.indexOf(p),1);p.tid=null;G.fa.push(p);news(p.name+" leaves "+t.id+", now a free agent.");}
    }
  }

  // academy prospects
  G.prospects=[mkYouth(),mkYouth()];
  if(G.fac.academy>=4)G.prospects.push(mkYouth());

  // fired?
  if(!G.madePO&&G.trust<25)G.q.push({k:"fired",d:{}});

  G.off=true;
  save();
}
function foldStats(p){
  const s=p.s,c=p.c;
  c.m+=s.m;c.runs+=s.runs;c.balls+=s.balls;c.outs+=s.outs;
  c.wkts+=s.wkts;c.conc+=s.conc;c.bb+=s.bb;
  if(s.hs>c.hs)c.hs=s.hs;
  p.s=blankS();
}
function startNextSeason(){
  const t=myTeam();
  // unresolved expiring contracts walk
  const exp=t.players.filter(p=>p.exp);
  for(const p of exp){p.tid=null;p.exp=0;G.fa.push(p);news(p.name+" left — contract expired.");}
  t.players=t.players.filter(p=>!exp.includes(p));
  // refill thin squads with academy youth
  for(const x of G.teams){
    while(x.players.length<12){const y=mkYouth();y.tid=x.id;x.players.push(y);
      if(x.id===G.my)news("Academy graduate "+y.name+" joins the squad.");}
  }
  for(const x of G.teams){
    x.p=0;x.w=0;x.pts=0;x.rf=0;x.bf=0;x.ra=0;x.ba=0;
    x.players.forEach(p=>{p.inj=0;p.form=0;p.morale=CL(p.morale,60,80);});
  }
  G.season++;G.round=0;G.po=null;G.off=false;G.madePO=false;G.prospects=[];
  G.fixtures=makeFixtures();
  G.lineup=autoXI(t).map(p=>p.id);
  news("Season "+G.season+" begins! The owner expects results.");
  save();
}

// ---- post-match effects for user team
function postMatchUser(won,xi){
  let cc=5+(won?10:0)+Math.round(G.fans/25);
  if(G.po)cc+=won?10:0;
  G.credits+=cc;
  G.trust=CL(G.trust+(won?3:-4),0,100);
  G.fans=CL(G.fans+(won?2:-3),0,100);
  const t=myTeam();
  for(const p of t.players){
    const played=xi.includes(p);
    p.morale=CL(p.morale+(played?(won?4:-1):-2),30,100);
    p.form=CL(p.form+R(1)-0.5,-1.5,1.5);
    if(p.inj>0)p.inj--;
    if(played&&p.inj===0&&R()<0.04-G.fac.physio*0.004){
      p.inj=Math.max(1,RI(1,3)-(G.fac.physio>=4?1:0));
      news(p.name+" injured — out for "+p.inj+" match"+(p.inj>1?"es":"")+".");
    }
    if(p.age<30&&R()<G.fac.train*0.03){
      if(p.bat>=p.bowl)p.bat=CL(p.bat+0.2,1,10);else p.bowl=CL(p.bowl+0.2,1,10);
      if(ovr(p)>=8)news(p.name+" is developing fast in training!");
    }
  }
  if(R()<0.6){
    const ev=CH(MEDIA);
    const star=[...t.players].sort((a,b)=>ovr(b)-ovr(a))[0];
    G.q.push({k:"media",d:{q:ev.q.replace("{STAR}",star?shortName(star.name):"your star"),
      o:ev.o,star:star?star.id:null}});
  }
  save();
  return cc;
}

// ---- news / save / init
function news(t){G.news.unshift("S"+G.season+" • "+t);if(G.news.length>40)G.news.length=40;}
function save(){try{localStorage.setItem("rc_save1",JSON.stringify({G,PID,M:typeof mSnap==="function"?mSnap():null}));}catch(e){}}
function load(){
  try{
    const d=localStorage.getItem("rc_save1");
    if(!d)return false;
    const o=JSON.parse(d);G=o.G;PID=o.PID;RESUME_M=o.M||null;
    return !!(G&&G.teams);
  }catch(e){return false;}
}
function wipeSave(){localStorage.removeItem("rc_save1");G=null;RESUME_M=null;}
function initGame(tid){
  PID=1;RESUME_M=null;
  G={my:tid,season:1,round:0,overs:5,credits:30,fans:50,trust:60,
    off:false,po:null,madePO:false,tut:0,curTab:"SQUAD",sel:null,
    fac:{train:1,physio:1,academy:1},coach:{bat:1,bowl:1,fld:1},
    news:[],history:[],prospects:[],q:[],
    teams:TEAMS.map(t=>({id:t.id,name:t.name,c1:t.c1,c2:t.c2,
      players:SQUADS[t.id].map(r=>mkP(r,t.id)),
      p:0,w:0,pts:0,rf:0,bf:0,ra:0,ba:0})),
    fa:FREE_AGENTS.map(r=>mkP(r,null)),
    lineup:[],fixtures:[]};
  G.fixtures=makeFixtures();
  G.lineup=autoXI(myTeam()).map(p=>p.id);
  news("Welcome to "+myTeam().name+", coach! Owner trust: "+G.trust+"%.");
  save();
}
function transferTeam(tid){
  RESUME_M=null;
  G.my=tid;G.trust=60;G.fans=50;
  G.fac={train:1,physio:1,academy:1};G.coach={bat:1,bowl:1,fld:1};
  G.lineup=autoXI(myTeam()).map(p=>p.id);
  news("New chapter: you take charge of "+myTeam().name+"!");
  save();
}
