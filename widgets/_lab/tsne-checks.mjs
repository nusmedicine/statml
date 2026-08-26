import { tsne, sqDists, condP, joint, qAndGrad, klOnly } from "./tsne-engine.js";
import { makeRng } from "../core/rng.js";

/* the mds stage, verbatim in shape: g groups of `per` on a sphere of R */
const R = 3, SIGMA = 0.55, JITTER = 0.18;
function spread(k){
  if(k===2) return [[1,0,0],[-1,0,0]];
  if(k===3) return [[1,0,0],[-0.5,0.866,0],[-0.5,-0.866,0]];
  return [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(v=>v.map(x=>x/Math.sqrt(3)));
}
function stage(groups, per, rng){
  const centres = spread(groups).map(p=>{
    const v=p.map(x=>x*R + rng.normal()*JITTER*R);
    const m=Math.hypot(...v)||1; return v.map(x=>x/m*R);
  });
  const out=[];
  for(let g=0;g<groups;g+=1) for(let i=0;i<per;i+=1)
    out.push({g, p: centres[g].map(x=> per>1 ? x+rng.normal()*SIGMA : x)});
  return out;
}

console.log("=== 1. TIMING: is a runtime compute affordable? ===");
for(const [groups,per] of [[2,4],[3,4],[4,4],[4,6],[4,10]]){
  const rng=makeRng(1), pts=stage(groups,per,rng).map(s=>s.p), n=pts.length;
  const perp = Math.min(5, Math.max(2, Math.floor((n-1)/3)));
  const t0=process.hrtime.bigint();
  const r=tsne(pts,{perplexity:perp,iters:1000,seed:1});
  const t1=process.hrtime.bigint();
  console.log(`n=${String(n).padStart(3)}  perp=${perp}  1000 iters: ${(Number(t1-t0)/1e6).toFixed(1)} ms   final KL ${r.kls[r.kls.length-1].toFixed(4)}`);
}

console.log("\n=== 2. Does the bisection actually hit the requested perplexity? ===");
{
  const rng=makeRng(7), pts=stage(3,4,rng).map(s=>s.p);
  for(const perp of [2,3,5,8,11]){
    const c=condP(sqDists(pts),perp);
    console.log(`  perplexity ${String(perp).padStart(2)}  worst |2^H - perp| = ${c.worstPerplexityError.toExponential(2)}   bisections ${c.bisectionIters}`);
  }
}

console.log("\n=== 3. Analytic gradient vs numerical (the one bug that hides) ===");
{
  const rng=makeRng(3), pts=stage(3,3,rng).map(s=>s.p), n=pts.length;
  const P=joint(condP(sqDists(pts),3).P);
  const r2=makeRng(9);
  const Y=Array.from({length:n},()=>[r2.normal(0,1),r2.normal(0,1)]);
  const {G}=qAndGrad(Y,P);
  let psum=0; for(let i=0;i<n;i+=1) for(let j=0;j<n;j+=1) psum+=P[i][j];
  console.log(`  sum of P = ${psum.toFixed(12)}  (the gradient derivation needs exactly 1)`);
  let gmax=0; for(const g of G) gmax=Math.max(gmax,Math.abs(g[0]),Math.abs(g[1]));
  console.log(`  largest |gradient component| = ${gmax.toExponential(2)}`);
  const h=1e-6; let worst=0;
  for(let i=0;i<n;i+=1) for(let d=0;d<2;d+=1){
    const s=Y[i][d];
    Y[i][d]=s+h; const a=klOnly(Y,P);
    Y[i][d]=s-h; const b=klOnly(Y,P);
    Y[i][d]=s;
    worst=Math.max(worst, Math.abs((a-b)/(2*h) - G[i][d]));
  }
  console.log(`  worst |analytic - numerical| over ${n*2} coords: ${worst.toExponential(2)}`);
}

console.log("\n=== 4. Does KL fall, and where does the exaggeration release show? ===");
{
  const rng=makeRng(1), pts=stage(3,4,rng).map(s=>s.p);
  const r=tsne(pts,{perplexity:5,iters:1000,seed:1});
  const at=[0,50,100,200,249,250,251,300,500,999];
  console.log("  iter  KL (against the P it was minimising)");
  for(const k of at) console.log(`  ${String(k).padStart(4)}  ${r.kls[k].toFixed(4)}`);
  let rises=0; for(let k=1;k<250;k+=1) if(r.kls[k]>r.kls[k-1]+1e-9) rises+=1;
  let rises2=0; for(let k=251;k<1000;k+=1) if(r.kls[k]>r.kls[k-1]+1e-9) rises2+=1;
  console.log(`  KL rose on ${rises} of 249 exaggerated steps, ${rises2} of 748 plain steps`);
}
