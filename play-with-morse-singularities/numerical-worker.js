import {trajectoryGenerator} from './trajectories.js';
import {prepared} from './elastic.js';

// Main-thread roots/IDs are authoritative. This worker never advances a second
// critical tracker and never publishes curves computed for a different state.
export function createFlowWorkerController(post,schedule=fn=>setTimeout(fn,0)){
 let epoch=0;
 function receive(message){
  const m=message?.data??message;
  if(m.type==='reset'||m.type==='cancel'){epoch++;return}
  if(m.type!=='solve')return;
  const token=++epoch,{id,key}=m;
  try{
   if(!Array.isArray(m.rootsSnapshot))throw Error('Authoritative rootsSnapshot required');
   const depths=Array.from(m.depths),lateral=m.lateral??0,level=Math.max(0,Math.min(2,m.level??0)),engine=prepared(depths,-1,lateral),iterator=trajectoryGenerator(depths,lateral,level,m.rootsSnapshot,{sparse:m.sparse===true});
   let current={patches:[],curves:[]},first=true,lastPost=0;
   const publish=done=>{post({id,key,epoch:m.epoch,patches:current.patches,curves:current.curves,radius:current.radius,done});lastPost=performance.now();first=false};
   const enrich=curve=>{if(!curve)return;for(const sample of curve.points){if(sample.mapped&&sample.sourceGradient&&sample.physicalGradient)continue;const d=engine.fieldData(sample.p);sample.mapped=d.q;sample.sourceGradient=d.V;sample.physicalGradient=d.G}};
   const pump=()=>{
    if(token!==epoch){iterator.return();return}
    try{
     const start=performance.now();
     do{
      const step=iterator.next();current=step.value??current;
      if(step.done){if(token===epoch)publish(true);return}
      enrich(current.added);
      if(first&&current.curves.length){publish(false);break}
     }while(performance.now()-start<8);
     if(token!==epoch){iterator.return();return}
     if(!first&&performance.now()-lastPost>=20)publish(false);
     // A MACROTASK yield lets incoming solve/cancel messages invalidate this
     // iterator before any additional obsolete numerical work is performed.
     schedule(pump);
    }catch(error){if(token===epoch)post({id,key,epoch:m.epoch,done:true,error:String(error?.stack??error),curves:[]})}
   };
   schedule(pump);
  }catch(error){post({id,key,epoch:m.epoch,done:true,error:String(error?.stack??error),curves:[]})}
 }
 return {receive,cancel:()=>{epoch++}};
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function'&&typeof document==='undefined'){
 const controller=createFlowWorkerController(message=>self.postMessage(message));
 self.onmessage=event=>controller.receive(event);
}
