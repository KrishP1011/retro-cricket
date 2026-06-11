// ===== RETRO CRICKET — first-person match engine =====
// Batting: batter's-eye view. HOLD, DRAG to aim (block/ground/loft), RELEASE on arrival.
// Bowling: bowler's-eye view. Mouse = pitch target, HOLD = run-up meter, RELEASE at the top.
// Field radar top-right in both views.

let MT=null;
// world coords (for field logic + radar)
const CV={W:240,H:320,BX:120,BY:212,CX:120,CY:154,RX:110,RY:146,BOWLY:98};
// screen
const SC={W:320,H:240,CXX:160,HZ:84,NEAR:216,SPAN:132,NEARHW:45,FARHW:9};
// radar box
const MAP={x:254,y:6,s:0.26};
const SKINS=["#e8b88a","#c68950","#8a5a2b","#6b4423"];
const CROWD_COLS=["#d8c27a","#b06ee7","#6ee7e7","#e76e6e","#7ae77a","#e8e4d0","#f0a050","#7a9ae7"];
const AD_COLS=["#7a1f2b","#1f3a7a","#7a6a1f","#2b7a3a","#5a2b7a","#1f6a7a"];

function startMatch(oppId,stage){
  const my=myTeam(),opp=team(oppId);
  const myXI=userXI(),oppXI=autoXI(opp);
  [...myXI,...oppXI].forEach(p=>p.s.m++);
  MT={stage,my,opp,myXI,oppXI,order:null,inn:0,innings:[],
    snap:snapStats([...myXI,...oppXI]),
    mode:"pre",phase:"pre",aim:-1.9,t0:0,T:700,bw:null,U:null,B:null,
    drag:{on:false,sx:0,sy:0,len:0},lineX:0,drift:0,curve:0,wide:false,markerAt:0,
    fd:[],anim:null,away:null,flash:null,timing:"",lineWarn:"",feed:"",sub:"",
    shotAng:0,lastGap:null,pend:null,decideUntil:0,chase:null,particles:[],
    crowd:genCrowdFP(),stars:genStars(),trail:[],
    shakeUntil:0,cheerUntil:0,swingT0:0,hurtUntil:0,
    raf:0,done:false};
  renderMatchScreen();
  MT.raf=requestAnimationFrame(mLoop);
  if(Math.random()<.5){
    showModal("<h3>YOU WON THE TOSS</h3><p class='sm'>"+esc(opp.name)+" await. What'll it be, coach?</p>",
      [["BAT FIRST",'ui_toss(1)'],["BOWL FIRST",'ui_toss(0)']]);
  }else{
    const aiBats=Math.random()<.5;
    showModal("<h3>TOSS LOST</h3><p class='sm'>"+esc(opp.name)+" won the toss and chose to "+(aiBats?"BAT":"BOWL")+" first.</p>",
      [["PLAY",aiBats?'ui_toss(0)':'ui_toss(1)']]);
  }
}
function ui_toss(userBats){
  closeModal();
  MT.order=userBats?["user","opp"]:["opp","user"];
  beginInnings();
}
function beginInnings(){
  const side=MT.order[MT.inn];
  const target=MT.inn===1?MT.innings[0].runs+1:null;
  if(side==="user")startUserBat(target);else startUserBowl(target);
}

