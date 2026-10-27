// Test-only exact front-depth index over the SAME projected sheet mesh.
// No mapping, resolution, triangle, or occlusion tolerance changes.
export function mergedFrontDepth(depths){
 depths.sort((a,b)=>a-b);let front=-Infinity;
 // Match rayMesh.intersections: compare each hit to its preceding RAW hit.
 for(let i=0;i<depths.length;i++)if(!i||depths[i]-depths[i-1]>1e-8)front=depths[i];
 return front;
}
export function createDepthIndex(projected,rows,cols,width,height,scaleX,scaleY,padding=20){
 const left=-padding*scaleX,top=-padding*scaleY,right=width+padding*scaleX,bottom=height+padding*scaleY;
 const cell=16*Math.max(scaleX,scaleY),nx=Math.ceil((right-left)/cell),ny=Math.ceil((bottom-top)/cell),bins=Array.from({length:nx*ny},()=>[]);
 let retained=0,total=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<projected.length;i+=2){minX=Math.min(minX,projected[i]);maxX=Math.max(maxX,projected[i]);minY=Math.min(minY,projected[i+1]);maxY=Math.max(maxY,projected[i+1])}
 const ix=x=>Math.max(0,Math.min(nx-1,Math.floor((x-left)/cell))),iy=y=>Math.max(0,Math.min(ny-1,Math.floor((y-top)/cell)));
 function triangles(visit){for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*cols+j,b=i*cols+(j+1)%cols,c=(i+1)*cols+(j+1)%cols,d=(i+1)*cols+j;if(i)visit(a,b,c);if(i<rows-1)visit(a,c,d)}}
 const triangleBounds=new Float64Array(8*cols*(rows-1));
 triangles((a,b,c)=>{const ax=projected[a*2],ay=projected[a*2+1],bx=projected[b*2],by=projected[b*2+1],cx=projected[c*2],cy=projected[c*2+1],loX=Math.min(ax,bx,cx),hiX=Math.max(ax,bx,cx),loY=Math.min(ay,by,cy),hiY=Math.max(ay,by,cy),pad=2e-10*Math.max(hiX-loX,hiY-loY)+32*Number.EPSILON*Math.max(1,Math.abs(ax),Math.abs(ay),Math.abs(bx),Math.abs(by),Math.abs(cx),Math.abs(cy)),x0=loX-pad,x1=hiX+pad,y0=loY-pad,y1=hiY+pad,k=4*total++;triangleBounds[k]=x0;triangleBounds[k+1]=x1;triangleBounds[k+2]=y0;triangleBounds[k+3]=y1;if(x1<left||x0>right||y1<top||y0>bottom)return;retained++;for(let y=iy(y0);y<=iy(y1);y++)for(let x=ix(x0);x<=ix(x1);x++)bins[y*nx+x].push(a,b,c)});
 const stats={insideQueries:0,outsideQueries:0,outsideGlobalBounds:0};
 return {retained,total,stats,query(x,y,areaThreshold=1e-15){
  // Original rayMesh rejects outside its global projected vertex bounds too.
  if(x<minX||x>maxX||y<minY||y>maxY){stats.outsideGlobalBounds++;return -Infinity}
  const hits=[];const visit=(a,b,c)=>{const ax=projected[2*a],ay=projected[2*a+1],bx=projected[2*b],by=projected[2*b+1],cx=projected[2*c],cy=projected[2*c+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<areaThreshold)return;const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-10)return;hits.push(u*projected.depths[a]+v*projected.depths[b]+w*projected.depths[c])};
  if(x>=left&&x<=right&&y>=top&&y<=bottom){stats.insideQueries++;const candidates=bins[iy(y)*nx+ix(x)];for(let k=0;k<candidates.length;k+=3)visit(candidates[k],candidates[k+1],candidates[k+2])}
  else{stats.outsideQueries++;let i=0;triangles((a,b,c)=>{const k=4*i++;if(x<triangleBounds[k]||x>triangleBounds[k+1]||y<triangleBounds[k+2]||y>triangleBounds[k+3])return;visit(a,b,c)})}
  return mergedFrontDepth(hits);
 }};
}
