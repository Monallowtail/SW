import {TAU,add,sub,mul,dot,cross,unit} from './geometry.js';
import {SURFACES,surfaceMesh,createSurfaceEngine} from './surfaces.js';
const align=(a,b)=>dot(a,b)<0?-1:1;
function gradient(engine,e){const h=7e-5,b=e.b;return[0,1].map(k=>{const p=engine.evaluate(engine.move(e.p,b,k?0:h,k?h:0)),m=engine.evaluate(engine.move(e.p,b,k?0:-h,k?-h:0));return (p.lambda*(engine.direct?1:align(p.n,e.n))-m.lambda*(engine.direct?1:align(m.n,e.n)))/(2*h)})}
function contourPoint(engine,p){for(let i=0;i<9;i++){const e=engine.evaluate(p);if(Math.abs(e.lambda)<2e-10)return e;const g=gradient(engine,e),gg=dot(g,g);if(gg<1e-14)return e;p=engine.move(p,e.b,-e.lambda*g[0]/gg,-e.lambda*g[1]/gg)}return engine.evaluate(p)}
function kernel(engine,e){if(engine.direct){const x=[e.a1[0],e.a2[0]],z=[e.a1[2],e.a2[2]],r=dot(x,x)>dot(z,z)?x:z,l=Math.hypot(...r)||1;return[-r[1]/l,r[0]/l]}const A=dot(e.a1,e.a1),B=dot(e.a1,e.a2),C=dot(e.a2,e.a2),d=A*C-B*B;return[(C*e.a1[1]-B*e.a2[1])/d,(A*e.a2[1]-B*e.a1[1])/d]}
function cuspValue(engine,e){return dot(gradient(engine,e),kernel(engine,e))}
function cuspAt(engine,e,ref){if(!engine.direct)return cuspValue(engine,e)*align(e.n,ref.n);const b=engine.evaluate(engine.lift(e.p,ref.p)),k=kernel(engine,b),r=kernel(engine,ref),v=add(mul(b.b[0],k[0]),mul(b.b[1],k[1])),w=add(mul(ref.b[0],r[0]),mul(ref.b[1],r[1]));return cuspValue(engine,b)*(dot(v,w)<0?-1:1)}
function brief(e){return{p:e.p,q:e.q,n:e.n}}
export function computeManifold(state,level=4){
 const start=performance.now(),kind=state.surface,engine=createSurfaceEngine(state),mesh=surfaceMesh(kind,level),samples=mesh.points.map(engine.evaluate),nodes=[],edgeNodes=new Map(),segments=[];
 let minDet=Math.min(...samples.map(e=>e.det)),maxResidual=0,ambiguous=false;
 if(engine.direct)for(const p of [[1,1,0],[1,-1,0],[0,1,1],[0,1,-1],[1,0,1],[1,0,-1]])minDet=Math.min(minDet,engine.evaluate(unit(p)).det);
 const local=(e,ref)=>engine.evaluate(engine.lift(e.p,ref));
 const cut=(a,b,ea,eb)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edgeNodes.has(key))return edgeNodes.get(key);let lo=ea,hi=eb,e=lo,fl=lo.lambda,fh=hi.lambda;
  for(let i=0;i<36;i++){const t=i%3===2?.5:Math.max(.04,Math.min(.96,fl/(fl-fh)));e=engine.evaluate(engine.interpolate(lo.p,hi.p,t));const f=e.lambda;if(Math.abs(f)<2e-10)break;if((f<0)===(fl<0)){lo=e;fl=f}else{hi=e;fh=f}}
  const id=nodes.length;nodes.push(e);edgeNodes.set(key,id);maxResidual=Math.max(maxResidual,Math.abs(e.lambda));return id;
 };
 for(const tri of mesh.triangles){const es=tri.map(k=>local(samples[k],samples[tri[0]].p)),normal=es[0].n,ls=es.map(e=>e.lambda),cuts=[];
  for(let k=0;k<3;k++){const l=(k+1)%3;if((ls[k]<0)!==(ls[l]<0))cuts.push(cut(tri[k],tri[l],{...es[k],lambda:ls[k]},{...es[l],lambda:ls[l]}))}
  if(cuts.length!==2)continue;
  let[a,b]=cuts;const p0=es[0].p,pa=engine.lift(nodes[a].p,p0),pb=engine.lift(nodes[b].p,p0),positive=es[ls.findIndex(l=>l>=0)].p;
  const midpoint=engine.interpolate(pa,pb,.5),ee=engine.evaluate(midpoint),t=sub(pb,pa),v=sub(positive,midpoint),tx=dot(t,ee.b[0]),ty=dot(t,ee.b[1]),vx=dot(v,ee.b[0]),vy=dot(v,ee.b[1]);
  // es and ee have the same local source orientation; ensure λ-positive is left.
  if((tx*vy-ty*vx)<0)[a,b]=[b,a];segments.push([a,b]);
 }
 const out=new Map(),incoming=new Map();for(const[a,b]of segments){if(out.has(a)||incoming.has(b))ambiguous=true;out.set(a,b);incoming.set(b,a)}
 let closed=!ambiguous&&out.size===nodes.length&&incoming.size===nodes.length,nearDegenerate=ambiguous,maxAngle=0;const seen=new Set(),components=[];
 for(let start=0;start<nodes.length;start++){if(seen.has(start))continue;let ids=[],id=start;while(id!==undefined&&!seen.has(id)){ids.push(id);seen.add(id);id=out.get(id)}const loopClosed=id===start;closed&&=loopClosed;if(ids.length<3){nearDegenerate=true;continue}let path=ids.map(i=>nodes[i]);
  for(let pass=0;pass<6;pass++){let change=false,next=[];for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];next.push(a);const angle=Math.atan2(a.n[0]*b.n[2]-a.n[2]*b.n[0],a.n[0]*b.n[0]+a.n[2]*b.n[2]);if(Math.min(Math.abs(angle),Math.abs(Math.PI-Math.abs(angle)))>.13||engine.distance(a.p,b.p)>.045){next.push(contourPoint(engine,engine.interpolate(a.p,b.p,.5)));change=true}}path=next;if(!change)break}
  const cs=path.map(e=>cuspValue(engine,e)),cusps=[];let winding=0,minGrad=Infinity,minCuspSlope=Infinity;
  for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],za=[a.n[0]**2-a.n[2]**2,2*a.n[0]*a.n[2]],zb=[b.n[0]**2-b.n[2]**2,2*b.n[0]*b.n[2]],da=Math.atan2(za[0]*zb[1]-za[1]*zb[0],dot(za,zb));winding+=da;maxAngle=Math.max(maxAngle,Math.abs(da));
   const ca=cs[i],cb=cuspAt(engine,b,a);
   if(ca*cb<0){let lo=a,hi=b,fl=ca,fh=cb,e;for(let j=0;j<32;j++){const t=j%3===2?.5:Math.max(.04,Math.min(.96,fl/(fl-fh)));e=contourPoint(engine,engine.interpolate(lo.p,hi.p,t));const f=cuspAt(engine,e,a);if(Math.abs(f)<2e-7)break;if((f<0)===(fl<0)){lo=e;fl=f}else{hi=e;fh=f}}if(e&&!cusps.some(c=>engine.distance(c.p,e.p)<2e-4)){e.residual=Math.abs(cuspValue(engine,e));cusps.push(e)}}
   if(i%Math.max(1,Math.floor(path.length/50))===0)minGrad=Math.min(minGrad,Math.hypot(...gradient(engine,a)));
  }
  for(const c of cusps){const g=gradient(engine,c),t=unit([g[1],-g[0],0]),h=3e-4,a=contourPoint(engine,engine.move(c.p,c.b,t[0]*h,t[1]*h)),b=contourPoint(engine,engine.move(c.p,c.b,-t[0]*h,-t[1]*h)),slope=Math.abs((cuspAt(engine,a,c)-cuspAt(engine,b,c))/(2*h));minCuspSlope=Math.min(minCuspSlope,slope)}
  for(let i=0;i<cs.length;i++){const a=Math.abs(cs[i]),prev=cuspAt(engine,path[(i+cs.length-1)%cs.length],path[i]),next=cuspAt(engine,path[(i+1)%cs.length],path[i]);if(a<.003&&a<=Math.abs(prev)&&a<=Math.abs(next)&&prev*next>0)nearDegenerate=true}
  const raw=winding/TAU,degree=Math.round(raw)||0;if(minGrad<.01||minCuspSlope<.025||Math.abs(raw-degree)>1e-5||maxAngle>1.5)nearDegenerate=true;
  components.push({path:path.map(brief),cusps:cusps.map(e=>({...brief(e),residual:e.residual})),degree,raw,minGrad,minCuspSlope,closed:loopClosed});
 }
 components.sort((a,b)=>b.path.length-a.path.length||a.degree-b.degree);const total=components.reduce((s,c)=>s+c.degree,0),cuspCount=components.reduce((s,c)=>s+c.cusps.length,0),chi=SURFACES[kind].chi;
 return{state:{...state,depths:[...state.depths]},level,points:samples.map(e=>e.q),source:mesh.points,triangles:mesh.triangles,components,total,cuspCount,closed,nearDegenerate,minDet,maxResidual,maxAngle,valid:closed&&!nearDegenerate&&minDet>.005&&maxResidual<1e-7&&total===chi&&((cuspCount-chi)%2===0),ms:performance.now()-start};
}
export function manifoldRayHits(g,x,z,engine){const hits=[];
 for(const tri of g.triangles){const[a,b,c]=tri.map(k=>g.points[k]),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-15)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-9)continue;
  const src=tri.map(k=>g.source[k]),ref=src[0];let p=engine.normalize(add(add(mul(ref,u),mul(engine.lift(src[1],ref),v)),mul(engine.lift(src[2],ref),w)));
  for(let k=0;k<10;k++){const e=engine.evaluate(p),a=e.a1,b=e.a2,det=a[0]*b[2]-a[2]*b[0];if(Math.abs(det)<1e-10)break;const ex=x-e.q[0],ez=z-e.q[2],du=(ex*b[2]-ez*b[0])/det,dv=(a[0]*ez-a[2]*ex)/det;if(Math.hypot(du,dv)>.2)break;p=engine.move(p,e.b,du,dv);if(Math.hypot(ex,ez)<1e-10)break}
  const q=engine.map(p);if(Math.hypot(q[0]-x,q[2]-z)>2e-5)continue;
  // Compare source points in the quotient, never image depths: intersecting sheets are distinct.
  if(!hits.some(h=>engine.distance(h.p,p)<2e-4))hits.push({p,q});
 }
 return hits.sort((a,b)=>a.q[1]-b.q[1]);
}
