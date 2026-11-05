import {rotation} from './geometry.js';
export const CAMERA={yaw:.82,pitch:.32};
export function measureFraming(g){
 const points=[...g.points];
 for(const c of g.components){for(const p of c.path)points.push(p.q);for(const p of c.cusps)points.push(p.q)}
 let maxAbs=0,maxUpperX=-Infinity;
 for(const p of points){maxAbs=Math.max(maxAbs,Math.abs(p[0]),Math.abs(p[2]));maxUpperX=Math.max(maxUpperX,rotation(p,CAMERA.yaw,CAMERA.pitch)[0])}
 const extent=Math.ceil(Math.max(1.65,maxAbs+.25)*20)/20;
 const depth=Math.min(-3.5,-(maxUpperX+.35+Math.cos(CAMERA.yaw)*extent)/Math.sin(CAMERA.yaw));
 const corners=[[-extent,depth,-extent],[extent,depth,-extent],[extent,depth,extent],[-extent,depth,extent]];
 const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
 for(const p of [...points,...corners]){const q=rotation(p,CAMERA.yaw,CAMERA.pitch);for(let i=0;i<2;i++){const v=q[i?2:0];min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v)}}
 const frontHalf=Math.max(1.12,maxAbs+.12);
 return {extent,depth,corners,maxAbs,upper:{center:min.map((v,i)=>(v+max[i])/2),span:min.map((v,i)=>max[i]-v)},front:{center:[0,0],span:[2*frontHalf,2*frontHalf]}};
}