// ============================================================
// BATTING (batter's eye)
// ============================================================
function startUserBat(target){
  MT.mode="bat";
  MT.U={xi:MT.myXI,bws:bowlersOf(MT.oppXI),runs:0,w:0,b:0,st:0,ns:1,nx:2,
    innR:{},innB:{},target,balls:G.overs*6};
  setSkip(false);
  if(!G.tut){
    showModal("<h3>HOW TO BAT</h3><p class='sm'>You're at the crease, looking down the pitch.<br><br>"+
      "1. PRESS &amp; HOLD — the bowler runs in.<br>"+
      "2. DRAG to aim (check the radar, top right):<br>"+
      "&nbsp;&nbsp;<span class='dim'>tiny drag</span> = BLOCK • <span class='grn'>medium</span> = GROUND • <span class='red'>big</span> = LOFT<br>"+
      "3. RELEASE as the ball hits the glowing ring.<br><br>"+
      "Watch the ✕ where it pitches — spinners drift after the bounce. After a hit: CLICK to steal an extra run, SPACE to stay.</p>",
      [["GOT IT",'ui_tutDone()']]);
  }
  newBall();
}
function ui_tutDone(){G.tut=1;save();closeModal();}
function newBall(){
  const U=MT.U;
  const over=Math.floor(U.b/6);
  const perB=Math.max(1,Math.ceil(G.overs/5));
  MT.bw=U.bws[Math.floor(over/perB)%U.bws.length];
  MT.T=MT.bw.spin?940+R(90):640+(10-effBowl(MT.bw))*18+R(50);
  MT.lineX=R()<0.05?CH([-1,1])*RI(13,16):RI(-11,11);
  MT.drift=MT.bw.spin?RI(-6,6):(R()<0.3?RI(-2,2):0);
  MT.curve=MT.bw.spin?0:(R(2)-1)*4;
  MT.wide=Math.abs(MT.lineX+MT.drift)>=13;
  MT.markerAt=MT.bw.spin?0:0.35;
  MT.phase="ready";
  MT.timing="";MT.lineWarn="";MT.chase=null;MT.pend=null;MT.away=null;MT.anim=null;
  MT.trail=[];
  MT.drag.on=false;MT.drag.len=0;
  genField();
  MT.sub=shortName(MT.bw.name)+" • "+(MT.bw.spin?"SPIN":"PACE "+RI(82,93)+" MPH")+" — HOLD, DRAG, RELEASE";
}
function shotKind(len){return len<12?"block":(len<46?"ground":"loft");}
function resolveSwing(dt,dragLen){
  if(!MT||MT.phase!=="flight")return;
  const U=MT.U,bw=MT.bw,bat=U.xi[U.st];
  MT.phase="result";MT.t0=performance.now();
  const finalX=MT.lineX+MT.drift;
  const be=effBat(bat)+G.coach.bat*0.25, bo=effBowl(bw)+0.5;
  let r=0,wkt=null,txt="";
  let tier=-1;
  if(dt!==null){
    const W=90*(1+(be-6)*0.05)*(1-(bo-7)*0.04);
    const a=Math.abs(dt);
    tier=a<=W*0.5?3:a<=W?2:a<=W*1.7?1:0;
    MT.timing=tier===3?"PERFECT!":tier===2?"GOOD":tier===1?(dt<0?"EARLY":"LATE"):"MISSED";
  }
  if(MT.wide&&tier<=0){
    U.runs++;bw.s.conc++;
    setFlash("WIDE +1");sfx("hit");
    MT.anim=mkAnim(CV.BX+(finalX>0?34:-34),CV.BY+14,500);
    checkEnd();return;
  }
  if(tier===-1){
    if(Math.abs(finalX)<5&&R()<0.25)wkt="BOWLED";
    else txt="LEFT ALONE";
    MT.anim=mkAnim(CV.BX-6,CV.BY+20,450);
  }else{
    let pen=0;
    const aimX=Math.cos(MT.aim);
    if((finalX>5&&aimX<-0.3)||(finalX<-5&&aimX>0.3)){pen=0.13;MT.lineWarn="ACROSS THE LINE!";}
    if(MT.wide)pen+=0.05;
    const kind=shotKind(dragLen);
    MT.swingT0=performance.now();
    if(tier===0){
      const roll=R();
      if(kind==="block"){
        if(roll<0.10)wkt=CH(["BOWLED","LBW"]);
        else if(roll<0.22)wkt="CAUGHT BEHIND";
        else txt="BEATEN";
      }else{
        if(roll<0.34+pen)wkt=CH(["BOWLED","LBW"]);
        else if(roll<0.5)wkt="CAUGHT BEHIND";
        else txt="BEATEN";
      }
      MT.anim=mkAnim(CV.BX+(wkt?0:9),CV.BY+(wkt&&wkt!=="CAUGHT BEHIND"?7:22),420);
    }else{
      // contact sparks at the hit zone
      sparks(pitchX(finalX,0),SC.NEAR-10,5,"#fff");
      const errDeg=(tier===3?6:tier===2?14:26)*(R(2)-1);
      MT.shotAng=MT.aim+errDeg*Math.PI/180;
      const g=gapAt(MT.shotAng);MT.lastGap=g;
      let res;
      if(kind==="block")res=blockResult(tier);
      else if(kind==="ground")res=groundResult(tier,g,pen,be);
      else res=loftResult(tier,g,pen);
      r=res.r||0;wkt=res.wkt||null;txt=res.txt||"";
      setupShotAnim(wkt,r);
      MT.away={ang:MT.shotAng,r,wkt,t0:performance.now(),dur:wkt?500:(r>=4?800:600)};
      if(g.fd&&(wkt==="CAUGHT"||r<4))MT.chase=g.fd;
      if(!wkt&&r>=1&&r<=2&&!res.noGamble){
        const pSafe=CL(0.45+g.deg*0.012+(g.deep?0.18:-0.12)+(be-7)*0.02,0.2,0.92);
        MT.pend={r,txt,pSafe};
      }
    }
  }
  bat.s.balls++;bw.s.bb++;U.b++;
  U.innB[bat.id]=(U.innB[bat.id]||0)+1;
  if(MT.pend){MT.feed=r+" RUN"+(r>1?"S":"")+" — more on offer…";return;}
  finalizeBall(r,wkt,txt,false);
}
function blockResult(tier){
  return {r:R()<0.25?1:0,txt:"BLOCKED",noGamble:tier<2};
}
function groundResult(tier,g,pen,be){
  const p=(tier===3?0.85:tier===2?0.68:0.45)+(be-6)*0.02+R(0.06)-pen;
  if(tier===1&&R()<0.10+pen*0.6)return{wkt:"CAUGHT",txt:"CHIPPED TO THE RING"};
  if(g.deg<7)return p>0.6?{r:g.deep?1:0,txt:"FIELDED"}:{r:0,txt:"STRAIGHT TO FIELDER"};
  if(p>0.76&&g.deg>14)return{r:4};
  if(g.deg>23)return{r:2};
  return{r:1};
}
function loftResult(tier,g,pen){
  if(tier===3){
    if(g.deg<8&&g.deep)return R()<0.32+pen?{wkt:"CAUGHT",txt:"PICKED OUT THE MAN"}:{r:R()<0.5?6:4,noGamble:true};
    return R()<0.62?{r:6,noGamble:true}:{r:4,noGamble:true};
  }
  if(tier===2){
    if(g.deep&&g.deg<10)return R()<0.5+pen?{wkt:"CAUGHT",txt:"STRAIGHT DOWN HIS THROAT"}:{r:4,noGamble:true};
    return R()<0.25?{r:6,noGamble:true}:{r:4,noGamble:true};
  }
  return R()<0.55+pen?{wkt:"CAUGHT",txt:"SKIED IT…"}:{r:2,txt:"MISTIMED, SAFE"};
}
function finalizeBall(r,wkt,txt,runout){
  const U=MT.U,bw=MT.bw,bat=U.xi[U.st];
  if(wkt){
    U.w++;bat.s.outs++;
    if(runout){
      U.runs+=r;bat.s.runs+=r;U.innR[bat.id]=(U.innR[bat.id]||0)+r;bw.s.conc+=r;
    }else bw.s.wkts++;
    sfx("wkt");setFlash(wkt+"!","#ff5e5e");
    MT.shakeUntil=performance.now()+320;
    MT.hurtUntil=performance.now()+420;
    if(wkt==="BOWLED"||wkt==="LBW")sparks(SC.CXX,SC.NEAR+8,8,"#f0d9a0");
    hsCheck(bat);
    U.st=U.nx;U.nx++;
  }else{
    U.runs+=r;bat.s.runs+=r;U.innR[bat.id]=(U.innR[bat.id]||0)+r;bw.s.conc+=r;
    if(r===4){sfx("four");setFlash("FOUR!");MT.cheerUntil=performance.now()+900;confetti(10);}
    else if(r===6){sfx("six");setFlash("SIX!");MT.cheerUntil=performance.now()+1100;MT.shakeUntil=performance.now()+280;confetti(26);}
    else{sfx("hit");setFlash(r===0?(txt||"DOT BALL"):(txt&&txt.startsWith("PUSHED")?txt:r+" RUN"+(r>1?"S":"")));}
    if(r%2===1)swapStrike();
  }
  if(U.b%6===0&&U.b<U.balls&&!MT.endInn)swapStrike();
  checkEnd();
}
function gambleGo(){
  const p=MT.pend;if(!p)return;
  MT.pend=null;MT.phase="result";MT.t0=performance.now();
  const g=MT.lastGap;
  const from=g&&g.fd?fdPos(g.fd):[CV.BX+40,CV.BY-60];
  MT.anim={fx:from[0],fy:from[1],tx:CV.BX,ty:CV.BY,t0:performance.now(),dur:380};
  if(R()<p.pSafe)finalizeBall(p.r+1,null,"PUSHED FOR "+(p.r+1)+"!",false);
  else finalizeBall(p.r,"RUN OUT",null,true);
}
function gambleStay(){
  const p=MT.pend;if(!p)return;
  MT.pend=null;MT.phase="result";MT.t0=performance.now();
  finalizeBall(p.r,null,p.txt,false);
}
function swapStrike(){const U=MT.U;const t=U.st;U.st=U.ns;U.ns=t;}
function hsCheck(bat){const ir=MT.U.innR[bat.id]||0;if(ir>bat.s.hs)bat.s.hs=ir;}
function checkEnd(){
  const U=MT.U;
  if(U.w>=10||U.b>=U.balls||(U.target!=null&&U.runs>=U.target)||U.st>=U.xi.length)MT.endInn=true;
}
function setupShotAnim(wkt,r){
  let to,dur=600;
  if(wkt==="CAUGHT"&&MT.lastGap&&MT.lastGap.fd)to=fdPos(MT.lastGap.fd);
  else if(wkt==="CAUGHT")to=[CV.BX+20,CV.BY-40];
  else if(r>=4){const t=tBound(MT.shotAng);to=pt(MT.shotAng,t*(r===6?1.16:1.01));dur=r===6?820:650;}
  else if(r===0)to=pt(MT.shotAng,22);
  else to=pt(MT.shotAng,tBound(MT.shotAng)*(0.3+0.2*r));
  MT.anim=mkAnim(to[0],to[1],dur);
  MT.anim.six=r===6;
}
function mkAnim(tx,ty,dur){return{fx:CV.BX,fy:CV.BY,tx,ty,t0:performance.now(),dur};}
function nextBall(){
  if(!MT)return;
  if(MT.endInn){MT.endInn=false;endInnings();}
  else newBall();
}
function endInnings(){
  if(MT.mode==="bat"){
    const U=MT.U;
    for(const pid in U.innR){const p=U.xi.find(x=>x.id==pid);if(p&&U.innR[pid]>p.s.hs)p.s.hs=U.innR[pid];}
    MT.innings.push({runs:U.runs,w:U.w,balls:U.b});
  }else{
    const B=MT.B;
    for(const pid in B.innR){const p=B.xi.find(x=>x.id==pid);if(p&&B.innR[pid]>p.s.hs)p.s.hs=B.innR[pid];}
    MT.innings.push({runs:B.runs,w:B.w,balls:B.b});
  }
  proceedInnings();
}

