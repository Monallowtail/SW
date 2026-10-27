// Production candidate v21. Finite smooth composition is the defined map, not an RK flow claim.
export const epsilon=.4,nu=.35,ratio=1/(4*(1-nu)), norm=2*epsilon/(1.5-ratio);
export const anchors=[[.45,Math.sqrt(.55**2-.45**2),Math.sqrt(1-.55**2)],[.45,Math.sqrt(.55**2-.45**2),-Math.sqrt(1-.55**2)],[-.45*.56/.55,Math.sqrt(.55**2-.45**2)*.56/.55,Math.sqrt(1-.56**2)],[-.45*.56/.55,Math.sqrt(.55**2-.45**2)*.56/.55,-Math.sqrt(1-.56**2)]];
export function scalars(r2,epsilon=.4){let norm=2*epsilon/(1.5-ratio);let A=0,B=0,C=0,D=0;for(let k=0;k<2;k++){let e=epsilon*(k+1),R2=r2+e*e,i=1/Math.sqrt(R2),i3=i/R2,i5=i3/R2,s=k?-norm:norm;A+=s*((1-ratio)*i+.5*e*e*i3);B+=s*ratio*i3;C+=s*(-(1-ratio)*i3-1.5*e*e*i5);D+=s*(-3*ratio*i5)}return[A,B,C,D]}
export function solve(A,b){let n=b.length,M=A.map((r,i)=>[...r,b[i]]);for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;[M[p],M[k]]=[M[k],M[p]];if(Math.abs(M[k][k])<1e-12)throw Error('singular anchor system');let t=M[k][k];for(let j=k;j<=n;j++)M[k][j]/=t;for(let i=0;i<n;i++)if(i!==k){t=M[i][k];for(let j=k;j<=n;j++)M[i][j]-=t*M[k][j]}}return M.map(r=>r[n])}
export function system(centres,widths=[.4,.4,.4,.4]){let M=Array.from({length:12},()=>Array(12).fill(0));for(let i=0;i<4;i++)for(let j=0;j<4;j++){let r=centres[i].map((v,k)=>v-centres[j][k]),[A,B]=scalars(r.reduce((s,v)=>s+v*v,0),widths[j]);for(let a=0;a<3;a++)for(let b=0;b<3;b++)M[3*i+a][3*j+b]=(a===b?A:0)+B*r[a]*r[b]}return M}
export function stage(depths,t,h,widths=[.4,.4,.4,.4]){let c=anchors.map((p,i)=>[p[0],p[1],p[2]-t*depths[i]]),M=system(c,widths),f=solve(M,depths.flatMap(d=>[0,0,-d*h]));return{c,f,M,widths}}
export function velocity(q,st,withJ=false){let v=[0,0,0],J=withJ?Array(9).fill(0):null;for(let k=0;k<4;k++){let r=[q[0]-st.c[k][0],q[1]-st.c[k][1],q[2]-st.c[k][2]],f=st.f.slice(k*3,k*3+3),dot=r[0]*f[0]+r[1]*f[1]+r[2]*f[2],[A,B,C,D]=scalars(r[0]**2+r[1]**2+r[2]**2,st.widths[k]);for(let a=0;a<3;a++){v[a]+=A*f[a]+B*r[a]*dot;if(J)for(let b=0;b<3;b++)J[3*a+b]+=C*r[b]*f[a]+D*r[b]*r[a]*dot+B*((a===b?dot:0)+r[a]*f[b])}}return{v,J}}
export function multiply(A,B){let C=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)C[3*i+j]+=A[3*i+k]*B[3*k+j];return C}
export function determinant(J){return J[0]*(J[4]*J[8]-J[5]*J[7])-J[1]*(J[3]*J[8]-J[5]*J[6])+J[2]*(J[3]*J[7]-J[4]*J[6])}
export function inverse(J){let d=determinant(J);return [J[4]*J[8]-J[5]*J[7],J[2]*J[7]-J[1]*J[8],J[1]*J[5]-J[2]*J[4],J[5]*J[6]-J[3]*J[8],J[0]*J[8]-J[2]*J[6],J[2]*J[3]-J[0]*J[5],J[3]*J[7]-J[4]*J[6],J[1]*J[6]-J[0]*J[7],J[0]*J[4]-J[1]*J[3]].map(x=>x/d)}
// Same bounded lateral postcomposition as source20. It is NOT a new deformation kernel.
const a=.25,b=.85,L=b-a,N=4096,table=new Float64Array(N+1);
function bump(x){const q=(2*x-a-b)/L;return Math.abs(q)<1?Math.exp(1-1/(1-q*q)):0}
function derivative(x){return x>a&&x<b?x/Math.sqrt(1-x*x)*bump(x):0}
for(let i=1;i<=N;i++){let l=a+L*(i-1)/N,r=a+L*i/N;table[i]=table[i-1]+(r-l)/6*(derivative(l)+4*derivative((l+r)/2)+derivative(r))}
function integral(x){if(x<=a)return 0;if(x>=b)return table[N];let q=(x-a)/L*N,i=Math.floor(q),left=a+L*i/N;return table[i]+(x-left)/6*(derivative(left)+4*derivative((left+x)/2)+derivative(x))}
export function widthSchedule(depth,limit=.55){return .22+.18*(depth/limit)**2}
export function prepare(depths,steps=32,sign=-1,lateral=0,widths=null){depths=Array.from(depths);if(depths.length!==4||depths.some((d,i)=>!Number.isFinite(d)||Math.abs(d)>(i<2?.55:.51)+1e-12))throw Error('depth limits');depths=depths.map((d,i)=>Math.max(-(i<2?.55:.51),Math.min(i<2?.55:.51,d)));widths=widths??depths.map((d,i)=>widthSchedule(d,i<2?.55:.51));if(widths.some(e=>e<.22||e>.4))throw Error('width test range');if(depths.length!==4||depths.some((d,i)=>!Number.isFinite(d)||Math.abs(d)>(i<2?.55:.51)+1e-12))throw Error('depth limits');if(Math.abs(lateral)>.04)throw Error('lateral limit');let stages=Array.from({length:steps},(_,k)=>stage(depths,k/steps,1/steps,widths));
// These coefficients depend only on the four control depths, not the sampled
// point or composition stage. Keep their arithmetic identical to the kernel.
const kernelWidths=Array.from(widths,epsilon=>({
  norm:2*epsilon/(1.5-ratio), ee:epsilon*epsilon
}));
const activeStages=depths.every(d=>d===0)?[]:stages;
function evaluate(p,withJ=false){let x=p[0],y=p[1],z=-p[2],J=withJ?[1,0,0,0,1,0,0,0,-1]:null;
for(let st of activeStages){let vx=0,vy=0,vz=0,d00=1,d01=0,d02=0,d10=0,d11=1,d12=0,d20=0,d21=0,d22=1;
for(let k=0;k<4;k++){let rx=x-st.c[k][0],ry=y-st.c[k][1],rz=z-st.c[k][2],fx=st.f[3*k],fy=st.f[3*k+1],fz=st.f[3*k+2],dot=rx*fx+ry*fy+rz*fz,r2=rx*rx+ry*ry+rz*rz;
let {norm,ee}=kernelWidths[k],R1=r2+ee,R2=r2+4*ee,i1=1/Math.sqrt(R1),i2=1/Math.sqrt(R2),i13=i1/R1,i23=i2/R2,A=norm*((1-ratio)*(i1-i2)+.5*ee*i13-2*ee*i23),B=norm*ratio*(i13-i23);
vx+=A*fx+B*rx*dot;vy+=A*fy+B*ry*dot;vz+=A*fz+B*rz*dot;
if(J){let i15=i13/R1,i25=i23/R2,C=norm*(-(1-ratio)*(i13-i23)-1.5*ee*i15+6*ee*i25),D=-3*norm*ratio*(i15-i25),t0=C*fx+D*rx*dot,t1=C*fy+D*ry*dot,t2=C*fz+D*rz*dot;
d00+=t0*rx+B*(dot+rx*fx);d01+=t0*ry+B*rx*fy;d02+=t0*rz+B*rx*fz;
d10+=t1*rx+B*ry*fx;d11+=t1*ry+B*(dot+ry*fy);d12+=t1*rz+B*ry*fz;
d20+=t2*rx+B*rz*fx;d21+=t2*ry+B*rz*fy;d22+=t2*rz+B*(dot+rz*fz);}}
x+=vx;y+=vy;z+=vz;if(J){let a=J[0],b=J[1],c=J[2],d=J[3],e=J[4],f=J[5],g=J[6],h=J[7],i=J[8];J[0]=d00*a+d01*d+d02*g;J[1]=d00*b+d01*e+d02*h;J[2]=d00*c+d01*f+d02*i;J[3]=d10*a+d11*d+d12*g;J[4]=d10*b+d11*e+d12*h;J[5]=d10*c+d11*f+d12*i;J[6]=d20*a+d21*d+d22*g;J[7]=d20*b+d21*e+d22*h;J[8]=d20*c+d21*f+d22*i;}}
let q=[x+lateral*Math.sign(x)*integral(Math.abs(x))/table[N],y,-sign*z];if(J){let s=1+lateral*derivative(Math.abs(x))/table[N];for(let i=0;i<3;i++){J[i]*=s;J[6+i]*=-sign}}return{q,J}}

function field(p){let {q,J}=evaluate(p,true),I=inverse(J),normal=[0,0,0];for(let i=0;i<3;i++)for(let j=0;j<3;j++)normal[i]+=I[3*j+i]*p[j];let nn=normal.reduce((s,v)=>s+v*v,0),G=normal.map((v,i)=>(i===2?1:0)-normal[2]*v/nn),V=[0,0,0];for(let i=0;i<3;i++)for(let j=0;j<3;j++)V[i]+=I[3*i+j]*G[j];return{q,V,G,J}}
return{stages,evaluate,fieldData:field,mapBatch:ps=>ps.map(p=>evaluate(p).q),evaluateBatch:(ps,withJ=true)=>ps.map(p=>evaluate(p,withJ)),map:p=>evaluate(p).q,jacobian:p=>evaluate(p,true).J,field:p=>field(p).V,pushedField:p=>field(p).G}}
// A small exact-state LRU prevents geometry and field queries at different
// lateral settings from rebuilding the same 32 anchor systems each time.
// Entries are reusable prepared engines; callers must not mutate their stages.
const preparedCache=new Map(),PREPARED_CACHE_LIMIT=8;
export function prepared(d,s=-1,l=0){
  const key=d.join(',')+','+s+','+l;
  let engine=preparedCache.get(key);
  if(engine){preparedCache.delete(key);preparedCache.set(key,engine);return engine}
  engine=prepare(d,32,s,l);
  preparedCache.set(key,engine);
  if(preparedCache.size>PREPARED_CACHE_LIMIT)preparedCache.delete(preparedCache.keys().next().value);
  return engine;
}
export const map=(p,d,s=-1,l=0)=>prepared(d,s,l).map(p);
export const jacobian=(p,d,s=-1,l=0)=>prepared(d,s,l).jacobian(p);
export const field=(p,d,s=-1,l=0)=>prepared(d,s,l).field(p);
export const pushedField=(p,d,s=-1,l=0)=>prepared(d,s,l).pushedField(p);

