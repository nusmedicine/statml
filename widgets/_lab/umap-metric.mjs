/* What distance does the widget actually use, and do the samples lie on the
   sphere the globe draws?  Both answers are checkable. */
import { knn, fuzzySet } from "../umap/model.js";
import { makeRng } from "../core/rng.js";
const R=2,S=0.62;
const C=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(c=>{const m=Math.hypot(...c)/R;return c.map(v=>v/m);});
function stage(seed,per=12){const rng=makeRng(seed),X=[];
  for(let i=0;i<4;i+=1)for(let p=0;p<per;p+=1)X.push(C[i].map(c=>c+rng.normal(0,S)));return X;}

const X=stage(1), n=X.length;
const rad=X.map(p=>Math.hypot(...p)).sort((a,b)=>a-b);
const q=(f)=>rad[Math.floor(f*(rad.length-1))];
console.log("1. DO THE SAMPLES LIE ON THE SPHERE THE GLOBE DRAWS (radius 2)?");
console.log(`   radius from origin: min ${q(0).toFixed(2)}  p25 ${q(.25).toFixed(2)}  `+
  `median ${q(.5).toFixed(2)}  p75 ${q(.75).toFixed(2)}  max ${q(1).toFixed(2)}`);
const mean=rad.reduce((s,v)=>s+v,0)/n;
const sd=Math.sqrt(rad.reduce((s,v)=>s+(v-mean)**2,0)/n);
console.log(`   mean ${mean.toFixed(2)} +- ${sd.toFixed(2)};  ${rad.filter(r=>Math.abs(r-2)<0.1).length}/${n} within 0.1 of radius 2`);
console.log("   -> the samples are scattered in the BALL, not on the shell.\n");

console.log("2. WHAT DISTANCE DOES `knn` COMPUTE?  Check it against the Euclidean norm.");
const {dist,idx}=knn(X,15);
let worstE=0, worstGeo=0;
for(let i=0;i<n;i+=1)for(let c=0;c<15;c+=1){
  const j=idx[i][c];
  const e=Math.hypot(X[i][0]-X[j][0],X[i][1]-X[j][1],X[i][2]-X[j][2]);
  worstE=Math.max(worstE,Math.abs(dist[i][c]-e));
  /* the great-circle distance if both were projected onto the sphere */
  const ui=X[i].map(v=>v/Math.hypot(...X[i])), uj=X[j].map(v=>v/Math.hypot(...X[j]));
  const ang=Math.acos(Math.max(-1,Math.min(1,ui[0]*uj[0]+ui[1]*uj[1]+ui[2]*uj[2])));
  worstGeo=Math.max(worstGeo,Math.abs(e-R*ang));
}
console.log(`   worst |knn distance - Euclidean|            ${worstE.toExponential(1)}`);
console.log(`   worst |Euclidean - great-circle on radius 2| ${worstGeo.toFixed(2)}  (they are NOT the same)`);

console.log("\n3. WHERE THE MANIFOLD ASSUMPTION ACTUALLY ENTERS: rho and sigma.");
const {rho,sigma}=fuzzySet(X,15);
const rs=[...rho].sort((a,b)=>a-b), ss=[...sigma].sort((a,b)=>a-b);
console.log(`   rho   min ${rs[0].toFixed(3)}  median ${rs[n>>1].toFixed(3)}  max ${rs[n-1].toFixed(3)}`);
console.log(`   sigma min ${ss[0].toFixed(3)}  median ${ss[n>>1].toFixed(3)}  max ${ss[n-1].toFixed(3)}`);
console.log(`   sigma varies by x${(ss[n-1]/ss[0]).toFixed(1)} across the samples — that per-point`);
console.log("   rescaling is UMAP's whole approximation to a geodesic. No geodesic is computed.");
