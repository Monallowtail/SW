import {a,critical,field} from './model.js';
import {saddleBranches} from './branches.js';

// Local integral curves of the current Euclidean-height gradient on Y, pulled
// back to the source sphere. No screen-space rays or contour interpolations.
const flowSmooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u)};
const flowNorm=p=>Math.hypot(...p),flowUnit=p=>{const n=flowNorm(p);return n?p.map(x=>x/n):[0,0,0]};
export const flowDistance=(p,q)=>2*Math.asin(Math.min(1,flowNorm(p.map((x,k)=>x-q[k]))/2));
function flowStep(p,h,t,lateral,direction){
 const f=q=>flowUnit(field(flowUnit(q),t,-1,lateral)).map(x=>direction*x),add=(q,k,s)=>flowUnit(q.map((x,j)=>x+s*k[j]));
 const k1=f(p),k2=f(add(p,k1,h/2)),k3=f(add(p,k2,h/2)),k4=f(add(p,k3,h));
 return flowUnit(p.map((x,j)=>x+h*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6));
}
function extremumCurves(c,radius,t,lateral,weight){
 const e=[c.p[2],0,-c.p[0]],direction=c.m===2?1:-1,step=radius/96;
 // Seed at the outer ring, then integrate inward. Uniform boundary angles avoid
 // the unstable visual bunching of tiny seeds expanded out of an anisotropic zero.
 return [0,4,2,6,1,5,3,7].map(k=>{
  const angle=k*Math.PI/4,v=e.map((x,j)=>x*Math.cos(angle)+(j===1?Math.sin(angle):0));
  let p=c.p.map((x,j)=>Math.cos(radius)*x+Math.sin(radius)*v[j]);const points=[],roundPole=(c.id==='A'||c.id==='D')&&Math.sin(radius)<a;
  for(let i=0;i<180;i++){
   const distance=flowDistance(p,c.p);if(distance<.08*radius)break;
   points.push({id:`flow:${c.id}:${k}:${i}`,p,s:i*step,distance,weight:weight*(1-flowSmooth(.56*radius,radius,distance))});
   // Two half RK4 steps per sample keep source-arclength integration accurate
   // even in the most anisotropic supported lateral metric.
   if(roundPole){
    // Entire pole patch lies outside the support x>a of BOTH deformations.
    // These great-circle meridians are therefore the exact current gradient
    // trajectories, not radial substitutes for the anisotropic C curves.
    const angle=radius-(i+1)*step;p=c.p.map((x,j)=>Math.cos(angle)*x+Math.sin(angle)*v[j]);
   }else p=flowStep(flowStep(p,step/2,t,lateral,direction),step/2,t,lateral,direction);
  }
  return {id:`${c.id}:${k}`,criticalId:c.id,kind:'extremum',flow:direction,points};
 });
}
export function criticalFlows(t,lateral=0){
 const cps=critical(t,-1),saddle=saddleBranches(t,lateral),patches=[],curves=[];
 const B=cps.find(c=>c.id==='B'),C=cps.find(c=>c.id==='C');
 // Fade the curve layer before the fold accelerates the shrinking outer tail.
 // The ordinary field takes over; no bright temporal tail chases a vanishing zero.
 const foldWeight=B&&C?flowSmooth(.10,.32,flowDistance(B.p,C.p)):0;
 for(const c of cps){
  if(c.m===null)continue;
  if(c.m===1){
   patches.push({id:c.id,p:c.p,radius:saddle.radius,weight:saddle.weight*foldWeight});
   curves.push(...saddle.branches.map(b=>({...b,criticalId:c.id,kind:'saddle',points:b.points.map(p=>({...p,weight:p.weight*foldWeight,distance:flowDistance(p.p,c.p)}))})));continue;
  }
  // The pole patch follows the nearby *potential* fold even before birth. This
  // avoids an abrupt A/D radius change when B/C enter or leave critical().
  const foldZ=Math.sqrt(1-.55**2),neighbors=[...cps.filter(q=>q.id!==c.id).map(q=>q.p),...(c.id==='C'?[]:[[.55,0,foldZ],[.55,0,-foldZ]])];
  const gap=Math.min(...neighbors.map(q=>flowDistance(q,c.p))),radius=Math.min(c.id==='C'?.36:Math.asin(a)-.001,.46*gap),weight=c.id==='C'?saddle.weight*foldWeight:1;
  if(radius<1e-6)continue;
  patches.push({id:c.id,p:c.p,radius,weight});curves.push(...extremumCurves(c,radius,t,lateral,weight));
 }
 return {patches,curves,radius:saddle.radius};
}
export function flowPatchWeight(p,patch){return patch.weight*(1-flowSmooth(.48*patch.radius,patch.radius,flowDistance(p,patch.p)))}
