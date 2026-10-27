// Display decisions belong to complete contour families and ordered contour
// segments, never to an unordered screen-space collision list. Coordinates and
// directions are supplied by the actual surface/gradient; this module moves no
// point and manufactures no vector.
const rowClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rowSmooth=(a,b,x)=>{const u=rowClamp((x-a)/(b-a),0,1);return u*u*(3-2*u)};
const rowDistance=(a,b)=>Math.hypot(a.q[0]-b.q[0],a.q[1]-b.q[1]);
function rowQuantile(values,f){if(!values.length)return Infinity;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*f)]}
function rowPriority(group,focusId){
 const a=group[0],tier=Number(a.level.match(/_(\d+)_/)?.[1]??0);
 return (a.local?(a.regular?36:a.criticalId===focusId?0:20)+tier*2:a.level.startsWith('fold')?40:a.feature?44:50)+ (a.local&&a.level.endsWith('_-1')?0:.01);
}
// A faint incoming regular-cap family must not suppress an established row.
// Selection still fades as a whole cohort; only its activation needs enough ink.
function rowEligible(a,width,height){return !a.hidden&&a.weight>(a.regular?.25:.015)&&a.projectedRatio>.04&&a.near>(a.local?8:11)&&a.q[0]>-18&&a.q[0]<width+18&&a.q[1]>-18&&a.q[1]<height+18}
export function selectContourRows(samples,{minSpacing=18,focusId=null,width=Infinity,height=Infinity}={}){
 const weights=new Map(samples.map(a=>[a.id,0])),rowWeights=new Map(),groups=[],families=new Map();
 for(const a of samples){if(!families.has(a.level))families.set(a.level,[]);families.get(a.level).push(a)}
 const tierFamilies=new Map();
 for(const [level,all] of families){const pair=all[0].local?level.replace(/_(-?1)$/,''):level;if(!tierFamilies.has(pair))tierFamilies.set(pair,{pair,levels:[],all:[]});const family=tierFamilies.get(pair);family.levels.push(level);family.all.push(...all)}
 const ordered=[...tierFamilies.values()].map(f=>({...f,visible:f.all.filter(a=>rowEligible(a,width,height))})).filter(r=>r.visible.length>0).sort((a,b)=>rowPriority(a.all,focusId)-rowPriority(b.all,focusId)||a.pair.localeCompare(b.pair));
 const edgesOf=family=>{const pieces=new Map(),edges=[];for(const a of family.all){const key=a.row??a.level;if(!pieces.has(key))pieces.set(key,[]);pieces.get(key).push(a)}for(const points of pieces.values()){points.sort((a,b)=>a.order-b.order);for(let i=1;i<points.length;i++)if(rowEligible(points[i-1],width,height)&&rowEligible(points[i],width,height))edges.push([points[i-1].q,points[i].q])}return edges};
 const edgeDistance=(point,edge)=>{const a=edge[0],b=edge[1],dx=b[0]-a[0],dy=b[1]-a[1],u=rowClamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(point[0]-a[0]-u*dx,point[1]-a[1]-u*dy)};
 const accepted=[];
 for(const family of ordered){
  let selected=accepted.length<7;
  // Treat both sides of a saddle's chosen level offset as ONE tier. The whole
  // tier is selected or retired; sector loss is never a collision tie-break.
  for(const other of accepted){
   const distance=rowQuantile(family.visible.map(a=>Math.min(...other.visible.map(b=>rowDistance(a,b)),...other.edges.map(edge=>edgeDistance(a.q,edge)))),.2);
   if(distance<minSpacing*.9){selected=false;break}
  }
  const weight=selected?1:0;for(const level of family.levels)rowWeights.set(level,weight);
  if(selected)accepted.push({...family,edges:edgesOf(family)});
 }
 const rows=new Map();
 for(const a of samples){const key=a.row??a.level;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(a)}
 for(const [row,all] of rows){
  const sorted=all.slice().sort((a,b)=>a.order-b.order||a.id-b.id),bands=new Map();
  for(const a of sorted){
   // Eight fixed angular bands keep foreshortening decisions local and stable.
   // True occlusion, marker clearance and the local-neighborhood boundary may
   // split a band; these are geometric ends, not arbitrary interior omissions.
   const band=Math.min(7,Math.floor((((a.order??0)%1)+1)%1*8));
   if(!bands.has(band))bands.set(band,[]);bands.get(band).push(a);
  }
  for(const [band,points] of bands){let segment=[];let part=0;
   const finish=()=>{if(!segment.length)return;
    const level=segment[0].level,rowWeight=rowWeights.get(level)??0;
    const depth=Math.max(0,...segment.map(a=>a.depth??0)),steps=[];
    for(let exponent=-depth;exponent<=8;exponent++)steps.push(2**exponent);
    // All members use one dyadic lattice step. Changing zoom adds/removes an
    // entire alternating cohort, preserving the IDs/positions of older arrows.
    let stride=steps.at(-1),selected=[];
    for(const candidate of steps){
     const keep=segment.filter(a=>{const lattice=a.lattice??a.order*(a.baseCount??1),u=lattice/candidate;return Math.abs(u-Math.round(u))<1e-6});
     if(!keep.length)continue;
     const gaps=keep.slice(1).map((a,i)=>rowDistance(a,keep[i]));
     if(!gaps.length||Math.min(...gaps)>=minSpacing){stride=candidate;selected=keep;break}
    }
    // Tiny geometric fragments can contain no lattice origin. Keep the oldest
    // endpoint only if it was itself an original lattice point, not a nearest
    // pixel substitute that would make identities hop as the camera moves.
    for(const a of selected)weights.set(a.id,rowWeight);
    groups.push({points:segment.slice(),row,level,segment:`${row}:${band}:${part++}`,stride,count:segment.length,orderedIds:segment.map(a=>a.id),orderedLattices:segment.map(a=>a.lattice),selectedIds:selected.map(a=>a.id),rowWeight});segment=[];
   };
   for(const a of points){if(rowEligible(a,width,height)){segment.push(a)}else finish()}finish();
  }
 }
 // Reconcile neighboring bands by coarsening an ENTIRE band cohort. A local
 // decision may otherwise leave one tight pair on the shared band boundary.
 for(const row of rows.keys()){
  const members=groups.filter(g=>g.row===row);
  for(let pass=0;pass<members.length*12;pass++){
   const selected=members.flatMap(g=>g.points.filter(a=>g.selectedIds.includes(a.id)).map(a=>({a,g}))).sort((x,y)=>x.a.order-y.a.order);
   let conflict=null;
   for(let i=1;i<selected.length;i++)if(rowDistance(selected[i-1].a,selected[i].a)<minSpacing-1e-7){conflict=[selected[i-1],selected[i]];break}
   if(!conflict&&selected.length>1&&selected.at(-1).a.order-selected[0].a.order>.65&&rowDistance(selected.at(-1).a,selected[0].a)<minSpacing-1e-7)conflict=[selected.at(-1),selected[0]];
   if(!conflict)break;
   const [a,b]=conflict;const group=a.g.stride<b.g.stride?a.g:b.g.stride<a.g.stride?b.g:a.g.selectedIds.length>b.g.selectedIds.length?a.g:b.g;
   const before=group.selectedIds;group.stride*=2;
   const keep=group.points.filter(a=>{const u=(a.lattice??a.order*(a.baseCount??1))/group.stride;return Math.abs(u-Math.round(u))<1e-6}).map(a=>a.id);
   // A one-arrow terminal fragment cannot be thinned further on its lattice;
   // retire that whole fragment instead of moving its arrow to a new point.
   const terminal=keep.length===before.length&&keep.every((id,i)=>id===before[i]);group.selectedIds=terminal?[]:keep;if(terminal)group.retired=true;
  }
 }
 for(const a of samples)weights.set(a.id,0);
 for(const group of groups){for(const id of group.selectedIds)weights.set(id,group.rowWeight);delete group.points}
 return {weights,rowWeights,groups};
}
