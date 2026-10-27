// Select whole exact orbits, never fragments. Retained lines have a wider
// persistence band than newcomers. Saddles are structural and never suppressed.
// Geometry is screen-local: compare directions where an orbit leaves a 40 CSS
// pixel neighbourhood, rather than counting every converging endpoint sample.
export function selectWholeOrbits(curves,criticals,screens,previous=new Set()){
 const selected=new Set(),slots=new Map(),fanCounts=new Map(),bodySlots=[];
 const extrema=criticals.map((c,i)=>({...c,q:screens[i]})).filter(c=>c.m===0||c.m===2);
 const bornFan=c=>c.extremum&&!['A','D'].includes(c.extremum);
 const regular=curves.filter(c=>c.kind!=='saddle').sort((a,b)=>(bornFan(b)?1:0)-(bornFan(a)?1:0)||(b.extremum?1:0)-(a.extremum?1:0)||(previous?.has(b.id)?1:0)-(previous?.has(a.id)?1:0)||(a.level??0)-(b.level??0)||a.id.localeCompare(b.id));
 for(const curve of curves)if(curve.kind==='saddle')selected.add(curve.id);
 for(const curve of regular){
  const contacts=[];
  for(const c of extrema){
   if(![curve.criticalId,curve.target,curve.extremum].includes(c.id))continue;
   const candidates=curve.points.filter(p=>!p.hidden).map(p=>({p,d:Math.hypot(p.q[0]-c.q[0],p.q[1]-c.q[1])})).filter(x=>x.d>=24&&x.d<=64).sort((a,b)=>Math.abs(a.d-40)-Math.abs(b.d-40));
   if(!candidates.length)continue;
   const p=candidates[0].p,angle=Math.atan2(p.q[1]-c.q[1],p.q[0]-c.q[0]);contacts.push({id:c.id,angle});
  }
  const threshold=previous?.has(curve.id)?10:18;
  // Main-body coverage has its own budget. A common terminal cap carrying a
  // newborn fan must not erase all long meridians elsewhere on the sphere.
  const mainBody=['A','D'].includes(curve.criticalId)&&['A','D'].includes(curve.target)&&curve.criticalId!==curve.target;
  if(mainBody){
   const middle=curve.points.filter(p=>!p.hidden&&Math.abs(p.p?.[2]??2)<.4).sort((a,b)=>Math.abs(a.p[2])-Math.abs(b.p[2]))[0];
   if(!middle){selected.add(curve.id);continue} // Hidden orbit consumes no screen quota.
   if(bodySlots.length<3&&bodySlots.every(q=>Math.hypot(q[0]-middle.q[0],q[1]-middle.q[1])>=threshold)){selected.add(curve.id);bodySlots.push(middle.q)}
   continue;
  }
  // A fan belongs to its own extremum. Its opposite common endpoint must
  // not consume a global quota and starve other newborn radial fans.
  const ownFan=curve.extremum&&extrema.some(c=>c.id===curve.extremum);
  const fits=ownFan?((fanCounts.get(curve.extremum)??0)<4&&(bornFan(curve)||[curve.criticalId,curve.target].every(id=>['A','D'].includes(id)||(fanCounts.get(id)??0)<4))):contacts.every(({id,angle})=>{const old=slots.get(id)??[];return old.length<4&&old.every(a=>80*Math.abs(Math.sin((angle-a)/2))>=threshold)});
  if(!fits)continue;
  selected.add(curve.id);if(ownFan)fanCounts.set(curve.extremum,(fanCounts.get(curve.extremum)??0)+1);for(const {id,angle}of contacts){if(!slots.has(id))slots.set(id,[]);slots.get(id).push(angle)}
 }
 return selected;
}
