import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const brass = (color, roughness) => new THREE.MeshStandardMaterial({color, roughness, metalness: .8});
const mesh = (parent, geometry, material, x, y, z) => {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = part.receiveShadow = true;
  parent.add(part);
  return part;
};

// The three printed reels share one texture. Only a moving reel uploads a new frame.
export function makeRegister({scene, slab, canvasTexture, chipGeometry, chipMaterial, glow, imageURL}) {
  const group = new THREE.Group();
  scene.add(group);
  const metal = brass(0x946334, .38);
  const black = brass(0x27180f, .64);
  const centerX = .45, centerZ = 3.77, width = 2.45, depth = .85;
  mesh(group, slab(width + .08, depth + .06, .09, .13, .025), metal, centerX, .82, centerZ);
  const plate = canvasTexture(410, 152, () => {});
  const ctx = plate.image.getContext('2d');
  const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  mesh(group, flat(width, depth), new THREE.MeshBasicMaterial({map: plate, toneMapped:false}), centerX, .979, centerZ);
  const labelTexture = canvasTexture(384, 96, g => {
    g.fillStyle = '#3d2819'; g.fillRect(0, 0, 384, 96);
    g.strokeStyle = '#c5a270'; g.lineWidth = 4; g.strokeRect(6, 6, 372, 84);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f8deb0';
    g.font = 'bold 57px Georgia'; g.fillText('TOLL DUE', 192, 52);
  });
  mesh(group, flat(1.24, .34), new THREE.MeshBasicMaterial({map:labelTexture}), centerX - 1.93, .85, centerZ);
  const lamps = [], socket = new THREE.CylinderGeometry(.119, .14, .065, 24);
  const glass = new THREE.SphereGeometry(.094, 18, 10);
  for (let i = 0; i < 3; i++) {
    const x = centerX + 1.53 + i * .36;
    mesh(group, socket, metal, x, .86, centerZ);
    const lens = mesh(group, glass, new THREE.MeshStandardMaterial({color:0x68401b, roughness:.24, metalness:.25, emissive:0xff981b}), x, .908, centerZ);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:glow, color:0xffac40, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
    halo.position.set(x, .965, centerZ); halo.scale.setScalar(.48); group.add(halo);
    lamps.push({lens, halo});
  }
  const coin = mesh(group, chipGeometry, chipMaterial, 0, 0, 0);
  coin.visible = false;
  const mouthX = centerX + (350 / 410 - .5) * width;
  const mouthZ = centerZ + (81 / 152 - .5) * depth;
  const art = new Image();
  let artLoaded = false, dirty = true, balance = 0, started = 0, coinAt = null;
  let from = [0,0,0], to = [0,0,0], lastStep = -1, lastLamps = -1;
  art.onload = () => { artLoaded = dirty = true; };
  art.src = imageURL;
  function paint(t) {
    if (artLoaded) ctx.drawImage(art, 0, 0);
    else { ctx.fillStyle = '#836038'; ctx.fillRect(0,0,410,152); ctx.fillStyle = '#211912'; ctx.fillRect(55,18,208,105); ctx.fillRect(343,55,14,49); }
    for (let i = 0; i < 3; i++) {
      const x = [66,132,198][i], w = 56, y = 29, h = 86;
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      const gradient = ctx.createLinearGradient(0,y,0,y+h);
      for (const [p,c] of [[0,'#6f4a2a'],[.18,'#ddbd89'],[.46,'#ffe7ba'],[.76,'#cfaa77'],[1,'#654627']]) gradient.addColorStop(p,c);
      ctx.fillStyle = gradient; ctx.fillRect(x,y,w,h);
      const offset = from[i] + (to[i] - from[i]) * t;
      const base = Math.floor(offset);
      ctx.fillStyle = '#20150c'; ctx.font = 'bold 64px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let n = base - 1; n <= base + 1; n++) ctx.fillText(String((n % 10 + 10) % 10), x + w/2, y+h/2+3+(n-offset)*h);
      ctx.restore();
    }
    plate.needsUpdate = true;
  }
  function reset() {
    coinAt = null; coin.visible = false; balance = 0; from = [0,0,0]; to = [0,0,0]; started = -1000; dirty = true;
  }
  function update(active, debt, streak, now, reduced) {
    group.visible = active;
    if (!active) return;
    if (debt !== balance) {
      const direction = Math.sign(debt - balance);
      const digits = String(clamp(debt,0,999)).padStart(3,'0');
      const progress = 1 - (1-clamp((now-started)/310,0,1))**3;
      from = to.map((old,i) => from[i] + (old-from[i])*progress);
      to = from.map((old,i) => {
        const base = Math.round(old), delta = (Number(digits[i]) - base % 10 + 10) % 10;
        return base + (direction < 0 && delta ? delta - 10 : delta);
      });
      balance = debt; started = now; dirty = true;
    }
    const step = reduced ? 20 : Math.round(clamp((now-started)/310,0,1)*20);
    if (dirty || step !== lastStep) { paint(1 - (1-step/20)**3); lastStep = step; dirty = false; }
    const lit = Math.min(3,streak);
    if (lit !== lastLamps) {
      lamps.forEach(({lens,halo},i) => { const on = i < lit; lens.material.emissiveIntensity = on ? 2.1 : .025; halo.visible = on; });
      lastLamps = lit;
    }
    if (coinAt === null) return;
    const t = clamp((now-coinAt)/540,0,1);
    coin.visible = !reduced && t < 1;
    if (!coin.visible) { coinAt = null; return; }
    const roll = Math.min(1,t/.78), drop = Math.max(0,(t-.78)/.22);
    coin.position.set(THREE.MathUtils.lerp(3.3,mouthX,roll), 1.17 + .45*Math.sin(Math.PI*roll) - .24*drop, THREE.MathUtils.lerp(.14,mouthZ,roll));
    coin.rotation.set(0,-.14*(1-roll),Math.PI/2+roll*Math.PI*4);
    coin.scale.setScalar(.77*(1-drop));
  }
  reset();
  return {update, reset, collect(now, paid) { if (paid > 0) coinAt = now; }};
}

