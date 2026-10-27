import {prepared} from './elastic.js';
// Screen-space LOD shared by raster, picking and occlusion. Dyadic base levels
// preserve source-grid vertices; final 192 level avoids unnecessary 256² work.
export function meshResolution(scale=240){const rows=scale<=128?64:scale<=500?128:scale<=1100?192:64*Math.ceil(Math.sqrt(34*scale)/64);return {rows,cols:2*rows}}
// Shared source mesh: no inverse-graph assumption, no per-ray map integration.
const sources=new Map(),mapped=new Map();
export function sourceMesh(rows=128,cols=256){
 const key=rows+'/'+cols;if(sources.has(key))return sources.get(key);
 const points=[];for(let i=0;i<=rows;i++){const u=-Math.PI/2+Math.PI*i/rows,x=Math.sin(u),r=i===0||i===rows?0:Math.cos(u);for(let j=0;j<cols;j++){const v=2*Math.PI*j/cols;points.push([x,r*Math.sin(v),r*Math.cos(v)])}}
 const triangles=[];for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*cols+j,b=i*cols+(j+1)%cols,c=(i+1)*cols+(j+1)%cols,d=(i+1)*cols+j;if(i)triangles.push([a,b,c]);if(i<rows-1)triangles.push([a,c,d])}
 const mesh={points,triangles,rows,cols};if(sources.size>=4)sources.delete(sources.keys().next().value);sources.set(key,mesh);return mesh;
}
export function mappedMesh(depths,sign=-1,lateral=0,rows=128,cols=256){
 const key=[...depths,sign,lateral,rows,cols].join('/');if(mapped.has(key))return mapped.get(key);
 const source=sourceMesh(rows,cols),engine=prepared(depths,sign,lateral),stateKey=[...depths,sign,lateral].join('/');
 const reusable=[...mapped.values()].filter(m=>m.stateKey===stateKey&&rows%m.rows===0&&cols%m.cols===0).sort((a,b)=>b.rows-a.rows)[0];
 const ry=reusable?rows/reusable.rows:0,rx=reusable?cols/reusable.cols:0;
 const points=source.points.map((p,k)=>{const i=Math.floor(k/cols),j=k%cols;return reusable&&i%ry===0&&j%rx===0?reusable.points[(i/ry)*reusable.cols+j/rx]:engine.map(p)}),mesh={...source,source:source.points,points,key,stateKey};
 if(mapped.size>=3)mapped.delete(mapped.keys().next().value);mapped.set(key,mesh);return mesh;
}
// Projected uniform spatial bins are a 2D acceleration structure for orthographic rays.
let projectedKey='',projected;
export function rayMesh(depths,sign=-1,yaw=0,lateral=0,pitch=0,rows=128,cols=256){
 const mesh=mappedMesh(depths,sign,lateral,rows,cols),key=mesh.key+'/'+yaw+'/'+pitch;if(key===projectedKey)return projected;
 const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),points=mesh.points.map(([x,y,z])=>{const d=s*x+c*y;return[c*x-s*y,cp*z-sp*d,cp*d+sp*z]});
 let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;for(const p of points){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);zmin=Math.min(zmin,p[1]);zmax=Math.max(zmax,p[1])}
 const n=64,dx=(xmax-xmin)/n,dz=(zmax-zmin)/n,bins=Array.from({length:n*n},()=>[]),ix=x=>Math.max(0,Math.min(n-1,Math.floor((x-xmin)/dx))),iz=z=>Math.max(0,Math.min(n-1,Math.floor((z-zmin)/dz)));
 mesh.triangles.forEach((tri,t)=>{const ps=tri.map(i=>points[i]),loX=ix(Math.min(...ps.map(p=>p[0]))),hiX=ix(Math.max(...ps.map(p=>p[0]))),loZ=iz(Math.min(...ps.map(p=>p[1]))),hiZ=iz(Math.max(...ps.map(p=>p[1])));for(let z=loZ;z<=hiZ;z++)for(let x=loX;x<=hiX;x++)bins[z*n+x].push(t)});
 projected={mesh,points,intersections(x,z){if(x<xmin||x>xmax||z<zmin||z>zmax)return[];const hits=[];for(const t of bins[iz(z)*n+ix(x)]){const tri=mesh.triangles[t],[a,b,c]=tri.map(i=>points[i]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-15)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-10)continue;const p=[0,1,2].map(k=>u*mesh.source[tri[0]][k]+v*mesh.source[tri[1]][k]+w*mesh.source[tri[2]][k]),norm=Math.hypot(...p);hits.push({p:p.map(v=>v/norm),depth:u*a[2]+v*b[2]+w*c[2],triangle:t,barycentric:[u,v,w]})}hits.sort((a,b)=>a.depth-b.depth);return hits.filter((h,i)=>!i||h.depth-hits[i-1].depth>1e-8)}};
 projectedKey=key;return projected;
}
