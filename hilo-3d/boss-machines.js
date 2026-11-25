import * as THREE from 'three';

const brass = new THREE.MeshStandardMaterial({color:0xb68a48,metalness:.85,roughness:.29});
const bronze = new THREE.MeshStandardMaterial({color:0x553923,metalness:.72,roughness:.47});
const enamel = new THREE.MeshPhysicalMaterial({color:0x174846,metalness:.34,roughness:.36,clearcoat:.72});
const lacquer = new THREE.MeshPhysicalMaterial({color:0x52100e,metalness:.2,roughness:.26,clearcoat:1});
const steel = new THREE.MeshStandardMaterial({color:0x252d28,metalness:.68,roughness:.47});
const pin = new THREE.CylinderGeometry(.025,.031,.017,10);
const lensGeometry = new THREE.SphereGeometry(1,16,10);
const unitBox = new THREE.BoxGeometry(1,1,1);
const plane = new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
function part(parent,geo,mat,x,y,z,name='') {
  const m=new THREE.Mesh(geo,mat); m.name=name; m.position.set(x,y,z); parent.add(m); return m;
}
function block(group,x,y,z,w,h,d,material) {
  const m=part(group,unitBox,material,x,y,z); m.scale.set(w,h,d); return m;
}
function decal(group,tex,x,y,z,w,d,name) {
  const m=part(group,plane,new THREE.MeshBasicMaterial({map:tex,toneMapped:false}),x,y,z,name); m.scale.set(w,1,d); return m;
}
function lens(group,x,y,z,r,color,name) {
  const m=part(group,lensGeometry,new THREE.MeshStandardMaterial({color:0x725e46,roughness:.28,metalness:.15,emissive:color,emissiveIntensity:.03}),x,y,z,name);
  m.scale.set(r,r*.8,r);return m;
}
function shine(m,on) {m.material.emissiveIntensity=on?1.85:.035;}
function dialArt(ctx) {
  const cx=150,cy=142;
  ctx.fillStyle='#183633';ctx.fillRect(0,0,300,174);
  ctx.strokeStyle='#967747';ctx.lineWidth=3;ctx.strokeRect(6,6,288,162);
  ctx.beginPath();ctx.arc(cx,cy,104,Math.PI*1.10,Math.PI*1.90);ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f9e5bc';ctx.font='bold 42px Georgia';
  for(let n=0;n<3;n++){
    const a=(n-1)*.83;ctx.fillText(['I','II','III'][n],cx+Math.sin(a)*103,cy-Math.cos(a)*101);
  }
}
function engraved(ctx,w,h,text,ground,ink){
  ctx.fillStyle=ground;ctx.fillRect(0,0,w,h);ctx.strokeStyle=ink;ctx.lineWidth=3;
  ctx.strokeRect(7,7,w-14,h-14);ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold '+Math.round(h*.47)+'px Georgia';ctx.fillText(text,w/2,h*.53,w*.89);
}
function fixture(group,slab,x,z,w,d,metal){
  const base=part(group,slab(w,d,.08,.095,.018),metal,x,.83,z);
  for(const sign of [-1,1])part(base,pin,brass,sign*(w/2-.063),.113,0);
  return base;
}
function makeElevator(group,{slab,canvasTexture}) {
  const face=canvasTexture(300,174,dialArt);
  const dials=[],numbers=[];
  const grille = canvasTexture(144,900,g=>{
    g.fillStyle='#19322f';g.fillRect(0,0,144,900);
    for(let col=0;col<3;col++)for(let j=-1;j<9;j++){
      const x=13+col*39,y=j*118;
      g.beginPath();g.moveTo(x,y);g.lineTo(x+36,y+60);g.lineTo(x,y+118);g.strokeStyle='#aa8350';g.lineWidth=4;g.stroke();
      g.beginPath();g.moveTo(x+36,y);g.lineTo(x,y+60);g.lineTo(x+36,y+118);g.strokeStyle='#705333';g.stroke();
    }
    for(const x of [4,136]){g.fillStyle='#d0a76a';g.fillRect(x,0,3,900)}
  });
  for(const x of [-3.01,4.73])decal(group,grille,x,.878,.1,.31,5.7);
  for(let col=0;col<3;col++){
    const x=(col-1)*1.54;
    const base=fixture(group,slab,x,-3.56,1.39,.74,enamel);
    decal(base,face,0,.117,0,1.10,.59);
    const pivot=new THREE.Group();pivot.position.set(0,.133,.18);base.add(pivot);
    const pointer=part(pivot,new THREE.ConeGeometry(.033,.28,8),brass,0,.01,-.134);
    pointer.rotation.x=-Math.PI/2;part(pivot,pin,brass,0,.025,0);
    const lamp=lens(base,.56,.175,-.01,.077,0xffe3a6,'car-lamp-'+col);
    dials.push({pivot,lamp});numbers.push(null);
  }
  // Stepped kick plates and inlaid brass fluting frame the three car bays.
  for(const x of [-2.30,2.30]){
    const cap=fixture(group,slab,x,-3.56,.26,.81,brass);
    for(const dx of [-.066,0,.066])block(cap,dx,.123,0,.017,.027,.56,bronze);
  }
  return {reset(){numbers.fill(null)},update(state,now,dt,reduced,relay,fronts){
    let changed=false;
    for(let i=0;i<3;i++){
      const front=fronts[i],floor=front<0?-1:Math.floor(front/3);
      if(numbers[i]!==null && numbers[i]!==floor)changed=true;
      const angle=floor<0?-1.31:(1-floor)*.83;
      const d=dials[i];d.pivot.rotation.y=(reduced||numbers[i]===null)?angle:THREE.MathUtils.damp(d.pivot.rotation.y,angle,15,dt);
      d.pivot.userData.floor=floor;shine(d.lamp,front>=0);numbers[i]=floor;
    }
    if(changed)relay('floor-relay');
  }};
}
function makeSharp(group,{slab,canvasTexture}){
  const base=fixture(group,slab,3.08,-3.49,1.95,.68,bronze);
  decal(base,canvasTexture(480,128,g=>engraved(g,480,128,'DOUBLE DRAW','#46202a','#ead09c')),-.13,.118,0,1.39,.45);
  const warning=lens(base,.77,.175,0,.13,0xffae42,'double-draw-lamp');
  // Curved brass hood over an amber glass diffuser.
  const hood=part(group,new THREE.SphereGeometry(.33,28,12,0,Math.PI*2,0,Math.PI/2),brass,0,1.07,-3.63);
  hood.scale.set(1.8,.63,.82);
  const shade=lens(group,0,1.045,-3.63,.26,0xffc077,'table-lamp');shade.scale.set(.45,.09,.21);shine(shade,true);
  for(const x of [-.42,.42])block(group,x,.95,-3.66,.065,.26,.11,bronze);
  return {update(state,now,dt,reduced,relay,fronts,doubleDraw){shine(warning,doubleDraw)}};
}
function makeRoller(group,{slab,slots}){
  const base=fixture(group,slab,2.94,-3.55,1.24,.72,lacquer);
  const edgeBulb = new THREE.MeshStandardMaterial({color:0xffcc88,emissive:0xffa336,emissiveIntensity:.75});
  for (const x of [-3.04,4.77]) {
    const row = new THREE.InstancedMesh(lensGeometry,edgeBulb,9);
    const m = new THREE.Matrix4();
    for(let i=0;i<9;i++){m.makeScale(.044,.030,.044);m.setPosition(x,.872,-2.6+i*.67);row.setMatrixAt(i,m)}
    group.add(row);
  }
  const foot=part(base,new THREE.CylinderGeometry(.32,.35,.08,32),bronze,0,.16,0);
  const dome=part(foot,new THREE.SphereGeometry(.31,32,16,0,Math.PI*2,0,Math.PI/2),brass,0,.04,0);
  const plunger=part(dome,new THREE.CylinderGeometry(.061,.047,.1,16),brass,0,.34,0,'bell-plunger');
  const collar=part(group,slab(.95,.235,.06,.042,.01),brass,0,.707,0,'stake-plaque');
  const edgeLight=lens(group,0,.745,0,.05,0xff341f,'risk-light');edgeLight.scale.set(.29,.025,.025);
  const ivory=new THREE.MeshStandardMaterial({color:0xf2dfb6,roughness:.5});
  const chip=new THREE.CylinderGeometry(.142,.142,.034,24);
  for(let i=0;i<4;i++)for(let j=0;j<[3,5,4,2][i];j++)part(group,chip,j===2?bronze:ivory,-.64+i*.32,.868+j*.037,-3.68);
  let bellTime=-Infinity;
  return {ring(now){bellTime=now},reset(){bellTime=-Infinity},update(state,now,dt,reduced){
    const t=(now-bellTime)/400;
    dome.rotation.z=(!reduced&&t>=0&&t<1)?Math.sin(t*20)*.11*(1-t):0;
    plunger.position.y=.34-(!reduced&&t>=0&&t<.3 ? .07*Math.sin(t/.3*Math.PI):0);
    const a=slots[state.stake],b=slots[state.stakeMate];
    collar.visible=!!(a&&state.board[state.stake]);edgeLight.visible=!!(b&&state.board[state.stakeMate]);
    if(collar.visible)collar.position.set(a.x,.706,a.z-.95);
    if(edgeLight.visible){edgeLight.position.set(b.x,.743,b.z+.87);shine(edgeLight,true)}
  }};
}
function makeHouse(group,{slab,canvasTexture}){
  const suits=['♠','♥','♦','♣'], bank=fixture(group,slab,.28,-3.58,3.37,.72,steel);
  const faces=suits.map((s,i)=>{
    const x=(i-1.5)*.69;
    part(bank,new THREE.CylinderGeometry(.27,.29,.048,28),brass,x,.135,0);
    const texture=canvasTexture(120,120,g=>{
      g.fillStyle='#152824';g.fillRect(0,0,120,120);g.fillStyle='#fff3d5';g.textAlign='center';g.textBaseline='middle';g.font='bold 93px Georgia';g.fillText(s,60,66);
    });
    const m=part(bank,new THREE.CircleGeometry(.232,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:texture}),x,.163,0,'stamp-'+s);
    return m;
  });
  const press=fixture(group,slab,-2.68,.15,.83,1.58,steel);
  block(press,0,.139,-.48,.66,.092,.16,bronze);
  const roll=part(press,new THREE.CylinderGeometry(.15,.15,.65,24),brass,0,.23,-.56);roll.rotation.z=Math.PI/2;
  const paper=canvasTexture(180,330,()=>{}), ctx=paper.image.getContext('2d');
  const slip=decal(press,paper,0,.119,.12,.54,1.04,'receipt');
  let previous=null, feedStart=-Infinity;
  function print(stamps){
    ctx.fillStyle='#eadbb6';ctx.fillRect(0,0,180,330);ctx.textAlign='center';ctx.fillStyle='#422f22';ctx.font='bold 20px monospace';ctx.fillText('THE HOUSE',90,38);
    ctx.fillRect(20,50,140,2);ctx.font='bold 28px Georgia';
    stamps.forEach((s,i)=>ctx.fillText(String(i+1).padStart(2,'0')+'   '+s,90,90+53*i));
    for(let y=12;y<330;y+=22){ctx.fillStyle='#89775c';ctx.fillRect(6,y,5,6);ctx.fillRect(169,y,5,6)}
    paper.needsUpdate=true;
  }
  return {reset(){previous=null;feedStart=-Infinity},update(state,now,dt,reduced,relay){
    const stamped=Object.keys(state.stamps||{}),key=stamped.join('');
    if(key!==previous){
      if(previous!==null && key.length>previous.length){feedStart=now;relay('stamp-feed')}
      print(stamped);previous=key;
      faces.forEach((m,i)=>m.material.color.setHex(stamped.includes(suits[i])?0x67ffad:0xb8a582));
    }
    const t=THREE.MathUtils.clamp((now-feedStart)/240,0,1);
    const length=.40+.14*stamped.length-(reduced ? 0 : .14*(1-t));
    slip.scale.z=length;slip.position.z=-.40+length/2;
    // Unroll from the platen, exposing one printed row at a time at a constant text scale.
    paper.repeat.y=length/1.04;paper.offset.y=1-paper.repeat.y;
    roll.rotation.x=reduced?0:(stamped.length-(1-t))*.85;
  }};
}
const builders={elevator:makeElevator,sharp:makeSharp,roller:makeRoller,house:makeHouse};
export function makeBossMachines(options){
  const built=new Map();let active='',machine;
  function show(id){
    if(id===active)return;
    if(machine)machine.group.visible=false;
    active=id;machine=null;
    if(!Object.hasOwn(builders,id))return;
    if(!built.has(id)){
      const group=new THREE.Group();group.name='machine-'+id;options.scene.add(group);
      built.set(id,{...builders[id](group,options),group});
    }
    machine=built.get(id);machine.group.visible=true;machine.reset?.();
  }
  return {show,reset(){machine?.reset?.()},ring(now){machine?.ring?.(now)},update(...args){machine?.update(...args)}};
}
