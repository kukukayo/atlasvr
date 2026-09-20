/* Geometry-backed callouts. SVG on a monitor; camera-facing planes/lines in XR.
   Candidate anchors are source vertices. A visibility ray prevents labels through
   covering pieces. Recompute at most 5 Hz and only after view/state changes. */
window.AtlasLabels=class{
 constructor(api){
  this.api=api;this.T=AFRAME.THREE;this.scene=document.querySelector('a-scene');this.svg=document.querySelector('#callouts');
  this.root=new this.T.Group();this.scene.object3D.add(this.root);this.root.visible=false;
  this.entries=[];this.ray=new this.T.Raycaster();this.lastKey='';this.next=0;this.lastDuration=0;this.drawn=0;
  const ns='http://www.w3.org/2000/svg';
  for(const p of api.state.parts){
   const el=api.entities.get(p.id),mesh=el.getObject3D('mesh'),samples=[];
   mesh.updateMatrixWorld(true);
   const box=new this.T.Box3();mesh.traverse(n=>{if(n.isMesh){n.userData.atlasPart=p.id;const a=n.geometry.attributes.position;
    for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/36))){const v=new this.T.Vector3().fromBufferAttribute(a,i);n.localToWorld(v);api.model.object3D.worldToLocal(v);samples.push(v);box.expandByPoint(v);}
   }});
   const g=document.createElementNS(ns,'g');g.classList.add('callout');g.dataset.part=p.id;
   const path=document.createElementNS(ns,'path'),circle=document.createElementNS(ns,'circle'),rect=document.createElementNS(ns,'rect'),text=document.createElementNS(ns,'text');circle.setAttribute('r',3);rect.setAttribute('rx',5);g.append(path,circle,rect,text);this.svg.append(g);
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=170;const ctx=canvas.getContext('2d');
   const texture=new this.T.CanvasTexture(canvas);texture.colorSpace=this.T.SRGBColorSpace;
   const material=new this.T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,side:this.T.DoubleSide,toneMapped:false});
   const card=new this.T.Mesh(new this.T.PlaneGeometry(.42,.07),material);card.renderOrder=20;this.root.add(card);
   const line=new this.T.Line(new this.T.BufferGeometry().setFromPoints([new this.T.Vector3(),new this.T.Vector3(),new this.T.Vector3()]),new this.T.LineBasicMaterial({color:0xa8d8d0,depthTest:false,transparent:true,opacity:.8}));line.renderOrder=19;this.root.add(line);
   this.entries.push({p,el,samples,center:box.getCenter(new this.T.Vector3()),g,path,circle,rect,text,canvas,ctx,texture,card,line});
  }
  this.scene.addEventListener('exit-vr',()=>this.invalidate());
  const loop=t=>{if(t>=this.next){this.next=t+200;this.update();}this.frame=requestAnimationFrame(loop);};this.frame=requestAnimationFrame(loop);
 }
 invalidate(){this.lastKey='';}
 hide(){for(const e of this.entries){e.g.style.display='none';e.card.visible=false;e.line.visible=false;}this.drawn=0;document.querySelector('#label-hint').textContent='';}
 update(force=false){
  const began=performance.now(),{state,model,isVisible}=this.api,T=this.T;
  if(!state.names&&!state.revealed){this.hide();return;}
  const xr=this.scene.is('vr-mode')||new URLSearchParams(location.search).has('labels3d'),camera=this.scene.camera,view=this.scene.canvas.getBoundingClientRect();if(!camera||!view.width||!view.height)return;
  const pos=new T.Vector3(),quat=new T.Quaternion();camera.getWorldPosition(pos);camera.getWorldQuaternion(quat);model.object3D.updateMatrixWorld(true);
  const key=[xr,view.width,view.height,state.names,state.revealed,state.selected,...model.object3D.matrixWorld.elements.map(x=>x.toFixed(3)),...pos.toArray().map(x=>x.toFixed(2)),...quat.toArray().map(x=>x.toFixed(2)),...state.parts.map(p=>+isVisible(p))].join('|');
  if(!force&&key===this.lastKey)return;this.lastKey=key;this.hide();this.root.visible=xr;
  const center=model.object3D.getWorldPosition(new T.Vector3()),mid=center.clone().project(camera),cx=(mid.x*.5+.5)*view.width;
  const pickables=this.entries.filter(e=>isVisible(e.p)).map(e=>e.el.object3D),candidates=[];
  for(const e of this.entries){
   if(!isVisible(e.p)||(!state.names&&!(state.revealed&&e.p.id===state.selected)))continue;
   // Surface vertex near the screen-space center, biased toward the viewer.
   const pc=e.center.clone();model.object3D.localToWorld(pc);const projected=pc.clone().project(camera);let best,score=Infinity;
   for(const sample of e.samples){const world=sample.clone();model.object3D.localToWorld(world);const v=world.clone().project(camera);if(v.z<-1||v.z>1)continue;const cost=Math.hypot(v.x-projected.x,v.y-projected.y)*2+world.distanceTo(pos)*.24;if(cost<score){best=world;score=cost;}}
   if(!best)continue;
   const dir=best.clone().sub(pos).normalize();this.ray.set(pos,dir);this.ray.far=best.distanceTo(pos)+.025;
   const hit=this.ray.intersectObjects(pickables,true)[0];const exposed=hit?.object.userData.atlasPart===e.p.id;
   if(!exposed&&e.p.id!==state.selected)continue;
   const anchor=exposed?hit.point:best,screen=anchor.clone().project(camera);
   if(screen.z<-1||screen.z>1||Math.abs(screen.x)>1.12||Math.abs(screen.y)>1.1)continue;
   candidates.push({e,anchor,x:(screen.x*.5+.5)*view.width,y:(-.5*screen.y+.5)*view.height,occluded:!exposed,side:screen.x<mid.x?-1:1});
  }
  const max=xr?6:(view.width<520?6:12);
  candidates.sort((a,b)=>(b.e.p.id===state.selected)-(a.e.p.id===state.selected)||b.e.p.triangles-a.e.p.triangles);
  const shown=candidates.slice(0,max),columns=[shown.filter(c=>c.side<0),shown.filter(c=>c.side>0)];
  this.svg.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);
  const right=new T.Vector3(1,0,0).applyQuaternion(quat),up=new T.Vector3(0,1,0).applyQuaternion(quat);
  columns.forEach((col,index)=>{
   col.sort((a,b)=>a.y-b.y);const side=index===0?-1:1;
   const gap=31,top=107,bottom=Math.max(top,view.height-(view.width<520?190:184));
   const fit=col.slice(0,Math.max(1,Math.floor((bottom-top)/gap)+1));
   let previous=top-gap;
   fit.forEach((c,i)=>{
    const e=c.e,active=e.p.id===state.selected;this.drawn++;
    if(xr){
     const endpoint=center.clone().addScaledVector(right,side*.54).addScaledVector(up,((fit.length-1)/2-i)*.09);
     e.card.position.copy(endpoint);e.card.quaternion.copy(quat);e.card.visible=true;
     const edge=endpoint.clone().addScaledVector(right,-side*.22),knee=edge.clone().addScaledVector(right,-side*.07);
     const a=e.line.geometry.attributes.position;[c.anchor,knee,edge].forEach((v,j)=>a.setXYZ(j,v.x,v.y,v.z));a.needsUpdate=true;e.line.geometry.computeBoundingSphere();e.line.visible=true;
     const ctx=e.ctx;ctx.clearRect(0,0,1024,170);ctx.fillStyle=active?'#21483f':'#14252ef2';ctx.fillRect(0,0,1024,170);ctx.strokeStyle=active?'#8aedc9':'#74919d';ctx.lineWidth=6;ctx.strokeRect(3,3,1018,164);ctx.fillStyle='#e4f5f2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='46px Segoe UI, Arial';
     const words=e.p.name_pt.split(' ');let lines=[''];words.forEach(w=>{let n=lines.length-1;if(ctx.measureText(lines[n]+' '+w).width>920)lines.push(w);else lines[n]+=(lines[n]?' ':'')+w;});lines.slice(0,2).forEach((l,j)=>ctx.fillText(l,512,85+(j-(Math.min(lines.length,2)-1)/2)*54));e.texture.needsUpdate=true;
    }else{
     const width=Math.min(192,Math.max(128,view.width*.27)),x=side<0?15:view.width-width-15;
     const y=Math.max(previous+gap,Math.min(c.y,bottom-(fit.length-1-i)*gap));previous=y;
     const edge=side<0?x+width:x,knee=edge-side*12;
     e.path.setAttribute('d',`M${c.x.toFixed(1)},${c.y.toFixed(1)} L${knee},${y} L${edge},${y}`);
     e.circle.setAttribute('cx',c.x);e.circle.setAttribute('cy',c.y);e.rect.setAttribute('x',x);e.rect.setAttribute('y',y-13);e.rect.setAttribute('width',width);e.rect.setAttribute('height',26);
     e.text.setAttribute('x',x+9);e.text.setAttribute('y',y+4);e.text.textContent=e.p.name_pt;
     // Fit long names without truncating the anatomical name.
     const needed=e.p.name_pt.length*5.7;e.text.setAttribute('font-size',Math.min(11,(width-18)/needed*11));e.text.style.fontSize=`${Math.min(11,(width-18)/needed*11)}px`;
     e.g.classList.toggle('selected',active);e.g.classList.toggle('occluded',c.occluded);e.g.style.display='';
    }
   });
  });
  if(!xr)document.querySelector('#label-hint').textContent=state.names?`${this.drawn} nomes nesta vista · gire ou oculte grupos para ver outras estruturas`:(this.drawn?'Nome revelado · linha ligada à peça selecionada':'');
  this.lastDuration=performance.now()-began;
 }
};