// ============================================================
// BOWLING (bowler's eye)
// ============================================================
function startUserBowl(target){
  MT.mode="bowl";
  const maxOv=Math.max(1,Math.ceil(G.overs/5));
  const ovLeft={};
  MT.myXI.forEach(p=>ovLeft[p.id]=maxOv);
  MT.B={xi:MT.oppXI,st:0,ns:1,nx:2,runs:0,w:0,b:0,innR:{},innB:{},target,
    balls:G.overs*6,ovLeft,lastBw:null,bw:null,tgt:{lx:2,len:0.7},
    needleT0:0,acc:0,out:null,justPicked:false};
  MT.phase="b_pick";
  genField();
  setSkip(true);
  if(!G.tutB){
    showModal("<h3>HOW TO BOWL</h3><p class='sm'>You're at the top of your mark, batter in your sights.<br><br>"+
      "1. MOVE the mouse to place the ✕ — your line &amp; length.<br>"+
      "&nbsp;&nbsp;<span class='grn'>Good length / yorker</span> = wickets. <span class='red'>Short or leg-side</span> = runs.<br>"+
      "2. PRESS &amp; HOLD to run in — the meter climbs.<br>"+
      "3. RELEASE at the top of the green band for a perfect delivery.<br><br>"+
      "Overshoot and you'll spray it (or overstep: NO BALL). You pick a fresh bowler every over.</p>",
      [["GOT IT",'ui_tutBDone()']]);
    return;
  }
  pickBowlerModal();
}
function ui_tutBDone(){G.tutB=1;save();closeModal();pickBowlerModal();}
function bowlerChoices(){
  const B=MT.B;
  return MT.myXI.filter(p=>B.ovLeft[p.id]>0&&p.id!==B.lastBw)
    .sort((a,b)=>effBowl(b)-effBowl(a)).slice(0,8);
}
function pickBowlerModal(){
  const B=MT.B;
  const list=bowlerChoices();
  if(!list.length){B.ovLeft[MT.myXI[0].id]=9;pickBowlerModal();return;}
  const over=Math.floor(B.b/6)+1;
  showModal("<h3>OVER "+over+" — WHO BOWLS?</h3><table>"+
    list.map(p=>"<tr class='click' onclick='ui_pickBowler("+p.id+")'><td>"+esc(shortName(p.name))+"</td>"+
      "<td>"+(p.spin?"SPIN":"PACE")+"</td><td>"+sstr(p.bowl)+"</td>"+
      "<td class='r sm dim'>"+p.s.wkts+"-"+p.s.conc+" • "+B.ovLeft[p.id]+" ov left</td></tr>").join("")+
    "</table>",[]);
}
function ui_pickBowler(pid){
  const B=MT.B;
  B.bw=MT.myXI.find(p=>p.id===pid);
  B.ovLeft[pid]--;
  B.lastBw=pid;
  closeModal();sfx("ui");
  newBowlBall();
}
function newBowlBall(){
  MT.phase="b_aim";
  MT.timing="";MT.flash=null;MT.anim=null;MT.B.out=null;
  MT.trail=[];
  genField();
  MT.sub=shortName(MT.B.bw.name)+" to "+shortName(MT.B.xi[MT.B.st].name)+" — AIM ✕, HOLD, RELEASE AT TOP";
}
function aiAggr(){
  const B=MT.B;
  if(B.target!=null){const need=B.target-B.runs,bl=B.balls-B.b;return CL(0.8+(need/(Math.max(bl,1)/6))*0.06,0.85,1.7);}
  return Math.floor(B.b/6)>=G.overs-2?1.25:1;
}
function resolveBowl(acc){
  const B=MT.B,bw=B.bw,bat=B.xi[B.st];
  B.acc=acc;
  const skill=effBowl(bw)/10;
  const slop=(1-acc)*(1.3-skill*0.5);
  const lx=CL(B.tgt.lx+(R(2)-1)*slop*9,-16,16);
  const len=CL(B.tgt.len+(R(2)-1)*slop*0.28,0.2,1.0);
  if(acc<0.12&&R()<0.5){B.out={kind:"nb"};return;}
  if(Math.abs(lx)>12.5){B.out={kind:"wd",lx,len};return;}
  let lenScore=len>0.97?0.25:len>0.86?0.92:len>0.62?1.0:len>0.45?0.68:0.48;
  let lineScore=Math.abs(lx)<=6?1:Math.abs(lx)<=10?0.85:0.62;
  const q=lenScore*lineScore*(0.55+0.45*acc);
  const adj=effBowl(bw)+G.coach.bowl*0.25+(q-0.55)*4.5;
  let out=simBall(effBat(bat)+0.5,adj,aiAggr());
  if(out==="wd")out=0;
  if(q>0.85&&out===0&&R()<0.12)out="W";
  if(q<0.35&&(out===0||out===1)&&R()<0.3)out=4;
  let wktType=null;
  if(out==="W")wktType=len>0.85?CH(["BOWLED","BOWLED","LBW"]):len>0.55?CH(["CAUGHT BEHIND","LBW","BOWLED"]):"CAUGHT";
  B.out={kind:"ball",r:out==="W"?0:out,wkt:wktType,lx,len,q};
}
function applyBowlBall(){
  const B=MT.B,bw=B.bw,bat=B.xi[B.st],o=B.out;
  B.out=null;
  if(o.kind==="nb"){B.runs++;bw.s.conc++;setFlash("NO BALL! +1","#ff5e5e");sfx("wkt");MT.phase="b_result";MT.t0=performance.now();return;}
  if(o.kind==="wd"){B.runs++;bw.s.conc++;setFlash("WIDE +1","#ff5e5e");sfx("hit");MT.phase="b_result";MT.t0=performance.now();return;}
  bat.s.balls++;bw.s.bb++;B.b++;
  B.innB[bat.id]=(B.innB[bat.id]||0)+1;
  const ang=R(Math.PI*2);
  if(o.wkt){
    B.w++;bat.s.outs++;bw.s.wkts++;
    sfx("win");setFlash(o.wkt+"! "+shortName(bat.name)+" GONE","#6ee76e");
    MT.cheerUntil=performance.now()+900;MT.shakeUntil=performance.now()+250;
    sparks(SC.CXX,SC.HZ-4,9,"#f0d9a0");
    confetti(14);
    if(B.innR[bat.id]>(bat.s.hs||0))bat.s.hs=B.innR[bat.id];
    B.st=B.nx;B.nx++;
  }else{
    const r=o.r;
    B.runs+=r;bat.s.runs+=r;B.innR[bat.id]=(B.innR[bat.id]||0)+r;bw.s.conc+=r;
    if(r===4){sfx("four");setFlash("FOUR CONCEDED","#ff5e5e");}
    else if(r===6){sfx("six");setFlash("SIX! THAT'S HUGE","#ff5e5e");MT.shakeUntil=performance.now()+260;}
    else if(r===0){sfx("hit");setFlash(o.q>0.85?"DOT — JAFFA!":"DOT BALL","#6ee76e");}
    else{sfx("hit");setFlash(r+" RUN"+(r>1?"S":""));}
    const d=r>=4?1.02:(0.3+0.2*r);
    MT.anim={fx:CV.BX,fy:CV.BY,tx:CV.BX+Math.cos(ang)*tBound(ang)*d,ty:CV.BY+Math.sin(ang)*tBound(ang)*d,t0:performance.now(),dur:600};
    if(r%2===1)swapStrikeB();
  }
  if(B.b%6===0&&B.b<B.balls)swapStrikeB();
  checkEndB();
  MT.phase="b_result";MT.t0=performance.now();
}
function swapStrikeB(){const B=MT.B;const t=B.st;B.st=B.ns;B.ns=t;}
function checkEndB(){
  const B=MT.B;
  if(B.w>=10||B.b>=B.balls||(B.target!=null&&B.runs>=B.target)||B.st>=B.xi.length)MT.endInn=true;
}
function advanceBowl(){
  if(MT.endInn){MT.endInn=false;endInnings();return;}
  const B=MT.B;
  if(B.b%6===0&&B.b>0&&!B.justPicked){pickBowlerModal();MT.phase="b_pick";B.justPicked=true;return;}
  if(B.b%6!==0)B.justPicked=false;
  newBowlBall();
}
function ui_skip(){
  if(!MT||MT.mode!=="bowl")return;
  closeModal();
  const B=MT.B;
  const order=bowlersOf(MT.myXI);
  while(!(B.w>=10||B.b>=B.balls||(B.target!=null&&B.runs>=B.target)||B.st>=B.xi.length)){
    const over=Math.floor(B.b/6);
    let bw=B.bw;
    if(!bw||B.b%6===0)bw=order[over%order.length];
    const bat=B.xi[B.st];
    const out=simBall(effBat(bat)+0.5,effBowl(bw)+G.coach.bowl*0.25,aiAggr());
    if(out==="wd"){B.runs++;bw.s.conc++;continue;}
    B.b++;bw.s.bb++;bat.s.balls++;
    if(out==="W"){B.w++;bat.s.outs++;bw.s.wkts++;B.st=B.nx;B.nx++;if(B.w>=10)break;}
    else{B.runs+=out;bat.s.runs+=out;B.innR[bat.id]=(B.innR[bat.id]||0)+out;bw.s.conc+=out;if(out%2===1)swapStrikeB();}
    if(B.b%6===0&&B.b<B.balls)swapStrikeB();
  }
  MT.endInn=false;
  endInnings();
}

// ============================================================
// innings flow / finish
// ============================================================
function proceedInnings(){
  MT.inn++;
  if(MT.inn<2){
    const i1=MT.innings[0];
    const firstSide=MT.order[0]==="user"?MT.my:MT.opp;
    const chaser=MT.order[1]==="user"?"You need":(MT.opp.id+" need");
    showModal("<h3>INNINGS BREAK</h3><p>"+esc(firstSide.id)+" posted <span class='ac'>"+i1.runs+"/"+i1.w+"</span> ("+ovTxt(i1.balls)+" ov)</p><p class='sm'>"+chaser+" "+(i1.runs+1)+" to win.</p>",
      [["START 2ND INNINGS",'ui_inn2()']]);
  }else finishMatch();
}
function ui_inn2(){closeModal();beginInnings();}
function finishMatch(){
  const userFirst=MT.order[0]==="user";
  const ur=userFirst?MT.innings[0]:MT.innings[1];
  const orr=userFirst?MT.innings[1]:MT.innings[0];
  let won,margin;
  if(ur.runs>orr.runs){won=true;margin=userFirst?("by "+(ur.runs-orr.runs)+" runs"):("by "+(10-ur.w)+" wickets");}
  else if(ur.runs<orr.runs){won=false;margin=userFirst?("by "+(10-orr.w)+" wickets"):("by "+(orr.runs-ur.runs)+" runs");}
  else{won=Math.random()<.5;margin="in a Super Over";}
  if(MT.stage==="league"){
    applyStd(MT.my,ur.runs,ur.balls,orr.runs,orr.balls,won);
    applyStd(MT.opp,orr.runs,orr.balls,ur.runs,ur.balls,!won);
    news((won?"YOU beat "+MT.opp.id:MT.opp.id+" beat YOU")+" "+margin+".");
    advanceRound();
  }else{
    news(MT.stage+": "+(won?"YOU beat "+MT.opp.id:MT.opp.id+" knocked you out")+" "+margin+".");
    recordPO(G.po.idx,won?G.my:MT.opp.id,won?MT.opp.id:G.my);
    if(!G.po.champ)G.po.idx++;
  }
  const cc=postMatchUser(won,MT.myXI);
  const pom=playerOfMatch(won);
  sfx(won?"win":"loss");
  MT.done=true;
  const sc1=MT.order[0]==="user"?MT.my.id:MT.opp.id;
  const sc2=MT.order[1]==="user"?MT.my.id:MT.opp.id;
  showModal(
    "<h3 class='"+(won?"grn":"red")+"'>"+(won?"VICTORY!":"DEFEAT")+"</h3>"+
    "<p>"+sc1+" "+MT.innings[0].runs+"/"+MT.innings[0].w+" ("+ovTxt(MT.innings[0].balls)+")<br>"+
    sc2+" "+MT.innings[1].runs+"/"+MT.innings[1].w+" ("+ovTxt(MT.innings[1].balls)+")</p>"+
    "<p class='sm'>"+(won?"You":MT.opp.id)+" won "+margin+".</p>"+
    (pom?"<p class='sm ac'>PLAYER OF THE MATCH: "+esc(pom.name)+" ("+pom.line+")</p>":"")+
    "<p class='sm grn'>+"+cc+" COACH CREDITS</p>",
    [["CONTINUE",'ui_afterMatch()']]);
}
function playerOfMatch(won){
  let best=null,bs=-1;
  for(const p of (won?MT.myXI:MT.oppXI)){
    const s0=MT.snap[p.id]||[0,0];
    const dr=p.s.runs-s0[0],dw=p.s.wkts-s0[1];
    const sc=dr+22*dw;
    if(sc>bs){bs=sc;best={name:p.name,line:(dr?dr+" runs":"")+(dr&&dw?" & ":"")+(dw?dw+" wkts":"")||"economy"};}
  }
  return best;
}
function snapStats(list){const o={};for(const p of list)o[p.id]=[p.s.runs,p.s.wkts];return o;}
function ui_afterMatch(){
  closeModal();
  if(MT)cancelAnimationFrame(MT.raf);
  MT=null;
  window.onkeydown=null;
  window.onmouseup=null;
  document.getElementById("app").className="";
  goHub("SQUAD");
}

