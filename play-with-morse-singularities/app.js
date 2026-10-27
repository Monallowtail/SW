import {map,critical,cancellationPlan,resetTracker,field,pushedField,PATCHES,patchDepthLimit,lateralLimit} from './model.js';
import {rayOccluded,surfaceHit} from './levels.js';
import {allTrajectories,trajectoryLevelWeight} from './trajectories.js';
import {renderSurfaceSheets,sheetPointOccluded} from './sheets.js';
const $=s=>document.querySelector(s),tau=Math.PI*2,ink='#604739',orange='#cb4b16',cyan='#31999d';
let depths=[0,0,0,0],targetDepths=[0,0,0,0],selectedPatch=0,lateral=0,targetLateral=0,sign=-1,mode='deform',selected=[],animation=null,dirty=true;
let sharedFlows={patches:[],curves:[]},flowDepths=NaN,flowLateral=NaN,flowLevel=-1,flowRevision=0;
let flowWorker=null,workerRequest=0,workerStateKey=null,flowPending=false,workerError=null;
let coreFlows={patches:[],curves:[]},flowRoots=[],flowChangedAt=0,flowDetailRequested=false;
// Input parameters may lead the displayed state. Only complete exact snapshots
// reach render; a running solve is never cancelled by an ordinary move event.
let displayed={depths:[...depths],lateral,roots:structuredClone(critical(depths,-1))};
sharedFlows=allTrajectories(displayed.depths,displayed.lateral,0,displayed.roots,{sparse:false});coreFlows=sharedFlows;
// Preserve v23 coarse-first crowding priority without recomputing its short
// interaction core: only reorder already solved complete curves.
function denseDisplayOrder(curves,roots){
 const anchor=PATCHES[selectedPatch]?.sourceAnchor??PATCHES[0].sourceAnchor;
 const distance=c=>Math.hypot(...c.p.map((x,i)=>x-anchor[i]));
 const nearest=m=>roots.filter(c=>c.m===m).sort((a,b)=>distance(a)-distance(b))[0]?.id;
 const saddle=nearest(1),extrema=[nearest(0),nearest(2)];
 const ids=[...curves.filter(c=>c.kind==='saddle'&&c.criticalId===saddle).map(c=>c.id),
 ...PATCHES.map(p=>`seed:patch:${p.index}:8:4`),
 ...roots.filter(c=>extrema.includes(c.id)).map(c=>`seed:extremum:${c.id}:4:0`)];
 const rank=new Map(ids.map((id,i)=>[id,i]));
 return [...curves].sort((a,b)=>(rank.get(a.id)??1e6)-(rank.get(b.id)??1e6));
}
sharedFlows.curves=denseDisplayOrder(sharedFlows.curves,displayed.roots);
let inFlight=null,queued=null;
function displayedCritical(){return displayed.roots.map(c=>sign===-1?c:{...c,h:-c.h,m:c.m===null?null:2-c.m,eigenvalues:[-c.eigenvalues[1],-c.eigenvalues[0]]})}
function coherent(){return !inFlight&&!queued&&depths.every((x,i)=>x===displayed.depths[i])&&lateral===displayed.lateral}
function commitSnapshot(job,data){
 displayed={depths:[...job.depths],lateral:job.lateral,roots:job.roots};
 flowRoots=job.roots;sharedFlows={patches:data.patches??[],curves:denseDisplayOrder(data.curves??[],job.roots),radius:data.radius};coreFlows=sharedFlows;
 flowRevision++;dirty=true;
}
function startFlowWorker(){
 if(typeof Worker==='undefined')return;
 try{
  flowWorker=new Worker(new URL('./numerical-worker.js',import.meta.url),{type:'module'});
  flowWorker.onmessage=({data})=>{
   if(!inFlight||data.id!==inFlight.id||data.key!==inFlight.key)return;
   if(data.error){stopFlowWorker(data.error);return}
   if(!data.done)return; // Never expose a partial branch prefix.
   const job=inFlight;inFlight=null;commitSnapshot(job,data);flowPending=!!queued;
   launchQueued();ui();
  };
  flowWorker.onerror=e=>stopFlowWorker(e.message||'worker failure');
 }catch(error){stopFlowWorker(String(error))}
}
function stopFlowWorker(error){flowWorker?.terminate();flowWorker=null;workerError=String(error);if(inFlight&&!queued)queued=inFlight;inFlight=null;launchQueued();dirty=true}
function launchQueued(){
 if(inFlight||!queued)return;
 const job={...queued,depths:[...depths],lateral};queued=null;
 // This is the sole ordinary interaction path advancing critical ID history.
 job.roots=structuredClone(critical(job.depths,-1));job.id=++workerRequest;
 job.key=JSON.stringify([job.depths,job.lateral,job.level,job.roots.map(c=>[c.id,c.m,c.p])]);
 inFlight=job;workerStateKey=job.key;flowPending=true;flowDetailRequested=true;
 if(flowWorker)flowWorker.postMessage({type:'solve',id:job.id,key:job.key,epoch:job.id,depths:job.depths,lateral:job.lateral,level:job.level,rootsSnapshot:job.roots,sparse:false});
 else{const data=allTrajectories(job.depths,job.lateral,job.level,job.roots,{sparse:false});inFlight=null;commitSnapshot(job,data);flowPending=false}
}
function prepareFlows(level,now){queued={depths:[...depths],lateral,level};flowChangedAt=now;flowPending=true;launchQueued();ui()}
function refineFlows(level){prepareFlows(level,performance.now())}
function discardPending(){flowWorker?.postMessage({type:'cancel'});inFlight=null;queued=null;flowPending=false;workerRequest++;flowDepths=NaN}

