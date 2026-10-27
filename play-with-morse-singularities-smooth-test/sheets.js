import {createDepthIndex} from './sheet-depth-index.js';
import {depthArray} from './elastic.js';
import {mappedMesh,meshResolution} from './elastic-mesh.js';
const depthsOf=state=>depthArray(state.depths??state.t);
const hasWells=state=>depthsOf(state).some(x=>x!==0);

/* Projected sheet multiplicity, not depth, volume, or normal lighting.
 * Each transverse crossing contributes the same neutral transparent layer.
 * A closed convex sphere therefore has TWO layers everywhere inside its outline.
 *
 * A fine, watertight triangulation approximates the smooth embedded sphere.
 * Pixel-center scan conversion uses half-open intervals on both axes. Shared
 * triangle edges are evaluated in the same endpoint order, so triangulation
 * edges do not become extra layers. Exactly tangent/degenerate triangles have
 * zero projected area and contribute nothing. Near a smooth silhouette/fold,
 * counts are a finite-mesh approximation; supersampling provides coverage AA,
 * not a fabricated continuous "thickness" shade.
 */
export const SHEET_COLOR=[157,143,119];
export const SHEET_OPACITY=.135;
const sheetCaches=new WeakMap(),sheetMeshes=new Map();
let playbackMeshProvider=null;
// Only the explicitly labeled playback test page enables this bounded provider.
export function setPlaybackMeshProvider(provider){playbackMeshProvider=provider;sheetCachesResetEpoch++;}
let sheetCachesResetEpoch=0;

export function sheetAlpha(count){return 1-Math.pow(1-SHEET_OPACITY,count)}

// Unique seam coordinates and exact poles make the mesh watertight numerically.
function sheetMesh(rows,cols){
 const key=`${rows}/${cols}`;
 if(sheetMeshes.has(key))return sheetMeshes.get(key);
 const vertices=new Float64Array((rows+1)*cols*3),integrals=new Float64Array(rows+1);
 for(let i=0;i<=rows;i++){
  const u=-Math.PI/2+Math.PI*i/rows,x=Math.sin(u),r=i===0||i===rows?0:Math.cos(u);
  integrals[i]=0;
  for(let j=0;j<cols;j++){
   const v=2*Math.PI*j/cols,k=(i*cols+j)*3;
   vertices[k]=x;vertices[k+1]=r*Math.sin(v);vertices[k+2]=r*Math.cos(v);
  }
 }
 const mesh={vertices,integrals,rows,cols};
 // Quantized LOD has only a few sizes; retain at most four as zoom changes.
 if(sheetMeshes.size>=4)sheetMeshes.delete(sheetMeshes.keys().next().value);
 sheetMeshes.set(key,mesh);return mesh;
}

function sheetProjectedMesh(view,state,width,height,rows,cols){
 const mesh=sheetMesh(rows,cols),p=mesh.vertices,out=new Float64Array((rows+1)*cols*2);out.depths=new Float64Array((rows+1)*cols);
 const cy=Math.cos(view.yaw||0),sy=Math.sin(view.yaw||0),cp=Math.cos(view.pitch||0),sp=Math.sin(view.pitch||0);
 const sx=width/view.w,sz=height/view.h,deformed=state.deformed??view.right;
 const depths=deformed?depthsOf(state):[0,0,0,0],sign=deformed?(state.sign??-1):-1,lateral=deformed?(state.lateral||0):0;
 const mapped=(playbackMeshProvider?.({depths,sign,lateral,rows,cols})??mappedMesh(depths,sign,lateral,rows,cols)).points;
 for(let i=0;i<=rows;i++){
  for(let j=0;j<cols;j++){
   const k=(i*cols+j)*3,[x,y,z]=mapped[i*cols+j],u=cy*x-sy*y,d=sy*x+cy*y;
   const q=(i*cols+j)*2;
   out.depths[i*cols+j]=cp*d+sp*z;
   out[q]=(view.cx+(u-(view.centerX||0))*view.scale)*sx;
   out[q+1]=(view.cy-(cp*z-sp*d-(view.centerZ||0))*view.scale)*sz;
  }
 }
 return out;
}