// ============================================================
// input & screen
// ============================================================
function renderMatchScreen(){
  const app=document.getElementById("app");
  app.className="match-mode";
  app.innerHTML=
    '<div class="mwrap"><canvas id="cv" width="'+SC.W+'" height="'+SC.H+'"></canvas>'+
    '<div class="m-btnrow"><button class="btn mini" id="m-skip" style="display:none" onclick="ui_skip()">SIM REST OF INNINGS ⏩</button></div></div>';
  const cv=document.getElementById("cv");
  MT.ctx=cv.getContext("2d");
  const xy=e=>{
    const r=cv.getBoundingClientRect();
    return[(e.clientX-r.left)*(SC.W/r.width),(e.clientY-r.top)*(SC.H/r.height)];
  };
  cv.addEventListener("mousedown",e=>{const[x,y]=xy(e);onDown(x,y);});
  cv.addEventListener("mousemove",e=>{const[x,y]=xy(e);onMove(x,y);});
  window.onmouseup=onUp;
  cv.addEventListener("touchstart",e=>{e.preventDefault();const[x,y]=xy(e.touches[0]);onMove(x,y);onDown(x,y);},{passive:false});
  cv.addEventListener("touchmove",e=>{e.preventDefault();const[x,y]=xy(e.touches[0]);onMove(x,y);},{passive:false});
  cv.addEventListener("touchend",e=>{e.preventDefault();onUp();},{passive:false});
  window.onkeydown=e=>{
    if(!MT)return;
    if(e.code==="Space"){
      e.preventDefault();
      if(MT.phase==="rundecide")gambleStay();
      else if(MT.phase==="ready")onDown(SC.CXX,SC.NEAR);
      else if(MT.phase==="flight")resolveSwing(performance.now()-(MT.t0+MT.T),0);
      else if(MT.phase==="b_aim")onDown(SC.CXX,150);
      else if(MT.phase==="b_run")onUp();
    }
    if(e.key==="z"||e.key==="Z"){if(MT.phase==="flight")resolveSwing(performance.now()-(MT.t0+MT.T),0);}
    if(e.key==="x"||e.key==="X"){if(MT.phase==="flight")resolveSwing(performance.now()-(MT.t0+MT.T),32);}
    if(e.key==="c"||e.key==="C"){if(MT.phase==="flight")resolveSwing(performance.now()-(MT.t0+MT.T),60);}
    if(e.key==="ArrowLeft")MT.aim-=0.13;
    if(e.key==="ArrowRight")MT.aim+=0.13;
  };
}
function setSkip(show){
  const el=document.getElementById("m-skip");
  if(el)el.style.display=show?"inline-block":"none";
}
function onDown(x,y){
  if(!MT)return;
  if(MT.mode==="bat"){
    if(MT.phase==="rundecide"){gambleGo();return;}
    if(MT.phase==="ready"){MT.phase="runup";MT.t0=performance.now();sfx("ui");MT.sub="";}
    if(MT.phase==="runup"||MT.phase==="flight"){MT.drag.on=true;MT.drag.sx=x;MT.drag.sy=y;MT.drag.len=0;}
  }else if(MT.mode==="bowl"){
    if(MT.phase==="b_aim"){MT.phase="b_run";MT.B.needleT0=performance.now();sfx("ui");}
  }
}
function onMove(x,y){
  if(!MT)return;
  if(MT.mode==="bat"){
    if(MT.drag.on){
      const dx=x-MT.drag.sx,dy=y-MT.drag.sy;
      MT.drag.len=Math.hypot(dx,dy);
      if(MT.drag.len>6)MT.aim=Math.atan2(dy,dx);
    }else MT.aim=Math.atan2(y-SC.NEAR,x-SC.CXX);
  }else if(MT.mode==="bowl"&&MT.phase==="b_aim"){
    const len=CL((SC.NEAR-y)/SC.SPAN,0.25,0.97);
    const hw=SC.NEARHW-(SC.NEARHW-SC.FARHW)*len;
    MT.B.tgt={lx:CL((x-SC.CXX)*14/Math.max(hw,6),-15,15),len};
  }
}
function onUp(){
  if(!MT)return;
  if(MT.mode==="bat"&&MT.drag.on){
    MT.drag.on=false;
    if(MT.phase==="flight")resolveSwing(performance.now()-(MT.t0+MT.T),MT.drag.len);
  }else if(MT.mode==="bowl"&&MT.phase==="b_run"){
    const v=(performance.now()-MT.B.needleT0)/750;
    const acc=v<=1?CL(1-(1-v)*2.2,0,1):CL(1-(v-1)*3.2,0,1);
    resolveBowl(acc);
    MT.timing=acc>0.92?"PERFECT!":acc>0.7?"GOOD":acc>0.4?"LOOSE":"SPRAYED";
    MT.phase="b_fly";MT.t0=performance.now();
  }
}
function mLoop(ts){
  if(!MT)return;
  MT.raf=requestAnimationFrame(mLoop);
  if(MT.mode==="bat"){
    if(MT.phase==="runup"&&ts-MT.t0>650){MT.phase="flight";MT.t0=ts;}
    else if(MT.phase==="flight"&&ts-MT.t0>MT.T+240){MT.drag.on=false;resolveSwing(null,0);}
    else if(MT.phase==="result"){
      if(MT.pend&&ts-MT.t0>520){MT.phase="rundecide";MT.decideUntil=ts+1300;}
      else if(!MT.pend&&ts-MT.t0>1500)nextBall();
    }
    else if(MT.phase==="rundecide"&&ts>MT.decideUntil)gambleStay();
  }else if(MT.mode==="bowl"){
    if(MT.phase==="b_run"&&ts-MT.B.needleT0>750*1.35){onUp();}
    else if(MT.phase==="b_fly"&&ts-MT.t0>700){applyBowlBall();}
    else if(MT.phase==="b_result"&&ts-MT.t0>1300)advanceBowl();
  }
  drawFP(ts);
}

