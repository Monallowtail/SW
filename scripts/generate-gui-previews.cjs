const fs=require('fs');
const vm=require('vm');
const path=require('path');
const os=require('os');
const {spawnSync}=require('child_process');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
// Browser-free asset generation: execute the original Canvas2D renderer and
// capture its two drawing panels. This does not render or test page layout.
// Dependencies: Node.js, @napi-rs/canvas, ffmpeg.
// Usage: node scripts/generate-gui-previews.cjs --source-dir .
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
if(args.includes('--help')){console.log('node scripts/generate-gui-previews.cjs [--source-dir DIR] [--output-dir DIR] [--frames-dir DIR] [--only morse|contours]');process.exit(0)}
const sourceDir=path.resolve(option('--source-dir',root));
const destination=path.resolve(option('--output-dir',path.join(root,'assets/homepage')));
const keepFrames=args.includes('--frames-dir');
const output=path.resolve(keepFrames?option('--frames-dir'):fs.mkdtempSync(path.join(os.tmpdir(),'sw-gui-')));
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(destination,{recursive:true});
const font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
if(fs.existsSync(font))GlobalFonts.registerFromPath(font,'Noto Sans JP');
function encode(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('ffmpeg failed: '+r.status)}

function makeEnvironment(type){
 const nodes=new Map(),timers=new Map(),rafs=new Map();let counter=0,now=0;
 const width=480,height=430;
 function elem(id){
  if(nodes.has(id))return nodes.get(id);
  let e=['left','right','surface','screen'].includes(id)?createCanvas(width,height):{};
  Object.assign(e,{id,dataset:{},style:{},options:[{value:'sphere'},{value:'torus'}],value:'',textContent:'',innerHTML:'',checked:false,clientHeight:height,clientWidth:width,
    setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},addEventListener(type,fn){(this.listeners??={})[type]=fn},querySelectorAll(){return[]},querySelector(){return elem('nested')},getBoundingClientRect(){return{width,height,left:['right','screen'].includes(id)?width:0,top:0}},setPointerCapture(){},focus(){}});
  nodes.set(id,e);return e;
 }
 const document={body:elem('body'),documentElement:elem('html'),querySelector:q=>elem(q.startsWith('#')?q.slice(1):q),getElementById:elem,querySelectorAll:()=>[],createElement:t=>t==='canvas'?createCanvas(1,1):elem('created'+(++counter)),fonts:{load:async()=>[{}],ready:Promise.resolve()}};
 const CountAnswer={markup:()=>'<input value="?">',render:(n,s)=>n.innerHTML=s};
 const sandbox={console,document,URL,location:{href:'https://monallowtail.github.io/SW/play-with-'+(type==='morse'?'morse-singularities':'apparent-contours')+'.html?surface=torus'},history:{replaceState(){}},devicePixelRatio:1,performance:{now:()=>now},structuredClone,CountAnswer,Math,WebAssembly,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,atob,Blob,OffscreenCanvas:undefined,
 setTimeout(fn,ms=0){let i=++counter;timers.set(i,{fn,ms});return i},clearTimeout(i){timers.delete(i)},requestAnimationFrame(fn){let i=++counter;rafs.set(i,fn);return i},cancelAnimationFrame(i){rafs.delete(i)},ResizeObserver:class{observe(){}},Worker:class{constructor(){throw Error('asset renderer uses the page main-thread fallback')}},addEventListener(){},matchMedia(){return{matches:false,addEventListener(){}}}};
 sandbox.window=sandbox;sandbox.self=sandbox;
 const context=vm.createContext(sandbox);
 async function flush(){
  for(let pass=0;pass<20;pass++){
   await Promise.resolve();await Promise.resolve();
   if(timers.size){const a=[...timers.values()];timers.clear();for(const t of a){now+=t.ms;t.fn()}}
   await Promise.resolve();await Promise.resolve();
   if(rafs.size){const a=[...rafs.values()];rafs.clear();now+=80;for(const fn of a)fn(now)}
   await Promise.resolve();
   if(!timers.size&&!rafs.size){await Promise.resolve();if(!timers.size&&!rafs.size)break}
  }
 }
 const capture=(file)=>{const out=createCanvas(width*2,height);const c=out.getContext('2d');c.fillStyle='#fdf6e3';c.fillRect(0,0,out.width,out.height);for(let i=0;i<2;i++)c.drawImage(elem(type==='morse'?(i?'right':'left'):(i?'screen':'surface')),i*width,0);c.strokeStyle='#d8cdb9';c.lineWidth=1;c.beginPath();c.moveTo(width,0);c.lineTo(width,height);c.stroke();fs.writeFileSync(file,out.toBuffer('image/png'))};
 return {context,flush,capture,nodes,sandbox};
}
(async()=>{
 try {
  const types=option('--only',null)?[option('--only',null)]:['morse','contours'];
  if(types.some(x=>!['morse','contours'].includes(x)))throw Error('--only must be morse or contours');
  for(const type of types){
   const env=makeEnvironment(type);
   const file=path.join(sourceDir,'play-with-'+(type==='morse'?'morse-singularities':'apparent-contours')+'.html');
   const html=fs.readFileSync(file,'utf8');
   const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
   const src=scripts.sort((a,b)=>b.length-a.length)[0];
   if(!src)throw Error('No embedded renderer in '+file);
   await vm.runInContext('(async()=>{'+src+'})()',env.context,{timeout:200000});await env.flush();
   if(type==='contours'){
    // Tilt the actual map far enough for its four genuine contour cusps.
    // Keep this direction fixed while the left control pulls and pushes.
    env.sandbox.projectionLab.setState({surface:'torus',yaw:.45,pitch:1.25,depths:[0,0,0,0]});await env.flush();
    // Enlarge the target screen with the page's own wheel handler.
    env.nodes.get('screen').listeners.wheel({deltaY:-Math.log(1.45)/.0024,deltaMode:0,clientX:720,clientY:215,preventDefault(){}});await env.flush();
   } else {
    // The source view may tilt freely. The height view only turns around
    // its vertical axis, preserving the original height-function policy.
    const key=(canvas,name,n)=>{for(let i=0;i<n;i++)env.nodes.get(canvas).onkeydown({key:name,preventDefault(){}})};
    env.nodes.get('rotate').onclick();
    key('left','ArrowRight',6);key('left','ArrowDown',4);key('right','ArrowRight',8);
    env.nodes.get('deform').onclick();await env.flush();
   }
   // Morse keeps the upper control. Contours moves the left control,
   // whose projection changes the silhouette and creates a cusp pair.
   const movingPatch=type==='contours'?2:1;
   const movingLabel=type==='contours'?'left':'upper';
   env.nodes.get('patch'+movingPatch)?.onclick?.();await env.flush();
   env.capture(path.join(output,type+'-initial.png'));
   const outdir=path.join(output,type);fs.mkdirSync(outdir,{recursive:true});
   // The torus controls are [right, top, left, bottom]. Positive depth
   // pulls the selected patch outward; negative depth pushes it inward.
   // Twenty-one unique solver states cover both directions. Reuse the
   // matching return frames for a smooth 40-frame, four-second loop.
   const states=path.join(outdir,'states');fs.mkdirSync(states,{recursive:true});
   const diagnostics=[];
   for(let i=0;i<21;i++){
    const d=i<=10?.50*Math.sin(i/10*Math.PI/2):-.50*Math.sin((i-10)/10*Math.PI/2);
    if(type==='morse')env.sandbox.morseSurfaceLab.setDepths([0,d,0,0]);
    else env.sandbox.projectionLab.setState({depths:[0,0,d,0],yaw:.45,pitch:1.25});
    await env.flush();
    if(type==='morse'&&env.sandbox.morseSurfaceLab.error)throw Error(env.sandbox.morseSurfaceLab.error);
    env.capture(path.join(states,String(i).padStart(4,'0')+'.png'));
    if(i===10)env.capture(path.join(output,type+'-pull-peak.png'));
    if(i===20)env.capture(path.join(output,type+'-push-peak.png'));
    const g=type==='contours'?env.sandbox.projectionLab.geometry:null;
    if(g&&(!g.valid||g.cuspCount<1||env.sandbox.projectionLab.verification!=='confirmed'))throw Error('Contour preview must retain verified visible cusps');
    if(g)diagnostics.push({frameState:i,controlIndex:movingPatch,controlLabel:movingLabel,controlDepth:d,state:g.state,valid:g.valid,cuspCount:g.cuspCount,verification:env.sandbox.projectionLab.verification,components:g.components.map(c=>({degree:c.degree,cusps:c.cusps.map(q=>q.q)}))});
    console.log(type+': '+(i+1)+'/21, '+movingLabel+' patch '+d.toFixed(3)+(g?', cusps '+g.cuspCount+', valid '+g.valid:''));
   }
   if(diagnostics.length)fs.writeFileSync(path.join(output,type+'-diagnostics.json'),JSON.stringify(diagnostics,null,2)+'\n');
   const sequence=[...Array.from({length:11},(_,i)=>i),...Array.from({length:10},(_,i)=>9-i),...Array.from({length:10},(_,i)=>11+i),...Array.from({length:9},(_,i)=>19-i)];
   sequence.forEach((state,i)=>fs.copyFileSync(path.join(states,String(state).padStart(4,'0')+'.png'),path.join(outdir,String(i).padStart(4,'0')+'.png')));
   const filter='[0:v]trim=end_frame=40,setpts=N/(10*TB),scale=720:322:flags=lanczos,split[x][y];[x]palettegen=max_colors=192:stats_mode=diff[p];[y][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle';
   encode(['-framerate','10','-i',path.join(outdir,'%04d.png'),'-filter_complex',filter,'-final_delay','10','-loop','0','-y',path.join(destination,type+'-gui.gif')]);
   encode(['-i',path.join(output,type+'-initial.png'),'-vf','scale=720:322:flags=lanczos','-frames:v','1','-y',path.join(destination,type+'-gui.png')]);
   console.log('Saved '+type+' GUI: 720x322, 40 frames, 4 seconds; '+movingLabel+' patch pulls and pushes.');
  }
 } finally {if(!keepFrames)fs.rmSync(output,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