// A subdivided rounded card keeps the print, the underside and the paper edge together.
export function makeFlexibleCard(width, height, thickness) {
  const cols = 14, rows = 24, radius = .09;
  const top = [], bottom = [], uv = [], indices = [], rim = [];
  const stride = cols+1;
  for (let j=0; j<=rows; j++) {
    const z = height*(j/rows-.5);
    const corner = Math.max(0,Math.abs(z)-(height/2-radius));
    const half = width/2-radius+Math.sqrt(Math.max(0,radius*radius-corner*corner));
    for (let i=0;i<=cols;i++) {
      const x = half*(2*i/cols-1);
      top.push(x,thickness/2,z); bottom.push(x,-thickness/2,z); uv.push(x/width+.5,.5-z/height);
      if (j<rows && i<cols) { const a=j*stride+i; indices.push(a,a+stride,a+1,a+1,a+stride,a+stride+1); }
    }
  }
  for (let i=0;i<=cols;i++) rim.push(i);
  for (let j=1;j<=rows;j++) rim.push(j*stride+cols);
  for (let i=cols-1;i>=0;i--) rim.push(rows*stride+i);
  for (let j=rows-1;j>0;j--) rim.push(j*stride);
  const edge=[], edgeUV=[], edgeIndices=[];
  for (const [k,id] of rim.entries()) {
    edge.push(...top.slice(id*3,id*3+3),...bottom.slice(id*3,id*3+3)); edgeUV.push(0,1,0,0);
    const a=k*2,b=((k+1)%rim.length)*2; edgeIndices.push(a,b,a+1,b,b+1,a+1);
  }
  function skin(vertices, uvs, triangles) {
    const geo = new THREE.BufferGeometry();
    geo.setIndex(triangles); geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.computeVertexNormals();
    const bent = vertices.slice();
    for (let i=0;i<bent.length;i+=3) {
      const fold = Math.max(0,.59*(vertices[i]/width+.5)+.41*(.5-vertices[i+2]/height)-.51)/.49;
      bent[i] -= .15*fold**2; bent[i+1] += .41*fold**2; bent[i+2] += .095*fold**2;
    }
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(bent,3)];
    return geo;
  }
  const backUV = uv.map((n,i)=>i%2 ? 1-n : n);
  return [skin(top,uv,indices),skin(bottom,backUV,[...indices].reverse()),skin(edge,edgeUV,edgeIndices)];
}