// ============================================================
// world helpers (field logic + radar)
// ============================================================
function genStars(){const a=[];for(let i=0;i<26;i++)a.push({x:R(SC.W),y:2+R(16),tw:R(6)});return a;}
function genCrowdFP(){
  const arr=[];
  for(let i=0;i<240;i++)arr.push({x:R(SC.W),y:26+R(36),c:CH(CROWD_COLS),ph:R(6)});
  return arr;
}
function genField(){
  const slots=[-155,-125,-95,-65,-40,-15,10,35,60,120,150];
  const pick=[...slots].sort(()=>R()-0.5).slice(0,9);
  MT.fd=pick.map((deg,i)=>{
    const a=(deg-90)*Math.PI/180;
    const tb=tBound(a);
    const deep=i<5;
    return{a,deep,r:deep?tb*(0.72+R(0.16)):tb*(0.26+R(0.16))};
  });
}
function fdPos(f){return[CV.BX+Math.cos(f.a)*f.r,CV.BY+Math.sin(f.a)*f.r];}
function gapAt(ang){
  let best=null,bd=999;
  for(const f of MT.fd){
    let d=Math.abs(ang-f.a)*180/Math.PI;
    d=((d%360)+360)%360;if(d>180)d=360-d;
    if(d<bd){bd=d;best=f;}
  }
  return{deg:bd,fd:best,deep:best?best.deep:false};
}
function tBound(a){
  const dx=Math.cos(a),dy=Math.sin(a);
  const u=(CV.BX-CV.CX)/CV.RX,v=(CV.BY-CV.CY)/CV.RY;
  const ex=dx/CV.RX,ey=dy/CV.RY;
  const A=ex*ex+ey*ey,Bq=2*(u*ex+v*ey),Cq=u*u+v*v-1;
  const disc=Math.sqrt(Math.max(0,Bq*Bq-4*A*Cq));
  return(-Bq+disc)/(2*A);
}
function pt(a,t){return[CV.BX+Math.cos(a)*t,CV.BY+Math.sin(a)*t];}
function setFlash(t,col){MT.flash={t,col:col||"#ffd84d",until:performance.now()+1300};MT.feed=t;}
function ovTxt(b){return Math.floor(b/6)+"."+(b%6);}
function sparks(x,y,n,col){
  for(let i=0;i<n;i++)MT.particles.push({x,y,vx:R(3)-1.5,vy:-R(2.5)-0.4,life:20+R(10),c:col});
}
function confetti(n){
  for(let i=0;i<n;i++)MT.particles.push({x:R(SC.W),y:26+R(34),vx:R(1)-0.5,vy:R(1.2)+0.3,life:30+R(25),c:CH(CROWD_COLS)});
}
function pitchX(lx,depth){ // lx -14..14, depth 0(near)..1(far) -> screen x
  const hw=SC.NEARHW-(SC.NEARHW-SC.FARHW)*depth;
  return SC.CXX+lx*hw/14;
}