// Public for exact shared-edge, degeneracy, and alternate-triangulation tests.
export function rasterizeSheetTriangle(counts,width,height,ax,ay,bx,by,cx,cy,frontDepth=null,az=0,bz=0,cz=0){
 if(Math.max(ax,bx,cx)<.5||Math.min(ax,bx,cx)>width-.5||Math.max(ay,by,cy)<.5||Math.min(ay,by,cy)>height-.5)return;
 const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
 if(Math.abs(area)<1e-12)return;
 // A fixed low-to-high ordering makes a shared edge's intersection identical
 // for both incident triangles, including the case of a reversed winding.
 let swap;
 if(ay>by){swap=ax;ax=bx;bx=swap;swap=ay;ay=by;by=swap;swap=az;az=bz;bz=swap}
 if(by>cy){swap=bx;bx=cx;cx=swap;swap=by;by=cy;cy=swap;swap=bz;bz=cz;cz=swap}
 if(ay>by){swap=ax;ax=bx;bx=swap;swap=ay;ay=by;by=swap;swap=az;az=bz;bz=swap}
 const ymin=Math.max(0,Math.ceil(ay-.5)),ymax=Math.min(height,Math.ceil(cy-.5));
 for(let y=ymin;y<ymax;y++){
  const scan=y+.5;
  const long=ax+(scan-ay)*(cx-ax)/(cy-ay);
  const short=scan<by?ax+(scan-ay)*(bx-ax)/(by-ay):bx+(scan-by)*(cx-bx)/(cy-by);
  const begin=Math.max(0,Math.ceil(Math.min(long,short)-.5)),end=Math.min(width,Math.ceil(Math.max(long,short)-.5));
  const longDepth=frontDepth?az+(scan-ay)*(cz-az)/(cy-ay):0;
  const shortDepth=frontDepth?(scan<by?az+(scan-ay)*(bz-az)/(by-ay):bz+(scan-by)*(cz-bz)/(cy-by)):0;
  for(let x=begin,k=y*width+begin;x<end;x++,k++){counts[k]++;if(frontDepth){const d=longDepth+(x+.5-long)*(shortDepth-longDepth)/(short-long);if(d>frontDepth[k])frontDepth[k]=d}}
 }
}

export function rasterizeSheetSurface(view,state={},options={}){
 const pixelSize=options.pixelSize??2,samples=options.samples??2;
 const width=Math.max(1,Math.ceil(view.w/pixelSize)),height=Math.max(1,Math.ceil(view.h/pixelSize));
 const sampleWidth=width*samples,sampleHeight=height*samples;
 const counts=new Uint8Array(sampleWidth*sampleHeight),frontDepth=new Float64Array(sampleWidth*sampleHeight);frontDepth.fill(-Infinity);
 // LOD follows object scale, not viewport size: close-up folds remain smooth.
 const resolution=meshResolution(view.scale);
 const rows=options.rows??resolution.rows,cols=options.cols??resolution.cols;
 const deformed=state.deformed??view.right;let projected=null;
 if(!deformed||(!hasWells(state)&&!(state.lateral||0))){
  // Exact sphere coverage is also a triangulation-free two-sheet baseline.
  for(let y=0;y<sampleHeight;y++){
   const z=(view.cy-(y+.5)*view.h/sampleHeight)/view.scale+(view.centerZ||0);
   for(let x=0;x<sampleWidth;x++){
    const u=((x+.5)*view.w/sampleWidth-view.cx)/view.scale+(view.centerX||0);
    if(u*u+z*z<1){counts[y*sampleWidth+x]=2;frontDepth[y*sampleWidth+x]=Math.sqrt(1-u*u-z*z)}
   }
  }
 }else{
  projected=sheetProjectedMesh(view,state,sampleWidth,sampleHeight,rows,cols);
  const triangle=(a,b,c)=>rasterizeSheetTriangle(counts,sampleWidth,sampleHeight,projected[2*a],projected[2*a+1],projected[2*b],projected[2*b+1],projected[2*c],projected[2*c+1],frontDepth,projected.depths[a],projected.depths[b],projected.depths[c]);
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
   const next=(j+1)%cols,a=i*cols+j,b=i*cols+next,c=(i+1)*cols+next,d=(i+1)*cols+j;
   triangle(a,b,c);triangle(a,c,d);
  }
 }
 const refinedPixels=0; // All multiplicities retained; no invalid graph inverse refinement.
 const data=new Uint8ClampedArray(width*height*4),histogram=[],alpha=Array.from({length:256},(_,n)=>sheetAlpha(n));
 let maxCount=0;
 for(const n of counts){histogram[n]=(histogram[n]||0)+1;if(n>maxCount)maxCount=n}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let opacity=0;
  for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++)opacity+=alpha[counts[(y*samples+sy)*sampleWidth+x*samples+sx]];
  const k=4*(y*width+x);data[k]=SHEET_COLOR[0];data[k+1]=SHEET_COLOR[1];data[k+2]=SHEET_COLOR[2];data[k+3]=Math.round(255*opacity/(samples*samples));
 }
 return {width,height,sampleWidth,sampleHeight,counts,frontDepth,data,maxCount,histogram,rows,cols,refinedPixels,projected};
}

