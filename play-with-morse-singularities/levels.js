import {map} from './elastic.js';
import {critical} from './critical.js';
import {rayMesh,meshResolution} from './elastic-mesh.js';
// Rays intersect the actual mapped surface triangulation. Source coordinates are
// barycentric interpolants, normalized to S²; finite mesh error is not exact inversion.
export function rayIntersections(screenX,height,depths,sign=-1,yaw=0,lateral=0,pitch=0,scale=240){const {rows,cols}=meshResolution(scale);return rayMesh(depths,sign,yaw,lateral,pitch,rows,cols).intersections(screenX,height)}
export function surfaceHit(screenX,height,depths,sign=-1,yaw=0,lateral=0,pitch=0,scale=240){return rayIntersections(screenX,height,depths,sign,yaw,lateral,pitch,scale).at(-1)?.p??null}
export function rayOccluded(p,depths,yaw,lateral=0,sign=-1,pitch=0,scale=240){
 const q=map(p,depths,sign,lateral),c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),d=s*q[0]+c*q[1],depth=cp*d+sp*q[2],x=c*q[0]-s*q[1],z=cp*q[2]-sp*d;
 const front=rayIntersections(x,z,depths,sign,yaw,lateral,pitch,scale).at(-1);return !!front&&front.depth-depth>Math.max(.004,1/scale);
}
export function levelComponents(){return []}
export function sampleLevelArrows(){return []}
export function regularLevels(depths,sign=-1){const hs=critical(depths,sign).map(c=>c.h).sort((a,b)=>a-b),lo=hs[0],hi=hs.at(-1);return Array.from({length:7},(_,i)=>({H:lo+(hi-lo)*(i+1)/8,feature:false})).filter(l=>hs.every(h=>Math.abs(h-l.H)>1e-7))}
