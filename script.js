function updateSliderValue(slider) {
  const output = slider.nextElementSibling;
  const min = slider.min ? slider.min : 0;
  const max = slider.max ? slider.max : 100;
  const val = slider.value;

  // Update text
  output.textContent = val;

  // Calculate position %
  const percent = (val - min) / (max - min);
  output.style.left = `calc(${percent * 100}% - ${output.offsetWidth / 2}px)`;
}

// Attach to all sliders
document.querySelectorAll('input[type="range"]').forEach(slider => {
  updateSliderValue(slider); // initialize
  slider.addEventListener('input', () => updateSliderValue(slider));
});

// PRNG (xmur3 + sfc32)
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^h>>>16)>>>0}}
function sfc32(a,b,c,d){return function(){a>>>0;b>>>0;c>>>0;d>>>0;var t=a+b|0;a=b^b>>>9;b=c+(c<<3)|0;c=c<<21|c>>>11;d=d+1|0;t=t+d|0;c=c+t|0;return(t>>>0)/4294967296}}
function rngFromSeed(seed){const h=xmur3(seed);return sfc32(h(),h(),h(),h())}

// Perlin noise (seeded)
function Perlin(rand){this.p=new Uint8Array(512);const perm=new Uint8Array(256);for(let i=0;i<256;i++)perm[i]=i;for(let i=255;i>0;i--){const j=Math.floor(rand()*(i+1));[perm[i],perm[j]]=[perm[j],perm[i]]}for(let i=0;i<512;i++)this.p[i]=perm[i&255]} 
Perlin.prototype.fade=t=>t*t*t*(t*(t*6-15)+10);
Perlin.prototype.lerp=(a,b,t)=>a+(b-a)*t;
Perlin.prototype.grad=function(hash,x,y){const h=hash&3;const u=h<2?x:y;const v=h<2?y:x;return((h&1)?-u:u)+((h&2)?-2*v:2*v)};
Perlin.prototype.noise2=function(x,y){const p=this.p;const X=Math.floor(x)&255,Y=Math.floor(y)&255;x-=Math.floor(x);y-=Math.floor(y);const u=this.fade(x),v=this.fade(y);const A=p[X]+Y,B=p[X+1]+Y;const n00=this.grad(p[A],x,y),n01=this.grad(p[A+1],x,y-1);const n10=this.grad(p[B],x-1,y),n11=this.grad(p[B+1],x-1,y-1);return this.lerp(this.lerp(n00,n10,u),this.lerp(n01,n11,u),v)*0.7071};
function fbm(per, x,y, oct=6, lac=2.02, gain=0.52){let a=1,f=1,s=0,m=0;for(let i=0;i<oct;i++){s+=a*per.noise2(x*f,y*f);m+=a;a*=gain;f*=lac}return s/m}

// UI refs
const cvs=document.getElementById('map'); const ctx=cvs.getContext('2d');
const ui={ seed:document.getElementById('seed'), size:document.getElementById('size'), scale:document.getElementById('scale'), moist:document.getElementById('moist'), temp:document.getElementById('temp'),
  btnRand:document.getElementById('btnRand'), btnGen:document.getElementById('btnGen'), btnPng:document.getElementById('btnPng'),
  lyrRelief:document.getElementById('lyrRelief'),lyrCoast:document.getElementById('lyrCoast'),lyrRivers:document.getElementById('lyrRivers'),lyrBorders:document.getElementById('lyrBorders'),lyrLabels:document.getElementById('lyrLabels') };

function resizeCanvas(baseW){const aspect=1.6; const w=parseInt(baseW,10); const h=Math.round(w/aspect); cvs.width=w; cvs.height=h}
function randomSeed(){return Math.random().toString(36).slice(2,10)}

