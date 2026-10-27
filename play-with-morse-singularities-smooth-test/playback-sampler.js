// Bounded test-page sampler. Coefficients were independently checked offline;
// this is not a general trajectory solver or an all-state interpolation claim.
const weights=t=>[2*(t-.5)*(t-1),4*t*(1-t),2*t*(t-.5)];
const unit=p=>{const n=Math.hypot(...p);return p.map(x=>x/n)};
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
export function makePlaybackInterval(meta,flow,meshBuffers){
 if(meta.level!==0||meta.maxScale!==160||flow.length!==meta.coefficientCount)throw Error('Unsupported playback certificate');
 const memberships=meta.canonicalIds.map(ids=>new Set(ids));
 function membership(id,t){const x=Math.max(0,Math.min(4,t*4)),i=Math.min(3,Math.floor(x)),f=x-i;return(memberships[i].has(id)?1:0)*(1-f)+(memberships[i+1].has(id)?1:0)*f}
 function sample(t,{canonicalOnly=false}={}){
  t=Math.max(0,Math.min(1,t));const w=weights(t),curves=[];
  for(const c of meta.curves){if(canonicalOnly&&!memberships[0].has(c.meta.id))continue;const weight=membership(c.meta.id,t),points=[];let arc=0;
   for(let i=0;i<c.count;i++){const offset=(c.offsetPoints+i)*36,attributes=[];for(let a=0;a<4;a++){const p=[];for(let j=0;j<3;j++)p.push(w[0]*flow[offset+a*3+j]+w[1]*flow[offset+12+a*3+j]+w[2]*flow[offset+24+a*3+j]);attributes.push(p)}const p=unit(attributes[0]);if(i)arc+=distance(p,points[i-1].p);points.push({id:`playback:${c.meta.id}:${i}`,p,mapped:attributes[1],sourceGradient:attributes[2],physicalGradient:attributes[3],weight,s:arc})}
   const zero=points[c.zero].s;for(const p of points)p.s-=zero;curves.push({...c.meta,seed:c.meta.seed?points[c.zero].p:null,points});
  }
  const roots=meta.roots.map(r=>({...r.meta,p:unit([0,1,2].map(j=>r.nodes.reduce((n,x,i)=>n+w[i]*x.p[j],0))),h:r.nodes.reduce((n,x,i)=>n+w[i]*x.h,0)}));
  return{curves,roots,depths:[0,1,2,3].map(j=>meta.depths.reduce((n,x,i)=>n+w[i]*x[j],0)),lateral:0,level:0};
 }
 function mesh(t,rows,cols){const entry=meta.meshes.find(x=>x.rows===rows&&x.cols===cols),data=meshBuffers.get(rows);if(!entry||!data)throw Error('Playback mesh level unavailable');const w=weights(t),n=entry.vertices,points=new Array(n);for(let i=0;i<n;i++)points[i]=[0,1,2].map(j=>w[0]*data[i*3+j]+w[1]*data[(n+i)*3+j]+w[2]*data[(2*n+i)*3+j]);return{points,rows,cols}}
 return{meta,sample,mesh};
}
