import {SURFACES} from './surfaces.js';
import {PATCHES,clampDepth} from './elastic.js';
import {createEngine,computeGeometry,rayHits,rotation,add,sub,mul,unit,dot,TAU} from './geometry.js';
import {rasterizeSheetTriangle} from './raster.js';
import {measureFraming,CAMERA} from './framing.js';
const $=id=>document.getElementById(id),ink='#604739',cyan='#31999d',orange='#cb4b16';
let screenDepth=-3.5,screenExtent=1.65,screenCorners=[],frame=null;
let state={surface:'sphere',depths:[0,0,0,0],lateral:0,yaw:0,pitch:0},geometry=null,engine=null,selectedPatch=0,mode='deform',selectedComponent=-1,point=[.15,.05],hits=[],dirty=true,paintQueued=false;
let worker=null,inFlight=null,queued=null,requestID=0,idleTimer=null,lastInput=0,coarseCheck=null,verification='pending',workerError=null;
const views=[{canvas:$('surface'),...CAMERA,zoom:1,center:[0,0],baseCenter:[0,0],span:[5,4],cache:null},{canvas:$('screen'),yaw:0,pitch:0,zoom:1,center:[0,0],baseCenter:[0,0],span:[2.24,2.24],cache:null}];
const snapshot=()=>({...state,depths:[...state.depths]}),key=s=>JSON.stringify([s.surface,s.depths,s.lateral,s.yaw,s.pitch]);
function schedule(){dirty=true;if(!paintQueued){paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;if(dirty&&geometry){draw();dirty=false}})}}
function solve(level=3){queued={state:snapshot(),level,id:++requestID};launch();ui()}
function launch(){if(inFlight||!queued)return;inFlight=queued;queued=null;if(worker)worker.postMessage(inFlight);else{const job=inFlight;setTimeout(()=>receive({id:job.id,geometry:computeGeometry(job.state,job.level)}),0)}}
function receive(data){if(data.id!==inFlight?.id)return;const job=inFlight;inFlight=null;if(data.error){workerError=data.error;verification='error';$('status').textContent='計算エラー';launch();return}
 geometry=data.geometry;engine=createEngine(geometry.state);frame=measureFraming(geometry);screenDepth=frame.depth;screenExtent=frame.extent;screenCorners=frame.corners;views.forEach((v,i)=>{const f=i?frame.front:frame.upper;v.center=v.center.map((x,k)=>x+f.center[k]-v.baseCenter[k]);v.baseCenter=[...f.center];v.span=[...f.span];v.cache=null});selectedComponent=selectedComponent<geometry.components.length?selectedComponent:-1;
 const current=key(job.state)===key(state);
 if(current){if(job.level===4){coarseCheck={key:key(job.state),g:geometry};verification='pending'}if(job.level>=5){const old=coarseCheck?.key===key(job.state)?coarseCheck.g:null;const agree=old&&old.components.length===geometry.components.length&&old.cuspCount===geometry.cuspCount&&JSON.stringify(old.components.map(c=>[c.degree,c.cusps.length]).sort())===JSON.stringify(geometry.components.map(c=>[c.degree,c.cusps.length]).sort());verification=agree&&geometry.valid&&old.valid?'confirmed':'uncertain';if(job.level===5&&verification==='uncertain'){coarseCheck={key:key(job.state),g:geometry};queued={state:snapshot(),level:6,id:++requestID}}}
 if(job.level===4&&!queued)queued={state:snapshot(),level:5,id:++requestID};}
 hits=rayHits(geometry,...point,engine);ui();schedule();launch();
}
function changed(){lastInput=performance.now();verification='pending';coarseCheck=null;solve(3);clearTimeout(idleTimer);idleTimer=setTimeout(()=>solve(4),240)}
function ui(){
 const kind=state.surface||'sphere',spec=SURFACES[kind],isSphere=kind==='sphere';
 $('surface-select').value=kind;$('euler').innerHTML=`χ(${spec.symbol}) = ${spec.chi}`;$('surface-label').textContent=`${spec.label}とスクリーン`;
 $('surface-note').textContent=isSphere?'':`${kind==='rp2'?'ボーイ曲面のはめ込み。':kind==='roman'?'ローマン曲面は特異点を持つ写像です。数値は平面への合成写像から計算します。':kind==='klein'?'壺型のはめ込み。':kind==='klein8'?'8の字型のはめ込み。':''}回転して射影方向を変えられます。変形は未実装です。`;
 $('deform').disabled=!isSphere;$('regions').hidden=!isSphere;$('deformation-tools').hidden=!isSphere;
 $('surface').setAttribute('aria-label',isSphere?'球面。変形モードで4箇所を上下に引いて変形。回転モードで射影方向を変更。':`${spec.label}。ドラッグまたは矢印キーで回転し、射影方向を変更。`);
 $('screen').setAttribute('aria-label',`${spec.label}の平面への射影。ドラッグまたは矢印キーで選択点を移動。`);
 for(let i=0;i<4;i++)$('patch'+i).setAttribute('aria-pressed',String(i===selectedPatch));
 for(const m of ['deform','rotate'])$(m).setAttribute('aria-pressed',String(mode===m));
 $('amplitude').min=-PATCHES[selectedPatch].depthLimit;$('amplitude').max=PATCHES[selectedPatch].depthLimit;$('amplitude').value=state.depths[selectedPatch];
 if(!geometry)return;
 if((geometry.state.surface||'sphere')!==kind){$('equation').textContent='計算中';$('cusp-equation').textContent='';$('component-results').replaceChildren();$('status').textContent='';views.forEach(v=>v.canvas.style.visibility='hidden');return}views.forEach(v=>v.canvas.style.visibility='');
 const pending=key(geometry.state)!==key(state)||inFlight||queued||verification==='pending';
 const confirmed=verification==='confirmed'&&!pending,showNumbers=geometry.valid&&(pending||confirmed),unknown=pending?'計算中':'未確定';
 $('equation').innerHTML=`<span class="formula-label">射影化回転数の総和</span> <span class="math">= ${showNumbers?geometry.total:unknown}${confirmed?` = χ(${spec.symbol})`:''}</span>`;
 $('cusp-equation').innerHTML=`<span class="formula-label">カスプの個数</span> <span class="math">= ${showNumbers?geometry.cuspCount:unknown}${confirmed?` ≡ ${spec.chi} = χ(${spec.symbol}) (mod 2)`:''}</span>`;
 $('component-results').replaceChildren(...geometry.components.map((c,i)=>{const b=document.createElement('button');b.className='component-result';b.innerHTML=`γ<sub>${i+1}</sub>${showNumbers?` : ${c.degree}`:''}`;b.setAttribute('aria-pressed',String(selectedComponent===i));b.setAttribute('aria-label',`成分${i+1}の接線の表示を切り替える`);b.onclick=()=>{selectedComponent=selectedComponent===i?-1:i;ui();schedule()};return b}));
 $('status').textContent=workerError?'計算エラー':!pending&&verification==='uncertain'?'未確定':'';
}
function dimensions(v){const r=v.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);v.w=r.width;v.h=r.height;v.scale=Math.max(.01,Math.min((v.w-56)/v.span[0],(v.h-56)/v.span[1]))*v.zoom;v.cx=v.w/2;v.cy=v.h/2;if(v.canvas.width!==Math.round(v.w*d)||v.canvas.height!==Math.round(v.h*d)){v.canvas.width=Math.round(v.w*d);v.canvas.height=Math.round(v.h*d);v.cache=null}v.d=d;return r}
function raw(p,v){return rotation(p,v.yaw,v.pitch)}
function project(p,v){const q=raw(p,v);return[v.cx+(q[0]-v.center[0])*v.scale,v.cy-(q[2]-v.center[1])*v.scale,q[1]]}
function path(ctx,ps){ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]))}
function raster(v){const id=[requestID,geometry.level,v.w,v.h,v.yaw,v.pitch,v.zoom,...v.center].join(':');if(v.cache?.id===id)return v.cache;
 const w=Math.max(1,Math.ceil(v.w)),h=Math.max(1,Math.ceil(v.h)),counts=new Uint8Array(w*h),depth=new Float32Array(w*h);depth.fill(-Infinity);const ps=geometry.points.map(p=>project(p,v));for(const t of geometry.triangles){const[a,b,c]=t.map(i=>ps[i]);rasterizeSheetTriangle(counts,w,h,a[0],a[1],b[0],b[1],c[0],c[1],depth,a[2],b[2],c[2])}
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h);for(let i=0;i<counts.length;i++){image.data[i*4]=157;image.data[i*4+1]=143;image.data[i*4+2]=119;image.data[i*4+3]=Math.round(255*(1-Math.pow(.865,counts[i])))}ctx.putImageData(image,0,0);return v.cache={id,canvas,depth,counts,w,h};
}
function hidden(p,v){const q=project(p,v),r=v.cache,x=Math.round(q[0]),y=Math.round(q[1]);if(!r||x<0||y<0||x>=r.w||y>=r.h)return false;const z=r.depth[y*r.w+x];return Number.isFinite(z)&&z-q[2]>.025}
function marker(ctx,p,v,type,color,size=4,occlude=true){const q=project(p,v),hide=occlude&&hidden(p,v);ctx.globalAlpha=hide?.35:1;ctx.strokeStyle=color;ctx.fillStyle=type==='ring'?'#fdf6e3':color;ctx.lineWidth=1.5;ctx.beginPath();if(type==='diamond'){ctx.moveTo(q[0],q[1]-size);ctx.lineTo(q[0]+size,q[1]);ctx.lineTo(q[0],q[1]+size);ctx.lineTo(q[0]-size,q[1]);ctx.closePath()}else ctx.arc(q[0],q[1],size,0,TAU);ctx.fill();ctx.stroke();ctx.globalAlpha=1}
// The rank-one image line remains well-defined at a cusp, where the image
// curve's velocity vanishes. Its unoriented direction is (n_z,0,-n_x).
function tangentTick(ctx,q,n,v,length,color,alpha=1){
 const t=[n[2],0,-n[0]],a=project(q,v),b=project(add(q,t),v),dx=b[0]-a[0],dy=b[1]-a[1],norm=Math.hypot(dx,dy);if(norm<1e-10)return;
 const u=[dx/norm,dy/norm],ends=[-1,1].map(sign=>[a[0]+sign*u[0]*length/2,a[1]+sign*u[1]*length/2]);
 ctx.save();ctx.globalAlpha=alpha;ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.lineCap='round';
 // Keep the cyan contour continuous. No background-coloured under-stroke:
 // it previously cut the contour and made tangents look like dashes.
 path(ctx,ends);ctx.strokeStyle=color;ctx.lineWidth=1.65;ctx.stroke();
 ctx.restore()
}
function contourTangents(ctx,component,v,onPlane=false,selected=false){if(!selected)return;const convert=q=>onPlane?[q[0],screenDepth,q[2]]:q;
 if(selected){const ps=component.path;let distance=0,next=18;for(let j=0;j<ps.length;j++){const a=ps[j],b=ps[(j+1)%ps.length],pa=project(convert(a.q),v),pb=project(convert(b.q),v),len=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]);while(next<=distance+len){const t=len?(next-distance)/len:0,q=add(mul(a.q,1-t),mul(b.q,t)),n=unit(add(mul(a.n,1-t),mul(b.n,t*(dot(a.n,b.n)<0?-1:1)))),at=project(convert(q),v);const nearCusp=component.cusps.some(c=>{const cp=project(convert(c.q),v);return Math.hypot(cp[0]-at[0],cp[1]-at[1])<16});if(!nearCusp)tangentTick(ctx,convert(q),n,v,48,ink,onPlane?.7:.95);next+=64}distance+=len}}
 // Every cusp on the selected component receives its limiting tangent.
 if(geometry.valid&&verification!=='uncertain')for(const c of component.cusps)tangentTick(ctx,convert(c.q),c.n,v,27,orange,onPlane?.7:1);
}
function drawScreenPlane(ctx,v){const ps=screenCorners.map(p=>project(p,v));ctx.save();path(ctx,ps);ctx.closePath();ctx.fillStyle='#eee6d388';ctx.fill();ctx.strokeStyle='#b9ad97';ctx.lineWidth=1;ctx.stroke();
 geometry.components.forEach((c,i)=>{const qs=c.path.map(p=>project([p.q[0],screenDepth,p.q[2]],v));ctx.globalAlpha=selectedComponent<0||selectedComponent===i?.5:.14;ctx.strokeStyle=cyan;ctx.lineWidth=1;path(ctx,[...qs,qs[0]]);ctx.stroke();ctx.globalAlpha=1;contourTangents(ctx,c,v,true,selectedComponent===i)});ctx.restore()}