function generate(){
  const seed=(ui.seed.value||randomSeed()).toString(); ui.seed.value=seed; const rand=rngFromSeed(seed);
  resizeCanvas(ui.size.value);
  const w=cvs.width,h=cvs.height; const cx=w/2,cy=h/2,maxd=Math.sqrt(cx*cx+cy*cy);
  const perE=new Perlin(rand), perM=new Perlin(rand), perT=new Perlin(rand);
  const scale=parseFloat(ui.scale.value); const mBias=(ui.moist.value-50)/50; const tBias=(ui.temp.value-50)/50;
  const elev=new Float32Array(w*h), moist=new Float32Array(w*h), temp=new Float32Array(w*h);
  const sea=0.5, beach=0.03;

  // Elevation / climate fields
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const nx=(x-w/2)/scale, ny=(y-h/2)/scale;
      let e=(fbm(perE,nx,ny,6,2.05,0.53)+1)/2; // 0..1
      const dx=x-cx,dy=y-cy; const d=Math.sqrt(dx*dx+dy*dy)/maxd; const rim=0.78+(rand()-0.5)*0.18; const mask=Math.max(0,1-Math.pow(d/rim,2.4));
      e=e*0.9+0.1*(fbm(perE,nx*2.7,ny*2.7,3,2.3,0.5)+1)/2; e*=mask; elev[y*w+x]=e;
      let m=(fbm(perM,nx*1.2,ny*1.2,5,2.1,0.56)+1)/2; m=Math.min(1,Math.max(0,m+mBias*0.35)); moist[y*w+x]=m;
      const lat=Math.abs((y/h)*2-1); let t=(fbm(perT,nx*0.9,ny*0.9,4,2.1,0.55)+1)/2; t=(1-lat)*0.8+t*0.2; t=Math.min(1,Math.max(0,t+tBias*0.35)); temp[y*w+x]=t;
    }
  }

  // Render parchment backdrop
  ctx.fillStyle='#efe7d5'; ctx.fillRect(0,0,w,h);
  const pat = ctx.createLinearGradient(0,0,w,0); pat.addColorStop(0,'rgba(0,0,0,0.03)'); pat.addColorStop(1,'rgba(255,255,255,0.03)'); ctx.fillStyle=pat; ctx.fillRect(0,0,w,h);

  // Base color pass
  const img=ctx.createImageData(w,h); const put=(i,r,g,b,a=255)=>{const o=i*4; img.data[o]=r; img.data[o+1]=g; img.data[o+2]=b; img.data[o+3]=a};
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=y*w+x; const e=elev[i], m=moist[i], t=temp[i];
      if(e<sea){ // water depth
        const dd=(sea-e)/(sea+1e-6); const r=90-40*dd,g=150+10*dd,b=190+30*dd; put(i,r|0,g|0,b|0,255);
      }else{
        const he=(e-sea)/(1-sea);
        let r,g,b; if(he<beach){ r=242; g=237; b=220; }
        else if(he>0.82){ const snow=Math.max(0,(he-0.88)*6); r=156; g=140; b=125; r=r*(1-snow)+242*snow; g=g*(1-snow)+245*snow; b=b*(1-snow)+247*snow; }
        else if(m>0.6 && t>0.35){ r=122; g=155; b=116; }
        else if(m>0.35){ r=184; g=196; b=138; }
        else if(t>0.55){ r=201; g=176; b=128; }
        else { r=156; g=140; b=123; }
        put(i,r|0,g|0,b|0,255);
      }
    }
  }
  if(ui.lyrRelief.checked){ // soft relief by lighting
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        const i=y*w+x; const e=elev[i]; const ex=(elev[i+1]-elev[i-1]); const ey=(elev[i+w]-elev[i-w]);
        let shade=(ex*2 - ey*1.5); shade=Math.max(-0.08,Math.min(0.08,shade)); const o=i*4; img.data[o]=img.data[o]*(1+shade); img.data[o+1]=img.data[o+1]*(1+shade); img.data[o+2]=img.data[o+2]*(1+shade);
      }
    }
  }
  ctx.putImageData(img,0,0);

  // Continental shelf + coast line
  if(ui.lyrCoast.checked){
    ctx.strokeStyle='rgba(60,80,100,0.65)'; ctx.lineWidth=1.2; ctx.beginPath();
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        const e=elev[y*w+x]; if((e>=sea)!=(elev[y*w+x-1]>=sea)|| (e>=sea)!=(elev[y*w+x+1]>=sea) || (e>=sea)!=(elev[(y-1)*w+x]>=sea) || (e>=sea)!=(elev[(y+1)*w+x]>=sea)) ctx.rect(x+.2,y+.2,0.8,0.8);
      }
    }
    ctx.stroke();
    // glow
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=3; ctx.stroke();
  }

  // Rivers & lakes (simple downhill)
  if(ui.lyrRivers.checked){
    ctx.lineWidth=1.2; ctx.strokeStyle='rgba(70,120,170,0.95)';
    const highs=[]; for(let i=0;i<w*h;i++) if(elev[i]>sea+0.25) highs.push(i);
    const count=Math.min(90,Math.max(25,Math.floor(highs.length/900)));
    for(let s=0;s<count;s++){
      let i=highs[Math.floor(rand()*highs.length)]; let x=i%w,y=(i/w)|0; ctx.beginPath(); ctx.moveTo(x+.5,y+.5); let steps=0; while(steps<900){ const e=elev[y*w+x]; if(e<sea) break; let bx=x,by=y,be=e; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(dx||dy){ const nx=x+dx,ny=y+dy; if(nx<1||ny<1||nx>=w-1||ny>=h-1) continue; const ne=elev[ny*w+nx]; if(ne<be){be=ne; bx=nx; by=ny}} if(be>=e){ elev[y*w+x]-=0.0015; bx=x+(rand()<0.5?1:-1); by=y+(rand()<0.5?1:-1) } x=bx;y=by; ctx.lineTo(x+.5,y+.5); if(++steps%20===0){ctx.stroke();ctx.beginPath();ctx.moveTo(x+.5,y+.5)} }
      ctx.stroke();
    }
    // sprinkle lakes on wet lowlands above sea
    ctx.fillStyle='rgba(110,150,190,0.85)';
    for(let y=2;y<h-2;y+=3){for(let x=2;x<w-2;x+=3){const i=y*w+x; if(elev[i]>sea && elev[i]<sea+0.06 && moist[i]>0.55){ ctx.beginPath(); ctx.ellipse(x,y,2+Math.random()*3,1+Math.random()*2,0,0,Math.PI*2); ctx.fill(); }}}
  }

  // Political regions via coarse Voronoi on land
  const realms=[]; const realmCount=10+Math.floor(rand()*8);
  const taken=new Set();
  while(realms.length<realmCount){ const x=Math.floor(rand()*w), y=Math.floor(rand()*h); if(elev[y*w+x]>sea+0.02 && !taken.has((y<<16)|x)){ realms.push({x,y}); taken.add((y<<16)|x) } }
  // Lloyd relax 2 rounds
  for(let it=0;it<2;it++){
    const acc=realms.map(()=>({x:0,y:0,n:0}));
    for(let y=0;y<h;y+=4){for(let x=0;x<w;x+=4){const i=y*w+x; if(elev[i]<=sea) continue; let best=0,bd=Infinity; for(let r=0;r<realms.length;r++){const dx=x-realms[r].x,dy=y-realms[r].y;const d=dx*dx+dy*dy; if(d<bd){bd=d;best=r}} acc[best].x+=x; acc[best].y+=y; acc[best].n++}}
    for(let r=0;r<realms.length;r++){ if(acc[r].n){ realms[r].x=(acc[r].x/acc[r].n)|0; realms[r].y=(acc[r].y/acc[r].n)|0 } }
  }
  if(ui.lyrBorders.checked){
    // draw coarse borders by marching sampled grid and stroking edges where nearest realm changes
    ctx.strokeStyle='rgba(90,70,50,0.8)'; ctx.lineWidth=1.4; ctx.beginPath();
    const step=4; const nearest=(x,y)=>{let id=0,bd=Infinity; for(let r=0;r<realms.length;r++){const dx=x-realms[r].x,dy=y-realms[r].y; const d=dx*dx+dy*dy; if(d<bd){bd=d;id=r}} return id};
    for(let y=step;y<h-step;y+=step){ for(let x=step;x<w-step;x+=step){ const i=y*w+x; if(elev[i]<=sea) continue; const a=nearest(x,y), b=nearest(x+step,y), c=nearest(x,y+step); if(a!==b||a!==c){ ctx.rect(x+.5,y+.5,step-1,step-1);} }}
    ctx.stroke();
  }

  // Generate realm names and label
  function nameFor(seed,x,y){ const syl=['an','ar','al','ba','be','bo','da','de','dor','en','el','fa','fi','gal','ha','hel','ir','is','ka','kel','kor','la','len','lor','mir','na','nor','or','os','ra','ren','rim','sa','sel','sil','tor','ur','val','ven','vor','wyr','yor']; const r=rngFromSeed(seed+':'+x+','+y); const n=2+(r()<0.7?1:2); let s=''; for(let i=0;i<n;i++){ s+=syl[Math.floor(r()*syl.length)]; } return s.charAt(0).toUpperCase()+s.slice(1)}
  const labels=[]; for(const r of realms){ const n=nameFor(seed,r.x,r.y); labels.push({x:r.x,y:r.y,text:n}) }
  if(ui.lyrLabels.checked){
    ctx.save(); ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=2; ctx.fillStyle='rgba(60,45,30,0.9)'; ctx.font='italic 25px Georgia,Times,serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const l of labels){ if(elev[(l.y|0)*w+(l.x|0)]<=sea) continue; ctx.fillText(l.text,l.x,l.y); }
    ctx.restore();
  }

  // Scale bar (simple: assume 1 px ≈ 1 km * scale factor)
  const kmPerPx=2.2; const totalKm=Math.round((w*kmPerPx)/10)*10; const seg=50; const segKm=Math.round(seg*kmPerPx); const bar=document.getElementById('scaleBar'); bar.textContent=`0  —  ${segKm} km`; 
  const badge=document.getElementById('badge'); badge.textContent=`Seed: ${seed}`;
}

// Export
ui.btnPng.onclick=()=>{const link=document.createElement('a'); link.download=`map_${ui.seed.value||'seed'}.png`; link.href=cvs.toDataURL('image/png'); link.click()}
ui.btnGen.onclick=generate; ui.btnRand.onclick=()=>{ui.seed.value=''; generate()};
ui.size.onchange=generate; ui.scale.oninput=generate; ui.moist.oninput=generate; ui.temp.oninput=generate; 
ui.lyrRelief.onchange=generate; ui.lyrCoast.onchange=generate; ui.lyrRivers.onchange=generate; ui.lyrBorders.onchange=generate; ui.lyrLabels.onchange=generate;

// Info button toggle
document.querySelector('.info-btn').addEventListener('click', () => {
  const popup = document.querySelector('.info-popup');
  popup.classList.toggle('active');
});

document.addEventListener('click', (event) => {
  const btn = document.querySelector('.info-btn');
  const popup = document.querySelector('.info-popup');
  if (!btn.contains(event.target) && !popup.contains(event.target) && popup.classList.contains('active')) {
    popup.classList.remove('active');
  }
});

// First run
generate();