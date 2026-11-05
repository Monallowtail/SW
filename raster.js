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
