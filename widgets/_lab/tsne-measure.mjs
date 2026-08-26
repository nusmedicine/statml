import { tsne } from "./tsne-engine.js";
import { makeRng } from "../core/rng.js";
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const sd=a=>Math.sqrt(mean(a.map(x=>(x-mean(a))**2)));
function sil(Y,gs){const n=Y.length;let s=0,c=0;
  for(let i=0;i<n;i+=1){const same=[],oth=new Map();
    for(let j=0;j<n;j+=1){if(i===j)continue;const d=d2(Y[i],Y[j]);
      if(gs[j]===gs[i])same.push(d);else{if(!oth.has(gs[j]))oth.set(gs[j],[]);oth.get(gs[j]).push(d);}}
    if(!oth.size)continue;
    const a=same.length?mean(same):0,b=Math.min(...[...oth.values()].map(mean));
    s+=(b-a)/Math.max(a,b);c+=1;}
  return c?s/c:0;}
function kmeans(Y,k,rng){
  let C=Array.from({length:k},()=>Y[Math.floor(rng.next()*Y.length)].slice()),lab=[];
  for(let it=0;it<80;it+=1){
    lab=Y.map(p=>{let b=0,bd=1e18;C.forEach((c,q)=>{const d=d2(p,c);if(d<bd){bd=d;b=q;}});return b;});
    C=C.map((_,q)=>{const m=Y.filter((_,i)=>lab[i]===q);
      return m.length?[mean(m.map(p=>p[0])),mean(m.map(p=>p[1]))]:Y[Math.floor(rng.next()*Y.length)].slice();});}
  return lab;}
/* best 2-way split k-means finds over 8 restarts */
const best2=(Y)=>{let b=-1;for(let r=0;r<8;r+=1){const s=sil(Y,kmeans(Y,2,makeRng(100+r)));if(s>b)b=s;}return b;};
function knnKeep(pts,Y,k){const n=pts.length;
  const near=(D,i)=>D[i].map((v,j)=>[v,j]).filter(([,j])=>j!==i).sort((a,b)=>a[0]-b[0]).slice(0,k).map(([,j])=>j);
  const Dh=pts.map(a=>pts.map(b=>d3(a,b))),Dl=Y.map(a=>Y.map(b=>d2(a,b)));
  let s=0;for(let i=0;i<n;i+=1){const A=new Set(near(Dh,i)),B=near(Dl,i);s+=B.filter(j=>A.has(j)).length/k;}
  return s/n;}

console.log("=== G2. MANUFACTURED CLUSTERS, over 40 seeds of a structureless cloud ===");
console.log("  A round 3-D Gaussian. No groups exist. Best 2-way split a reader could see:");
console.log("   n   perp    t-SNE sil (mean+-sd)   PCA sil (mean+-sd)   t-SNE > PCA on how many of 40");
for(const n of [12,24,40,60]){
  const legal=Math.floor((n-2)/3);
  for(const perp of [...new Set([2,5,Math.min(10,legal),legal])].filter(p=>p>=2&&p<=legal)){
    const T=[],Pc=[];let win=0;
    for(let s=0;s<40;s+=1){
      const r=makeRng(1000+s), pts=Array.from({length:n},()=>[r.normal(),r.normal(),r.normal()]);
      const Y=tsne(pts,{perplexity:perp,iters:1000,seed:s+1}).path[1000];
      const t=best2(Y), p=best2(pts.map(q=>[q[0],q[1]]));
      T.push(t);Pc.push(p);if(t>p)win+=1;}
    console.log(`  ${String(n).padStart(3)}  ${String(perp).padStart(5)}    ${mean(T).toFixed(3)}+-${sd(T).toFixed(3)}          ${mean(Pc).toFixed(3)}+-${sd(Pc).toFixed(3)}          ${win}/40`);
  }
}

console.log("\n=== H2. PERPLEXITY OVER ITS LEGAL RANGE, at four stage sizes ===");
console.log("  4 groups, overlapping (scatter 1.1). silhouette of the TRUE groups in the picture,");
console.log("  mean over 12 seeds. Rtsne's own rule is 3*perplexity < n-1.");
const spread4=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(v=>v.map(x=>x/Math.sqrt(3)*3));
for(const per of [3,6,9,12]){
  const n=4*per, legal=Math.floor((n-2)/3), out=[];
  for(const perp of [2,3,5,8,12,18,25].filter(p=>p<=legal)){
    const vals=[],nn=[];
    for(let s=0;s<12;s+=1){
      const r=makeRng(2000+s),pts=[],gs=[];
      for(let g=0;g<4;g+=1) for(let i=0;i<per;i+=1){pts.push(spread4[g].map(x=>x+r.normal()*1.1));gs.push(g);}
      const Y=tsne(pts,{perplexity:perp,iters:1000,seed:s+1}).path[1000];
      vals.push(sil(Y,gs));nn.push(knnKeep(pts,Y,3));}
    out.push(`p${String(perp).padStart(2)}: ${mean(vals).toFixed(2)}`);
  }
  console.log(`  n=${String(n).padStart(2)} (legal perp <= ${legal})   ${out.join("  ")}`);
}
