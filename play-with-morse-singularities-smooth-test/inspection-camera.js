// Dedicated stopped-state camera input. No surface or solver state is changed.
export function bindInspectionCamera({canvases,qa,isEnabled,onChange=()=>{},mode=()=> 'pan'}){
 const removers=[];
 canvases.forEach((canvas,index)=>{
  const points=new Map();
  const enabled=()=>Boolean(isEnabled());
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const local=p=>{const r=canvas.getBoundingClientRect();return{x:p.x-r.left,y:p.y-r.top}};
  const apply=action=>qa.camera(index,action);
  const pair=()=>{const [a,b]=[...points.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}};
  const clear=()=>{for(const id of points.keys())try{canvas.releasePointerCapture(id)}catch{}points.clear()};
  const listen=(name,fn,options={capture:true,passive:false})=>{canvas.addEventListener(name,fn,options);removers.push(()=>canvas.removeEventListener(name,fn,options))};
  listen('pointerdown',e=>{if(!enabled()){clear();return}consume(e);if(e.button!==undefined&&e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.focus?.({preventScroll:true});try{canvas.setPointerCapture(e.pointerId)}catch{}});
  listen('pointermove',e=>{if(!enabled()){clear();return}consume(e);if(!points.has(e.pointerId))return;const before=points.size>=2?pair():points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>=2){const after=pair(),anchor=local(before);apply({kind:'zoom',factor:after.d/before.d,...anchor});apply({kind:'pan',dx:after.x-before.x,dy:after.y-before.y})}else{const kind=(typeof mode==='function'?mode(index):mode)==='rotate'?'rotate':'pan';apply({kind,dx:e.clientX-before.x,dy:e.clientY-before.y})}onChange()});
  const end=e=>{if(!enabled()){clear();return}consume(e);points.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId)}catch{}};
  listen('pointerup',end);listen('pointercancel',end);listen('lostpointercapture',e=>{points.delete(e.pointerId);if(enabled())consume(e)});
  listen('wheel',e=>{if(!enabled())return;consume(e);const r=canvas.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?r.height:1);apply({kind:'zoom',factor:Math.exp(-delta*.0024),x:e.clientX-r.left,y:e.clientY-r.top});onChange()});
  listen('keydown',e=>{if(!enabled()||e.altKey||e.ctrlKey||e.metaKey)return;const step=e.shiftKey?60:24,pan={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};if(pan[e.key]){consume(e);apply({kind:'pan',dx:pan[e.key][0],dy:pan[e.key][1]})}else if(['+','=','-','_'].includes(e.key)){consume(e);const r=canvas.getBoundingClientRect();apply({kind:'zoom',factor:e.key==='-'||e.key==='_'?1/1.2:1.2,x:r.width/2,y:r.height/2})}else return;onChange()});
  listen('blur',clear);removers.push(clear);
 });
 return()=>{for(const remove of removers)remove()};
}
