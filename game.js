(()=>{"use strict";
const $=id=>document.getElementById(id);
const canvas=$("game");
if(!window.BABYLON){$("engine-error").classList.remove("hide");return;}
const B=window.BABYLON;
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,antialias:false,powerPreference:"low-power"});
engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio>1?1.35:1));
let scene,camera,playerRoot,started=false,paused=false,health=100,ammo=30,kills=0,reloading=false,reloadTimer=0,lastTime=0,jumpVelocity=0,onGround=true,fireCooldown=0,targets=[],keys={},toastTimer=0;
const MOVE_SPEED=5.2, ARENA=26;
function material(name,color,roughness=1,emissive=null){const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);m.roughness=roughness;if(emissive)m.emissiveColor=B.Color3.FromHexString(emissive);return m;}
function block(name,x,y,z,sx,sy,sz,mat){const o=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function flat(name,x,z,sx,sz,y,mat){const o=B.MeshBuilder.CreateGround(name,{width:sx,height:sz,subdivisions:1},scene);o.position.set(x,y,z);o.material=mat;o.checkCollisions=true;return o;}
function makeStairs(x,zStart,zEnd,dir,mat){const steps=7,depth=Math.abs(zEnd-zStart)/steps;for(let i=0;i<steps;i++){const z=zStart+dir*(i+.5)*depth;const y=-1.15+(i+.5)*(1.15/steps);block("bowl stair",x,y,z,2.2,(i+1)*1.15/steps,depth+.03,mat);}}
function createArena(){
scene=new B.Scene(engine);scene.clearColor=new B.Color4(.055,.075,.09,1);scene.collisionsEnabled=true;scene.gravity=new B.Vector3(0,-18,0);
const sky=new B.HemisphericLight("ambient",new B.Vector3(0,1,0),scene);sky.intensity=.78;sky.groundColor=new B.Color3(.12,.16,.16);
const sun=new B.DirectionalLight("sun",new B.Vector3(-.45,-1,.25),scene);sun.position.set(8,18,-8);sun.intensity=.7;
const ground=material("upper concrete","#465653"),wall=material("outer steel","#263941"),barrier=material("barrier alloy","#52696b"),trim=material("lime trim","#b7f34a",.6,"#273b0c"),tower=material("tower concrete","#63767b"),bowlmat=material("bowl floor","#283b39"),stepmat=material("stair concrete","#53615f"),cover=material("cover","#3c5054");
flat("upper ground",13,13,26,26,0,ground);
// A recessed central bowl, with a low central floor and actual sloped ramps/staircases.
flat("central bowl floor",13,13,10.4,7.4,-1.2,bowlmat);
block("bowl north retaining wall",13,.0,9.05,10.4,2.4,.5,wall);
block("bowl south retaining wall",13,.0,16.95,10.4,2.4,.5,wall);
block("bowl west retaining wall",7.8,.0,13,.5,2.4,7.4,wall);
block("bowl east retaining wall",18.2,.0,13,.5,2.4,7.4,wall);
// Openings in the west/east retaining walls line up with the two stair flights.
for(let i=0;i<7;i++){const z=10.55+i*.72;const y=-1.12+i*.16;block("west stair "+i,7.05,y,z,2.0,.25+i*.02,.78,stepmat);block("east stair "+i,18.95,y,16.0-i*.72,2.0,.25+i*.02,.78,stepmat);}
// Two parallel raised lanes, the Barriers, run along either side of the bowl.
for(const z of [8,18]){block("barrier lane",13,.12,z,16,.24,1.35,barrier);for(let x=6;x<=20;x+=2){if(x===12||x===14)continue;block("lane cover",x,.72,z,1.15,1.0,.42,cover);block("cover stripe",x,1.24,z-.22,.75,.045,.035,trim);}}
 // Symmetrical sniper towers at opposite far map edges, with stairs.
for(const x of [3.2,22.8]){const z=13;block("sniper tower base",x,.45,z,3.2,.9,3.2,tower);block("sniper tower platform",x,3.2,z,4.2,.3,4.2,wall);block("tower parapet",x,3.8,z-1.85,4.2,.9,.25,barrier);block("tower parapet",x,3.8,z+1.85,4.2,.9,.25,barrier);block("tower parapet",x-1.95,3.8,z,.25,.9,3.5,barrier);block("tower parapet",x+1.95,3.8,z,.25,.9,3.5,barrier);for(let i=0;i<9;i++)block("tower stair",x+(x<13?1:-1)*(1.7-i*.18),.18+i*.35,9.1+i*.45,.95,.35,.48,stepmat);}
 // Outer boundary walls and low cover pieces.
block("north perimeter",13,1.4,0,26,2.8,.6,wall);block("south perimeter",13,1.4,26,26,2.8,.6,wall);block("west perimeter",0,1.4,13,.6,2.8,26,wall);block("east perimeter",26,1.4,13,.6,2.8,26,wall);
[[9,5],[13,5],[17,5],[9,21],[13,21],[17,21],[10,13],[16,13]].forEach(([x,z])=>block("field cover",x,.55,z,1.5,1.1,1.1,cover));
// Glowing map labels/markers via simple colored vertical posts at lane ends.
for(const z of [8,18])for(const x of [5.5,20.5])block("lane marker",x,1.1,z,.12,2.2,.12,trim);
camera=new B.UniversalCamera("player camera",new B.Vector3(3.5,1.7,13),scene);camera.attachControl(canvas,true);camera.inertia=0;camera.angularSensibility=2400;camera.speed=0;camera.minZ=.08;camera.fov=Math.PI/2.8;camera.checkCollisions=true;camera.applyGravity=false;camera.ellipsoid=new B.Vector3(.35,.85,.35);camera.ellipsoidOffset=new B.Vector3(0,.8,0);camera.keysUp=[87,38];camera.keysDown=[83,40];camera.keysLeft=[65];camera.keysRight=[68];camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
camera.rotation.set(0,Math.PI/2,0); // looking across the arena from the west side
// A small visible rifle silhouette, parented to the camera.
const gunMat=material("rifle body","#18252c"),gunAccent=material("rifle accent","#b7f34a",.4,"#334a11");
const gun=B.MeshBuilder.CreateBox("rifle receiver",{width:.22,height:.17,depth:.65},scene);gun.material=gunMat;gun.parent=camera;gun.position.set(.34,-.29,.62);
const barrelMesh=B.MeshBuilder.CreateCylinder("rifle barrel",{height:.48,diameter:.055},scene);barrelMesh.rotation.x=Math.PI/2;barrelMesh.material=gunAccent;barrelMesh.parent=camera;barrelMesh.position.set(.34,-.25,.23);
const sight=B.MeshBuilder.CreateBox("rifle sight",{width:.07,height:.06,depth:.12},scene);sight.material=gunAccent;sight.parent=camera;sight.position.set(.34,-.17,.55);
createTargets();return scene;
}
function createTargets(){targets=[];const spots=[[8.5,1.1,10.5],[11.5,1.1,13.2],[14.5,1.1,12],[17.5,1.1,10.5],[18,1.1,15.3]];spots.forEach((v,i)=>{const root=new B.TransformNode("drone root "+i,scene);root.position.set(v[0],v[1],v[2]);const body=B.MeshBuilder.CreateSphere("drone body",{diameter:.75,segments:8},scene);body.parent=root;body.material=material("drone shell "+i,"#52666a");const eye=B.MeshBuilder.CreateBox("drone eye",{width:.38,height:.08,depth:.08},scene);eye.parent=root;eye.position.z=-.34;eye.material=material("drone eye glow "+i,"#b7f34a",.4,"#b7f34a");const ring=B.MeshBuilder.CreateTorus("drone ring",{diameter:1.05,thickness:.045,tessellation:12},scene);ring.parent=root;ring.rotation.x=Math.PI/2;ring.material=material("drone ring mat "+i,"#b7f34a",.4,"#273b0c");targets.push({root,alive:true,hp:2,phase:i*1.2,baseY:v[1]});});}
function showToast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),1300);}
function syncHUD(){$("health").textContent=health;$("hpbar").style.width=health+"%";$("ammo").textContent=ammo;$("objective").textContent="Eliminate training drones · "+kills+" / 5";}
function resetGame(){health=100;ammo=30;kills=0;reloading=false;reloadTimer=0;fireCooldown=0;camera.position.set(3.5,1.7,13);camera.rotation.set(0,Math.PI/2,0);jumpVelocity=0;onGround=true;targets.forEach((t,i)=>{t.alive=true;t.hp=2;t.root.setEnabled(true);});syncHUD();}
function startGame(){started=true;paused=false;$("intro").classList.add("hide");$("pausemenu").classList.add("hide");canvas.focus();if(canvas.requestPointerLock)canvas.requestPointerLock();}
function togglePause(){if(!started)return;paused=!paused;$("pausemenu").classList.toggle("hide",!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&canvas.requestPointerLock)canvas.requestPointerLock();}
function endGame(win){paused=true;$("endtitle").textContent=win?"TEST COMPLETE":"OPERATOR DOWN";$("endcopy").textContent=win?"All five training drones eliminated. Arena clear.":"You were tagged out during testing. Reset and try again.";$("endmenu").classList.remove("hide");if(document.pointerLockElement)document.exitPointerLock();}
function leave(){if(document.pointerLockElement)document.exitPointerLock();location.href="index.html";}
function shoot(){if(!started||paused||reloading||fireCooldown>0)return;if(ammo<=0){showToast("EMPTY MAGAZINE — PRESS R");return;}ammo--;fireCooldown=.12;syncHUD();const ray=new B.Ray(camera.position,camera.getForwardRay().direction,80);const pick=scene.pickWithRay(ray,m=>targets.some(t=>t.alive&&(m===t.root||m.parent===t.root)));if(pick&&pick.hit&&pick.pickedMesh){const target=targets.find(t=>t.alive&&(pick.pickedMesh===t.root||pick.pickedMesh.parent===t.root));if(target){target.hp--;if(target.hp<=0){target.alive=false;target.root.setEnabled(false);kills++;syncHUD();showToast("DRONE ELIMINATED");if(kills===5)endGame(true);}else showToast("TARGET HIT");}}}
function reload(){if(!started||paused||reloading||ammo===30)return;reloading=true;reloadTimer=1.15;showToast("RELOADING…");}
function update(dt){if(!started||paused)return;fireCooldown=Math.max(0,fireCooldown-dt);if(reloading){reloadTimer-=dt;if(reloadTimer<=0){ammo=30;reloading=false;syncHUD();showToast("MAGAZINE RELOADED");}}
let forward=0,right=0;if(keys.KeyW||keys.ArrowUp)forward++;if(keys.KeyS||keys.ArrowDown)forward--;if(keys.KeyD)right++;if(keys.KeyA)right--;const len=Math.hypot(forward,right)||1;forward/=len;right/=len;
const yaw=camera.rotation.y;const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*MOVE_SPEED*dt;const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*right)*MOVE_SPEED*dt;
const old=camera.position.clone();camera.position.x+=dx;camera.position.z+=dz;
if(camera.position.x<1||camera.position.x>25||camera.position.z<1||camera.position.z>25||scene.meshes.some(m=>m.checkCollisions&&m.isEnabled()&&m.getBoundingInfo&&m.name!=="player camera"&&m.intersectsPoint(new B.Vector3(camera.position.x,camera.position.y-.7,camera.position.z)))){camera.position.x=old.x;camera.position.z=old.z;}
if(keys.Space&&onGround){jumpVelocity=6.5;onGround=false;keys.Space=false;}if(!onGround||camera.position.y>1.7){jumpVelocity-=18*dt;camera.position.y+=jumpVelocity*dt;if(camera.position.y<=1.7){camera.position.y=1.7;jumpVelocity=0;onGround=true;}}
targets.forEach(t=>{if(t.alive){t.root.position.y=t.baseY+Math.sin(performance.now()*.002+t.phase)*.12;t.root.rotation.y+=dt*.5;if(Math.random()<dt*.012){health=Math.max(0,health-1);syncHUD();if(health===0)endGame(false);}}});
}
function loop(){const now=performance.now();const dt=Math.min(.04,(now-lastTime)/1000||.016);lastTime=now;if(scene){update(dt);scene.render();} }
try{createArena();resetGame();engine.runRenderLoop(loop);window.addEventListener("resize",()=>engine.resize());}catch(e){console.error(e);$("engine-error").classList.remove("hide");}
canvas.addEventListener("click",()=>{if(!started)startGame();else if(!paused){if(document.pointerLockElement===canvas)shoot();else canvas.requestPointerLock?.();}});
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas&&started&&!paused){camera.rotation.y+=e.movementX*.0023;camera.rotation.x+=e.movementY*.0023;camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x));}});
document.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();if(e.code==="Escape"&&started)togglePause();if(e.code==="KeyR")reload();});
document.addEventListener("keyup",e=>{keys[e.code]=false;});
$("start").addEventListener("click",startGame);$("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);$("exit").addEventListener("click",leave);$("exit2").addEventListener("click",leave);$("exit3").addEventListener("click",leave);$("reload").addEventListener("click",reload);$("again").addEventListener("click",()=>{resetGame();$("endmenu").classList.add("hide");$("intro").classList.remove("hide");started=false;paused=false;});
})();