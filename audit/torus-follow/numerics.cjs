// Run from the repository root: node audit/torus-follow/numerics.cjs
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function worker(file,exports){const s=fs.readFileSync(file,'utf8'),ws=[...s.matchAll(/new Blob\(\[("(?:[^"\\]|\\.)*")\]/g)],code=JSON.parse(ws.at(-1)[1]).replace('return {computeCritical,computeSurfaceState,gradientCurves,heightEngine};','return {computeCritical,computeSurfaceState,gradientCurves,heightEngine,numerical};'),c={self:{},performance};vm.createContext(c);vm.runInContext(code+'\nglobalThis.api={'+exports+'};',c);return c.api;}
const m=worker('play-with-morse-singularities.html','...__morse_surfaces,...__source_surfaces,...__surface_state'),a=worker('play-with-apparent-contours.html','...__geometry,...__surfaces,...__manifold');
const report={morse:[],contours:[],bounds:{stageDet:1-.55*.70/12*4.2/.62,compositionDet:(1-.55*.70/12*4.2/.62)**12,maxRadius:1.72},maxSeam:0,maxMapDifference:0,minArea:Infinity};
const direction=[Math.cos(23*Math.PI/180)*Math.cos(24*Math.PI/180),Math.sin(23*Math.PI/180),Math.cos(23*Math.PI/180)*Math.sin(24*Math.PI/180)];
for(const depths of [[0,0,0,0],[-.4,0,0,0],[.55,0,0,0],[0,-.55,0,0],[0,0,-.55,0],[0,0,0,-.55],[-.55,-.55,-.55,-.55],[.55,-.55,.55,-.55]]){
 const r=m.computeCritical('torus',direction,1,depths),e=m.heightEngine('torus',direction,depths),s=m.createSurfaceEngine({surface:'torus',depths}),t=a.createSurfaceEngine({surface:'torus',depths});
 assert(r.valid);assert.equal(r.total,0);assert(r.roots.every(x=>x.residual<2e-6));
 // Independent denser seed grid, including convergence of root positions and indices.
 const finer=m.numerical('torus',direction,2,depths);assert.equal(finer.roots.length,r.roots.length);assert(r.roots.every(x=>finer.roots.some(y=>x.m===y.m&&e.distance(x.p,y.p)<2e-4)));
 console.log('Morse verified',depths);report.morse.push({depths,counts:r.counts,valid:r.valid,residual:Math.max(...r.roots.map(x=>x.residual))});
 for(let i=0;i<80;i++)for(let j=0;j<40;j++){const p=[2*Math.PI*i/80,2*Math.PI*j/40,0],q=s.map(p);report.minArea=Math.min(report.minArea,s.evaluate(p).area);report.maxMapDifference=Math.max(report.maxMapDifference,Math.hypot(...q.map((x,k)=>x-t.map(p)[k])));for(let k=0;k<2;k++){const pp=[...p];pp[k]+=2*Math.PI;report.maxSeam=Math.max(report.maxSeam,Math.hypot(...q.map((x,k)=>x-s.map(pp)[k])));for(const key of ['a1','a2'])assert(Math.hypot(...s.evaluate(p)[key].map((x,k)=>x-s.evaluate(pp)[key][k]))<1e-8);}}
}
for(const depth of [0,-.2,-.4,-.55,.55]){const gs=[4,5,6].map(level=>a.computeGeometry({surface:'torus',depths:[depth,0,0,0],yaw:.13,pitch:.21},level));const summary=g=>({cusps:g.cuspCount,degrees:g.components.map(c=>[c.degree,c.cusps.length]).sort(),total:g.total});for(const g of gs){assert(g.valid);assert.equal(g.total,0);assert.equal(g.cuspCount%2,0);assert(g.maxResidual<1e-7);assert.equal(JSON.stringify(summary(g)),JSON.stringify(summary(gs[0])));}console.log('Contour verified',depth);report.contours.push({depth,levels:gs.map(g=>({level:g.level,...summary(g),residual:g.maxResidual}))});}
// Curves use the same deformed height engine; every displayed sample lies on it.
const flow=m.computeState('torus',direction,[-.55,0,0,0]),fe=m.heightEngine('torus',direction,[-.55,0,0,0]);let maxFlowMapError=0,maxFlowHeightError=0;
for(const curve of flow.curves)for(const p of curve.points){maxFlowMapError=Math.max(maxFlowMapError,Math.hypot(...p.mapped.map((x,k)=>x-fe.map(p.p)[k])));maxFlowHeightError=Math.max(maxFlowHeightError,Math.abs(p.height-fe.h(p.p)));}
assert(flow.curves.length>0);assert(maxFlowMapError<1e-10);assert(maxFlowHeightError<1e-10);report.trajectories={shown:flow.curves.length,omitted:flow.omitted.length,maxFlowMapError,maxFlowHeightError};
const rs={surface:'torus',depths:[-.4,0,0,0],yaw:.13,pitch:.21},rg=a.computeGeometry(rs,5),re=a.createSurfaceEngine(rs);let hits=0,maxRayResidual=0;
for(const [x,z] of [[.8,.1],[0,.8],[-.7,.2],[0,0]])for(const h of a.manifoldRayHits(rg,x,z,re)){hits++;maxRayResidual=Math.max(maxRayResidual,Math.hypot(h.q[0]-x,h.q[2]-z),Math.hypot(...h.q.map((v,k)=>v-re.map(h.p)[k])));}
assert(hits>0);assert(maxRayResidual<2e-5);report.preimages={hits,maxRayResidual};
assert(!m.computeCritical('torus',[0,1,0],1,[-.4,0,0,0]).valid);
assert(report.minArea>0);assert(report.maxSeam<1e-10);assert.equal(report.maxMapDifference,0);
fs.writeFileSync('audit/torus-follow/numerics.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