function draw(){views.forEach(dimensions);for(let k=0;k<2;k++){const v=views[k],ctx=v.canvas.getContext('2d');ctx.setTransform(v.d,0,0,v.d,0,0);ctx.clearRect(0,0,v.w,v.h);if(k===0)drawScreenPlane(ctx,v);const r=raster(v);ctx.drawImage(r.canvas,0,0,v.w,v.h);ctx.lineCap='round';ctx.lineJoin='round';
 geometry.components.forEach((component,i)=>{let phase=0;const ps=component.path,emphasized=selectedComponent<0||selectedComponent===i;for(let j=0;j<ps.length;j++){const a=ps[j],b=ps[(j+1)%ps.length],isHidden=k===0&&hidden(mul(add(a.q,b.q),.5),v);ctx.globalAlpha=(emphasized?1:.22)*(isHidden?.3:1);ctx.strokeStyle=cyan;ctx.lineWidth=selectedComponent===i?2.7:1.7;ctx.setLineDash(isHidden?[3,4]:[]);ctx.lineDashOffset=-phase;const pa=project(a.q,v),pb=project(b.q,v);path(ctx,[pa,pb]);ctx.stroke();phase+=Math.hypot(pa[0]-pb[0],pa[1]-pb[1])}ctx.globalAlpha=1;ctx.setLineDash([]);ctx.lineDashOffset=0;if(k===1)contourTangents(ctx,component,v,false,selectedComponent===i);if(geometry.valid&&verification!=='uncertain')for(const c of component.cusps)marker(ctx,c.q,v,'diamond',orange,4.5,k===0);if(selectedComponent===i){const q=project(ps[Math.floor(ps.length*.27)].q,v);ctx.font='15px "Euler Math"';ctx.fillStyle=cyan;ctx.fillText(`γ${['₁','₂','₃','₄','₅','₆'][i]??i+1}`,q[0]+8,q[1]-8)}});
 if(k===0){ctx.strokeStyle='#60473966';ctx.lineWidth=1;ctx.setLineDash([4,5]);path(ctx,[project([point[0],screenDepth,point[1]],v),project([point[0],Math.max(1.4,...hits.map(h=>h.q[1]+.12)),point[1]],v)]);ctx.stroke();ctx.setLineDash([]);marker(ctx,[point[0],screenDepth,point[1]],v,'ring',ink,4.5,false);for(const h of hits)marker(ctx,h.q,v,'ring',ink,4.5);}
 else{marker(ctx,[point[0],0,point[1]],v,'ring',ink,4.5,false);const a=project([point[0],0,point[1]],v);ctx.strokeStyle='#60473977';ctx.lineWidth=1;path(ctx,[[a[0]-11,a[1]],[a[0]+11,a[1]]]);ctx.stroke();path(ctx,[[a[0],a[1]-11],[a[0],a[1]+11]]);ctx.stroke()}}
 let near=false;for(const c of geometry.components)for(let j=0;j<c.path.length;j++){const a=c.path[j].q,b=c.path[(j+1)%c.path.length].q,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[2])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[2]-t*dz)<.012/views[1].zoom)near=true}
 $('preimages').textContent=near?'逆像 未確定':`逆像 ${hits.length} 個`;
}
function pick(e,v){const r=dimensions(v);point=[(e.clientX-r.left-v.cx)/v.scale+v.center[0],(v.cy-(e.clientY-r.top))/v.scale+v.center[1]];hits=rayHits(geometry,...point,engine);schedule()}
function screenAnchor(v,clientX,clientY){const r=dimensions(v);return[(clientX-r.left-v.cx)/v.scale+v.center[0],(v.cy-clientY+r.top)/v.scale+v.center[1]]}
function placeAnchor(v,anchor,clientX,clientY,z){v.zoom=Math.max(.65,Math.min(5,z));const r=dimensions(v);v.center=[anchor[0]-(clientX-r.left-v.cx)/v.scale,anchor[1]-(v.cy-clientY+r.top)/v.scale];v.cache=null;schedule()}
function zoom(v,clientX,clientY,z){placeAnchor(v,screenAnchor(v,clientX,clientY),clientX,clientY,z)}
function selectPatch(i){selectedPatch=i;ui();schedule()}
for(let i=0;i<4;i++)$('patch'+i).onclick=()=>selectPatch(i);
for(const m of ['deform','rotate'])$(m).onclick=()=>{if(m==='deform'&&state.surface!=='sphere')return;mode=m;ui();schedule()};
$('surface-select').onchange=e=>{state={surface:e.target.value,depths:[0,0,0,0],lateral:0,yaw:e.target.value==='sphere'?0:e.target.value==='klein'?-.55:.13,pitch:e.target.value==='sphere'?0:e.target.value==='klein'?.12:.21};mode=state.surface==='sphere'?'deform':'rotate';point=[.15,.05];selectedComponent=-1;views.forEach(v=>{v.zoom=1;v.center=[...v.baseCenter];v.cache=null});changed()};
$('amplitude').oninput=e=>{state.depths[selectedPatch]=clampDepth(+e.target.value,selectedPatch);changed()};
$('reset').onclick=()=>{const kind=state.surface||'sphere';state={surface:kind,depths:[0,0,0,0],lateral:0,yaw:kind==='sphere'?0:kind==='klein'?-.55:.13,pitch:kind==='sphere'?0:kind==='klein'?.12:.21};point=[.15,.05];selectedPatch=0;selectedComponent=-1;mode=state.surface==='sphere'?'deform':'rotate';views.forEach((v,i)=>{v.yaw=i?0:CAMERA.yaw;v.pitch=i?0:CAMERA.pitch;v.zoom=1;v.center=[...v.baseCenter];v.cache=null});changed()};
for(let k=0;k<2;k++){const v=views[k],active=new Map();let drag=null,pinch=null;
 const pinchStart=()=>{const p=[...active.values()].slice(0,2);pinch={dist:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),zoom:v.zoom,anchor:screenAnchor(v,(p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2)};drag=null};
 v.canvas.onpointerdown=e=>{if(!geometry)return;v.canvas.setPointerCapture(e.pointerId);active.set(e.pointerId,{x:e.clientX,y:e.clientY});if(active.size===2){pinchStart();return}const r=dimensions(v),x=e.clientX-r.left,y=e.clientY-r.top;let allowed=true;if(!k&&mode==='deform'){const hs=PATCHES.map((p,i)=>({i,s:project(engine.map(p.sourceAnchor),v)})).sort((a,b)=>Math.hypot(a.s[0]-x,a.s[1]-y)-Math.hypot(b.s[0]-x,b.s[1]-y));allowed=Math.hypot(hs[0].s[0]-x,hs[0].s[1]-y)<Math.max(44,v.scale*.55);if(allowed)selectPatch(hs[0].i)}drag={allowed,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,depth:state.depths[selectedPatch],lateral:state.lateral,patch:selectedPatch};if(k)pick(e,v)};
 v.canvas.onpointermove=e=>{if(!active.has(e.pointerId))return;active.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&active.size>1){const p=[...active.values()].slice(0,2);placeAnchor(v,pinch.anchor,(p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2,pinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/pinch.dist);return}if(!drag)return;if(k){pick(e,v);return}const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(mode==='rotate'){state.yaw-=dx*.009;state.pitch+=dy*.009;changed()}else{if(!drag.allowed)return;const p=PATCHES[drag.patch].sourceAnchor,trial=snapshot(),step=.0001;trial.depths[drag.patch]=clampDepth(drag.depth+step,drag.patch);const plus=project(createEngine(trial).map(p),v);trial.depths[drag.patch]=clampDepth(drag.depth-step,drag.patch);const minus=project(createEngine(trial).map(p),v);const response=(plus[1]-minus[1])/(2*step),safe=Math.sign(response||1)*Math.max(v.scale*.25,Math.abs(response));state.depths[drag.patch]=clampDepth(drag.depth+(e.clientY-drag.startY)/safe,drag.patch);state.lateral=Math.max(-.04,Math.min(.04,drag.lateral+(e.clientX-drag.startX)*.25*Math.sign(PATCHES[drag.patch].center[0])/v.scale));changed()}drag.x=e.clientX;drag.y=e.clientY};
 const release=e=>{active.delete(e.pointerId);drag=null;if(active.size<2)pinch=null;if(!active.size&&k===0){clearTimeout(idleTimer);solve(4)}};for(const ev of ['pointerup','pointercancel','lostpointercapture'])v.canvas.addEventListener(ev,release);
 v.canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(v,e.clientX,e.clientY,v.zoom*Math.exp(-e.deltaY*(e.deltaMode===1?16:1)*.0024))},{passive:false});
 v.canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const dx=(e.key==='ArrowRight')-(e.key==='ArrowLeft'),dy=(e.key==='ArrowUp')-(e.key==='ArrowDown');if(k){point[0]+=dx*.025/v.zoom;point[1]+=dy*.025/v.zoom;hits=rayHits(geometry,...point,engine);schedule()}else if(mode==='deform'){state.depths[selectedPatch]=clampDepth(state.depths[selectedPatch]-dy*.015,selectedPatch);state.lateral=Math.max(-.04,Math.min(.04,state.lateral+dx*.003*Math.sign(PATCHES[selectedPatch].center[0])));changed()}else{state.yaw-=dx*.08;state.pitch-=dy*.08;changed()}};
}
new ResizeObserver(()=>{views.forEach(v=>v.cache=null);schedule()}).observe(document.querySelector('main'));
try{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>receive(data);worker.onerror=e=>{workerError=e.message;worker.terminate();worker=null;if(inFlight){queued=inFlight;inFlight=null;launch()}}}catch(e){workerError=String(e)}
try{const fonts=await Promise.all([document.fonts.load('14px "Noto Sans JP"','球面の射影'),document.fonts.load('14px "Euler Math"','χΣ∑ℝℙγ0123456789')]);if(fonts.some(a=>!a.length))throw Error('Missing font');await document.fonts.ready;document.documentElement.dataset.fonts='ready';solve(4)}catch(e){document.documentElement.dataset.fonts='ready';$('status').textContent='フォントの一部を読み込めませんでした。';solve(4)}
window.projectionLab={get screenPlane(){return {depth:screenDepth,extent:screenExtent,corners:screenCorners.map(p=>[...p])}},get framing(){return frame},get state(){return snapshot()},get geometry(){return geometry},get verification(){return verification},get hits(){return hits},get mode(){return mode},get views(){return views.map(v=>({w:v.w,h:v.h,scale:v.scale,zoom:v.zoom,yaw:v.yaw,pitch:v.pitch,center:v.center}))},setState(s){state={...state,...s,depths:s.depths?[...s.depths]:state.depths};changed()},setPoint(p){point=[...p];hits=rayHits(geometry,...point,engine);schedule()},get workerError(){return workerError}};