// ============================================================
// first-person rendering
// ============================================================
function skinOf(p){return SKINS[p?p.id%SKINS.length:0];}
function bigGuy(c,x,y,h,col,o){
  // pixel cricketer anchored at the feet (x,y), h = height in px
  o=o||{};const s=h/10;
  const skin=o.skin||"#e0b080";
  // legs (or pads)
  c.fillStyle=o.pads?"#e8e4d0":"#1a1a2a";
  if(o.crouch){
    c.fillRect(x-2.4*s,y-2*s,1.6*s,2*s);c.fillRect(x+0.8*s,y-2*s,1.6*s,2*s);
  }else{
    c.fillRect(x-2*s+(o.frame?s*0.8:0),y-3.4*s,1.6*s,3.4*s);
    c.fillRect(x+0.6*s-(o.frame?s*0.8:0),y-3.4*s,1.6*s,3.4*s);
  }
  const ty=o.crouch?y-5.2*s:y-7*s;
  // torso
  c.fillStyle=col;c.fillRect(x-2.6*s,ty,5.2*s,3.8*s);
  // arms
  c.fillStyle=skin;
  c.fillRect(x-3.5*s,ty+0.6*s,1*s,2*s);c.fillRect(x+2.5*s,ty+0.6*s,1*s,2*s);
  // head
  c.fillStyle=skin;c.fillRect(x-1.6*s,ty-3*s,3.2*s,3*s);
  // cap or helmet
  if(o.helmet){
    c.fillStyle=o.cap||col;c.fillRect(x-1.9*s,ty-3.4*s,3.8*s,2.2*s);
    c.fillStyle="#1a1a2a";c.fillRect(x-1.6*s,ty-1.2*s,3.2*s,0.6*s); // grille
  }else{
    c.fillStyle=o.cap||col;c.fillRect(x-1.8*s,ty-3.8*s,3.6*s,1.4*s);
  }
  // bat
  if(o.bat!==undefined){
    c.strokeStyle="#d9a85e";c.lineWidth=Math.max(1.2,1.3*s);
    c.beginPath();c.moveTo(x+2.8*s,ty+2.2*s);
    c.lineTo(x+2.8*s+Math.cos(o.bat)*5.5*s,ty+2.2*s+Math.sin(o.bat)*5.5*s);c.stroke();
  }
  // keeper gloves
  if(o.gloves){c.fillStyle="#e8e4d0";c.fillRect(x-3*s,y-3.4*s,1.6*s,1.4*s);c.fillRect(x+1.4*s,y-3.4*s,1.6*s,1.4*s);}
}
function drawStadium(c,ts,cheer){
  // night sky
  const sky=c.createLinearGradient(0,0,0,SC.HZ);
  sky.addColorStop(0,"#06070f");sky.addColorStop(1,"#161d38");
  c.fillStyle=sky;c.fillRect(0,0,SC.W,SC.HZ);
  for(const st of MT.stars){
    c.fillStyle="rgba(232,228,208,"+(0.25+0.35*Math.abs(Math.sin(ts/900+st.tw)))+")";
    c.fillRect(st.x,st.y,1,1);
  }
  // floodlights
  for(const fx of [196,238]){
    const g=c.createRadialGradient(fx,14,2,fx,14,34);
    g.addColorStop(0,"rgba(255,250,215,.55)");g.addColorStop(1,"rgba(255,250,215,0)");
    c.fillStyle=g;c.fillRect(fx-34,0,68,52);
    c.fillStyle="#2a3050";c.fillRect(fx-1,19,2,28);
    c.fillStyle="#3a4260";c.fillRect(fx-7,10,14,9);
    c.fillStyle="#fffbe0";
    for(let i=0;i<3;i++)for(let j=0;j<2;j++)c.fillRect(fx-5+i*4,12+j*3,2,2);
  }
  // stands: two tiers + roof line
  c.fillStyle="#2e3450";c.fillRect(0,23,SC.W,2);
  c.fillStyle="#10131f";c.fillRect(0,25,SC.W,16);
  c.fillStyle="#181d30";c.fillRect(0,41,SC.W,23);
  // crowd
  for(const p of MT.crowd){
    c.fillStyle=p.c;
    const j=cheer&&Math.sin(ts/70+p.ph)>0?1:0;
    c.fillRect(p.x,p.y-j,2,2);
  }
  // ad boards
  for(let i=0;i<8;i++){
    c.fillStyle=AD_COLS[i%AD_COLS.length];
    c.fillRect(i*42-4,SC.HZ-13,40,8);
    c.fillStyle="rgba(255,255,255,.7)";
    c.fillRect(i*42+1,SC.HZ-10,11,2);c.fillRect(i*42+16,SC.HZ-10,15,2);
  }
  // boundary rope
  c.fillStyle=cheer?"#ffd84d":"#e8e4d0";c.fillRect(0,SC.HZ-4,SC.W,2);
  // outfield: perspective mowing stripes
  for(let i=0;i<7;i++){
    const t0=Math.pow(i/7,1.45),t1=Math.pow((i+1)/7,1.45);
    c.fillStyle=i%2?"#2c6726":"#387430";
    const yy=SC.HZ-2+(SC.H-SC.HZ+2)*t0;
    c.fillRect(0,yy,SC.W,(SC.H-SC.HZ+2)*(t1-t0)+1);
  }
  // 30-yard circle
  c.strokeStyle="rgba(232,228,208,.22)";c.lineWidth=1;c.setLineDash([3,4]);
  c.beginPath();c.ellipse(SC.CXX,SC.HZ+36,132,15,0,0,7);c.stroke();
  c.setLineDash([]);
}
function drawPitchFP(c){
  // strip
  c.fillStyle="#cdb472";
  c.beginPath();
  c.moveTo(SC.CXX-SC.FARHW,SC.HZ);c.lineTo(SC.CXX+SC.FARHW,SC.HZ);
  c.lineTo(SC.CXX+SC.NEARHW,SC.NEAR);c.lineTo(SC.CXX-SC.NEARHW,SC.NEAR);
  c.closePath();c.fill();
  // wear bands (perspective spacing)
  c.fillStyle="rgba(90,65,25,.13)";
  for(let i=1;i<=6;i++){
    const d=Math.pow(i/7,1.2); // depth toward far end
    const y=SC.NEAR-SC.SPAN*d;
    const hw=SC.NEARHW-(SC.NEARHW-SC.FARHW)*d;
    c.fillRect(SC.CXX-hw,y,hw*2,1.4);
  }
  // footmarks
  c.fillStyle="rgba(120,90,40,.45)";
  c.fillRect(SC.CXX-4,SC.HZ+7,3,3);
  c.fillRect(SC.CXX+6,SC.NEAR-26,6,5);
  c.fillRect(SC.CXX-10,SC.NEAR-22,4,4);
  // creases
  c.fillStyle="#efe9d2";
  c.fillRect(SC.CXX-SC.FARHW,SC.HZ+5,SC.FARHW*2,1);                 // far popping crease
  c.fillRect(SC.CXX-SC.NEARHW+6,SC.NEAR-11,SC.NEARHW*2-12,1.5);     // near crease
  c.fillRect(SC.CXX-SC.NEARHW+6,SC.NEAR-11,1.5,8);                  // return creases
  c.fillRect(SC.CXX+SC.NEARHW-8,SC.NEAR-11,1.5,8);
}
function drawFarStumps(c){
  c.fillStyle="#f5edd5";
  for(let i=-1;i<=1;i++)c.fillRect(SC.CXX+i*2.2-0.6,SC.HZ-7,1.2,7);
  c.fillStyle="#d9a85e";c.fillRect(SC.CXX-2.8,SC.HZ-7.6,5.6,1); // bails
}
function ballSprite(c,x,y,r){
  c.fillStyle="#f4f4f4";c.beginPath();c.arc(x,y,r,0,7);c.fill();
  if(r>1.6){c.strokeStyle="rgba(180,60,60,.8)";c.lineWidth=Math.max(0.6,r*0.22);
    c.beginPath();c.arc(x,y,r*0.55,0.6,2.6);c.stroke();}
}
function drawTrail(c){
  for(let i=0;i<MT.trail.length;i++){
    const t=MT.trail[i];
    c.fillStyle="rgba(255,255,255,"+(0.05+0.3*(i/MT.trail.length))+")";
    c.beginPath();c.arc(t.x,t.y,Math.max(t.r*0.7,0.5),0,7);c.fill();
  }
}
function drawFP(ts){
  const c=MT.ctx;if(!c)return;
  c.clearRect(0,0,SC.W,SC.H);
  c.save();
  if(ts<MT.shakeUntil)c.translate(R(4)-2,R(4)-2);
  const cheer=ts<MT.cheerUntil;
  // camera bob while running in to bowl
  c.save();
  if(MT.mode==="bowl"&&MT.phase==="b_run"){
    const v=CL((ts-MT.B.needleT0)/750,0,1.3);
    const k=1+0.05*v;
    c.translate(SC.CXX,SC.NEAR);c.scale(k,k);c.translate(-SC.CXX,-SC.NEAR);
    c.translate(Math.sin(ts/52)*1.6*v,Math.sin(ts/26)*1.2*v);
  }
  drawStadium(c,ts,cheer);
  drawPitchFP(c);
  if(MT.mode==="bat")sceneBat(c,ts);
  else if(MT.mode==="bowl")sceneBowl(c,ts);
  c.restore(); // end camera
  // particles (sparks, confetti)
  for(let i=MT.particles.length-1;i>=0;i--){
    const p=MT.particles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.life--;
    if(p.life<=0){MT.particles.splice(i,1);continue;}
    c.fillStyle=p.c;c.fillRect(p.x,p.y,1.6,1.6);
  }
  // vignette
  const vg=c.createRadialGradient(SC.CXX,120,95,SC.CXX,120,215);
  vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.42)");
  c.fillStyle=vg;c.fillRect(0,0,SC.W,SC.H);
  if(MT.mode==="bat")uiBat(c,ts);
  else if(MT.mode==="bowl")uiBowl(c,ts);
  drawRadar(c,ts);
  drawHUD(c,ts);
  // wicket red vignette
  if(ts<MT.hurtUntil){
    c.strokeStyle="rgba(255,60,60,"+(0.7*(MT.hurtUntil-ts)/420)+")";c.lineWidth=6;
    c.strokeRect(3,3,SC.W-6,SC.H-6);
  }
  // flash text with pop
  if(MT.flash&&ts<MT.flash.until){
    const age=performance.now()-(MT.flash.until-1300);
    c.font="bold "+(age<140?19:16)+"px monospace";c.textAlign="center";
    c.lineWidth=4;c.strokeStyle="#000";
    c.strokeText(MT.flash.t,SC.CXX,116);
    c.fillStyle=MT.flash.col;c.fillText(MT.flash.t,SC.CXX,116);
  }
  c.restore();
}
// ---------- batting scene ----------
function sceneBat(c,ts){
  const U=MT.U;if(!U)return;
  const fcol=MT.opp.c1;
  // sightscreen
  c.fillStyle="#ddd8c4";c.fillRect(SC.CXX-15,SC.HZ-30,30,24);
  c.strokeStyle="#2a3050";c.lineWidth=1;c.strokeRect(SC.CXX-15,SC.HZ-30,30,24);
  // far fielders on the outfield
  for(const f of MT.fd){
    const rel=f.a+Math.PI/2; // 0 = straight toward bowler
    if(Math.abs(rel)>1.45)continue;
    const tb=tBound(f.a);
    const depth=f.r/tb;
    const x=SC.CXX+Math.sin(rel)*(30+depth*132);
    const y=SC.HZ-1+(1-depth)*30;
    bigGuy(c,x,y,5+(1-depth)*4,fcol,{skin:"#e0b080",frame:Math.floor((ts+f.a*999)/500)%2});
  }
  drawFarStumps(c);
  // umpire
  bigGuy(c,SC.CXX+13,SC.HZ-2,8,"#e8e4d0",{cap:"#1a1a2a"});
  // bowler with run-up + windmill arm
  let bly=SC.HZ-22,blh=10,blf=0;
  if(MT.phase==="runup"){
    const t=CL((ts-MT.t0)/650,0,1);
    bly=SC.HZ-22+t*20;blh=10+t*4;blf=Math.floor(ts/80)%2;
    if(t>0.7){ // windmill
      const wa=(t-0.7)/0.3*Math.PI*1.6-Math.PI/2;
      c.strokeStyle=skinOf(MT.bw);c.lineWidth=1.4;
      c.beginPath();c.moveTo(SC.CXX-6,bly-blh*0.62);
      c.lineTo(SC.CXX-6+Math.cos(wa)*6,bly-blh*0.62+Math.sin(wa)*6);c.stroke();
    }
  }else if(MT.phase==="flight"){bly=SC.HZ-4;blh=13;}
  bigGuy(c,SC.CXX-6,bly,blh,fcol,{frame:blf,skin:skinOf(MT.bw)});
  const finalX=MT.lineX+MT.drift;
  // bounce marker
  if(MT.phase==="flight"||MT.phase==="runup"){
    const ft=MT.phase==="flight"?(ts-MT.t0)/MT.T:0;
    if(ft>=MT.markerAt&&ft<0.65){
      const mx=pitchX(MT.lineX*0.8,1-0.62),my=SC.HZ+SC.SPAN*0.62;
      c.strokeStyle=MT.wide?"#ff5e5e":"#ffd84d";c.lineWidth=1.2;
      c.beginPath();c.moveTo(mx-3,my-3);c.lineTo(mx+3,my+3);c.moveTo(mx+3,my-3);c.lineTo(mx-3,my+3);c.stroke();
    }
  }
  // hit zone ring
  if(MT.phase==="flight"||MT.phase==="runup"){
    const zx=pitchX(finalX,0),zy=SC.NEAR-8;
    const near=MT.phase==="flight"?CL((ts-MT.t0)/MT.T,0,1):0;
    const pul=1+0.12*Math.sin(ts/110);
    c.strokeStyle="rgba(255,216,77,"+(0.22+near*0.65)+")";c.lineWidth=1.6;
    c.beginPath();c.arc(zx,zy,8*pul,0,7);c.stroke();
    c.strokeStyle="rgba(255,216,77,"+(0.12+near*0.3)+")";
    c.beginPath();c.arc(zx,zy,12*pul,0,7);c.stroke();
  }
  // ball in flight + trail
  if(MT.phase==="flight"){
    const t=CL((ts-MT.t0)/MT.T,0,1);
    let wx;
    if(t<0.62)wx=MT.lineX*0.8*(t/0.62)+MT.curve*Math.sin(Math.PI*t);
    else wx=MT.lineX*0.8+(MT.lineX*0.2+MT.drift)*((t-0.62)/0.38);
    const h=t<0.62?7*(1-t/0.62):3*Math.sin(Math.PI*(t-0.62)/0.38);
    const s=0.3+0.7*t;
    const x=pitchX(wx,1-t),y=SC.HZ+SC.SPAN*t-h*2.2*s;
    const r=0.9+2.6*t;
    MT.trail.push({x,y,r});if(MT.trail.length>7)MT.trail.shift();
    drawTrail(c);
    c.fillStyle="rgba(0,0,0,.3)";c.beginPath();c.arc(pitchX(wx,1-t),SC.HZ+SC.SPAN*t,1.2*s+0.4,0,7);c.fill();
    ballSprite(c,x,y,r);
    if(t>0.6&&t<0.68){c.fillStyle="rgba(255,255,255,.4)";c.fillRect(x-2,y+1,4,2);}
  }else if((MT.phase==="result"||MT.phase==="rundecide")&&MT.away){
    const a=MT.away,t=CL((ts-a.t0)/a.dur,0,1);
    const dx=Math.cos(a.ang),dy=Math.sin(a.ang);
    const x=SC.CXX+dx*t*150;
    const y=(SC.NEAR-30)+dy*t*60-(a.r>=4?Math.sin(Math.PI*t)*(a.r===6?55:30):8*Math.sin(Math.PI*t));
    const rad=CL(3-(2.2*t),0.7,3);
    if(y>SC.HZ-34)ballSprite(c,x,y,rad);
  }
}
// ---------- batting POV overlay ----------
function uiBat(c,ts){
  const U=MT.U;if(!U)return;
  // helmet peak shadow
  c.fillStyle="rgba(4,5,9,.55)";c.fillRect(0,0,SC.W,5);
  c.fillRect(0,5,26,3);c.fillRect(SC.W-26,5,26,3);
  // gloves + bat
  const batP=U.xi[U.st];
  c.fillStyle=skinOf(batP);
  c.fillRect(SC.CXX-8,SC.H-16,6,5);c.fillRect(SC.CXX+3,SC.H-13,6,5);
  c.fillStyle="#e8e4d0"; // glove strips
  c.fillRect(SC.CXX-8,SC.H-16,6,1.6);c.fillRect(SC.CXX+3,SC.H-13,6,1.6);
  let ba=-0.5+Math.cos(MT.aim)*0.5;
  if(MT.swingT0&&ts-MT.swingT0<140)ba+=-1.2+((ts-MT.swingT0)/140)*2;
  c.save();
  c.translate(SC.CXX,SC.H-9);c.rotate(ba);
  c.fillStyle="#d9a85e";c.fillRect(-3.4,-36,6.8,31);
  c.fillStyle="rgba(0,0,0,.18)";c.fillRect(0.6,-36,2.8,31); // edge shading
  c.fillStyle="#8a5a2b";c.fillRect(-2.2,-8,4.4,9);          // handle
  c.restore();
  // aim compass
  if(MT.phase==="ready"||MT.phase==="runup"||MT.phase==="flight"){
    const kind=MT.drag.on?shotKind(MT.drag.len):null;
    const col=kind==="loft"?"#ff8c42":kind==="ground"?"#6ee76e":kind==="block"?"#8a8fa8":"rgba(255,216,77,.85)";
    const cx=30,cy=SC.H-32;
    c.fillStyle="rgba(8,10,16,.6)";c.beginPath();c.arc(cx,cy,16,0,7);c.fill();
    c.strokeStyle="#444";c.beginPath();c.arc(cx,cy,15,0,7);c.stroke();
    c.strokeStyle=col;c.lineWidth=2;
    c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(MT.aim)*13,cy+Math.sin(MT.aim)*13);c.stroke();
    c.fillStyle=col;
    const ax=cx+Math.cos(MT.aim)*13,ay=cy+Math.sin(MT.aim)*13;
    c.beginPath();c.arc(ax,ay,2,0,7);c.fill();
    if(kind){c.font="bold 7px monospace";c.textAlign="center";c.fillStyle=col;c.fillText(kind.toUpperCase(),cx,cy+26);}
  }
  // timing text
  if(MT.timing&&(MT.phase==="result"||MT.phase==="rundecide")){
    c.font="bold 9px monospace";c.textAlign="center";
    c.fillStyle=MT.timing==="PERFECT!"?"#6ee76e":(MT.timing==="GOOD"?"#ffd84d":"#ff5e5e");
    c.fillText(MT.timing,SC.CXX,SC.H-44);
    if(MT.lineWarn){c.fillStyle="#ff5e5e";c.fillText(MT.lineWarn,SC.CXX,SC.H-34);}
  }
  // run gamble overlay
  if(MT.phase==="rundecide"&&MT.pend){
    const left=CL((MT.decideUntil-ts)/1300,0,1);
    c.fillStyle="rgba(10,12,20,.88)";c.fillRect(60,148,200,46);
    c.strokeStyle="#ffd84d";c.lineWidth=1;c.strokeRect(60,148,200,46);
    c.font="bold 10px monospace";c.textAlign="center";c.fillStyle="#ffd84d";
    c.fillText("PUSH FOR "+(MT.pend.r+1)+"?  "+Math.round(MT.pend.pSafe*100)+"% SAFE",160,163);
    c.font="bold 8px monospace";c.fillStyle="#e8e4d0";
    c.fillText("CLICK = RUN  •  SPACE = STAY",160,175);
    c.fillStyle="#6ee76e";c.fillRect(64,183,192*left,4);
  }
}
// ---------- bowling scene ----------
function sceneBowl(c,ts){
  const B=MT.B;if(!B)return;
  const bcol=MT.opp.c1,mcol=MT.my.c1;
  // deep fielders behind the batter
  for(const f of MT.fd){
    const rel=f.a-Math.PI/2;
    if(Math.abs(rel)>1.45)continue;
    const tb=tBound(f.a);
    const depth=f.r/tb;
    const x=SC.CXX+Math.sin(rel)*(30+depth*132);
    const y=SC.HZ-1+(1-depth)*30;
    bigGuy(c,x,y,5+(1-depth)*4,mcol,{frame:Math.floor((ts+f.a*999)/500)%2});
  }
  // keeper + slips behind the stumps
  bigGuy(c,SC.CXX,SC.HZ-12,9,mcol,{crouch:1,gloves:1});
  bigGuy(c,SC.CXX+11,SC.HZ-10,8,mcol,{crouch:1});
  bigGuy(c,SC.CXX+19,SC.HZ-9,7,mcol,{crouch:1});
  drawFarStumps(c);
  // striker: helmet, pads, idle bat tap (plays a shot on result)
  const striker=B.xi[B.st];
  let batAng=0.95+0.12*Math.sin(ts/280);
  if(MT.phase==="b_result"&&ts-MT.t0<220)batAng=-0.6+((ts-MT.t0)/220)*1.4;
  bigGuy(c,SC.CXX+7,SC.HZ-2,13,bcol,{skin:skinOf(striker),helmet:1,pads:1,bat:batAng});
  // non-striker at near end edge
  bigGuy(c,SC.CXX-38,SC.NEAR-4,12,bcol,{skin:skinOf(B.xi[B.ns]),helmet:1,pads:1});
  // target reticle
  if(MT.phase==="b_aim"||MT.phase==="b_run"){
    const t=B.tgt;
    const y=SC.NEAR-SC.SPAN*t.len;
    const hw=SC.NEARHW-(SC.NEARHW-SC.FARHW)*t.len;
    const x=SC.CXX+t.lx*hw/14;
    const pulse=0.55+0.45*Math.sin(ts/170);
    c.strokeStyle="rgba(255,216,77,"+pulse+")";c.lineWidth=1.4;
    c.beginPath();c.moveTo(x-5,y);c.lineTo(x-2,y);c.moveTo(x+2,y);c.lineTo(x+5,y);
    c.moveTo(x,y-5);c.lineTo(x,y-2);c.moveTo(x,y+2);c.lineTo(x,y+5);c.stroke();
    c.fillStyle="rgba(255,216,77,"+pulse+")";c.fillRect(x-0.8,y-0.8,1.6,1.6);
    // zone chip
    const zone=t.len>0.97?"FULL TOSS":t.len>0.86?"YORKER":t.len>0.62?"GOOD LENGTH":t.len>0.45?"BACK OF LENGTH":"SHORT";
    const zw=zone.length*4+8;
    c.fillStyle="rgba(8,10,16,.75)";c.fillRect(x-zw/2,y-16,zw,9);
    c.font="bold 6px monospace";c.textAlign="center";
    c.fillStyle=(zone==="GOOD LENGTH"||zone==="YORKER")?"#6ee76e":(zone==="SHORT"||zone==="FULL TOSS")?"#ff5e5e":"#ffd84d";
    c.fillText(zone,x,y-9.5);
  }
  // delivery flying away + trail
  if(MT.phase==="b_fly"){
    const t=CL((ts-MT.t0)/700,0,1);
    const o=B.out||{lx:0,len:0.7};
    const lx=o.lx||0,len=o.len||0.7;
    const x=SC.CXX+(pitchX(lx,1)-SC.CXX)*t;
    let h;
    if(t<len)h=14*(1-t/Math.max(len,0.01));
    else h=10*Math.sin(Math.PI*CL((t-len)/Math.max(1-len,0.05),0,1));
    const y=SC.NEAR-SC.SPAN*t-h*(1-t*0.6);
    const r=CL(3-2.2*t,0.8,3);
    MT.trail.push({x,y,r});if(MT.trail.length>7)MT.trail.shift();
    drawTrail(c);
    if(Math.abs(t-len)<0.04){c.fillStyle="rgba(255,255,255,.5)";c.fillRect(pitchX(lx*0.9,len)-2,SC.NEAR-SC.SPAN*len,4,2);}
    ballSprite(c,x,y,r);
  }
}
// ---------- bowling POV overlay ----------
function uiBowl(c,ts){
  const B=MT.B;if(!B)return;
  // power meter
  if(MT.phase==="b_run"||MT.phase==="b_aim"){
    const mx=16,my=108,mh=100;
    c.fillStyle="rgba(8,10,16,.78)";c.fillRect(mx-7,my-6,18,mh+14);
    c.strokeStyle="#3a4260";c.lineWidth=1;c.strokeRect(mx-7,my-6,18,mh+14);
    // green band + perfect tick
    c.fillStyle="rgba(110,231,110,.4)";c.fillRect(mx-5,my,14,mh*0.14);
    c.fillStyle="#6ee76e";c.fillRect(mx-5,my,14,1);
    if(MT.phase==="b_run"){
      const v=CL((ts-MT.B.needleT0)/750,0,1.35);
      const fillH=CL(v,0,1)*mh;
      const g=c.createLinearGradient(0,my+mh,0,my);
      g.addColorStop(0,"#ffd84d");g.addColorStop(0.75,"#ff8c42");g.addColorStop(1,"#6ee76e");
      c.fillStyle=v>1.05?"#ff5e5e":g;
      c.fillRect(mx-5,my+mh-fillH,14,fillH);
      if(v>1){c.fillStyle="#ff5e5e";c.fillRect(mx-5,my-3,14,3);}
    }
    c.font="bold 6px monospace";c.textAlign="center";c.fillStyle="#8a8fa8";
    c.fillText("PWR",mx+2,my+mh+16);
  }
  // bowler's hand + ball, pumping during run
  if(MT.phase==="b_aim"||MT.phase==="b_run"){
    const v=MT.phase==="b_run"?CL((ts-MT.B.needleT0)/750,0,1.3):0;
    const bob=MT.phase==="b_run"?Math.sin(ts/55)*4*CL(v+0.3,0,1):Math.sin(ts/400)*1.5;
    const hx=SC.CXX+30,hy=SC.H-16+bob;
    c.fillStyle="rgba(4,5,9,.3)";c.fillRect(hx-7,hy+5,16,3);
    c.fillStyle=skinOf(B.bw);
    c.fillRect(hx-4,hy-2,9,8);
    c.fillRect(hx-7,hy+2,4,5);
    ballSprite(c,hx+1,hy-4,3.4);
  }
  // release feedback
  if(MT.timing&&(MT.phase==="b_fly"||MT.phase==="b_result")){
    c.font="bold 9px monospace";c.textAlign="center";
    c.fillStyle=MT.timing==="PERFECT!"?"#6ee76e":(MT.timing==="GOOD"?"#ffd84d":"#ff5e5e");
    c.fillText(MT.timing,SC.CXX,SC.H-30);
  }
}
function drawRadar(c,ts){
  const s=MAP.s,ox=MAP.x,oy=MAP.y;
  const w=CV.W*s,h=CV.H*s;
  c.fillStyle="rgba(8,10,16,.85)";c.fillRect(ox-3,oy-3,w+6,h+6);
  c.strokeStyle="#3a4260";c.strokeRect(ox-3,oy-3,w+6,h+6);
  c.fillStyle="#1d4019";
  c.beginPath();c.ellipse(ox+CV.CX*s,oy+CV.CY*s,CV.RX*s,CV.RY*s,0,0,7);c.fill();
  c.strokeStyle="#e8e4d0";c.lineWidth=0.7;
  c.beginPath();c.ellipse(ox+CV.CX*s,oy+CV.CY*s,CV.RX*s,CV.RY*s,0,0,7);c.stroke();
  c.strokeStyle="rgba(232,228,208,.25)";
  c.beginPath();c.ellipse(ox+CV.CX*s,oy+CV.CY*s,CV.RX*s*0.55,CV.RY*s*0.55,0,0,7);c.stroke();
  c.fillStyle="#c9b06b";c.fillRect(ox+(CV.BX-2)*s,oy+CV.BOWLY*s,4*s+1,(CV.BY-CV.BOWLY)*s);
  const fcol=MT.mode==="bat"?MT.opp.c1:MT.my.c1;
  for(const f of MT.fd){
    const[x,y]=fdPos(f);
    c.fillStyle=fcol;c.fillRect(ox+x*s-1,oy+y*s-1,2.4,2.4);
  }
  c.fillStyle=fcol;c.fillRect(ox+CV.BX*s-1,oy+(CV.BY+20)*s-1,2.4,2.4);
  c.fillStyle="#fff";c.fillRect(ox+CV.BX*s-1.2,oy+CV.BY*s-1.2,2.6,2.6);
  if(MT.mode==="bat"&&(MT.phase==="ready"||MT.phase==="runup"||MT.phase==="flight")){
    const kind=MT.drag.on?shotKind(MT.drag.len):null;
    c.strokeStyle=kind==="loft"?"#ff8c42":kind==="ground"?"#6ee76e":"#ffd84d";
    c.lineWidth=1;
    const bx=ox+CV.BX*s,by=oy+CV.BY*s;
    c.beginPath();c.moveTo(bx,by);
    c.lineTo(bx+Math.cos(MT.aim)*16,by+Math.sin(MT.aim)*16);c.stroke();
  }
  if(MT.anim&&(MT.phase==="result"||MT.phase==="rundecide"||MT.phase==="b_result")){
    const a=MT.anim,t=CL((ts-a.t0)/a.dur,0,1);
    const e=1-Math.pow(1-t,2);
    const x=a.fx+(a.tx-a.fx)*e,y=a.fy+(a.ty-a.fy)*e;
    c.strokeStyle="rgba(255,255,255,.35)";c.lineWidth=0.6;
    c.beginPath();c.moveTo(ox+a.fx*s,oy+a.fy*s);c.lineTo(ox+x*s,oy+y*s);c.stroke();
    c.fillStyle="#fff";c.beginPath();c.arc(ox+x*s,oy+y*s,1.4,0,7);c.fill();
  }
  c.font="bold 5px monospace";c.textAlign="center";c.fillStyle="#8a8fa8";
  c.fillText("FIELD",ox+w/2,oy+h+8);
}
function drawHUD(c,ts){
  // scoreboard panel
  c.fillStyle="rgba(8,10,16,.72)";c.fillRect(2,2,176,33);
  c.strokeStyle="#3a4260";c.lineWidth=1;c.strokeRect(2,2,176,33);
  c.font="bold 8px monospace";c.textAlign="left";
  const tag=MT.stage==="league"?"":" • "+MT.stage;
  let l1="",l2="",l3="";
  if(MT.mode==="bat"&&MT.U){
    const U=MT.U;
    const need=U.target!=null?(U.target-U.runs):null;
    l1=MT.my.id+" "+U.runs+"/"+U.w+"  ("+ovTxt(U.b)+"/"+G.overs+")"+(need!=null?"  NEED "+need+" OFF "+(U.balls-U.b):"")+tag;
    const st=U.xi[U.st],ns=U.xi[U.ns];
    l2=(st&&U.w<10?shortName(st.name)+" "+(U.innR[st.id]||0)+"("+(U.innB[st.id]||0)+")*":"")+
       (ns&&U.ns!==U.st&&U.ns<U.xi.length?"  |  "+shortName(ns.name)+" "+(U.innR[ns.id]||0):"");
    l3=MT.bw?shortName(MT.bw.name)+" "+MT.bw.s.wkts+"-"+MT.bw.s.conc:"";
  }else if(MT.mode==="bowl"&&MT.B){
    const B=MT.B;
    const need=B.target!=null?(B.target-B.runs):null;
    l1=MT.opp.id+" "+B.runs+"/"+B.w+"  ("+ovTxt(B.b)+"/"+G.overs+")"+(need!=null?"  THEY NEED "+need+" OFF "+(B.balls-B.b):"")+tag;
    const st=B.xi[B.st];
    l2=(st&&B.w<10?shortName(st.name)+" "+(B.innR[st.id]||0)+"("+(B.innB[st.id]||0)+")*":"");
    l3=B.bw?"YOU: "+shortName(B.bw.name)+" "+B.bw.s.wkts+"-"+B.bw.s.conc:"";
  }
  c.fillStyle="#ffd84d";c.fillText(l1,6,12);
  c.fillStyle="#e8e4d0";c.fillText(l2,6,21);
  c.fillStyle="#8a8fa8";c.fillText(l3,6,30);
  // feed / sub line at bottom
  c.font="bold 7px monospace";c.textAlign="center";
  c.fillStyle="#ffd84d";
  c.fillText((MT.flash&&ts<MT.flash.until?"":MT.sub||MT.feed||""),SC.CXX,SC.H-4);
}