let sharedSamples=[],transition=null,arrowFade=1,frameDt=1/60,lastFrame=0,repaintUntil=0;
const zoomClamp=z=>Math.max(.65,Math.min(6,z));
const smoothWeight=(a,b,x)=>{let u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u)};
const views=[{canvas:$('#left'),yaw:0,pitch:0,zoom:1,camera:null,focus:null,arrowAlphas:new Map(),flowAlphas:new Map(),flowAlphaRoots:new Map(),flowExtents:new Map(),flowHeadAlphas:new Map(),right:false},{canvas:$('#right'),yaw:0,pitch:0,zoom:1,camera:null,focus:null,arrowAlphas:new Map(),flowAlphas:new Map(),flowAlphaRoots:new Map(),flowExtents:new Map(),flowHeadAlphas:new Map(),right:true}];
function rawProject(p,v){const c=Math.cos(v.yaw),s=Math.sin(v.yaw),x=c*p[0]-s*p[1],d=s*p[0]+c*p[1],cp=Math.cos(v.pitch),sp=Math.sin(v.pitch);return [x,cp*p[2]-sp*d,cp*d+sp*p[2]]}
function project(p,v){const q=rawProject(p,v);return [v.cx+(q[0]-(v.centerX||0))*v.scale,v.cy-(q[1]-(v.centerZ||0))*v.scale,q[2]]}
function position(p,v){const {depths,lateral}=displayed;return v.right?map(p,depths,sign,lateral):[p[0],p[1],-p[2]]}
// Zoom is an affine change of the existing screen projection. It neither picks
// a surface sheet nor snaps/reorients toward a critical point. An empty screen
// location is an equally valid anchor; every depth on its view ray stays put.
function updateCamera(v){const {lateral}=displayed;
 const r=v.canvas.getBoundingClientRect();v.w=r.width;v.h=r.height;
 v.scale=v.zoom*Math.min(r.width/(v.right?3.3:2.65),r.height/3.2);
 v.cx=r.width*(v.right?.41:.5);v.cy=r.height*.5;
 if(v.camera){v.centerX=v.camera.x;v.centerZ=v.camera.z}
 else{const heights=displayedCritical().map(c=>c.h);v.centerX=v.right?horizontalCenter(v.yaw,lateral):0;v.centerZ=v.right?(Math.min(...heights)+Math.max(...heights))/2:0}
 return r;
}
function screenAnchor(v,clientX,clientY){
 const r=updateCamera(v),x=clientX-r.left,y=clientY-r.top;
 return [(x-v.cx)/v.scale+v.centerX,(v.cy-y)/v.scale+v.centerZ];
}
function placeAnchor(v,anchor,clientX,clientY,zoom){
 v.zoom=zoomClamp(zoom);const r=updateCamera(v),x=clientX-r.left,y=clientY-r.top;
 // This camera-space center remains spatially fixed during deformation: no
 // material-point tracking can cancel the cap's actual horizontal/vertical move.
 v.camera={x:anchor[0]-(x-v.cx)/v.scale,z:anchor[1]-(v.cy-y)/v.scale};
 v.centerX=v.camera.x;v.centerZ=v.camera.z;dirty=true;
}
function zoomAt(v,clientX,clientY,zoom){const anchor=screenAnchor(v,clientX,clientY);placeAnchor(v,anchor,clientX,clientY,zoom)}
function horizontalCenter(){return 0}
function path(ctx,ps,close=false){ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));if(close)ctx.closePath()}
function render(v){const {depths,lateral}=displayed;const canvas=v.canvas,r=updateCamera(v),ratio=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio)}const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,r.width,r.height);
v.sheetStats=renderSurfaceSheets(ctx,v,{t:depths,depths,sign,lateral});
// One genuine integral-curve layer. Zoom only reveals finer nested seed levels.
const isHidden=(q,p,mapped)=>v.right?(sheetPointOccluded(v,mapped??map(p,depths,sign,lateral))??rayOccluded(p,depths,v.yaw,lateral,sign,v.pitch||0,v.scale)):q[2]<-1e-8;
v.arrows=[];v.branchArrows=[];v.flowCurves=[];v.flowHeads=[];v.rowGroups=[];
const flowCritical=displayedCritical(),cpScreens=flowCritical.map(c=>project(position(c.p,v),v)),cpClearanceWeights=flowCritical.map(c=>c.m===null?.25:1);
const cyaw=Math.cos(v.yaw),syaw=Math.sin(v.yaw),cpitch=Math.cos(v.pitch),spitch=Math.sin(v.pitch);
const flowProject=p=>{const x=cyaw*p[0]-syaw*p[1],d=syaw*p[0]+cyaw*p[1];return [v.cx+(x-v.centerX)*v.scale,v.cy-(cpitch*p[2]-spitch*d-v.centerZ)*v.scale,cpitch*d+spitch*p[2]]};
const key=[flowRevision,depths,lateral,sign,v.yaw,v.pitch,v.scale,v.centerX,v.centerZ,v.w,v.h].join('|');
let projectedFlows;
if(v.flowProjection?.key===key)projectedFlows=v.flowProjection.curves;
else{
 const grid=new Map();projectedFlows=[];
 // Project full exact trajectories before whole-orbit density selection.
 for(const curve of sharedFlows.curves){
  const levelWeight=trajectoryLevelWeight(curve.level,v.scale);if(levelWeight<.001)continue;
  const points=curve.points.map(sample=>{
   const p=sample.p,mapped=sample.mapped?(sign===-1?sample.mapped:[sample.mapped[0],sample.mapped[1],-sample.mapped[2]]):null,q=flowProject(v.right&&mapped?mapped:position(p,v));let near=Infinity,clearance=1;for(let i=0;i<cpScreens.length;i++){const c=cpScreens[i],d=Math.hypot(c[0]-q[0],c[1]-q[1]);near=Math.min(near,d);clearance*=1-cpClearanceWeights[i]*(1-smoothWeight(8,curve.kind==='saddle'?14:22,d))}
   const inside=q[0]>-20&&q[0]<r.width+20&&q[1]>-20&&q[1]<r.height+20;
   let spatial=sample.weight*levelWeight*clearance,hidden=!inside||clearance<.001;
   const cell=[Math.floor(q[0]/10),Math.floor(q[1]/10)];
   if(spatial>.001&&!hidden&&curve.kind!=='saddle'){
    let crowd=0;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const a of grid.get(`${cell[0]+dx},${cell[1]+dy}`)??[]){const d=Math.hypot(q[0]-a.q[0],q[1]-a.q[1]);crowd=Math.max(crowd,a.weight*(1-smoothWeight(2,10,d)))}
    spatial*=1-crowd;
   }
   hidden=hidden||spatial<.005||isHidden(q,p,mapped);
   let g=hidden?[0,0,0]:v.right?(sample.physicalGradient?(sign===-1?sample.physicalGradient:[-sample.physicalGradient[0],-sample.physicalGradient[1],sample.physicalGradient[2]]):pushedField(p,depths,sign,lateral)):(sample.sourceGradient?sample.sourceGradient.map(x=>-sign*x):field(p,depths,sign,lateral));if(!v.right)g=[g[0],g[1],-g[2]];
   const dx=(cyaw*g[0]-syaw*g[1])*v.scale,dy=(-cpitch*g[2]+spitch*(syaw*g[0]+cyaw*g[1]))*v.scale,projected=Math.hypot(dx,dy);
   return {...sample,q,near,hidden,dx,dy,projected,spatial:hidden?0:spatial};
  });
  for(let i=0;i<points.length;i+=2){const p=points[i];if(p.spatial<.005)continue;const cell=`${Math.floor(p.q[0]/10)},${Math.floor(p.q[1]/10)}`;if(!grid.has(cell))grid.set(cell,[]);grid.get(cell).push({q:p.q,weight:p.spatial})}
  projectedFlows.push({...curve,points});
 }
 // Restore the pre-reduction full pool. Actual clipping, sheet occlusion,
 // critical clearance and level weights below remain unchanged.
 v.orbitSelection=new Set(projectedFlows.map(c=>c.id));
 for(const c of projectedFlows)c.selectionTarget=c.kind==='saddle'||v.orbitSelection.has(c.id)?1:0;
 v.flowProjection={key,curves:projectedFlows};
}
const live=new Set(),headLocations=[];
for(const curve of projectedFlows){
 const segments=[];
 const alphaId=`curve:${curve.id}`;live.add(alphaId);
 const extent=Infinity;if(Math.abs((v.flowAlphas.get(alphaId)??0)-(curve.selectionTarget??1))>.01)repaintUntil=Math.max(repaintUntil,performance.now()+200);const prev=v.flowAlphas.get(alphaId)??(curve.persistentAxis?1:0),appearance=prev+((curve.selectionTarget??1)-prev)*(1-Math.exp(-frameDt/.14));v.flowAlphas.set(alphaId,appearance);v.flowAlphaRoots.set(alphaId,[curve.criticalId,curve.target,curve.extremum].filter(Boolean));
 for(const p of curve.points)p.opacity=p.hidden?0:p.spatial*appearance*arrowFade;

 for(let i=1;i<curve.points.length;i++){
  const a=curve.points[i-1],b=curve.points[i],opacity=Math.min(a.opacity,b.opacity)*(curve.kind==='saddle'?.68:.48);
  if(opacity<.008)continue;
  ctx.globalAlpha=opacity;ctx.strokeStyle='#73776f';ctx.lineWidth=curve.kind==='saddle'?1.25:1;ctx.lineCap='round';path(ctx,[a.q,b.q]);ctx.stroke();ctx.globalAlpha=1;
  segments.push({id:b.id,a:a.q,b:b.q,p:a.p,p2:b.p,opacity});
 }
 // Heads use dyadic source-arclength cohorts; only refine as
 // screen scale grows. They carry the exact current projected gradient tangent.
 // Fixed CSS-pixel geometry survives DPR changes and camera zoom. The filled
 // on-curve triangle is legible on phones without widening the trajectory itself.
 const headLengthCSS=7.2,headWidthCSS=6,minSeparationCSS=68,markerClearanceCSS=32;
 const segmentIds=new Set(segments.map(s=>s.id));let stride=64;while(stride>8&&stride*.016*v.scale>150)stride/=2;
 const spacing=1.2/(64/stride),cohorts=new Map();
 for(const p of curve.points){const n=Math.round(p.s/spacing),error=Math.abs(p.s-n*spacing),old=cohorts.get(n);if(error<.026&&(!old||error<old.error))cohorts.set(n,{p,error})}
 const candidates=[...cohorts.values()].map(a=>a.p).sort((a,b)=>{const rank=p=>{let n=Math.abs(Math.round(p.s/.15));if(n===0)return 0;let k=0;while(n%2===0&&k<10){k++;n/=2}return 10-k};return rank(a)-rank(b)});

 for(const p of candidates){
  if(p.opacity<.10||p.projected<1e-9||p.near<markerClearanceCSS||!segmentIds.has(p.id)||headLocations.some(q=>Math.hypot(q[0]-p.q[0],q[1]-p.q[1])<minSeparationCSS))continue;
  const ux=p.dx/p.projected,uy=p.dy/p.projected,q=p.q,opacity=.88*p.opacity;
  const tip=headLengthCSS*7/12,tail=headLengthCSS*5/12,wing=headWidthCSS/2;
  const verticesCSS=[[q[0]+ux*tip,q[1]+uy*tip],[q[0]-ux*tail-uy*wing,q[1]-uy*tail+ux*wing],[q[0]-ux*tail+uy*wing,q[1]-uy*tail-ux*wing]];
  ctx.globalAlpha=opacity;ctx.fillStyle='#555e55';path(ctx,verticesCSS,true);ctx.fill();ctx.globalAlpha=1;headLocations.push(q);
  const record={id:p.id,curve:curve.id,criticalId:curve.criticalId,target:curve.target,extremum:curve.extremum,kind:curve.kind,p:p.p,s:p.s,H:p.mapped?-sign*p.mapped[2]:map(p.p,depths,sign,lateral)[2],q,direction:[ux,uy],verticesCSS,headLengthCSS,headWidthCSS,minSeparationCSS,markerClearanceCSS,near:p.near,opacity,flow:curve.flow*-sign,stride};v.flowHeads.push(record);if(curve.kind==='saddle')v.branchArrows.push({...record,branch:curve.id,length:0,selected:true});
 }
 v.flowCurves.push({id:curve.id,criticalId:curve.criticalId,target:curve.target,extremum:curve.extremum,kind:curve.kind,level:curve.level,flow:curve.flow*-sign,segments});
}
// Missing while details are pending means "not computed yet", not death.
// Retain only scalar opacity/identity, never stale path coordinates.
if(!flowPending)for(const id of v.flowAlphas.keys())if(!live.has(id)){v.flowAlphas.delete(id);v.flowAlphaRoots.delete(id);v.flowExtents.delete(id)}
const cps=displayedCritical();v.hits=[];
if(v.right){let ax=r.width*.86;ctx.strokeStyle='#99958b';ctx.lineWidth=1;path(ctx,[[ax,14],[ax,r.height-15]]);ctx.stroke();path(ctx,[[ax-3,20],[ax,14],[ax+3,20]]);ctx.stroke();
for(const c of cps){let q=project(map(c.p,depths,sign,lateral),v);ctx.setLineDash([3,5]);ctx.strokeStyle=c.m===1?'#31999d70':'#cb4b1660';path(ctx,[q,[ax,q[1]]]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=c.m===null?'#7e817b':c.m===1?cyan:orange;ctx.strokeStyle=ctx.fillStyle;if(c.m===2){ctx.fillRect(ax-3,q[1]-3,6,6)}else if(c.m===1){path(ctx,[[ax,q[1]-4],[ax+4,q[1]],[ax,q[1]+4],[ax-4,q[1]]],true);ctx.fill()}else if(c.m===null){path(ctx,[[ax-3,q[1]-3],[ax+3,q[1]+3]]);ctx.stroke();path(ctx,[[ax-3,q[1]+3],[ax+3,q[1]-3]]);ctx.stroke()}else{ctx.beginPath();ctx.arc(ax,q[1],3,0,tau);ctx.fill()}}}
for(const c of cps){let q=project(position(c.p,v),v),color=c.m===null?'#7e817b':c.m===1?cyan:orange,hidden=isHidden(q,c.p);ctx.globalAlpha=hidden?.26:1;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.5;if(selected.includes(c.id)){ctx.beginPath();ctx.arc(q[0],q[1],11,0,tau);ctx.stroke()}if(c.m===null){path(ctx,[[q[0]-5,q[1]-5],[q[0]+5,q[1]+5]]);ctx.stroke();path(ctx,[[q[0]-5,q[1]+5],[q[0]+5,q[1]-5]]);ctx.stroke()}else{if(c.m===1){path(ctx,[[q[0],q[1]-6],[q[0]+6,q[1]],[q[0],q[1]+6],[q[0]-6,q[1]]],true)}else if(c.m===2){path(ctx,[[q[0]-5,q[1]-5],[q[0]+5,q[1]-5],[q[0]+5,q[1]+5],[q[0]-5,q[1]+5]],true)}else{ctx.beginPath();ctx.arc(q[0],q[1],5,0,tau)}ctx.fill();ctx.stroke()}ctx.fillStyle=color;ctx.font='13px "Euler Math"';drawCriticalLabel(ctx,c.id,q[0]+10,q[1]-9);ctx.globalAlpha=1;v.hits.push({...c,q,hidden,alpha:hidden?.26:1,shape:c.m===null?'cross':c.m===2?'square':c.m===1?'diamond':'circle'});}

}
function drawCriticalLabel(ctx,id,x,y){
 const [,base,digits]=id.match(/^([A-Z]+)([0-9]*)$/)??['',id,''];ctx.font='13px "Euler Math"';ctx.fillText(base,x,y);
 if(digits){ctx.font='9px "Euler Math"';ctx.fillText(digits,x+9*base.length,y+4)}
}
let verifiedCancellation=null;
function cancellationPatch(){return verifiedCancellation?.validated===true?verifiedCancellation.patch:-1}
function refreshCancellation(){
 verifiedCancellation=coherent()&&!animation&&selected.length===2?cancellationPlan(depths,selected,selectedPatch,sign):null;
}
function ui(){
 const cps=displayedCritical(),counts=[0,0,0];selected=selected.filter(id=>cps.some(c=>c.id===id));refreshCancellation();cps.forEach(c=>{if(c.m!==null)counts[c.m]++});
 $('#equation').innerHTML=cps.some(c=>c.m===null)?'<span class="degenerate">臨界点を数値確認中 · 指数は未確定</span>':`<span class="orange math">c<sub>0</sub></span> − <span class="cyan math">c<sub>1</sub></span> + <span class="orange math">c<sub>2</sub></span> = ${counts[0]} − ${counts[1]} + ${counts[2]} = ${counts[0]-counts[1]+counts[2]}`;
 $('#cancel').disabled=!!animation||!!transition||cancellationPatch()<0;
 $('#amplitude').min=String(-PATCHES[selectedPatch].depthLimit);$('#amplitude').max=String(PATCHES[selectedPatch].depthLimit);
 $('#amplitude').value=animation?depths[selectedPatch]:targetDepths[selectedPatch];
 $('#amplitude').disabled=!!animation||!!transition;$('#reverse').disabled=!!animation||!!transition;
 $('#deform').setAttribute('aria-pressed',mode==='deform');$('#rotate').setAttribute('aria-pressed',mode==='rotate');
 const regionLabels=sign===-1?['右上','右下','左上','左下']:['右下','右上','左下','左上'];
 for(let i=0;i<4;i++){$('#patch'+i).textContent=regionLabels[i];$('#patch'+i).setAttribute('aria-pressed',i===selectedPatch);$('#patch'+i).disabled=!!animation||!!transition}
 $('#patch-name').textContent=regionLabels[selectedPatch];
 $('#status').innerHTML=animation?'選んだ対を相殺中':cps.some(c=>c.m===null||c.uncertain)?'臨界点の数値精度を確認中':cancellationPatch()>=0?'選んだ対を相殺できます':flowPending?'軌道を更新中':selected.length===2?'この操作で相殺できる経路は未確認です':'上下に引いて変形';dirty=true;
}
function select(id){if(animation)return;const c=displayedCritical().find(c=>c.id===id);if(c?.m===null)return;if(Number.isInteger(c?.patch))selectedPatch=c.patch;selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected.slice(-1),id];ui()}
function beginTransition(kind){animation=null;targetDepths=[...depths];targetLateral=lateral;for(const v of views)v.cancelGesture?.();transition={kind,phase:0,elapsed:0};ui()}
function resetState(){discardPending();resetTracker();flowDepths=NaN;depths=[0,0,0,0];targetDepths=[...depths];selectedPatch=0;lateral=targetLateral=0;sign=-1;selected=[];animation=null;mode='deform';const roots=structuredClone(critical(depths,-1));commitSnapshot({depths,lateral,roots},allTrajectories(depths,lateral,0,roots,{sparse:false}));for(const v of views){v.yaw=0;v.pitch=0;v.zoom=1;v.camera=null;v.focus=null;v.cancelGesture?.();v.arrowAlphas.clear();v.flowAlphas.clear();v.flowAlphaRoots.clear();v.flowExtents.clear();v.flowHeadAlphas.clear()}}
const clampDepth=(x,patch=selectedPatch)=>Math.max(-PATCHES[patch].depthLimit,Math.min(PATCHES[patch].depthLimit,x));
for(let i=0;i<4;i++)$('#patch'+i).onclick=()=>{selectedPatch=i;selected=[];ui()};
$('#deform').onclick=()=>{mode='deform';ui()};$('#rotate').onclick=()=>{mode='rotate';ui()};$('#reverse').onclick=()=>beginTransition('reverse');
$('#amplitude').oninput=e=>{targetDepths[selectedPatch]=clampDepth(+e.target.value);selected=[];ui()};
$('#reset').onclick=()=>beginTransition('reset');$('#cancel').onclick=()=>{const patch=cancellationPatch();if(patch>=0){targetDepths[patch]=depths[patch];animation={start:performance.now(),from:depths[patch],patch,to:verifiedCancellation.to};ui()}};
// Source-sheet identity comes from the actual ray hit. Nearby projected patch
// handles remain reachable on the narrow side silhouette without tinting it.
function patchAt(source,v,x,y){
 const ranked=PATCHES.map((patch,i)=>{const p=patch.sourceAnchor??[...patch.center,patch.sourceZSign*Math.sqrt(1-patch.center[0]**2-patch.center[1]**2)],px=p[0],py=p[1],z=p[2],q=project(position(p,v),v);return {i,p,q,d:Math.hypot(q[0]-x,q[1]-y),sourceDistance:source?Math.hypot(source[0]-px,source[1]-py):Infinity,sameSheet:source&&source[2]*z>0}});
 const hit=ranked.filter(a=>a.sameSheet&&a.sourceDistance<(PATCHES[a.i].radius??.4)+.06).sort((a,b)=>a.sourceDistance-b.sourceDistance)[0];
 if(hit)return hit.i;
 return ranked.filter(a=>a.d<28).sort((a,b)=>a.d-b.d)[0]?.i??-1;
}
// Follow the actual material map, not an obsolete compact graph bump. The
// material handles have exact unit vertical response. Away from a handle three
// bounded Newton steps use a finite parameter derivative of the current map.
// A touch may land anywhere on a broad shoulder. Compensating its weak response
// would amplify the visible handle motion up to fourfold. Touch therefore caps
// handle travel to the finger's CSS-pixel travel; off-handle material may move
// less, but never gains extra parameter travel. Mouse keeps its precision grip.
function grabDepth(drag,v,dy){
 const patch=drag.patch,p=drag.source,base=drag.depth,target=drag.height-dy/v.scale;
 const gainLimit=drag.pointerType==='touch'?1:4;
 let value=base,limit=gainLimit*Math.abs(dy/v.scale),trial=[...drag.depths];
 for(let k=0;k<3;k++){
  trial[patch]=value;const height=rawProject(map(p,trial,sign,lateral),v)[1],h=1e-5;
  const up=clampDepth(value+h,patch),down=clampDepth(value-h,patch);trial[patch]=up;const plus=rawProject(map(p,trial,sign,lateral),v)[1];
  trial[patch]=down;const minus=rawProject(map(p,trial,sign,lateral),v)[1];
  const derivative=(plus-minus)/(up-down),bounded=Math.sign(derivative||sign)*Math.max(.25,Math.abs(derivative));
  value=clampDepth(Math.max(base-limit,Math.min(base+limit,value+(target-height)/bounded)),patch);
 }
 return value;
}
for(const v of views){let drag=null,pinch=null,suppress=false;const active=new Map();
 v.cancelGesture=()=>{active.clear();drag=null;pinch=null;suppress=false};
 const beginPinch=()=>{const ids=[...active.keys()].slice(0,2),ps=ids.map(id=>active.get(id)),x=(ps[0].x+ps[1].x)/2,y=(ps[0].y+ps[1].y)/2;pinch={ids,distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)),zoom:v.zoom,anchor:screenAnchor(v,x,y)};drag=null;suppress=true};
 v.canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?v.canvas.clientHeight:1);zoomAt(v,e.clientX,e.clientY,v.zoom*Math.exp(-delta*.0024));if(pinch)beginPinch()},{passive:false});
 for(const type of ['gesturestart','gesturechange','gestureend'])v.canvas.addEventListener(type,e=>e.preventDefault(),{passive:false});
 v.canvas.onpointerdown=e=>{if(transition)return;active.set(e.pointerId,{x:e.clientX,y:e.clientY});v.canvas.setPointerCapture(e.pointerId);
  if(active.size>=2){if(!pinch)beginPinch();return}
  if(animation||transition||suppress)return;const {depths,lateral}=displayed;let r=updateCamera(v),x=e.clientX-r.left,y=e.clientY-r.top,hit=displayedCritical().map(c=>({...c,q:project(position(c.p,v),v)})).map(c=>({...c,distance:Math.hypot(c.q[0]-x,c.q[1]-y)})).filter(c=>c.distance<17).sort((a,b)=>a.distance-b.distance)[0];const source=v.right?surfaceHit((x-v.cx)/v.scale+v.centerX,(v.cy-y)/v.scale+v.centerZ,depths,sign,v.yaw,lateral,v.pitch||0,v.scale):null;const patch=v.right?patchAt(source,v,x,y):-1;if(patch>=0){selectedPatch=patch;if(mode==='deform'){v.camera={x:v.centerX,z:v.centerZ}}ui()}drag={pointerType:e.pointerType,allowed:patch>=0,patch,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,depth:patch>=0?depths[patch]:0,source:source??PATCHES[patch]?.sourceAnchor,depths:[...depths],height:patch>=0?rawProject(map(source??PATCHES[patch].sourceAnchor,depths,sign,lateral),v)[1]:0,lateral,hit:hit?.id};
 };
 // Front-facing material points follow the finger: rawProject gives dx/dyaw < 0, dy/dpitch > 0.
 v.canvas.onpointermove=e=>{if(!active.has(e.pointerId))return;active.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&active.size>=2){const ps=pinch.ids.map(id=>active.get(id)),distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);placeAnchor(v,pinch.anchor,(ps[0].x+ps[1].x)/2,(ps[0].y+ps[1].y)/2,pinch.zoom*Math.pow(distance/pinch.distance,1.2));return}if(suppress||!drag||transition||animation)return;let dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.moved||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5){drag.moved=true;if(v.right&&mode==='deform'){if(!drag.allowed)return;if(!drag.rebased){depths=[...drag.depths];targetDepths=[...drag.depths];lateral=targetLateral=drag.lateral;discardPending();drag.rebased=true}depths[drag.patch]=targetDepths[drag.patch]=grabDepth(drag,v,e.clientY-drag.startY);const lateralProjection=Math.cos(v.yaw);if(Math.abs(lateralProjection)>.2)lateral=targetLateral=Math.max(-lateralLimit,Math.min(lateralLimit,drag.lateral+(e.clientX-drag.startX)*.25*Math.sign(PATCHES[drag.patch].center[0])/(v.scale*lateralProjection))); selected=[];ui()}else{v.yaw-=dx*.009;if(!v.right)v.pitch+=dy*.009;dirty=true}}drag.x=e.clientX;drag.y=e.clientY;};
 const release=(e,cancelled=false)=>{if(!active.has(e.pointerId))return;if(!cancelled&&active.size===1&&!suppress&&drag&&!drag.moved&&drag.hit)select(drag.hit);active.delete(e.pointerId);drag=null;if(active.size<2)pinch=null;else if(pinch?.ids.includes(e.pointerId))beginPinch();if(active.size===0)suppress=false};v.canvas.onpointerup=e=>release(e);v.canvas.onpointercancel=e=>release(e,true);v.canvas.onlostpointercapture=e=>release(e,true);
 v.canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(transition||animation)return;if(v.right&&mode==='deform'){if(e.key==='ArrowUp'||e.key==='ArrowDown')targetDepths[selectedPatch]=clampDepth(targetDepths[selectedPatch]+(e.key==='ArrowUp'?1:-1)*sign*.005);else if(Math.abs(Math.cos(v.yaw))>.2)targetLateral=Math.max(-lateralLimit,Math.min(lateralLimit,targetLateral+(e.key==='ArrowRight'?1:-1)*Math.sign(Math.cos(v.yaw))*Math.sign(PATCHES[selectedPatch].center[0])*.00375));selected=[];ui()}else{if(e.key==='ArrowLeft')v.yaw+=.1;if(e.key==='ArrowRight')v.yaw-=.1;if(!v.right){if(e.key==='ArrowUp')v.pitch-=.1;if(e.key==='ArrowDown')v.pitch+=.1}dirty=true}}};
}
window.addEventListener('resize',()=>dirty=true);
function frame(now){frameDt=Math.min(.04,lastFrame?(now-lastFrame)/1000:1/60);lastFrame=now;
 if(transition){transition.elapsed+=frameDt;if(transition.phase===0){arrowFade=Math.max(0,1-transition.elapsed/.18);if(arrowFade===0){if(transition.kind==='reset')resetState();else{sign*=-1;selected=[];for(const v of views)if(v.right&&v.camera)v.camera.z*=-1}transition.phase=1;transition.elapsed=0}}else{arrowFade=Math.min(1,transition.elapsed/.18);if(arrowFade===1)transition=null}ui()}

 if(animation){let f=Math.min(1,(now-animation.start)/2300),smooth=f*f*(3-2*f);depths[animation.patch]=animation.from+(animation.to-animation.from)*smooth;targetDepths[animation.patch]=depths[animation.patch];if(f>=1){animation=null;selected=[]}ui()}
 if(!transition){for(let i=0;i<4;i++)if((!animation||animation.patch!==i)&&Math.abs(targetDepths[i]-depths[i])>1e-7){const change=(targetDepths[i]-depths[i])*(1-Math.exp(-frameDt/.085));depths[i]+=Math.max(-(patchDepthLimit*.75)*frameDt,Math.min(patchDepthLimit*.75*frameDt,change));if(Math.abs(targetDepths[i]-depths[i])<1e-6)depths[i]=targetDepths[i];ui()}}
 if(!transition&&Math.abs(targetLateral-lateral)>1e-7){const change=(targetLateral-lateral)*(1-Math.exp(-frameDt/.085));lateral+=Math.max(-.35*frameDt,Math.min(.35*frameDt,change));if(Math.abs(targetLateral-lateral)<1e-6)lateral=targetLateral;dirty=true}
 if(dirty)repaintUntil=now+1100;if(now>repaintUntil){requestAnimationFrame(frame);return}
 const scale=Math.max(...views.map(v=>v.zoom*Math.min(v.canvas.clientWidth/(v.right?3.3:2.65),v.canvas.clientHeight/3.2))),spacing=Math.max(.24,Math.min(.65,48/Math.max(1,scale))),zoom=Math.max(...views.map(v=>v.zoom)),lod=smoothWeight(1.15,5,zoom),localSpacing=Math.max(.018,Math.min(.12,20/Math.max(1,scale)));
 const level=scale>320?2:scale>160?1:0;sharedSamples=[];if(depths.join(',')!==flowDepths||lateral!==flowLateral){prepareFlows(level,now);flowDepths=depths.join(',');flowLateral=lateral;flowLevel=level}else if(level!==flowLevel){refineFlows(level);flowLevel=level}views.forEach(render);dirty=false;requestAnimationFrame(frame)
}
// FontFaceSet.check() alone can return true for a missing family. Require actual
// successfully loaded faces before any canvas labels or mathematical DOM appear.
let fontsReady=false,fontError=null;
// Preload numerical module while exact font faces are loading.
startFlowWorker();
try{
 const requested=[['Noto Sans JP','日本語あそぼう極小点鞍点極大点'],['Euler Math','cSiχ0123456789−+=()ABCD']];
 const loaded=await Promise.all(requested.map(([family,sample])=>document.fonts.load(`14px "${family}"`,sample)));
 await document.fonts.ready;
 fontsReady=loaded.every((faces,i)=>faces.length>0&&faces.every(face=>face.status==='loaded'&&face.family.replace(/^["']|["']$/g,'')===requested[i][0]));
 if(!fontsReady)throw Error('Required font face was not loaded');
 document.documentElement.dataset.fonts='ready';ui();requestAnimationFrame(frame);
}catch(error){
 fontError=String(error);document.documentElement.dataset.fonts='error';
 $('#status').textContent='フォントを読み込めませんでした。接続を確認して再読み込みしてください。';
 for(const control of document.querySelectorAll('button,input'))control.disabled=true;
}
window.instrument={state:()=>({fontsReady,fontError,flowPending,flowDetailRequested,flowChangedAt,flowCoreIds:coreFlows.curves.map(c=>c.id),flowWorker:!!flowWorker,workerRequest,workerStateKey,workerError,flowRevision,depths:[...displayed.depths],desiredDepths:[...depths],displayedRoots:structuredClone(displayed.roots),inFlightDepths:inFlight?[...inFlight.depths]:null,queuedDepths:queued?[...queued.depths]:null,targetDepths:[...targetDepths],selectedPatch,lateral:displayed.lateral,desiredLateral:lateral,targetLateral,sign,mode,selected,animation:!!animation,transition:!!transition,arrowFade,critical:displayedCritical(),views:views.map(v=>({yaw:v.yaw,pitch:v.pitch,zoom:v.zoom,camera:v.camera?{...v.camera}:null,focus:v.focus,centerX:v.centerX,hits:v.hits,centerZ:v.centerZ,cx:v.cx,cy:v.cy,width:v.w,height:v.h,scale:v.scale,arrows:v.arrows,branchArrows:v.branchArrows,flowCurves:v.flowCurves,flowHeads:v.flowHeads,flowAlphas:[...v.flowAlphas],rowGroups:v.rowGroups,sheetStats:v.sheetStats})),sampleCount:sharedSamples.length,branchRadius:sharedFlows.radius??0,flowPatches:sharedFlows.patches,particles:sharedSamples.map(a=>({id:a.id,p:a.p,H:sign*a.H,opacity:a.alpha*a.weight,level:a.level}))})};
