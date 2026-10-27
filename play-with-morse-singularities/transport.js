import {integral,derivative,critical,map} from './model.js';
import {levelComponents} from './levels.js';
const transportClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const transportSmooth=(a,b,x)=>{const u=transportClamp((x-a)/(b-a),0,1);return u*u*(3-2*u)};
export function trackedLevels(t,lod=0){
 const cs=critical(t,1),top=Math.max(...cs.map(c=>c.h)),bottom=Math.min(...cs.map(c=>c.h)),sheet=t<0?-1:1,levels=[];
 for(let i=1;i<6;i++)levels.push({id:`base${i}`,H:bottom+(top-bottom)*i/6,weight:1,feature:false});
 levels.push({id:'poleA',H:.94,weight:1,feature:true},{id:'poleD',H:-.9,weight:1,feature:true});
 const B=cs.find(c=>c.id==='B'),C=cs.find(c=>c.id==='C'),fallback=sheet*Math.sqrt(1-.55**2)+t*integral(.55),bh=B?.h??fallback,ch=C?.h??fallback,w=transportSmooth(1,1.25,Math.abs(t));
 const pairSeparation=B&&C?2*Math.asin(Math.min(1,Math.hypot(...B.p.map((x,k)=>x-C.p[k]))/2)):0,resolvedPair=transportSmooth(.10,.32,pairSeparation);
 levels.push({id:'foldInside',H:bh+(ch-bh)*.55,weight:w,feature:true},{id:'foldOutside',H:bh-sheet*.045,weight:w,feature:true});
 // Regular levels through the cap exist before a saddle/minimum pair does.
 // Continue two sparse local rows below the extended saddle height instead of
 // waiting for B/C to be present. These are ordinary level sets, not critical
 // trajectories: they carry no criticalId and their vectors remain the exact
 // current gradient. The lower offset never crosses the saddle's critical level.
 // Keep both signed families present even at t=0: the ordinary field has no
 // birth threshold. Reversal neither flips their IDs to the opposite pole nor
 // lets a faint incoming family erase an established full-opacity row.
 for(const capSheet of [-1,1]){
  const capWeight=1,capCenter=[.55,0,capSheet*Math.sqrt(1-.55**2)];
  const capHeight=capSheet===sheet?bh:capCenter[2]+t*integral(.55);
  for(const [tier,delta] of [.003,.058].entries())levels.push({id:`regularCap${capSheet>0?'P':'N'}_${tier}_1`,H:capHeight-capSheet*delta,weight:capWeight,feature:true,local:true,regular:true,center:capCenter,tier,radius:.54});
 }
 // Retire critical rows with the same resolved-pair envelope as trajectories.
 // Ordinary cap rows remain underneath while a collapsing critical root moves
 // too fast for its vanishing local level family to be visually meaningful.
 // Fixed dyadic local levels: zoom activates detail, never changes the height of a live family.
 for(const c of cs){if(c.m===null)continue;for(let tier=0;tier<4;tier++){
  const delta=[.025,.008,.0025,.00065][tier],activation=transportSmooth([.08,.32,.55,.78][tier],[.27,.52,.78,1][tier],lod);
  const offsets=c.id==='B'?[-1,1]:[c.m===2?-1:1];
  for(const side of offsets){let gap=c.id==='B'||c.id==='C'?Math.abs(ch-bh):Infinity,offset=Math.min(delta,gap*.3),foldWeight=Number.isFinite(gap)?transportSmooth(.00002,.001,gap)*resolvedPair:1;
   levels.push({id:`local${c.id}_${tier}_${side}`,H:c.h+side*offset,weight:activation*foldWeight,feature:true,local:true,criticalId:c.id,center:c.p,tier,radius:[.42,.26,.16,.10][tier]});
  }
 }}
 for(const l of levels)if(!l.feature){const gap=Math.min(...levels.filter(q=>q.feature&&!q.local&&q.weight>.5).map(q=>Math.abs(q.H-l.H)));l.weight*=transportSmooth(.012,.045,gap)}
 return levels;
}
function transportHeight(p,t){return p[2]+t*integral(p[0])}
function transportGradient(p,t){const w=[t*derivative(p[0]),0,1],dot=w[0]*p[0]+p[2];return w.map((x,i)=>x-dot*p[i])}
function normalizeTransport(p){const n=Math.hypot(...p);return p.map(x=>x/n)}
// Closest local retraction, with small parameter steps; never remap a live particle by arc rank.
export function continuePoint(p,H,t){
 let q=p.slice();
 for(let k=0;k<14;k++){const error=H-transportHeight(q,t);if(Math.abs(error)<2e-11)return {p:q,ok:true};const g=transportGradient(q,t),norm2=g.reduce((s,x)=>s+x*x,0);if(norm2<1e-10)return {p:q,ok:false};const step=transportClamp(error/norm2,-.4,.4);q=normalizeTransport(q.map((x,i)=>x+step*g[i]))}
 return {p:q,ok:Math.abs(H-transportHeight(q,t))<2e-8};
}
// A chart is used only for ordering and inserting into gaps. It never reassigns
// an existing particle's position; those positions continue by continuePoint.
function rowCharts(level,t,lateral=0){
 const charts=[];
 for(const [componentIndex,comp] of levelComponents(level.H,t,1).entries()){
  const at=u=>{const theta=2*Math.PI*u,x=(comp.lo+comp.hi)/2+(comp.hi-comp.lo)/2*Math.cos(theta),z=level.H-t*integral(x);return [x,Math.sin(theta)>=0?Math.sqrt(Math.max(0,1-x*x-z*z)):-Math.sqrt(Math.max(0,1-x*x-z*z)),z]},steps=256,cum=[0],ps=[at(0)];let last=map(ps[0],t,1,lateral);
  for(let i=1;i<=steps;i++){const p=at(i/steps),q=map(p,t,1,lateral);cum.push(cum.at(-1)+Math.hypot(...q.map((x,k)=>x-last[k])));ps.push(p);last=q}
  const length=cum.at(-1);if(length<1e-6)continue;
  const arc=p=>{const cosine=transportClamp((2*p[0]-comp.lo-comp.hi)/(comp.hi-comp.lo),-1,1);let theta=Math.acos(cosine);if(p[1]<0)theta=2*Math.PI-theta;const k=theta/(2*Math.PI)*steps,j=Math.min(steps-1,Math.floor(k));return (cum[j]+(k-j)*(cum[j+1]-cum[j]))/length};
  const point=u=>{u=((u%1)+1)%1;const target=u*length;let low=0,high=steps;while(high-low>1){const mid=(low+high)>>1;if(cum[mid]<target)low=mid;else high=mid}return at((low+(target-cum[low])/(cum[high]-cum[low]||1))/steps)};
  let intervals=[[0,1]];
  if(level.local){
   const center=map(level.center,t,1,lateral),inside=p=>Math.hypot(...map(p,t,1,lateral).map((x,k)=>x-center[k]))<=(level.radius??.42),flags=ps.slice(0,-1).map(inside);intervals=[];
   if(flags.every(Boolean))intervals=[[0,1]];
   else if(flags.some(Boolean)){
    // Start outside so a local arc crossing the chart seam stays a single arc.
    const start=flags.findIndex(v=>!v);let begin=null;
    for(let k=1;k<=steps;k++){const i=(start+k)%steps,on=flags[i],u=cum[i]/length+(start+k>=steps?1:0);if(on&&begin===null)begin=u;if(!on&&begin!==null){intervals.push([begin,u]);begin=null}}
    if(begin!==null)intervals.push([begin,cum[start]/length+1]);
   }
  }
  for(const [segment,[lo,hi]] of intervals.entries())if((hi-lo)*length>1e-5)charts.push({id:`${level.id}:${componentIndex}:${segment}`,component:componentIndex,segment,comp,length:(hi-lo)*length,wholeLength:length,lo,hi,closed:hi-lo>.999999,arc,point});
 }
 return charts;
}
function chartCoordinate(chart,p){if(p[0]<chart.comp.lo-1e-7||p[0]>chart.comp.hi+1e-7)return null;let u=chart.arc(p);while(u<chart.lo-1e-7)u++;return u<=chart.hi+1e-7?u:null}
function seedDepth(i,intervals){if(i===0||i===intervals)return 0;let depth=Math.log2(intervals/4);while(depth>0&&i%2===0){i/=2;depth--}return Math.max(0,depth)}
export class ArrowTracker{
 constructor(t=2.4){this.t=t;this.lateral=0;this.particles=[];this.nextId=1;this.adaptClock=1;this.spacing=0;this.lod=0;this.localSpacing=.1;this.failures=0;this.failureRecords=[];this.visibleFailures=0;this.maxTransportStep=0;this.cohortSerial=0;this.rows=[]}
 update(t,dt,spacing,lod=0,localSpacing=.1,lateral=0){
  dt=Math.min(.05,Math.max(0,dt));const delta=t-this.t,steps=Math.max(1,Math.ceil(Math.abs(delta)/.002)),step=delta/steps;
  for(let j=1;j<=steps;j++){const tj=this.t+step*j,levels=new Map(trackedLevels(tj,lod).map(l=>[l.id,l]));
   for(const a of this.particles){if(a.failed)continue;const l=levels.get(a.level);if(!l){a.retiring=true;a.failed=true;continue}if(l.id.startsWith('fold')&&l.weight===0){a.retiring=true;a.failed=true;continue}const old=a.p,result=continuePoint(old,l.H,tj),distance=Math.hypot(...result.p.map((x,k)=>x-old[k])),grad=Math.hypot(...transportGradient(old,tj));
    if(!result.ok||distance>.035){a.failed=true;a.retiring=true;this.failures++;if(a.alpha*(a.weight??1)*transportSmooth(a.local?.002:.06,a.local?.035:.24,grad)>.1){this.visibleFailures++;this.failureRecords.push({t:tj,id:a.id,level:a.level,grad,alpha:a.alpha,distance,ok:result.ok,p:old});}continue}
    a.p=result.p;a.H=l.H;this.maxTransportStep=Math.max(this.maxTransportStep,distance);
   }
  }
  this.t=t;const levels=trackedLevels(t,lod),byId=new Map(levels.map(l=>[l.id,l]));
  for(const a of this.particles){a.H=transportHeight(a.p,t);const l=byId.get(a.level),grad=Math.hypot(...transportGradient(a.p,t));a.feature=l?.feature??true;a.local=l?.local??a.local;a.regular=l?.regular??a.regular;a.criticalId=l?.criticalId??a.criticalId;const distance=l?.center?Math.hypot(...map(a.p,t,1,lateral).map((v,i)=>v-map(l.center,t,1,lateral)[i])):0;a.weight=(l?.weight??0)*transportSmooth(a.local?.002:.06,a.local?.035:.24,grad)*(a.local?1-transportSmooth((l?.radius??.42)*.6,l?.radius??.42,distance):1);if(a.failed)a.weight=0;a.alpha=transportClamp(a.alpha+(a.retiring?-dt/.24:dt/.3),0,1)}
  this.particles=this.particles.filter(a=>!a.retiring||a.alpha>0);
  this.adaptClock+=dt;
  if(this.adaptClock>.2||Math.abs(spacing-this.spacing)>.1*Math.max(.01,this.spacing)||Math.abs(lod-this.lod)>.04||Math.abs(localSpacing-this.localSpacing)>.01||Math.abs(lateral-this.lateral)>.008){
   this.adaptClock=0;this.spacing=spacing;this.lod=lod;this.localSpacing=localSpacing;this.lateral=lateral;
   this.rows=[];
   for(const l of levels){if(l.weight<.02)continue;const gapSpacing=l.local?localSpacing:spacing,charts=rowCharts(l,t,lateral),family=this.particles.filter(a=>a.level===l.id&&!a.retiring);
    for(const a of family){a.row=null;a.order=null}
    for(const chart of charts){
     const live=[];
     for(const a of family){const u=chartCoordinate(chart,a.p);if(u===null)continue;a.row=chart.id;a.component=chart.component;a.segment=chart.segment;a.order=u;live.push(a)}
     live.sort((a,b)=>a.order-b.order);
     const add=(u,depth,cohort,slot=null,latticeId=null)=>{const p=chart.point(u),grad=Math.hypot(...transportGradient(p,t)),distance=l.center?Math.hypot(...map(p,t,1,lateral).map((v,i)=>v-map(l.center,t,1,lateral)[i])):0,weight=l.weight*transportSmooth(l.local?.002:.06,l.local?.035:.24,grad)*(l.local?1-transportSmooth((l.radius??.42)*.6,l.radius??.42,distance):1),a={id:this.nextId++,level:l.id,row:chart.id,component:chart.component,segment:chart.segment,order:u,depth,cohort,slot,lattice:slot,baseCount:4,latticeId,p,H:l.H,feature:l.feature,local:!!l.local,regular:!!l.regular,criticalId:l.criticalId,alpha:0,weight,retiring:false,failed:false};this.particles.push(a);return a};
     if(!live.length){
      const wanted=Math.max(4,chart.length/gapSpacing),intervals=Math.min(256,2**Math.round(Math.log2(wanted))),cohort=`${chart.id}:${++this.cohortSerial}`;
      for(let i=0;i<(chart.closed?intervals:intervals+1);i++){const u=chart.closed?chart.lo+(i/intervals+.0875)%1:chart.lo+(chart.hi-chart.lo)*i/intervals;live.push(add(u,seedDepth(i,intervals),cohort+':'+seedDepth(i,intervals),4*i/intervals,cohort))}
      live.sort((a,b)=>a.order-b.order);
     }else{
      const intervalCount=chart.closed?live.length:Math.max(1,live.length-1),maxDepth=Math.max(...live.map(a=>a.depth||0)),top=live.filter(a=>(a.depth||0)===maxDepth),remaining=live.length-top.length;
      // A density change acts on an entire nested cohort, never individual
      // crowded arrows. Hysteresis keeps rows from alternately filling/emptying.
      if(maxDepth>0&&remaining>=(chart.closed?4:3)&&chart.length/(chart.closed?remaining:remaining-1)<gapSpacing*.9){for(const a of top)a.retiring=true}
      else if(chart.length/intervalCount>gapSpacing*1.35&&live.length<256){
       const cohort=`${chart.id}:${++this.cohortSerial}`,pairs=chart.closed?live.length:live.length-1;
       for(let i=0;i<pairs;i++){const left=live[i],right=live[(i+1)%live.length],rightOrder=i+1<live.length?right.order:right.order+1,sameLattice=left.latticeId&&left.latticeId===right.latticeId;let rightSlot=right.slot;if(sameLattice&&rightSlot<left.slot)rightSlot+=4;add((left.order+rightOrder)/2,maxDepth+1,cohort,sameLattice?((left.slot+rightSlot)/2)%4:((2*i+1)/2**(maxDepth+1))%4,sameLattice?left.latticeId:cohort)}
      }
     }
     this.rows.push({id:chart.id,level:l.id,component:chart.component,segment:chart.segment,closed:chart.closed,length:chart.length,count:live.length});
    }
   }
   // Whole invisible cohorts that have left a local support can be reclaimed.
   // This never creates a visible puncture in a row.
   const unused=new Map();for(const a of this.particles){if(a.retiring||!a.local)continue;const key=a.cohort??String(a.id);if(!unused.has(key))unused.set(key,[]);unused.get(key).push(a)}
   for(const members of unused.values())if(members.every(a=>a.row===null&&a.weight<.01))for(const a of members)a.retiring=true;

  }
  return this.particles;
 }
}
