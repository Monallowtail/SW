// Smooth neck-through-body tube around a piriform centerline.
// F(u+2π,v)=F(u,−v), including every derivative at the seam.
// See math-audit/classical-klein for the rank-two proof.
export function kleinMap([u,v]){
 const tx=-2*Math.cos(u/2),ty=Math.sin(1.5*u),L=Math.hypot(tx,ty),r=.28+.2*Math.sin(u);
 const x=Math.cos(u)-1-r*Math.sin(v)*ty/L;
 const y=.5*Math.sin(u)*(1-Math.cos(u))+r*Math.sin(v)*tx/L;
 const z=r*Math.cos(v);
 return[-1.2*y,1.2*z,1.2*(x+1)];
}
