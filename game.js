(()=>{"use strict";
const $=id=>document.getElementById(id);
const canvas=$("game");
if(!window.BABYLON){$("engine-error").classList.remove("hide");return;}
const B=window.BABYLON;
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:false,powerPreference:"low-power"});
engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio>1?1.35:1));
let scene,camera,started=false,paused=false,health=100,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0,gun=null,barrelMesh=null,muzzleFlash=null,weaponIndex=0,recoilKick=0,gunKick=0,spreadKick=0,slideTimer=0,slideDX=0,slideDZ=0,crouched=false,savedLoadout=null;
const MOVE_SPEED=8, ARENA=100;
const weapons=[
 {name:"VANGUARD AR",damage:25,rate:.14,recoil:.018,spread:.012,mag:30,range:100,color:"#b7f34a",reload:1.25},
 {name:"RIPTIDE SMG",damage:12,rate:.075,recoil:.009,spread:.025,mag:36,range:75,color:"#63d7ff",reload:1.35},
 {name:"BREACH SHOTGUN",damage:12,rate:.65,recoil:.055,spread:.09,mag:8,range:35,color:"#ffbd59",reload:1.65,pellets:6},
 {name:"LONGSHOT SNIPER",damage:100,rate:.9,recoil:.09,spread:.001,mag:5,range:140,color:"#ff78a8",reload:1.8},
 {name:"BULWARK LMG",damage:20,rate:.19,recoil:.028,spread:.02,mag:60,range:90,color:"#c7a5ff",reload:2}
];
const coreToWeapon={vanguard:0,viper:1,breacher:2,scope:3,bastion:4};
function loadSavedLoadout(){
 try{savedLoadout=JSON.parse(localStorage.getItem("customfps-loadout")||"null");}catch(e){savedLoadout=null;}
 if(!savedLoadout||!savedLoadout.loadout||!savedLoadout.stats)return;
 const i=coreToWeapon[savedLoadout.loadout.core];
 if(i===undefined)return;
 weaponIndex=i;
 const st=savedLoadout.stats,w=weapons[i];
 // Convert the loadout builder's displayed stats into match behavior.
 w.damage=Math.max(1,Number(st.damage)||w.damage);
 w.rate=Math.max(.055,Math.min(1.5,60/Math.max(1,Number(st.rate)||60)));
 w.recoil=Math.max(.004,Math.min(.14,(Number(st.recoil)||1)/100));
 w.mag=Math.max(1,Math.round(Number(st.capacity)||w.mag));
 w.range=Math.max(10,Number(st.range)||w.range);
 w.reload=Math.max(.5,Number(st.reload)||w.reload);
 w.name=(savedLoadout.core.name&&savedLoadout.core.className)?savedLoadout.core.name+" · "+savedLoadout.core.className:(savedLoadout.core.name||w.name);
}
loadSavedLoadout();
function material(name,color,roughness=1,emissive=null){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);m.roughness=roughness;if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);return m;}
function block(name,x,y,z,sx,sy,sz,mat){const o=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function flat(name,x,z,sx,sz,y,mat){const o=B.MeshBuilder.CreateGround(name,{width:sx,height:sz,subdivisions:1},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function createArena(){
scene=new B.Scene(engine);scene.clearColor=new B.Color4(.48,.72,.88,1);scene.collisionsEnabled=true;scene.gravity=new B.Vector3(0,-18,0);
const sky=new B.HemisphericLight("ambient",new B.Vector3(0,1,0),scene);sky.intensity=.9;sky.groundColor=new B.Color3(.35,.4,.38);
const sun=new B.DirectionalLight("sun",new B.Vector3(-.45,-1,.25),scene);sun.position.set(20,40,-20);sun.intensity=.7;
const ground=material("plain ground","#65716a"),wall=material("end walls","#263941"),barrier=material("side barriers","#52696b"),trim=material("lime trim","#b7f34a",.6,"#273b0c"),tower=material("tower concrete","#63767b"),cover=material("simple cover","#3c5054");
// A very large, untextured skybox surrounds the arena. It is deliberately open overhead.
const skybox=B.MeshBuilder.CreateBox("skybox",{size:1000},scene);const skyMat=new B.StandardMaterial("skybox material",scene);skyMat.backFaceCulling=false;skyMat.disableLighting=true;skyMat.diffuseColor=new B.Color3(.48,.72,.88);skyMat.emissiveColor=new B.Color3(.48,.72,.88);skybox.material=skyMat;skybox.infiniteDistance=true;skybox.isPickable=false;
// Large, completely flat play area.
flat("wide flat plain",50,50,100,100,0,ground);
// Solid walls on the two short ends, where the sniper towers sit.
block("north end wall",50,2,0,100,4,1.2,wall);
block("south end wall",50,2,100,100,4,1.2,wall);
// No solid side walls: spaced barriers line both long sides.
for(const z of [10,22,34,46,58,70,82,94]){
  block("west side barrier",1.5,.9,z,3,1.8,2.4,barrier);
  block("east side barrier",98.5,.9,z,3,1.8,2.4,barrier);
  block("west barrier stripe",1.5,1.83,z,1.8,.05,2.0,trim);
  block("east barrier stripe",98.5,1.83,z,1.8,.05,2.0,trim);
}
// Matching sniper towers near opposite end walls, with simple steps and low parapets.
for(const z of [8,92]){
  block("sniper tower base",50,.5,z,7,1,7,tower);
  block("sniper tower platform",50,3.2,z,8, .3,8,wall);
  block("tower parapet",50,3.8,z-3.7,8,.9,.3,barrier);
  block("tower parapet",50,3.8,z+3.7,8,.9,.3,barrier);
  block("tower parapet",46.2,3.8,z,.3,.9,7.5,barrier);
  block("tower parapet",53.8,3.8,z,.3,.9,7.5,barrier);
  for(let i=0;i<8;i++)block("tower stair",50, .25+i*.35, z+(z<50?1:-1)*(2.7+i*.48),2,.35,.55,cover);
}
// A few low pieces of cover are scattered across the otherwise empty plain.
[[25,25],[50,25],[75,25],[25,50],[75,50],[25,75],[50,75],[75,75]].forEach(([x,z])=>block("field cover",x,.65,z,3,1.3,2,cover));
camera=new B.UniversalCamera("player camera",new B.Vector3(50,1.7,15),scene);camera.attachControl(canvas,true);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.keysUp=[87,38];camera.keysDown=[83,40];camera.keysLeft=[65];camera.keysRight=[68];camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
camera.rotation.set(0,0,0);
// Stylized medium-detail AR, built from real Babylon.js meshes (no external asset loader).
// The camera-local Z axis points down the rifle toward its muzzle.
const gunMat=material("AR graphite body","#263238"),gunAccent=material("AR accent",weapons[0].color,.45,weapons[0].color);
const gunDark=material("AR dark components","#11191e"),gunMetal=material("AR metal","#7b898b"),gunGrip=material("AR grip","#35464a");
function gunBox(name,w,h,d,x,y,z,mat){const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.material=mat;m.parent=camera;m.position.set(x,y,z);return m;}
function gunCylinder(name,diameter,length,x,y,z,mat,segments=12){const m=B.MeshBuilder.CreateCylinder(name,{height:length,diameter, tessellation:segments},scene);m.rotation.x=Math.PI/2;m.material=mat;m.parent=camera;m.position.set(x,y,z);return m;}
// Receiver and raised upper receiver.
gun=gunBox("AR lower receiver",.22,.17,.48,.34,-.29,.60,gunMat);
gunBox("AR upper receiver",.205,.095,.49,.34,-.205,.60,gunDark);
gunBox("AR handguard",.205,.145,.40,.34,-.27,.30,gunGrip);
// Barrel and muzzle brake.
barrelMesh=gunCylinder("AR barrel",.052,.34,.34,-.25,.105,gunAccent);
gunCylinder("AR muzzle brake",.085,.105,.34,-.25,-.075,gunDark);
// Stock and cheek rest behind the receiver.
gunBox("AR buffer tube",.13,.105,.24,.34,-.28,.90,gunDark);
gunBox("AR shoulder stock",.19,.19,.28,.34,-.30,1.12,gunGrip);
gunBox("AR stock buttpad",.205,.205,.055,.34,-.30,1.285,gunDark);
gunBox("AR cheek rest",.17,.045,.19,.34,-.19,1.08,gunAccent);
// Angled-looking pistol grip and magazine under the receiver.
const pistolGrip=gunBox("AR pistol grip",.12,.24,.16,.34,-.47,.72,gunGrip);pistolGrip.rotation.x=-.14;
gunBox("AR grip base",.13,.045,.17,.34,-.595,.74,gunDark);
const magazine=gunBox("AR magazine",.145,.28,.18,.34,-.49,.49,gunDark);magazine.rotation.x=-.10;
gunBox("AR magazine floorplate",.16,.045,.19,.34,-.64,.51,gunAccent);
// Top rail, optic mount, optic body and glass.
gunBox("AR top rail",.12,.045,.43,.34,-.145,.55,gunDark);
gunBox("AR optic mount",.13,.06,.12,.34,-.095,.49,gunAccent);
gunBox("AR optic housing",.14,.13,.15,.34,-.015,.49,gunDark);
gunCylinder("AR optic lens",.075,.012,.34,-.015,.405,gunMetal,12);
// Front sight and rear sight.
gunBox("AR front sight post",.045,.13,.05,.34,-.17,.22,gunDark);
gunBox("AR front sight cap",.10,.035,.07,.34,-.105,.22,gunAccent);
gunBox("AR rear sight",.07,.085,.065,.34,-.095,.70,gunDark);
// Side ejection port and handguard rail ribs.
gunBox("AR ejection port",.018,.065,.17,.45,-.22,.59,gunDark);
gunBox("AR charging handle",.055,.035,.10,.46,-.17,.72,gunMetal);
for(let i=0;i<5;i++)gunBox("AR handguard rib "+i,.025,.035,.045,.455,-.27,.19+i*.065,gunMetal);
// Short lower handguard grip.
gunBox("AR foregrip",.11,.14,.105,.34,-.405,.31,gunDark);
muzzleFlash=B.MeshBuilder.CreateSphere("muzzle flash",{diameter:.18,segments:6},scene);muzzleFlash.parent=camera;muzzleFlash.position.set(.34,-.25,-.15);muzzleFlash.material=new B.StandardMaterial("muzzle flash material",scene);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(weapons[0].color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(weapons[0].color);muzzleFlash.isVisible=false;
createTargets();
 // Color the weapon accent to match the saved core.
 const activeWeapon=weapons[weaponIndex];barrelMesh.material.diffuseColor=B.Color3.FromHexString(activeWeapon.color);barrelMesh.material.emissiveColor=B.Color3.FromHexString(activeWeapon.color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(activeWeapon.color);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(activeWeapon.color);
 return scene;
}
function createTargets(){
 targets=[];
 const spots=[[25,1.1,35],[38,1.1,48],[50,1.1,60],[64,1.1,43],[76,1.1,68]];
 spots.forEach((v,i)=>{
  const root=new B.TransformNode("drone root "+i,scene);root.position.set(v[0],v[1],v[2]);
  const shell=material("drone shell "+i,"#52666a");
  const body=B.MeshBuilder.CreateSphere("drone body",{diameter:.9,segments:10},scene);body.parent=root;body.material=shell;body.isPickable=true;
  const eye=B.MeshBuilder.CreateBox("drone eye",{width:.38,height:.08,depth:.08},scene);eye.parent=root;eye.position.z=-.41;eye.material=material("drone eye glow "+i,"#b7f34a",.4,"#b7f34a");eye.isPickable=true;
  const ring=B.MeshBuilder.CreateTorus("drone ring",{diameter:1.15,thickness:.045,tessellation:12},scene);ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=material("drone ring mat "+i,"#b7f34a",.4,"#273b0c");ring.isPickable=true;
  // Floating health bar: dark backing plus a colored fill that shrinks with damage.
  const barRoot=new B.TransformNode("health bar root "+i,scene);barRoot.parent=root;barRoot.position.set(0,.9,0);
  const back=B.MeshBuilder.CreatePlane("health bar backing "+i,{width:1.35,height:.14},scene);back.parent=barRoot;back.position.z=-.04;back.billboardMode=B.Mesh.BILLBOARDMODE_ALL;back.material=material("health bar dark "+i,"#142024");back.isPickable=false;
  const fill=B.MeshBuilder.CreatePlane("health bar fill "+i,{width:1.25,height:.075},scene);fill.parent=barRoot;fill.position.z=-.02;fill.billboardMode=B.Mesh.BILLBOARDMODE_ALL;fill.material=material("health bar fill mat "+i,"#70ed63",.5,"#285d20");fill.isPickable=false;
  targets.push({root,body,alive:true,hp:100,maxHp:100,phase:i*1.2,baseY:v[1],barRoot,barFill:fill});
 });
}
function showToast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),1300);}
function syncHUD(){$("health").textContent=health;$("hpbar").style.width=health+"%";$("ammo").textContent=ammo;$("objective").textContent="Eliminate training drones · "+kills+" / 5";const w=weapons[weaponIndex];$("weapon-name").textContent=w.name;$("ammo").textContent=ammo;$("weapon-slots").textContent="1 AR · 2 SMG · 3 SG · 4 SR · 5 LMG";const ammoMax=document.querySelector(".hud em");if(ammoMax)ammoMax.textContent=" / "+w.mag;}
function resetGame(){health=100;kills=0;ammo=weapons[weaponIndex].mag;reloading=false;reloadTimer=0;fireCooldown=0;recoilKick=0;gunKick=0;spreadKick=0;slideTimer=0;crouched=false;camera.position.set(50,1.7,15);camera.rotation.set(0,0,0);jumpVelocity=0;onGround=true;targets.forEach(t=>{t.alive=true;t.hp=t.maxHp;t.root.setEnabled(true);updateTargetBar(t);});syncHUD();}
function updateTargetBar(t){const ratio=Math.max(0,t.hp/t.maxHp);t.barFill.scaling.x=ratio;t.barFill.position.x=-(1-ratio)*.625;t.barFill.material.diffuseColor=ratio>.6?B.Color3.FromHexString("#70ed63"):ratio>.3?B.Color3.FromHexString("#ffd45a"):B.Color3.FromHexString("#ff6262");t.barFill.material.emissiveColor=t.barFill.material.diffuseColor.scale(.25);}
function equipWeapon(i){if(i<0||i>=weapons.length||i===weaponIndex)return;weaponIndex=i;const w=weapons[i];ammo=w.mag;reloading=false;reloadTimer=0;fireCooldown=0;gun.material.diffuseColor=B.Color3.FromHexString("#18252c");barrelMesh.material.diffuseColor=B.Color3.FromHexString(w.color);barrelMesh.material.emissiveColor=B.Color3.FromHexString(w.color);muzzleFlash.material.diffuseColor=B.Color3.FromHexString(w.color);muzzleFlash.material.emissiveColor=B.Color3.FromHexString(w.color);syncHUD();showToast("EQUIPPED: "+w.name);}
function startGame(){started=true;paused=false;$("intro").classList.add("hide");$("pausemenu").classList.add("hide");canvas.focus();if(canvas.requestPointerLock)canvas.requestPointerLock();}
function togglePause(){if(!started)return;paused=!paused;$("pausemenu").classList.toggle("hide",!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&canvas.requestPointerLock)canvas.requestPointerLock();}
function endGame(win){paused=true;$("endtitle").textContent=win?"TEST COMPLETE":"OPERATOR DOWN";$("endcopy").textContent=win?"All five training drones eliminated. Arena clear.":"You were tagged out during testing. Reset and try again.";$("endmenu").classList.remove("hide");if(document.pointerLockElement)document.exitPointerLock();}
function leave(){if(document.pointerLockElement)document.exitPointerLock();location.href="index.html";}
function showDamagePopup(amount){
 let el=$("damage-popup");
 if(!el){
  el=document.createElement("div");el.id="damage-popup";
  Object.assign(el.style,{position:"absolute",left:"50%",top:"calc(50% - 42px)",transform:"translate(-50%,-50%)",zIndex:"5",font:"900 20px Inter,system-ui,sans-serif",letterSpacing:".04em",color:"#fff",textShadow:"0 2px 5px #000,0 0 8px #000",pointerEvents:"none",opacity:"0",transition:"opacity .08s"});
  document.body.appendChild(el);
 }
 el.textContent="-"+Math.round(amount);
 el.style.opacity="1";
 clearTimeout(el._hideTimer);
 el._hideTimer=setTimeout(()=>{el.style.opacity="0";},650);
}
function showImpactDot(point,normal){
 const dot=B.MeshBuilder.CreateSphere("temporary bullet impact",{diameter:.095,segments:6},scene);
 const mat=new B.StandardMaterial("black bullet impact material",scene);
 mat.diffuseColor=B.Color3.Black();mat.emissiveColor=B.Color3.Black();mat.disableLighting=true;
 dot.material=mat;dot.isPickable=false;
 dot.position.copyFrom(point);
 if(normal)dot.position.addInPlace(normal.scale(.035));
 setTimeout(()=>{if(!dot.isDisposed())dot.dispose();mat.dispose();},1800);
}
function shoot(){
 if(!started||paused||reloading||fireCooldown>0)return;
 const w=weapons[weaponIndex];
 if(ammo<=0){showToast("EMPTY MAGAZINE — PRESS R");return;}
 ammo--;fireCooldown=w.rate;
 // Hitscan: the ray follows the exact center of the camera/crosshair.
 // Compute the hit before applying this shot's visual recoil.
 const ray=camera.getForwardRay(w.range);
 const pick=scene.pickWithRay(ray,m=>m.isPickable&&m.parent!==camera&&m.name!=="skybox"&&!m.name.startsWith("health bar"));
 const hitPoint=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(w.range));
 const hitNormal=pick&&pick.hit&&pick.getNormal?pick.getNormal(true):null;
 gunKick=Math.min(.22,gunKick+.12+w.recoil);
 recoilKick=Math.min(.16,recoilKick+w.recoil);
 spreadKick=Math.min(.12,spreadKick+w.spread);
 muzzleFlash.isVisible=true;
 setTimeout(()=>{if(muzzleFlash)muzzleFlash.isVisible=false;},55);
 // Keep the existing weapon kick and upward camera recoil as visual effects only.
 gun.position.z=.62+gunKick;gun.position.y=-.29-gunKick*.4;
 camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x-w.recoil));
 syncHUD();
 // Tracer is cosmetic only; it never decides whether damage is dealt.
 const muzzle= camera.getDirection(B.Axis.Z);
 const origin=camera.position.add(muzzle.scale(.55));
 const tracer=B.MeshBuilder.CreateLines("bullet tracer",{points:[origin,hitPoint]},scene);
 tracer.color=B.Color3.FromHexString(w.color);tracer.alpha=.95;tracer.isPickable=false;
 setTimeout(()=>{if(!tracer.isDisposed())tracer.dispose();},85);
 let target=null;
 if(pick&&pick.hit&&pick.pickedMesh){
  target=targets.find(t=>t.alive&&(pick.pickedMesh===t.body||pick.pickedMesh.parent===t.root));
 }
 if(target){
  const damage=w.damage*(w.pellets||1);
  target.hp=Math.max(0,target.hp-damage);updateTargetBar(target);showDamagePopup(damage);
  if(target.hp<=0){
   target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");
   if(kills===5)endGame(true);
  }else{
   $("objective").textContent="Eliminate training drones · "+kills+" / 5";
  }
 }else if(pick&&pick.hit&&pick.pickedPoint){
  // A small black mark remains briefly on the surface when the shot hits scenery.
  showImpactDot(hitPoint,hitNormal);
 }
}
function reload(){const w=weapons[weaponIndex];if(!started||paused||reloading||ammo===w.mag)return;reloading=true;reloadTimer=w.reload;showToast("RELOADING…");}
function update(dt){
 if(!started||paused)return;
 fireCooldown=Math.max(0,fireCooldown-dt);
 if(reloading){reloadTimer-=dt;if(reloadTimer<=0){ammo=weapons[weaponIndex].mag;reloading=false;syncHUD();showToast("MAGAZINE RELOADED");}}
 const previousRecoil=recoilKick;recoilKick=Math.max(0,recoilKick-dt*.055);camera.rotation.x=Math.min(1.25,camera.rotation.x+(previousRecoil-recoilKick));gunKick=Math.max(0,gunKick-dt*.7);spreadKick=Math.max(0,spreadKick-dt*.12);
 if(gun){gun.position.z=.62+gunKick;gun.position.y=-.29-gunKick*.4;}
 if(slideTimer>0){slideTimer=Math.max(0,slideTimer-dt);camera.position.x+=slideDX*dt;camera.position.z+=slideDZ*dt;camera.position.y=1.15;if(slideTimer===0){slideDX=0;slideDZ=0;}}
 else{
  const crouchHeld=!!(keys.ControlLeft||keys.ControlRight||keys.KeyC);
  const moving=!!(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD);
  const sprinting=!!(keys.ShiftLeft||keys.ShiftRight)&&moving;
  if(crouchHeld&&sprinting&&moving&&slideTimer===0){
   const yaw=camera.rotation.y;let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0);const len=Math.hypot(f,r)||1;f/=len;r/=len;
   slideDX=(Math.sin(yaw)*f+Math.cos(yaw)*r)*15;slideDZ=(Math.cos(yaw)*f-Math.sin(yaw)*r)*15;slideTimer=.62;showToast("SLIDE");camera.position.y=1.15;
  }else{
   crouched=crouchHeld;const targetY=crouched?1.05:1.7;camera.position.y+=(targetY-camera.position.y)*Math.min(1,dt*12);
   let forward=0,right=0;if(keys.KeyW||keys.ArrowUp)forward++;if(keys.KeyS||keys.ArrowDown)forward--;if(keys.KeyD)right++;if(keys.KeyA)right--;const len=Math.hypot(forward,right)||1;forward/=len;right/=len;
   const speed=crouched?3.2:sprinting?12:MOVE_SPEED;const yaw=camera.rotation.y;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt;const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed*dt;
   const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
   if(camera.position.x<2||camera.position.x>98||camera.position.z<2||camera.position.z>98||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.name!=="wide flat plain"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
   if(keys.Space&&onGround){jumpVelocity=6.5;onGround=false;keys.Space=false;}
   if(!onGround||camera.position.y>targetY){jumpVelocity-=18*dt;camera.position.y+=jumpVelocity*dt;if(camera.position.y<=targetY){camera.position.y=targetY;jumpVelocity=0;onGround=true;}}
  }
 }
 targets.forEach(t=>{if(t.alive){t.root.position.y=t.baseY+Math.sin(performance.now()*.002+t.phase)*.12;t.root.rotation.y+=dt*.5;if(Math.random()<dt*.012){health=Math.max(0,health-1);syncHUD();if(health===0)endGame(false);}}});
}
function loop(){const now=performance.now();const dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;if(scene){update(dt);scene.render();} }
try{createArena();resetGame();engine.runRenderLoop(loop);window.addEventListener("resize",()=>engine.resize());}catch(e){console.error(e);$("engine-error").classList.remove("hide");}
canvas.addEventListener("click",()=>{if(!started)startGame();else if(!paused){if(document.pointerLockElement===canvas)shoot();else canvas.requestPointerLock?.();}});
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas&&started&&!paused){camera.rotation.y+=e.movementX*.0023;camera.rotation.x+=e.movementY*.0023;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));}});
document.addEventListener("keydown",e=>{if(!e.repeat){keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();if(e.code==="KeyE")shoot();if(e.code==="Digit1")equipWeapon(0);if(e.code==="Digit2")equipWeapon(1);if(e.code==="Digit3")equipWeapon(2);if(e.code==="Digit4")equipWeapon(3);if(e.code==="Digit5")equipWeapon(4);}});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
$("start").addEventListener("click",startGame);$("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);$("exit").addEventListener("click",leave);$("exit2").addEventListener("click",leave);$("exit3").addEventListener("click",leave);$("reload").addEventListener("click",reload);$("again").addEventListener("click",()=>{resetGame();$("endmenu").classList.add("hide");$("intro").classList.remove("hide");started=false;paused=false;});
})();