function sheetCacheKey(view,state){const deformed=state.deformed??view.right,sphere=!deformed||(!hasWells(state)&&!(state.lateral||0));return [deformed?(state.meshRevision??0):0,view.w,view.h,view.scale,view.cx,view.cy,view.centerX||0,view.centerZ||0,sphere?0:view.yaw||0,sphere?0:view.pitch||0,deformed,deformed?depthsOf(state).join(','):0,deformed?state.sign??1:1,deformed?state.lateral||0:0].join('/')}

export function renderSurfaceSheets(ctx,view,state={}){
 const key=sheetCacheKey(view,state);let cache=sheetCaches.get(view),cacheHit=cache?.key===key;
 if(!cacheHit){
  const raster=rasterizeSheetSurface(view,state);
  const canvas=cache?.canvas??(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(raster.width,raster.height):document.createElement('canvas'));
  canvas.width=raster.width;canvas.height=raster.height;
  const offscreen=canvas.getContext('2d'),image=offscreen.createImageData(raster.width,raster.height);
  image.data.set(raster.data);offscreen.putImageData(image,0,0);
  cache={key,canvas,projected:raster.projected,frontDepth:raster.frontDepth,sampleWidth:raster.sampleWidth,sampleHeight:raster.sampleHeight,maxCount:raster.maxCount,histogram:raster.histogram,width:raster.width,height:raster.height,rows:raster.rows,cols:raster.cols,refinedPixels:raster.refinedPixels};sheetCaches.set(view,cache);
 }
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(cache.canvas,0,0,view.w,view.h);ctx.restore();
 return {maxCount:cache.maxCount,histogram:cache.histogram,width:cache.width,height:cache.height,rows:cache.rows,cols:cache.cols,refinedPixels:cache.refinedPixels,cacheHit};
}
export const drawSheetSurface=renderSurfaceSheets;

// Display-only front-sheet depth lookup, in the same world coordinates as map.
// A small pixel/world tolerance prevents a curve being hidden by its own mesh
// approximation. Picking and fallback use cached mapped-mesh rays.
export function sheetPointOccluded(view,q){
 const cache=sheetCaches.get(view);if(!cache)return null;
 const cy=Math.cos(view.yaw||0),sy=Math.sin(view.yaw||0),cp=Math.cos(view.pitch||0),sp=Math.sin(view.pitch||0);
 const u=cy*q[0]-sy*q[1],d=sy*q[0]+cy*q[1],z=cp*q[2]-sp*d,depth=cp*d+sp*q[2];
 const px=(view.cx+(u-(view.centerX||0))*view.scale)*cache.sampleWidth/view.w-.5,py=(view.cy-(z-(view.centerZ||0))*view.scale)*cache.sampleHeight/view.h-.5;
 const x=Math.round(px),y=Math.round(py);if(x<0||y<0||x>=cache.sampleWidth||y>=cache.sampleHeight)return null;
 const nearest=cache.frontDepth[y*cache.sampleWidth+x];let conservativeDepth=nearest;
 // At projected silhouettes / fold boundaries the mesh can miss a subpixel
 // front lobe. Return null so the caller can use the shared-LOD mapped-mesh ray there.
 for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
  const xx=x+ox,yy=y+oy;if(xx<0||yy<0||xx>=cache.sampleWidth||yy>=cache.sampleHeight)continue;
  const neighbor=cache.frontDepth[yy*cache.sampleWidth+xx];
  if(Number.isFinite(neighbor)!==Number.isFinite(nearest)||Math.abs(neighbor-nearest)>.045)return null;
  conservativeDepth=Math.min(conservativeDepth,neighbor);
 }
 const tolerance=Math.max(.012,2.5/view.scale);
 return conservativeDepth-depth>tolerance;
}

export function sheetExactPointOccluded(view,q){
 const cache=sheetCaches.get(view);if(!cache?.projected)return null;
 const cy=Math.cos(view.yaw||0),sy=Math.sin(view.yaw||0),cp=Math.cos(view.pitch||0),sp=Math.sin(view.pitch||0);
 const u=cy*q[0]-sy*q[1],d=sy*q[0]+cy*q[1],z=cp*q[2]-sp*d,depth=cp*d+sp*q[2],sx=cache.sampleWidth/view.w,sz=cache.sampleHeight/view.h;
 const px=(view.cx+(u-(view.centerX||0))*view.scale)*sx,py=(view.cy-(z-(view.centerZ||0))*view.scale)*sz;
 cache.depthIndex??=createDepthIndex(cache.projected,cache.rows,cache.cols,cache.sampleWidth,cache.sampleHeight,sx,sz);
 const front=cache.depthIndex.query(px,py,1e-15*view.scale*view.scale*sx*sz);return front===null?null:Number.isFinite(front)&&front-depth>Math.max(.004,1/view.scale);
}
