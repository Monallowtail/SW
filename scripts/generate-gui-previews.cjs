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
    setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},addEventListener(){},querySelectorAll(){return[]},querySelector(){return elem('nested')},getBoundingClientRect(){return{width,height,left:['right','screen'].includes(id)?width:0,top:0}},setPointerCapture(){},focus(){}});
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
   if(type==='contours'){env.sandbox.projectionLab.setState({surface:'torus',yaw:.13,pitch:.21,depths:[0,0,0,0]});await env.flush()}
   // Select the same upper handle that the animation changes.
   env.nodes.get('patch1')?.onclick?.();await env.flush();
   env.capture(path.join(output,type+'-initial.png'));
   const outdir=path.join(output,type);fs.mkdirSync(outdir,{recursive:true});
   // The torus controls are [right, top, left, bottom]. Positive top depth
   // pulls the upper patch outward; negative depth pushes it inward.
   // Twenty-one unique solver states cover both directions. Reuse the
   // matching return frames for a smooth 40-frame, four-second loop.
   const states=path.join(outdir,'states');fs.mkdirSync(states,{recursive:true});
   for(let i=0;i<21;i++){
    const d=i<=10?.50*Math.sin(i/10*Math.PI/2):-.50*Math.sin((i-10)/10*Math.PI/2);
    if(type==='morse')env.sandbox.morseSurfaceLab.setDepths([0,d,0,0]);
    else env.sandbox.projectionLab.setState({depths:[0,d,0,0],yaw:.13,pitch:.21});
    await env.flush();
    if(type==='morse'&&env.sandbox.morseSurfaceLab.error)throw Error(env.sandbox.morseSurfaceLab.error);
    env.capture(path.join(states,String(i).padStart(4,'0')+'.png'));
    if(i===10)env.capture(path.join(output,type+'-pull-peak.png'));
    if(i===20)env.capture(path.join(output,type+'-push-peak.png'));
    console.log(type+': '+(i+1)+'/21, upper patch '+d.toFixed(3));
   }
   const sequence=[...Array.from({length:11},(_,i)=>i),...Array.from({length:10},(_,i)=>9-i),...Array.from({length:10},(_,i)=>11+i),...Array.from({length:9},(_,i)=>19-i)];
   sequence.forEach((state,i)=>fs.copyFileSync(path.join(states,String(state).padStart(4,'0')+'.png'),path.join(outdir,String(i).padStart(4,'0')+'.png')));
   const filter='[0:v]trim=end_frame=40,setpts=N/(10*TB),scale=720:322:flags=lanczos,split[x][y];[x]palettegen=max_colors=192:stats_mode=diff[p];[y][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle';
   encode(['-framerate','10','-i',path.join(outdir,'%04d.png'),'-filter_complex',filter,'-final_delay','10','-loop','0','-y',path.join(destination,type+'-gui.gif')]);
   encode(['-i',path.join(output,type+'-initial.png'),'-vf','scale=720:322:flags=lanczos','-frames:v','1','-y',path.join(destination,type+'-gui.png')]);
   console.log('Saved '+type+' GUI: 720x322, 40 frames, 4 seconds; upper patch pulls and pushes.');
  }
 } finally {if(!keepFrames)fs.rmSync(output,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
