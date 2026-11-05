// The double of an elliptical disk with two circular holes. F < 0 is the
// bounded handlebody. The three planar boundary curves are disjoint, so zero
// is a regular value of F and its boundary has Euler characteristic -2.
const A2=1.5**2,B2=.86**2,C=.65,R2=.29**2,K=.65;
export function implicitValue([x,y,z]) {
 const a=x*x/A2+z*z/B2-1,b=(x-C)**2+z*z-R2,c=(x+C)**2+z*z-R2;
 return y*y+K*a*b*c;
}
export function implicitGradient([x,y,z]) {
 const a=x*x/A2+z*z/B2-1,b=(x-C)**2+z*z-R2,c=(x+C)**2+z*z-R2;
 return [K*(2*x/A2*b*c+a*2*(x-C)*c+a*b*2*(x+C)),2*y,K*(2*z/B2*b*c+a*2*z*(b+c))];
}
export function surfaceNormal(p) {const g=implicitGradient(p),n=Math.hypot(...g);return g.map(v=>v/n)}
// Newton projection is intended for points on, or close to, this surface
// (edge interpolation, tangent differences and contour refinement).
export function projectToSurface(point) {
 let p=[...point];
 for(let i=0;i<24;i++) {
  const f=implicitValue(p);if(Math.abs(f)<2e-14)break;
  const g=implicitGradient(p),gg=g.reduce((s,v)=>s+v*v,0);
  if(gg<1e-24) {p[1]+=.025;continue}
  let t=f/gg;const step=Math.abs(t)*Math.sqrt(gg);if(step>.2)t*=.2/step;
  let q=p.map((v,k)=>v-t*g[k]);
  for(let j=0;j<12&&Math.abs(implicitValue(q))>Math.abs(f);j++){t*=.5;q=p.map((v,k)=>v-t*g[k])}
  p=q;
 }
 return p;
}
const cache=new Map();
// Consistent Freudenthal tetrahedra share face diagonals between every cube.
const tetrahedra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
export function genus2Mesh(level=4) {
 level=Math.max(2,Math.min(6,Math.round(level)));
 if(cache.has(level))return cache.get(level);
 const nx=({2:18,3:24,4:37,5:60,6:90})[level],h=3.24/nx;
 const ny=Math.ceil(1.3/h),nz=Math.ceil(1.94/h),sx=nx+1,sy=ny+1;
 const coords=[],values=[];
 // Non-symmetric origin avoids exact zero-valued grid vertices.
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++) {
  const p=[-1.61937+x*h,-.65019+y*h,-.97013+z*h];coords.push(p);values.push(implicitValue(p));
 }
 const points=[],triangles=[],normals=[],edgeVertices=new Map();
 const cut=(a,b)=> {
  const key=a<b?`${a}:${b}`:`${b}:${a}`;
  if(edgeVertices.has(key))return edgeVertices.get(key);
  let lo=0,hi=1,fa=values[a];
  const pa=coords[a],pb=coords[b];
  // Solve on the actual edge, preserving the tetrahedral embedding.
  for(let i=0;i<36;i++) {
   const t=(lo+hi)/2,p=pa.map((v,k)=>v+t*(pb[k]-v));
   if((implicitValue(p)<0)===(fa<0))lo=t;else hi=t;
  }
  const t=(lo+hi)/2,p=pa.map((v,k)=>v+t*(pb[k]-v)),id=points.length;
  points.push(p);normals.push(surfaceNormal(p));edgeVertices.set(key,id);return id;
 };
 const face=(a,b,c)=> {
  const p=points[a],q=points[b],r=points[c],u=q.map((v,k)=>v-p[k]),v=r.map((w,k)=>w-p[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],g=implicitGradient(p.map((w,k)=>(w+q[k]+r[k])/3));
  if(n.reduce((s,w,k)=>s+w*g[k],0)<0)[b,c]=[c,b];triangles.push([a,b,c]);
 };
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
  const i=x+sx*(y+sy*z),ids=[i,i+1,i+sx,i+sx+1,i+sx*sy,i+sx*sy+1,i+sx*sy+sx,i+sx*sy+sx+1];
  const count=ids.reduce((s,j)=>s+(values[j]<0),0);if(count===0||count===8)continue;
  for(const tet of tetrahedra) {
   const inside=[],outside=[];for(const j of tet)(values[ids[j]]<0?inside:outside).push(ids[j]);
   if(!inside.length||!outside.length)continue;
   if(inside.length===1||outside.length===1) {
    const one=inside.length===1?inside:outside,other=inside.length===1?outside:inside;
    face(...other.map(j=>cut(one[0],j)));
   } else {
    const [a,b]=inside,[c,d]=outside,ac=cut(a,c),ad=cut(a,d),bc=cut(b,c),bd=cut(b,d);
    face(ac,ad,bd);face(ac,bd,bc);
   }
  }
 }
 const mesh={points,triangles,normals,project:projectToSurface};cache.set(level,mesh);return mesh;
}
