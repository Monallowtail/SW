import {patchRadius,critical,field,map,pushedField,prepared} from './model.js';
const norm=p=>Math.hypot(...p), unit=p=>{const n=norm(p);return p.map(x=>x/n)},dist=(p,q)=>Math.hypot(...p.map((x,i)=>x-q[i]));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const add=(p,v,h)=>unit(p.map((x,i)=>x+h*v[i]));
function rk(p,h,engine,direction){
 const f=p=>{const v=engine.field(p),n=norm(v);return v.map(x=>direction*x/Math.max(n,1e-30))};
 const a=f(p),b=f(add(p,a,h/2)),c=f(add(p,b,h/2)),d=f(add(p,c,h));
 return unit(p.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6));
}
// Same induced-metric field for ordinary orbits and all separatrices. Only the
// appropriate extremum is terminal; passing close to a saddle never stops a ray.
export function traceIntegral(seed,depths,lateral=0,direction=1,cps=critical(depths,-1),tolerance=.0007,saddleEndpointIds=[],maxLength=14){
 const engine=prepared(depths,-1,lateral);let p=unit(seed),physicalP=engine.map(p),length=0;const result=[p],ends=cps.filter(c=>c.m===(direction>0?2:0)||(c.m===null&&c.birthIndex===(direction>0?2:0)));
 for(let k=0;k<1800;k++){
  const nearest=ends.reduce((a,c)=>!a||dist(p,c.p)<dist(p,a.p)?c:a,null);
  if(nearest&&dist(p,nearest.p)<tolerance){
   if(nearest.m!==null)break;
   // At the fold, proximity alone is NOT terminal: passing orbits must remain
   // intact. Stop only an index-appropriate approach with vanishing actual gradient.
   const v=field(p,depths,-1,lateral),toward=direction*dot(v,p.map((x,i)=>x-nearest.p[i]));
   if(norm(v)<1e-5&&toward<0)break;
  }
  // Separatrices alone may end on a genuine heteroclinic saddle. Require
  // vanishing gradient and alignment with the stable approach, never proximity
  // alone. Ordinary trajectories do not enable this rule.
  const connection=cps.find(c=>saddleEndpointIds.includes(c.id)&&dist(p,c.p)<tolerance);
  if(connection){const v=field(p,depths,-1,lateral),to=connection.p.map((x,i)=>x-p[i]);if(norm(v)<1e-6&&direction*dot(v,to)/(norm(v)*norm(to))>.995)break;}
  const gap=Math.min(...cps.map(c=>dist(p,c.p)));let h=Math.min(.05,Math.max(1e-7,.32*gap)),q,physicalQ;
  for(let j=0;j<12;j++){
   q=rk(p,h,engine,direction);const mid=unit(p.map((x,i)=>x+q[i])),data=engine.fieldData(mid),g=data.V,v=q.map((x,i)=>x-p[i]);
   const qb=physicalQ=engine.map(q),physical=qb.map((x,i)=>x-physicalP[i]),pg=data.G;
   if(direction*dot(v,g)/(norm(v)*norm(g))>.9997&&direction*dot(physical,pg)/(norm(physical)*norm(pg))>.9995)break;h*=.5;
  }
  const ds=dist(p,q);if(!q.every(Number.isFinite)||ds<1e-11)break;length+=ds;if(length>maxLength)break;
  result.push(q);p=q;physicalP=physicalQ;
 }return result;
}
function saddleDirections(c,depths,lateral){
 const p=c.p,e=c.frame?.[0]||unit(Math.abs(p[2])<.9?[-p[1],p[0],0]:[p[2],0,-p[0]]),f=c.frame?.[1]||[p[1]*e[2]-p[2]*e[1],p[2]*e[0]-p[0]*e[2],p[0]*e[1]-p[1]*e[0]],eps=1e-6;
 // Linearization in an orthonormal SOURCE tangent frame. This nonsymmetric
 // Jacobian already includes the pulled-back metric and horizontal stretch.
 const column=v=>{const a=field(add(p,v,eps),depths,-1,lateral),b=field(add(p,v,-eps),depths,-1,lateral),d=a.map((x,i)=>(x-b[i])/(2*eps));return [dot(d,e),dot(d,f)]};
 const [a,c0]=column(e),[b,d]=column(f),root=Math.sqrt((a-d)**2+4*b*c0),values=[(a+d-root)/2,(a+d+root)/2];
 return values.map(value=>{let v=Math.abs(b)>Math.abs(c0)?[b,value-a]:[value-d,c0];if(norm(v)<1e-10)v=Math.abs(a-value)<Math.abs(d-value)?[1,0]:[0,1];v=unit(v);return {flow:Math.sign(value),v:e.map((x,i)=>x*v[0]+f[i]*v[1]),value}});
}
export function* generateSaddleBranches(depths,lateral=0,cps=critical(depths,-1),maxLength=14,saddleIds=null){
 for(const c of cps.filter(c=>c.m===1&&(!saddleIds||saddleIds.includes(c.id))))for(const [axis,dir] of saddleDirections(c,depths,lateral).entries())for(const side of [-1,1]){
  const gap=Math.min(...cps.filter(x=>x.id!==c.id).map(x=>dist(x.p,c.p))),eps=Math.min(1e-6,gap*1e-4),seed=add(c.p,dir.v,side*eps),ps=[c.p,...traceIntegral(seed,depths,lateral,dir.flow,cps,.0007,cps.filter(x=>x.m===1&&x.id!==c.id).map(x=>x.id),maxLength)];
  let arc=0;const id=`${c.id}:${axis}:${side}`;
  yield {id,criticalId:c.id,flow:dir.flow,eigenvalue:dir.value,points:ps.map((p,i)=>{if(i)arc+=dist(p,ps[i-1]);return {id:`branch:${id}:${i}`,p,s:arc,weight:1}})};
 }
}

export function saddleBranches(depths,lateral=0,cps=critical(depths,-1)){return {center:null,radius:patchRadius,weight:1,branches:[...generateSaddleBranches(depths,lateral,cps)]}}
