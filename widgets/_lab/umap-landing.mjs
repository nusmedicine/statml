/* Does the entry tween land EXACTLY on frame 0 of the descent?  The tween draws
   [dot(Z,pc1), dot(Z,pc2)] at enter = 1; the descent starts from pcaPlane's Y,
   which compute() then recentres.  If those two disagree the cloud jumps at the
   end of the rotation — and no pixel hash of a settled state would see it. */
import { pcaPlane, umap, fuzzySet, findAbParams } from "../umap/model.js";
import { makeRng } from "../core/rng.js";
const R=2,S=0.62;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function stage(seed,per,g){const rng=makeRng(seed),X=[];
  const base=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].slice(0,g).map(c=>{const m=Math.hypot(...c)/R;return c.map(v=>v/m);});
  for(let i=0;i<g;i+=1)for(let p=0;p<per;p+=1)X.push(base[i].map(c=>c+rng.normal(0,S)));return X;}

let worst=0, worstCase="";
for(const [seed,per,g,k,md] of [[1,12,4,15,0.1],[7,3,2,2,0],[3,6,3,40,0.95],[200,12,4,5,0.5]]){
  const X=stage(seed,per,g), n=X.length;
  const {Z,pc1,pc2,Y:Y0}=pcaPlane(X);
  const {mu}=fuzzySet(X,Math.max(2,Math.min(k,n-1)));
  const {a,b}=findAbParams(1,md);
  const {frames}=umap(X,{nNeighbors:k,iters:500,every:10,eta:0.1,seed,mu,ab:{a,b},init:Y0});
  // compute() recentres every frame; do the same to frame 0
  const F=frames[0].map(p=>p.slice());
  let cx=0,cy=0; for(const p of F){cx+=p[0];cy+=p[1];} cx/=n; cy/=n;
  for(const p of F){p[0]-=cx;p[1]-=cy;}
  let d=0;
  for(let i=0;i<n;i+=1) d=Math.max(d, Math.abs(dot(Z[i],pc1)-F[i][0]), Math.abs(dot(Z[i],pc2)-F[i][1]));
  if(d>worst){worst=d;worstCase=`seed ${seed}, ${g}x${per}, k=${k}, min_dist=${md}`;}
  console.log(`  seed ${String(seed).padStart(3)}  n=${String(n).padStart(2)}  k=${String(k).padStart(2)}  `+
    `min_dist=${String(md).padEnd(4)} | recentre shift (${cx.toExponential(1)}, ${cy.toExponential(1)})  `+
    `worst |tween - frame0| = ${d.toExponential(1)}`);
}
console.log(`\nworst overall ${worst.toExponential(1)}  (${worstCase})`);
console.log(worst < 1e-12 ? "LANDS EXACTLY — the rotation ends on frame 0" : "MISMATCH: the cloud will jump at the end of the turn");
process.exit(worst < 1e-12 ? 0 : 1);
