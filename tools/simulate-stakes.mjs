// Balance simulator for High Stakes (light). node tools/simulate-stakes.mjs [runs] [charms]
// Payouts, charms and goals come from stakes.js. The table flow (deals, refills,
// boss rules) is re-implemented here, so it approximates game.js.
import * as K from '../hilo-3d/stakes.js';
const N = +process.argv[2] || 1500;
const START = {toll:3, collector:2, sharp:2, elevator:3, roller:3, house:2, driver:1};
const ORDER = ['toll','collector','sharp','elevator','roller','house','driver'];
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const nb = i => [i>2&&i-3, i<6&&i+3, i%3>0&&i-1, i%3<2&&i+1].filter(x => x!==false);
function runOne(seed, policy, buyer, limit=0, gift=null) {
  const rng = K.makeRng(seed), deck = K.freshDeck();
  let tokens = 65, charms = gift ? [gift] : [], mem = {}; const log = [];
  for (let stage=1; stage<=7; stage++) {
    if (buyer) for (let pass=0; pass<3; pass++) {
      for (const id of K.rollCharms(rng, charms, [])) { const c=K.charmById[id]; if (charms.length<5 && tokens>=c.cost) { tokens-=c.cost; charms.push(id); } }
      if (charms.length<5 && tokens>=70) tokens-=10; else break;
    }
    const boss=ORDER[stage-1], goal=K.goalFor(stage,limit); let pool=deck.map(c=>({...c}));
    for (let j=0;j<(boss==='driver'?4:2)+(K.LIMITS[limit].joker||0);j++) pool.push({joker:true}); K.shuffleWith(rng,pool);
    const draw=()=>{ while(pool.length){const c=pool.pop(); if(c.joker){guesses++;continue} return c;} return null; }; // a Joker costs a call
    let guesses=0;
    const b=Array(9).fill(null), locked=Array(9).fill(false); const os=boss==='elevator'?[0,3,1,2,4,5]:[0,1,2,3,4,5];
    for(let k=0;k<START[boss]+K.OPENING_BONUS;k++) b[os[k]]=draw();
    let score=0,streak=0,right=0,earned=0,shield=1,stamps=new Set(),stake=-1,mate=-1,passed=0;
    const grant=n=>{const g=Math.max(0,Math.min(n,100-earned));earned+=g;tokens+=g;};
    const refill=()=>{const i=b.findIndex((c,k)=>!c&&!locked[k]); if(i>=0){const before=LINES.map(l=>l.every(k=>b[k])),c=draw(); if(c){b[i]=c;LINES.forEach((l,j)=>{if(!before[j]&&l.every(k=>b[k])){score+=K.LINE_PAY;grant(6)}})}}};
    const pickStake=()=>{stake=mate=-1;const cs=[];b.forEach((c,i)=>{if(c){const n=nb(i).filter(j=>b[j]);if(n.length)cs.push([i,n])}});if(cs.length){const[i,n]=cs[Math.floor(rng()*cs.length)];stake=i;mate=n[Math.floor(rng()*n.length)]}};
    const done=()=>score>=goal&&(boss!=='house'||stamps.size===4)&&(boss!=='driver'||b.filter(Boolean).length>=2);
    let ok=null;
    while(ok===null){
      if(!b.some(Boolean)){ok=false;break}
      if(done()){ok=true;break}
      if(!pool.length||guesses>=K.CALLS){ok=false;break}
      if(boss==='roller'&&(stake<0||!b[stake]||!b[mate]))pickStake();
      const reg=pool.filter(c=>!c.joker);
      const opts=[]; const n=b.filter(Boolean).length; const dbl=boss==='sharp'&&(guesses+1)%4===0;
      b.forEach((c,i)=>{ if(!c||(boss==='elevator'&&((i+3<9&&b[i+3])||(i+6<9&&b[i+6]))))return;
        for(const dir of ['higher','lower']){ const w=reg.filter(x=>dir==='higher'?x.v>c.v:x.v<c.v).length/Math.max(1,reg.length); if(w<=0)continue; const p=dbl?w*w:w;
          const ctx={card:c,drawn:null,dir,slot:i,p,streak,board:b,callsLeft:K.CALLS-guesses};
          opts.push({i,dir,p,win:p,pay:K.payout(ctx,charms,mem),ctx,c,n}); } });
      if(!opts.length){ok=false;break}
      const need=Math.max(0,goal-score), o=policy({opts,n,need,calls:K.CALLS-guesses,boss,stamps,rng});
      if(o.win<Math.max(...opts.map(x=>x.win))-.001)passed++;
      const d=draw(); if(!d){ok=false;break} const d2=dbl?draw():null;
      const bt=x=>o.dir==='higher'?x.v>o.c.v:x.v<o.c.v;
      guesses++;
      if(bt(d)&&(!d2||bt(d2))){ const ctx={...o.ctx,drawn:d2||d,tier:K.tierOf(o.p)}; const pay=K.payout(ctx,charms,mem); score+=pay.total; K.afterWin(ctx,charms,mem); b[o.i]=d2||d; streak++; right++; grant(2);
        if(K.riskRefill(ctx.tier))refill(); stamps.add(o.c.s); if(boss==='roller'&&o.i===stake){refill();pickStake();}
        if(streak%3===0)refill(); else if(stage<=2?right%2===0:right%4===0)refill();
      } else { streak=0; score=Math.max(0,score-Math.round(K.MISS_COST*o.pay.total));
        if(shield&&n<=2){shield=0}
        else {b[o.i]=null;if(boss==='roller'&&o.i===stake&&b[mate])b[mate]=null;if(boss==='collector'&&locked.filter(Boolean).length<3)locked[o.i]=true;if(boss==='toll')tokens=Math.max(0,tokens-10);}
      }
    }
    log.push({boss,ok,score,goal,guesses,passed,n:b.filter(Boolean).length});
    if(!ok)return{won:false,stage,log,why:b.some(Boolean)?'short':'bust'};
    tokens+=K.CLEAR_TOKENS+K.SPARE_CALL_TOKENS*(K.CALLS-guesses); K.afterTable(charms,mem);
  }
  return{won:true,stage:8,log};
}
const best=(a,f)=>a.reduce((m,o)=>f(o)>f(m)?o:m);
const house=(s,o)=>s.boss==='house'&&!s.stamps.has(o.c.s)?.4:0;
const P={
  random:s=>s.opts[Math.floor(s.rng()*s.opts.length)],
  safest:s=>best(s.opts,o=>o.win+house(s,o)/4),
  biggest:s=>best(s.opts,o=>o.pay.total),
  greedy:s=>best(s.opts,o=>o.win*Math.min(o.pay.total,s.need||1e9)),
  // weighs pay against what losing a card costs, more when the table is thin
  smart:s=>best(s.opts,o=>{const per=Math.max(20,s.need/Math.max(1,s.calls)/.8); const t=K.tierOf(o.p).id; return o.win*(Math.min(o.pay.total,s.need)/per-(1-o.win)/o.win*K.MISS_COST*o.pay.total/per+(t==='long'||t==='bold'?2:0))-(1-o.win)*2*(s.n<=1?8:s.n<=2?3.5:s.n<=3?2:1)+house(s,o)})
};
if(process.argv[3]==='charms'){
  const rate=g=>Array.from({length:N},(_,k)=>runOne('s'+k,P.smart,true,0,g)).filter(r=>r.won).length/N*100;
  console.log('no gift',rate(null).toFixed(1)+'%');
  for(const r of K.CHARMS.map(c=>[c.name,rate(c.id)]).sort((a,b)=>b[1]-a[1]))console.log(r[0].padEnd(16),r[1].toFixed(1)+'%');
  process.exit();
}
console.log('limit policy  won%  avgBoss  boss1clear  passedSafest%');
for(const limit of [0,1,2])for(const[name,pol]of Object.entries(P)){
  const R=Array.from({length:N},(_,k)=>runOne('s'+k,pol,true,limit)),L=R.flatMap(r=>r.log),g=L.reduce((a,l)=>a+l.guesses,0);
  const b1=R.filter(r=>r.log[0]?.ok).length/N;
  console.log(String(limit).padEnd(5),name.padEnd(8),(100*R.filter(r=>r.won).length/N).toFixed(1).padStart(5),(R.reduce((a,r)=>a+Math.min(7,r.stage),0)/N).toFixed(2).padStart(7),(100*b1).toFixed(0).padStart(9)+'%',(100*L.reduce((a,l)=>a+l.passed,0)/g).toFixed(0).padStart(10));
  if(limit===0&&name==='smart')for(let s=1;s<=7;s++){const L=R.map(r=>r.log[s-1]).filter(Boolean);console.log('        boss',s,'goal',L[0].goal,'clear',(100*L.filter(l=>l.ok).length/L.length).toFixed(0)+'%','calls',(L.reduce((a,l)=>a+l.guesses,0)/L.length).toFixed(1))}
}
