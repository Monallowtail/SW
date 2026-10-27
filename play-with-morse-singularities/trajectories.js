import {critical,map,PATCHES,field,patchRadius,prepared} from './model.js';
import {generateSaddleBranches,traceIntegral} from './branches.js';
const norm=p=>Math.hypot(...p),unit=p=>{const n=norm(p);return p.map(x=>x/n)},dist=(p,q)=>Math.hypot(...p.map((x,i)=>x-q[i]));
const smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u)};
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const traceTrajectory=traceIntegral;
// Both minima and maxima have a transverse, 35%-barrier contour. These
// contour labels identify orbits; conditioned traces retain their full geometry.
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frame=c=>c.frame||(()=>{const axis=Math.abs(c.p[2])<.9?[0,0,1]:[0,1,0],e=unit(cross(axis,c.p));return [e,cross(c.p,e)]})();
// Shoot a genuinely local HEIGHT contour in a transported source tangent frame.
// The conservative directional barrier avoids assuming graph wells, fixed poles,
// or an extremum's continued association with the saddle it was born beside.
export function extremumSection(depths,id,cps=critical(depths,-1)){
 const C=cps.find(c=>c.id===id);if(!C||![0,2].includes(C.m))return null;
 const epsilon=C.m===0?1:-1,p=C.p,[e,f]=frame(C),gap=Math.min(1,...cps.filter(c=>c.id!==id).map(c=>dist(p,c.p))),radius=Math.min(.12,.28*gap);
 const point=(phi,r)=>p.map((x,i)=>Math.cos(r)*x+Math.sin(r)*(Math.cos(phi)*e[i]+Math.sin(phi)*f[i]));
 let delta=Infinity;
 for(let k=0;k<24;k++)delta=Math.min(delta,epsilon*(map(point(2*Math.PI*k/24,radius),depths)[2]-C.h));
 const saddleBarrier=Math.min(Infinity,...cps.filter(c=>c.m===1&&epsilon*(c.h-C.h)>0).map(c=>epsilon*(c.h-C.h)));
 delta=Math.min(.65*delta,.35*saddleBarrier);if(!(delta>1e-14))return null;
 const at=phi=>{let lo=0,hi=radius;for(let k=0;k<24;k++){const mid=(lo+hi)/2;if(epsilon*(map(point(phi,mid),depths)[2]-C.h)<delta)lo=mid;else hi=mid}return point(phi,(lo+hi)/2)};
 return {origin:C.id,center:p,height:C.h+epsilon*delta,delta,gap,at,angleAt:q=>Math.atan2(dot(q,f),dot(q,e))};
}
// Material control handles exist before, during and after any critical events.
// A transverse section supplies prospective ink without inventing future roots.
export function trajectorySections(depths,lateral=0){
 return PATCHES.map(patch=>{const p=patch.sourceAnchor,v=field(p,depths,-1,lateral),[e]=frame({p}),t=norm(v)>1e-9?unit(cross(p,v)):e,width=.16;
 return {index:patch.index,center:p,width,angle:0,at:u=>p.map((x,i)=>Math.cos(u*width)*x+Math.sin(u*width)*t[i])};});
}
export function trajectorySection(depths){return trajectorySections(depths)[0]}
let heightMemo=new WeakMap();
function heightAt(p,depths){if(!heightMemo.has(p))heightMemo.set(p,map(p,depths)[2]);return heightMemo.get(p)}
function contourCrossing(ps,height,depths){for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],ha=heightAt(a,depths),hb=heightAt(b,depths);if(ha<=height&&hb>=height&&hb>ha){const u=(height-ha)/(hb-ha);return unit(a.map((x,j)=>x+(b[j]-x)*u))}}return null}
export function trajectoryOwner(ps,origin,sections){return sections.find(s=>ps.some(p=>dist(p,s.center)<.19))?.index??null}
function nested(base,maxLevel,fn){const out=[];for(let level=0;level<=maxLevel;level++){const n=base*2**level;for(let k=level?1:0;k<n;k+=level?2:1)out.push(fn(k,n,level))}return out}
export function trajectorySeeds(depths=[0,0,0,0],maxLevel=2,lateral=0,cps=critical(depths,-1),locals=null){
 const sections=trajectorySections(depths,lateral),seeds=[];
 for(const s of sections)seeds.push(...nested(8,Math.min(maxLevel,1),(k,n,level)=>{const u=2*k/n-1+.013;return {id:`patch:${s.index}:${n}:${k}`,level,p:s.at(u),family:'section',owner:s.index,angle:u}}));
 for(const c of cps.filter(c=>c.m===0||c.m===2)){
  const s=locals?locals.get(c.id):extremumSection(depths,c.id,cps);if(!s)continue;
  seeds.push(...nested(4,maxLevel,(k,n,level)=>({id:`extremum:${c.id}:${n}:${k}`,level,p:s.at(2*Math.PI*k/n+.173),family:c.m===0?'source':'target',extremum:c.id,origin:c.id,angle:2*Math.PI*k/n+.173})));
 }return seeds;
}
let exactStateCache=null;
// A single iterator is the numerical source of truth for synchronous and worker
// clients. Every yielded curve has passed endpoint classification and canonical
// deduplication; a partial result never contains temporary duplicate families.
export function* trajectoryGenerator(depths,lateral=0,maxLevel=2,rootsSnapshot=null,{sparse=false}={}){
 heightMemo=new WeakMap();
 // Include every root attribute used by contours, branches and endpoints.
 // A fixed material point can change classification near an unresolved fold.
 const cps=rootsSnapshot??critical(depths,-1),key=JSON.stringify([depths,lateral,cps.map(c=>[c.id,c.p,c.frame,c.m,c.h,c.birthIndex])]);
 if(exactStateCache?.key!==key)exactStateCache={key,sections:trajectorySections(depths,lateral),locals:new Map(cps.filter(c=>[0,2].includes(c.m)).map(c=>[c.id,extremumSection(depths,c.id,cps)])),paths:new Map(),branches:null};
 const cache=exactStateCache,{sections,locals,paths}=cache,regular=[],uniqueBranches=[];
 // All four actual saddle incidences are mandatory. Yield each branch rather
 // than blocking on the whole saddle set; shared heteroclinic edges update IDs.
 const branches=cache.branches??generateSaddleBranches(depths,lateral,cps),saved=[];
 for(const b of branches){saved.push(b);const end=cps.find(c=>c.m===1&&c.id!==b.criticalId&&dist(c.p,b.points.at(-1).p)<.0015);let shared=false;
  if(end){const mate=uniqueBranches.find(q=>q.criticalId===end.id&&q.endCriticalId===b.criticalId);if(mate){const h=(cps.find(c=>c.id===b.criticalId).h+end.h)/2,oriented=q=>q.flow>0?q.points.map(x=>x.p):q.points.map(x=>x.p).reverse(),p=contourCrossing(oriented(b),h,depths),q=contourCrossing(oriented(mate),h,depths);if(p&&q&&dist(p,q)<1e-5){mate.localBranchIds.push(b.id);shared=true;yield {patches:[],curves:[...uniqueBranches],radius:patchRadius,updated:mate}}}}
  if(!shared){const c={...b,endCriticalId:end?.id,localBranchIds:[b.id],kind:'saddle',level:0,weight:1};uniqueBranches.push(c);yield {patches:[],curves:[...uniqueBranches],radius:patchRadius,added:c}}
 }cache.branches=saved;
 const endpoint=(p,index)=>cps.filter(c=>c.m===index||(c.m===null&&c.birthIndex===index)).reduce((best,c)=>!best||dist(p,c.p)<dist(p,best.p)?c:best,null);
 // Round-robin the angular samples across extrema, coarse before optional ink.
 const order=(a,b)=>a.level-b.level||(a.family==='section')-(b.family==='section')||Number(a.id.split(':').at(-1))-Number(b.id.split(':').at(-1))||a.id.localeCompare(b.id);
 // Stability-first snapshots always solve the same full material trajectories.
 // Unlike the legacy interaction core this set never depends on activePatch or
 // whether the pointer is moving. Zoom only inserts stable angular cohorts.
 const pool=trajectorySeeds(depths,sparse?0:maxLevel,lateral,cps,locals);
 const seeds=(sparse?pool.flatMap(seed=>{
  const k=Number(seed.id.split(':').at(-1));
  if(seed.family==='section')return k===4?[seed]:[];
  const born=seed.extremum!=='A'&&seed.extremum!=='D';
  const level=born||k===0||k===2?0:2;
  return level<=maxLevel?[{...seed,level}]:[];
 }):pool).sort(order).slice(0,160);
 for(const seed of seeds){
  let candidate=paths.get(seed.id);
  if(!paths.has(seed.id)){
   paths.set(seed.id,null);
   const reverse=traceIntegral(seed.p,depths,lateral,-1,cps).reverse(),forward=traceIntegral(seed.p,depths,lateral,1,cps),ps=[...reverse.slice(0,-1),...forward],source=endpoint(ps[0],0),target=endpoint(ps.at(-1),2);
   if(!source||!target||dist(ps[0],source.p)>.0015||dist(ps.at(-1),target.p)>.0015){yield {patches:[],curves:[...uniqueBranches,...regular],radius:patchRadius,checkpoint:true};continue}
   const angleFor=c=>{const local=locals.get(c.id),p=local&&contourCrossing(ps,local.height,depths);return p?local.angleAt(p):null},angle=angleFor(source),targetAngle=angleFor(target);
   if(angle===null||targetAngle===null){yield {patches:[],curves:[...uniqueBranches,...regular],radius:patchRadius,checkpoint:true};continue}
   let arc=0;const arcs=ps.map((p,i)=>{if(i)arc+=dist(p,ps[i-1]);return arc}),zero=arcs[reverse.length-1];
   candidate={id:`seed:${seed.id}`,criticalId:source.id,origin:source.id,target:target.id,kind:'regular',family:seed.family,extremum:seed.extremum,owner:trajectoryOwner(ps,source.id,sections,depths),level:seed.level,flow:1,seed:seed.p,angle,targetAngle,points:ps.map((p,i)=>({id:`trajectory:${seed.id}:${i-reverse.length+1}`,p,s:arcs[i]-zero,weight:1}))};paths.set(seed.id,candidate);
  }
  if(!candidate)continue;
  const c=sparse?{...candidate,level:seed.level}:candidate,peers=regular.filter(q=>q.origin===c.origin&&q.target===c.target);
  if(peers.some(q=>Math.abs(angleDiff(q.angle,c.angle))<1e-6&&Math.abs(angleDiff(q.targetAngle,c.targetAngle))<1e-6))continue;
  regular.push(c);yield {patches:[],curves:[...uniqueBranches,...regular],radius:patchRadius,added:c};
 }
 return {patches:[],curves:[...uniqueBranches,...regular],radius:patchRadius};
}
export function allTrajectories(depths,lateral=0,maxLevel=2,rootsSnapshot=null,options={}){const it=trajectoryGenerator(depths,lateral,maxLevel,rootsSnapshot,options);let step;do{step=it.next()}while(!step.done);return step.value}
// During deformation display short, genuine integral-curve segments. Their
// seeds and integration rule are exactly those of the final trajectories; no
// old geometry, guessed endpoint, or straight-line bridge is introduced.
export function coreTrajectories(depths,lateral=0,rootsSnapshot=null,activePatch=0){
 const cps=rootsSnapshot??critical(depths,-1),limit=.32,engine=prepared(depths,-1,lateral),curves=[];
 const anchor=PATCHES[activePatch]?.sourceAnchor??PATCHES[0].sourceAnchor,nearest=items=>items.sort((a,b)=>dist(a.p,anchor)-dist(b.p,anchor))[0],saddle=nearest(cps.filter(c=>c.m===1)),extrema=[0,2].map(m=>nearest(cps.filter(c=>c.m===m))?.id);
 for(const b of generateSaddleBranches(depths,lateral,cps,limit,saddle?[saddle.id]:[]))curves.push({...b,kind:'saddle',level:0,localBranchIds:[b.id],coreLimit:limit});
 const seeds=trajectorySeeds(depths,0,lateral,cps).filter(s=>s.family==='section'?Number(s.id.split(':').at(-1))===4:extrema.includes(s.extremum)&&Number(s.id.split(':').at(-1))===0);
 for(const seed of seeds){
  const reverse=traceIntegral(seed.p,depths,lateral,-1,cps,.0007,[],limit).reverse(),forward=traceIntegral(seed.p,depths,lateral,1,cps,.0007,[],limit),ps=[...reverse.slice(0,-1),...forward];
  let arc=0;const arcs=ps.map((p,i)=>{if(i)arc+=dist(p,ps[i-1]);return arc}),zero=arcs[reverse.length-1];
  curves.push({id:`seed:${seed.id}`,criticalId:seed.extremum,extremum:seed.extremum,kind:'regular',family:seed.family,owner:seed.owner,level:0,flow:1,seed:seed.p,coreLimit:limit,points:ps.map((p,i)=>({id:`trajectory:${seed.id}:${i-reverse.length+1}`,p,s:arcs[i]-zero,weight:1}))});
 }
 for(const c of curves)for(const p of c.points){const d=engine.fieldData(p.p);p.mapped=d.q;p.sourceGradient=d.V;p.physicalGradient=d.G}
 return {patches:[],curves,radius:patchRadius};
}
export function trajectoryLevelWeight(level,scale){return level===0?1:smooth(160*2**(level-1),270*2**(level-1),scale)}
