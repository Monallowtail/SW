import {kleinMap} from './klein.js';
import {TAU,add,sub,mul,dot,cross,unit,rotation,sphereMesh} from './geometry.js';
import {genus2Mesh,projectToSurface,surfaceNormal} from './genus2.js';
export const SURFACES={sphere:{label:'球面',symbol:'S<sup>2</sup>',chi:2},torus:{label:'トーラス',symbol:'T<sup>2</sup>',chi:0},genus2:{label:'2人乗りの浮き輪',symbol:'Σ<sub>2</sub>',chi:-2},rp2:{label:'射影平面',symbol:'ℝP<sup>2</sup>',chi:1},roman:{label:'射影平面',symbol:'ℝP<sup>2</sup>',chi:1},klein:{label:'クラインの壺',symbol:'K',chi:0},klein8:{label:'クラインの壺',symbol:'K',chi:0}};
const cache=new Map(),mod=(x,n)=>((x%n)+n)%n;
function paramMesh(kind,level){
 const N=level<=3?44:level===4?76:level===5?116:164,M=N,points=[],triangles=[];
 // Offset avoids edges lying on an entire fold at symmetric directions.
 const a=.173,b=.217;
 for(let i=0;i<N;i++)for(let j=0;j<M;j++)points.push([TAU*(i+a)/N,TAU*(j+b)/M,0]);
 // Klein seam reverses v. Using zero v offset for it makes that identification exact.
 if(kind.startsWith('klein'))for(let i=0;i<N;i++)for(let j=0;j<M;j++)points[i*M+j][1]=TAU*j/M;
 const at=(i,j)=>{if(i===N&&kind.startsWith('klein'))j=-j;return mod(i,N)*M+mod(j,M)};
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);triangles.push([a,b,c],[a,c,d])}
 return{points,triangles};
}
function rpMesh(level){
 const mesh=sphereMesh(Math.max(3,Math.min(6,level))),points=[],triangles=[],indices=[],seen=new Map(),faces=new Set();
 for(const p of mesh.points){let q=p;const k=p.find(x=>Math.abs(x)>1e-8);if(k<0)q=mul(p,-1);const key=q.map(x=>x.toFixed(8)).join(',');if(!seen.has(key)){seen.set(key,points.length);points.push(q)}indices.push(seen.get(key))}
 for(const t of mesh.triangles){const q=t.map(i=>indices[i]),key=[...q].sort((a,b)=>a-b).join(':');if(!faces.has(key)){faces.add(key);triangles.push(q)}}return{points,triangles};
}
export function surfaceMesh(kind,level){const k=`${kind}:${level}`;if(!cache.has(k))cache.set(k,kind==='genus2'?genus2Mesh(level):(kind==='rp2'||kind==='roman')?rpMesh(level):paramMesh(kind,level));return cache.get(k)}
export function createSurfaceEngine(state){
 const kind=state.surface||'sphere',yaw=state.yaw||0,pitch=state.pitch||0;
 const sphere=kind==='rp2'||kind==='roman',implicit=kind==='genus2';
 const lift=(p,ref)=>{if(sphere)return dot(p,ref)<0?mul(p,-1):p;if(implicit)return p;let best=p,bestd=Infinity;for(let i=-2;i<=2;i++){const u=p[0]+TAU*i,sgn=kind.startsWith('klein')&&Math.abs(i)%2?-1:1;const v=sgn*p[1]+TAU*Math.round((ref[1]-sgn*p[1])/TAU),d=(u-ref[0])**2+(v-ref[1])**2;if(d<bestd){bestd=d;best=[u,v,0]}}return best};
 const normalize=p=>sphere?unit(p):implicit?projectToSurface(p):p;
 const interpolate=(a,b,t)=>normalize(add(mul(a,1-t),mul(lift(b,a),t)));
 const basis=p=>{if(!sphere&&!implicit)return[[1,0,0],[0,1,0]];const n=sphere?p:surfaceNormal(p),u=unit(cross(n,Math.abs(n[2])<.8?[0,0,1]:[0,1,0]));return[u,cross(n,u)]};
 const base=p=>{
  if(implicit)return p;
  if(kind==='roman'){const[x,y,z]=p;return[2*y*z,2*z*x,2*x*y]}
  if(sphere)return boyMap(p);
  const[u,v]=p;
  if(kind==='torus'){const r=.32,R=.85;return[(R+r*Math.cos(v))*Math.cos(u),r*Math.sin(v),(R+r*Math.cos(v))*Math.sin(u)]}
  if(kind==='klein')return kleinMap(p);
  const R=.9,r=.36,a=R+r*(Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v)),b=r*(Math.sin(u/2)*Math.sin(v)+Math.cos(u/2)*Math.sin(2*v));return[a*Math.cos(u),b,a*Math.sin(u)];
 };
 const map=p=>rotation(base(p),yaw,pitch);
 const move=(p,b,du,dv)=>normalize(add(p,add(mul(b[0],du),mul(b[1],dv))));
 const evaluate=p=>{const b=basis(p),h=2e-5,q=map(p),a1=mul(sub(map(move(p,b,h,0)),map(move(p,b,-h,0))),.5/h),a2=mul(sub(map(move(p,b,0,h)),map(move(p,b,0,-h))),.5/h),raw=cross(a1,a2),area=Math.hypot(...raw);let n=unit(raw),lambda=-n[1],det=area;if(kind==='roman'){lambda=a1[0]*a2[2]-a1[2]*a2[0];const t=Math.hypot(a1[0],a1[2])>Math.hypot(a2[0],a2[2])?a1:a2;det=Math.hypot(t[0],t[2]);n=unit([-t[2],0,t[0]])}return{p,q,b,a1,a2,n,lambda,det,area}};
 const distance=(a,b)=>Math.hypot(...sub(a,lift(b,a)));
 return{kind,direct:kind==='roman',map,evaluate,basis,move,normalize,interpolate,lift,distance};
}
// Smooth antipodal-even Apéry quartic, with nonzero coordinate scaling and translation.
export function boyMap([x,y,z]){const r=x*x+y*y+z*z,s=x+y+z;return[
 .5*((2*x*x-y*y-z*z)*r+2*y*z*(y*y-z*z)+z*x*(x*x-z*z)+x*y*(y*y-x*x)),
 .125*s*(s*s*s+4*(y-x)*(z-y)*(x-z))-.55,
 Math.sqrt(3)/2*((y*y-z*z)*r+z*x*(z*z-x*x)+x*y*(y*y-x*x))
]}
