/* AtlasVR: one state and one set of actions for mouse and physical VR controllers. */
'use strict';
const $=s=>document.querySelector(s);
const T=AFRAME.THREE;
const state={parts:[],selected:null,hovered:null,revealed:false,names:false,isolated:false,page:0,tab:'pieces',ready:false,dragged:false};
const entities=new Map(),groups={ossos:'Ossos',encefalo:'Encéfalo',olhos:'Olhos'};
const model=$('#model'),scene=$('#scene');
let callouts=null;
const neutral=p=>`Peça ${String(state.parts.indexOf(p)+1).padStart(2,'0')}`;
const label=p=>state.names?p.name_pt:neutral(p);
const selected=()=>state.parts.find(p=>p.id===state.selected);
const isVisible=p=>p.visible&&(!state.isolated||p.id===state.selected);
const actions=[['yaw-','Girar ←'],['yaw+','Girar →'],['pitch-','Inclinar ↑'],['pitch+','Inclinar ↓'],['scale+','Ampliar +'],['scale-','Reduzir −'],['x-','Mover ←'],['x+','Mover →'],['y+','Subir ↑'],['y-','Descer ↓'],['z+','Aproximar'],['z-','Afastar']];
function resetTransform(){model.object3D.position.set(0,1.5,-1.5);model.object3D.rotation.set(0,0,0);model.object3D.scale.setScalar(3);}
function select(id){if(!state.ready||state.dragged)return;state.selected=id;state.revealed=false;refresh();const row=$(`[data-id="${id}"]`);if(row&&innerWidth>700)row.scrollIntoView({block:'nearest'});}
function action(a){
 if(!state.ready)return;
 const p=selected(),o=model.object3D;
 if(a.startsWith('group:')){const g=a.split(':')[1],ps=state.parts.filter(x=>x.group===g),show=!ps.every(isVisible);state.isolated=false;ps.forEach(x=>x.visible=show);}
 else if(a.startsWith('piece:')){const q=state.parts.find(x=>x.id===a.split(':')[1]);state.isolated=false;q.visible=!q.visible;}
 else if(a.startsWith('select:'))return select(a.split(':')[1]);
 else if(a==='reveal'&&p)state.revealed=!state.revealed;
 else if(a==='names')state.names=!state.names;
 else if(a==='deselect'){state.selected=null;state.revealed=false;state.isolated=false;}
 else if(a.startsWith('view:')){o.rotation.set(0,{front:0,left:Math.PI/2,back:Math.PI}[a.split(':')[1]],0);}
 else if(a==='hide'&&p){state.isolated=false;p.visible=!p.visible;}
 else if(a==='isolate'&&p){p.visible=true;state.isolated=!state.isolated;}
 else if(a==='restore'){state.parts.forEach(x=>x.visible=true);Object.assign(state,{selected:null,hovered:null,revealed:false,names:false,isolated:false,page:0,tab:'pieces'});$('#parts').scrollTop=0;resetTransform();$('#move-controls').hidden=true;$('#move-toggle').setAttribute('aria-expanded','false');}
 else if(a==='tab')state.tab=state.tab==='pieces'?'move':'pieces';
 else if(a==='prev')state.page=Math.max(0,state.page-1);
 else if(a==='next')state.page=Math.min(Math.ceil(state.parts.length/5)-1,state.page+1);
 else if(a.startsWith('yaw'))o.rotation.y+=a.endsWith('+')?.18:-.18;
 else if(a.startsWith('pitch'))o.rotation.x=T.MathUtils.clamp(o.rotation.x+(a.endsWith('+')?.15:-.15),-1.2,1.2);
 else if(a.startsWith('scale'))o.scale.setScalar(T.MathUtils.clamp(o.scale.x*(a.endsWith('+')?1.12:1/1.12),.7,5));
 else if(/^[xyz][+-]$/.test(a)){const axis=a[0];o.position[axis]+=(a[1]==='+'?.08:-.08);clampPosition();}
 refresh();
}
function clampPosition(){const p=model.object3D.position;p.x=T.MathUtils.clamp(p.x,-.55,.55);p.y=T.MathUtils.clamp(p.y,.75,2.15);p.z=T.MathUtils.clamp(p.z,-2.6,-.95);}
function selectionText(){const p=selected();return !p?'Nenhuma peça selecionada':(state.names||state.revealed?p.name_pt:'Peça selecionada · nome oculto');}
function refresh(){
 for(const p of state.parts){const el=entities.get(p.id);if(!el)continue;el.object3D.visible=isVisible(p);el.classList.toggle('pickable',isVisible(p));}
 paint();
 $('#selection').textContent=selectionText();
 document.body.classList.toggle('has-selection',!!selected());
 $('#selection-meta').textContent=selected()?`${groups[selected().group]} · ${isVisible(selected())?'Visível':'Oculta'}${state.isolated?' · Isolamento ativo':''}`:'Clique em uma estrutura ou escolha na lista.';
 $('#view-title').textContent=state.isolated?'Explorando a seleção':state.names?'Identificação das estruturas':'Explore as estruturas';
 for(const b of document.querySelectorAll('button[data-action]')){
  const a=b.dataset.action;b.disabled=!state.ready||(['reveal','hide','isolate','deselect'].includes(a)&&!selected());
  if(a==='names'){b.textContent=state.names?'Ocultar nomes':'Mostrar nomes';b.setAttribute('aria-pressed',state.names);}
  if(a==='reveal')b.textContent=state.revealed?'Ocultar nome selecionado':'Revelar nome';
  if(a==='hide')b.textContent=selected()&&!selected().visible?'Mostrar seleção':'Ocultar seleção';
  if(a==='isolate'){b.textContent=state.isolated?'Sair do isolamento':'Isolar seleção';b.setAttribute('aria-pressed',state.isolated);}
  if(a.startsWith('group:')){const ps=state.parts.filter(p=>p.group===a.split(':')[1]);b.setAttribute('aria-pressed',ps.every(isVisible));b.dataset.count=`${ps.filter(isVisible).length} / ${ps.length}`;}
 }
 for(const p of state.parts){const row=$(`[data-id="${p.id}"]`);if(row){row.querySelector('.pick').textContent=label(p);row.querySelector('.pick').setAttribute('aria-pressed',state.selected===p.id);const eye=row.querySelector('.eye');eye.textContent=isVisible(p)?'●':'○';eye.setAttribute('aria-label',`${isVisible(p)?'Ocultar':'Mostrar'} ${label(p)}`);eye.setAttribute('aria-pressed',isVisible(p));}}
 updateVR();
 document.querySelectorAll('[raycaster]').forEach(e=>e.components.raycaster?.refreshObjects());
 $('#metrics').textContent=`${state.parts.filter(isVisible).length}/${state.parts.length} peças · ${model.object3D.scale.x.toFixed(1)}×`;
 $('#scale-readout').textContent=model.object3D.scale.x.toFixed(1).replace('.',',')+'×';
 callouts?.invalidate();
}
function paint(){for(const p of state.parts){const el=entities.get(p.id);if(!el)continue;el.getObject3D('mesh').traverse(n=>{if(n.isMesh){const chosen=p.id===state.selected,hover=p.id===state.hovered;n.material.emissive.set(chosen?'#25bda3':hover?'#668b80':'#000000');n.material.emissiveIntensity=chosen?.45:hover?.16:0;}});}}
function htmlButton(text,a){const b=document.createElement('button');b.textContent=text;b.dataset.action=a;b.addEventListener('click',()=>action(a));return b;}
function buildDesktop(){
 for(const [g,n]of Object.entries(groups))$('#groups').append(htmlButton(n,'group:'+g));
 for(const p of state.parts){const row=document.createElement('div');row.className='part';row.dataset.id=p.id;row.setAttribute('role','listitem');const b=htmlButton(label(p),'select:'+p.id);b.className='pick';b.dataset.number=String(state.parts.indexOf(p)+1).padStart(2,'0');const v=htmlButton('●','piece:'+p.id);v.className='eye';row.append(b,v);row.addEventListener('mouseenter',()=>{state.hovered=p.id;paint();});row.addEventListener('mouseleave',()=>{state.hovered=null;paint();});$('#parts').append(row);}
}
// Canvas textures keep accented Portuguese text independent of external font downloads.
function panelPlane(parent,w,h,y,text,a){
 const el=document.createElement('a-entity');el.setAttribute('position',`0 ${y} 0`);
 if(a){el.classList.add('vr-button');el.addEventListener('click',e=>{e.stopPropagation();action(el.dataset.action);});el.dataset.action=a;}
 parent.append(el);const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false});
 el.setObject3D('mesh',new T.Mesh(new T.PlaneGeometry(w,h),material));
 el._draw=(lines,active=false)=>{const c=canvas.getContext('2d');c.fillStyle=active?'#235852':'#203541';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle=active?'#81f5d4':'#4d6978';c.lineWidth=5;c.strokeRect(3,3,canvas.width-6,canvas.height-6);c.fillStyle='#f0f8fa';c.textAlign='center';c.textBaseline='middle';const arr=String(lines).split('\n');c.font=`${arr.length>1?37:42}px Segoe UI, Arial`;arr.forEach((s,i)=>c.fillText(s,512,canvas.height/2+(i-(arr.length-1)/2)*48,970));texture.needsUpdate=true;};el._draw(text);return el;
}
let vr={};
function buildVR(){
 const l=$('#vr-left'),r=$('#vr-right');
 vr.title=panelPlane(l,.7,.11,.49,'AtlasVR · protótipo técnico\nConteúdo não validado para ensino');
 vr.status=panelPlane(l,.7,.09,.38,'Nenhuma peça selecionada');
 vr.left=[];
 const la=[['group:ossos','Ossos'],['group:encefalo','Encéfalo'],['group:olhos','Olhos'],['reveal','Revelar nome'],['names','Mostrar nomes'],['hide','Ocultar seleção'],['isolate','Isolar seleção'],['restore','Restaurar cena']];
 la.forEach(([a,t],i)=>vr.left.push(panelPlane(l,.7,.072,.28-i*.083,t,a)));
 vr.help=panelPlane(l,.7,.105,-.46,'Aponte com o controle e use o gatilho.\nO modelo se move; você permanece no lugar.');
 vr.tab=panelPlane(r,.7,.078,.49,'Peças | abrir posição e escala','tab');
 vr.rows=[];for(let i=0;i<12;i++)vr.rows.push(panelPlane(r,.7,.068,.39-i*.078,'—','next'));
 vr.credit=panelPlane(r,.7,.11,-.62,'BodyParts3D © DBCLS · CC BY 4.0\nNomes propostos, não validados');
}
function updateVR(){
 if(!vr.status)return;vr.status._draw(selectionText());
 const p=selected();
 for(const el of vr.left){let a=el.dataset.action,txt='',on=false;
  if(a.startsWith('group:')){const g=a.split(':')[1];on=state.parts.filter(p=>p.group===g).every(isVisible);txt=(on?'● ':'○ ')+groups[g];}
  if(a==='reveal')txt=state.revealed?'Ocultar nome selecionado':'Revelar nome selecionado';
  if(a==='names'){on=state.names;txt=state.names?'Ocultar nomes':'Mostrar nomes';}
  if(a==='hide')txt=p&&!p.visible?'Mostrar seleção':'Ocultar seleção';
  if(a==='isolate'){on=state.isolated;txt=on?'Sair do isolamento':'Isolar seleção';}
  if(a==='restore')txt='Restaurar cena';el._draw(txt,on);
 }
 vr.tab._draw(state.tab==='pieces'?'Peças  |  abrir posição e escala':'Posição e escala  |  abrir peças');
 vr.rows.forEach((el,i)=>{
  el.object3D.visible=true;el.classList.add('vr-button');
  if(state.tab==='move'){el.dataset.action=actions[i][0];el._draw(actions[i][1]);return;}
  if(i<10){const p=state.parts[state.page*5+Math.floor(i/2)];if(!p){el.object3D.visible=false;el.classList.remove('vr-button');return;}el.dataset.action=(i%2?'piece:':'select:')+p.id;el._draw(i%2?(isVisible(p)?'● Ocultar peça':'○ Mostrar peça'):label(p),i%2?isVisible(p):state.selected===p.id);}
  else{el.dataset.action=i===10?'prev':'next';el._draw(i===10?`← Anterior · ${state.page+1}/${Math.ceil(state.parts.length/5)}`:'Próxima →');}
 });
}
async function init(){
 try{
  const res=await fetch('parts.json');if(!res.ok)throw Error('Catálogo indisponível');const manifest=await res.json();state.parts=manifest.parts.map(p=>({...p,visible:true}));
  const loader=new T.GLTFLoader();const gltf=await loader.loadAsync('models/cabeca.glb');gltf.scene.updateMatrixWorld(true);
  for(const p of state.parts){const source=gltf.scene.getObjectByName(p.id);if(!source)throw Error('Peça ausente: '+p.id);const mesh=source.clone(true);source.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.side=T.DoubleSide;if(n.material.transparent)n.material.depthWrite=false;}});const el=document.createElement('a-entity');el.id=p.id;el.classList.add('pickable');model.append(el);el.setObject3D('mesh',mesh);el.addEventListener('click',()=>select(p.id));el.addEventListener('mouseenter',()=>{state.hovered=p.id;paint();});el.addEventListener('mouseleave',()=>{if(state.hovered===p.id){state.hovered=null;paint();}});entities.set(p.id,el);}
  state.ready=true;buildDesktop();buildVR();refresh();$('#status').textContent=`${state.parts.length} peças carregadas · pronto para explorar`;
  window.atlas={state,entities,action,select,model,manifest,isVisible,selectionText};
  callouts=new window.AtlasLabels(window.atlas);window.atlas.callouts=callouts;
  setupMouse();setupXR();
  if(new URLSearchParams(location.search).has('panels')){
   $('#vr-left').setAttribute('visible',true);$('#vr-right').setAttribute('visible',true);
   $('#camera').setAttribute('camera','fov',88);$('#mouse').setAttribute('raycaster','objects','.pickable, .vr-button');
   $('#status').textContent='Inspeção de painéis em tela — não é teste no headset';
  }
  if(new URLSearchParams(location.search).has('test')){const s=document.createElement('script');s.src='self-test.js';document.body.append(s);}
 }catch(e){$('#status').textContent='Falha ao carregar: '+e.message;console.error(e);}
}
function setupMouse(){
 const canvas=scene.canvas;let start=null;
 canvas.addEventListener('pointerdown',e=>{if(scene.is('vr-mode')||e.button!==0)return;state.dragged=false;start={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};});
 window.addEventListener('pointermove',e=>{if(!start||scene.is('vr-mode'))return;const dx=e.clientX-start.lastX,dy=e.clientY-start.lastY;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)state.dragged=true;if(state.dragged){if(e.shiftKey){model.object3D.position.x+=dx*.0015;model.object3D.position.y-=dy*.0015;clampPosition();}else{model.object3D.rotation.y+=dx*.008;model.object3D.rotation.x=T.MathUtils.clamp(model.object3D.rotation.x+dy*.008,-1.2,1.2);}}start.lastX=e.clientX;start.lastY=e.clientY;});
 window.addEventListener('pointerup',()=>{start=null;setTimeout(()=>state.dragged=false,60);});
 window.addEventListener('pointercancel',()=>{start=null;state.dragged=false;});
 canvas.addEventListener('wheel',e=>{if(scene.is('vr-mode'))return;e.preventDefault();action(e.deltaY<0?'scale+':'scale-');},{passive:false});
}
async function setupXR(){
 const button=$('#enter-vr');let available=false;try{available=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch{}
 button.disabled=!available;$('#xr-status').textContent=available?'VR disponível. No Quest, use os controles físicos.':'Abra este endereço HTTPS no navegador do Quest para entrar em VR.';
 button.addEventListener('click',async()=>{try{await scene.enterVR();}catch(e){$('#xr-status').textContent='Não foi possível entrar em VR: '+e.message;}});
 scene.addEventListener('enter-vr',()=>{document.body.classList.add('immersive');$('#camera').setAttribute('look-controls','enabled',true);$('#mouse').setAttribute('raycaster','enabled',false);$('#vr-left').setAttribute('visible',true);$('#vr-right').setAttribute('visible',true);resetTransform();refresh();});
 scene.addEventListener('exit-vr',()=>{document.body.classList.remove('immersive');$('#camera').setAttribute('look-controls','enabled',false);$('#camera').object3D.rotation.set(0,0,0);$('#mouse').setAttribute('raycaster','enabled',true);$('#vr-left').setAttribute('visible',false);$('#vr-right').setAttribute('visible',false);});
}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
$('#move-toggle').addEventListener('click',()=>{const p=$('#move-controls');p.hidden=!p.hidden;$('#move-toggle').setAttribute('aria-expanded',!p.hidden);});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||scene.is('vr-mode'))return;const keys={n:'names',r:'restore',i:'isolate',h:'hide',Escape:'deselect',ArrowLeft:'yaw-',ArrowRight:'yaw+',ArrowUp:'pitch-',ArrowDown:'pitch+','+':'scale+','=':'scale+','-':'scale-'};if(keys[e.key]){e.preventDefault();action(keys[e.key]);}});
if(scene.hasLoaded)init();else scene.addEventListener('loaded',init,{once:true});