export const lateralLimit=.04,patchDepthLimit=.55,patchRadius=.4,patchCenterRadius=.55;
export const PATCHES=Object.freeze(anchors.map((p,index)=>Object.freeze({index,id:['UR','LR','UL','LL'][index],label:['右上','右下','左上','左下'][index],center:Object.freeze(p.slice(0,2)),physicalAnchor:Object.freeze([...p]),baseCenter:Object.freeze([...p]),sourceAnchor:Object.freeze([p[0],p[1],-p[2]]),physicalSheet:index%2?-1:1,sourceZSign:index%2?1:-1,centerRadius:index<2?.55:.56,R:index<2?.55:.56,depthLimit:index<2?.55:.51,maxDepth:index<2?.55:.51})));
export const depthArray=d=>Array.isArray(d)||ArrayBuffer.isView(d)?d:[0,0,0,0];
export const patchLimit=i=>PATCHES[typeof i==='number'?i:i.index].depthLimit;
export function clampDepth(d,i){const l=patchLimit(i);return Math.max(-l,Math.min(l,Number.isFinite(d)?d:0))}
export function normal(p,d,s=-1,l=0){const I=inverse(jacobian(p,d,s,l));return [0,1,2].map(i=>I[i]*p[0]+I[3+i]*p[1]+I[6+i]*p[2])}
// Expose the unchanged global postcomposition for camera extent calculations.
export const lateralX=(x,lateral=0)=>x+lateral*Math.sign(x)*integral(Math.abs(x))/table[N];