// debug/test hooks
window.__rc={
  get G(){return G;},
  get MT(){return MT;},
  simMatch,
  step(dt,len){ // batting: auto-play one ball
    if(!MT||MT.mode!=="bat")return "not batting";
    if(MT.phase==="rundecide")gambleStay();
    if(MT.phase==="ready"){MT.phase="flight";MT.t0=performance.now()-MT.T;}
    if(MT.phase==="flight")resolveSwing(dt===undefined?RI(-130,130):dt,len===undefined?32:len);
    if(MT.phase==="rundecide")gambleStay();
    if(MT.phase==="result")nextBall();
    return MT.U?MT.U.runs+"/"+MT.U.w+" ("+MT.U.b+")":"";
  },
  stepBowl(acc,lx,len){ // bowling: auto-play one ball
    if(!MT||MT.mode!=="bowl")return "not bowling";
    if(MT.phase==="b_pick"){const ch=bowlerChoices();if(ch.length)ui_pickBowler(ch[0].id);}
    if(MT.phase==="b_aim"){
      MT.B.tgt={lx:lx===undefined?2:lx,len:len===undefined?0.72:len};
      resolveBowl(acc===undefined?0.85:acc);
      MT.phase="b_fly";
      applyBowlBall();
    }
    if(MT.phase==="b_result")advanceBowl();
    return MT.B?MT.B.runs+"/"+MT.B.w+" ("+MT.B.b+")":"";
  },
};
