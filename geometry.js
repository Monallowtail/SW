import {createSurfaceEngine} from './surfaces.js';
import {computeManifold,manifoldRayHits} from './manifold.js';
import {prepare,inverse,determinant} from './elastic.js';
export const TAU=2*Math.PI;
export const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), mul=(a,s)=>a.map(x=>x*s);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1));
export const mv=(A,v)=>[dot(A.slice(0,3),v),dot(A.slice(3,6),v),dot(A.slice(6,9),v)];
export function rotation(p,yaw=0,pitch=0){const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),d=s*p[0]+c*p[1];return[c*p[0]-s*p[1],cp*d+sp*p[2],cp*p[2]-sp*d]}
export function createEngine(state){
 if(state.surface&&state.surface!=='sphere')return createSurfaceEngine(state);
 const engine=prepare(state.depths,32,-1,state.lateral||0),yaw=state.yaw||0,pitch=state.pitch||0;
 const evaluate=p=>{const e=engine.evaluate(p,true),q=rotation(e.q,yaw,pitch),cols=[0,1,2].map(k=>rotation([e.J[k],e.J[3+k],e.J[6+k]],yaw,pitch)),J=[0,1,2].flatMap(i=>cols.map(v=>v[i])),I=inverse(J),n=[0,1,2].map(i=>I[i]*p[0]+I[3+i]*p[1]+I[6+i]*p[2]),det=determinant(J);return {p,q,J,I,n:unit(n),lambda:-det*n[1],det}};
 return {evaluate,map:p=>rotation(engine.map(p),yaw,pitch)};
}
const meshes=new Map();
export function sphereMesh(level=4){
 if(meshes.has(level))return meshes.get(level);
 const t=(1+Math.sqrt(5))/2;let points=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(unit);
 let triangles=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 for(let n=0;n<level;n++){const edges=new Map(),mid=(a,b)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))return edges.get(key);const k=points.length;points.push(unit(add(points[a],points[b])));edges.set(key,k);return k};triangles=triangles.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return[[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]]})}
 // A fixed generic rotation avoids the entire equator lying on triangulation edges.
 points=points.map(p=>rotation(rotation(p,.137,.219),.073,-.041));
 const mesh={points,triangles};meshes.set(level,mesh);return mesh;
}
export function gradientLambda(engine,p){
 const u=unit(cross(p,Math.abs(p[2])<.8?[0,0,1]:[0,1,0])),v=cross(p,u),h=2e-5;
 const du=(engine.evaluate(unit(add(p,mul(u,h)))).lambda-engine.evaluate(unit(add(p,mul(u,-h)))).lambda)/(2*h),dv=(engine.evaluate(unit(add(p,mul(v,h)))).lambda-engine.evaluate(unit(add(p,mul(v,-h)))).lambda)/(2*h);
 return add(mul(u,du),mul(v,dv));
}
export function projectToContour(engine,p){for(let i=0;i<5;i++){const e=engine.evaluate(p);if(Math.abs(e.lambda)<1e-11)return e;const g=gradientLambda(engine,p),gg=dot(g,g);if(gg<1e-14)return e;p=unit(sub(p,mul(g,e.lambda/gg)))}return engine.evaluate(p)}
function cuspScalar(engine,e){const K=unit([e.I[1],e.I[4],e.I[7]]),h=2e-5;return (engine.evaluate(unit(add(e.p,mul(K,h)))).lambda-engine.evaluate(unit(add(e.p,mul(K,-h)))).lambda)/(2*h)}
export function computeGeometry(state,level=4){
 if(state.surface&&state.surface!=='sphere')return computeManifold(state,level);
 const start=performance.now(),engine=createEngine(state),mesh=sphereMesh(level),samples=mesh.points.map(engine.evaluate),nodes=[],edges=new Map(),segments=[];
 let minDet=Infinity,maxResidual=0;
 for(const s of samples)minDet=Math.min(minDet,Math.abs(s.det));
 const cut=(a,b)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))return edges.get(key);let lo=samples[a],hi=samples[b],fa=lo.lambda,fb=hi.lambda,e;
 for(let n=0;n<48;n++){let f=n%3===2?.5:Math.max(.01,Math.min(.99,fa/(fa-fb)));const p=unit(add(mul(lo.p,1-f),mul(hi.p,f)));e=engine.evaluate(p);if(Math.abs(e.lambda)<1e-12)break;if((e.lambda<0)===(fa<0)){lo=e;fa=e.lambda}else{hi=e;fb=e.lambda}}
 maxResidual=Math.max(maxResidual,Math.abs(e.lambda));const id=nodes.length;nodes.push(e);edges.set(key,id);return id;
 };
 for(const tri of mesh.triangles){const cuts=[];for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3];if((samples[a].lambda<0)!==(samples[b].lambda<0))cuts.push(cut(a,b))}if(cuts.length!==2)continue;let[a,b]=cuts;const midpoint=unit(add(nodes[a].p,nodes[b].p)),t=sub(nodes[b].p,nodes[a].p),positive=samples[tri.find(k=>samples[k].lambda>=0)].p;if(dot(cross(midpoint,t),sub(positive,midpoint))<0)[a,b]=[b,a];segments.push([a,b])}
 const outgoing=new Map(),incoming=new Map();for(const[a,b]of segments){outgoing.set(a,b);incoming.set(b,a)}
 let closed=outgoing.size===nodes.length&&incoming.size===nodes.length;const seen=new Set(),components=[];let nearDegenerate=false,maxAngle=0;
 for(let start=0;start<nodes.length;start++){if(seen.has(start))continue;let ids=[],id=start;while(id!==undefined&&!seen.has(id)){ids.push(id);seen.add(id);id=outgoing.get(id)}const loopClosed=id===start;closed&&=loopClosed;if(ids.length<3){nearDegenerate=true;continue}
 let path=ids.map(i=>nodes[i]);
 // Refine the line field by its own angle, not by a predicted total winding.
 for(let pass=0;pass<5;pass++){let changed=false,out=[];for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],angle=Math.atan2(a.n[0]*b.n[2]-a.n[2]*b.n[0],a.n[0]*b.n[0]+a.n[2]*b.n[2]);out.push(a);if(Math.abs(angle)>.20||Math.hypot(...sub(a.p,b.p))>.06){out.push(projectToContour(engine,unit(add(a.p,b.p))));changed=true}}path=out;if(!changed)break}
 let winding=0;const cs=path.map(e=>cuspScalar(engine,e)),cusps=[];
 for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],ax=a.n[0],ay=a.n[2],bx=b.n[0],by=b.n[2]; const za=[ax*ax-ay*ay,2*ax*ay],zb=[bx*bx-by*by,2*bx*by];const da=Math.atan2(za[0]*zb[1]-za[1]*zb[0],dot(za,zb));winding+=da;maxAngle=Math.max(maxAngle,Math.abs(da));
 const ca=cs[i],cb=cs[(i+1)%path.length];if(ca*cb<0){let lo=a,hi=b,fl=ca,fh=cb,e;for(let n=0;n<20;n++){const t=fl/(fl-fh);e=projectToContour(engine,unit(add(mul(lo.p,1-t),mul(hi.p,t))));const f=cuspScalar(engine,e);if(Math.abs(f)<1e-8)break;if((f<0)===(fl<0)){lo=e;fl=f}else{hi=e;fh=f}}if(e&&!cusps.some(c=>Math.hypot(...sub(c.p,e.p))<1e-4))cusps.push({...e,residual:Math.abs(cuspScalar(engine,e))})}}
 let minCuspSlope=Infinity;for(const c of cusps){const t=unit(cross(gradientLambda(engine,c.p),c.p)),h=2e-4,a=projectToContour(engine,unit(add(c.p,mul(t,h)))),b=projectToContour(engine,unit(add(c.p,mul(t,-h)))),slope=Math.abs((cuspScalar(engine,a)-cuspScalar(engine,b))/(2*h));minCuspSlope=Math.min(minCuspSlope,slope)}if(minCuspSlope<.03)nearDegenerate=true;
 const raw=winding/TAU,degree=Math.round(raw)||0;if(Math.abs(raw-degree)>1e-5||maxAngle>2.5)nearDegenerate=true;
 let minGrad=Infinity;for(let i=0;i<path.length;i+=Math.max(1,Math.floor(path.length/40)))minGrad=Math.min(minGrad,Math.hypot(...gradientLambda(engine,path[i].p)));if(minGrad<.015)nearDegenerate=true;
 // A double cusp at a transition has a non-simple zero; do not silently certify it.
 for(let i=0;i<cs.length;i++){const a=Math.abs(cs[i]),prev=Math.abs(cs[(i+cs.length-1)%cs.length]),next=Math.abs(cs[(i+1)%cs.length]);if(a<.004&&a<=prev&&a<=next&&cs[(i+cs.length-1)%cs.length]*cs[(i+1)%cs.length]>0)nearDegenerate=true}
 components.push({path:path.map(e=>({p:e.p,q:e.q,n:e.n})),cusps:cusps.map(e=>({p:e.p,q:e.q,n:e.n,residual:e.residual})),degree,raw,minGrad,minCuspSlope,closed:loopClosed});
 }
 components.sort((a,b)=>b.path.length-a.path.length);const total=components.reduce((s,c)=>s+c.degree,0),cuspCount=components.reduce((s,c)=>s+c.cusps.length,0);
 return {state:{...state,depths:[...state.depths]},level,points:samples.map(e=>e.q),source:mesh.points,triangles:mesh.triangles,components,total,cuspCount,closed,nearDegenerate,minDet,maxResidual,maxAngle,valid:closed&&!nearDegenerate&&minDet>.01&&maxResidual<1e-7&&total===2&&cuspCount%2===0,ms:performance.now()-start};
}
export function rayHits(geometry,x,z,engine=null){if(geometry.state.surface&&geometry.state.surface!=='sphere')return manifoldRayHits(geometry,x,z,engine||createSurfaceEngine(geometry.state));const hits=[];for(const tri of geometry.triangles){const[a,b,c]=tri.map(k=>geometry.points[k]),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-15)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-9)continue;let p=unit([0,1,2].map(k=>u*geometry.source[tri[0]][k]+v*geometry.source[tri[1]][k]+w*geometry.source[tri[2]][k])),q=[x,u*a[1]+v*b[1]+w*c[1],z];
 if(engine){for(let k=0;k<5;k++){const e=engine.evaluate(p),a=unit(cross(p,Math.abs(p[2])<.8?[0,0,1]:[0,1,0])),b=cross(p,a),ja=mv(e.J,a),jb=mv(e.J,b),det=ja[0]*jb[2]-ja[2]*jb[0];if(Math.abs(det)<1e-9)break;const ex=x-e.q[0],ez=z-e.q[2],du=(ex*jb[2]-ez*jb[0])/det,dv=(ja[0]*ez-ja[2]*ex)/det;if(Math.hypot(du,dv)>.15)break;p=unit(add(p,add(mul(a,du),mul(b,dv))))}q=engine.map(p)}hits.push({p,q})}
 hits.sort((a,b)=>a.q[1]-b.q[1]);return hits.filter((h,i)=>!i||Math.abs(h.q[1]-hits[i-1].q[1])>2e-4);
}
