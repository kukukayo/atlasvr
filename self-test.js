/* Opt-in desktop regression suite: real loaded GLB, same actions as both interfaces. */
(()=>{
 const a=window.atlas,s=a.state,results=[];
 function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
 function ok(v,msg){if(!v)throw Error(msg);}
 const p=s.parts[0];
 test('Todas as representações carregadas',()=>ok(a.entities.size===s.parts.length&&s.parts.length>=23,'peças ausentes'));
 test('Seleção destaca sem revelar nome',()=>{a.action('restore');a.select(p.id);ok(!s.revealed&&!s.names&&a.selectionText().includes('oculto'),'nome revelado');const m=a.entities.get(p.id).getObject3D('mesh');let highlighted=false;m.traverse(n=>{if(n.isMesh)highlighted=n.material.emissiveIntensity>0;});ok(highlighted,'sem destaque');});
 test('Revelar e ocultar nome',()=>{a.action('reveal');ok(a.selectionText()===p.name_pt,'revelação falhou');a.action('reveal');ok(!a.selectionText().includes(p.name_pt),'nome não ocultado');});
 test('Nova seleção limpa revelação anterior',()=>{a.action('reveal');a.select(s.parts[1].id);ok(!s.revealed,'vazamento de nome');});
 test('Nomes globais podem ser ocultados',()=>{a.action('names');ok(s.names,'nomes desligados');a.action('names');ok(!s.names,'nomes ligados');});
 test('Ocultar grupo remove alvos de seleção',()=>{a.action('restore');a.action('group:ossos');ok(s.parts.filter(x=>x.group==='ossos').every(x=>!a.isVisible(x)&&!a.entities.get(x.id).classList.contains('pickable')),'ossos selecionáveis');a.action('group:ossos');});
 test('Ocultar e mostrar peça',()=>{a.select(p.id);a.action('hide');ok(!a.isVisible(p),'visível');a.action('hide');ok(a.isVisible(p),'oculta');});
 test('Isolar seleção e sair sem perder visibilidade',()=>{a.action('isolate');ok(s.parts.filter(a.isVisible).length===1,'isolamento falhou');a.action('isolate');ok(s.parts.every(a.isVisible),'restauração de isolamento falhou');});
 test('Transformações movem modelo e mantêm câmera',()=>{const cam=document.querySelector('#camera').object3D,old=cam.position.clone();a.action('yaw+');a.action('pitch+');a.action('scale+');a.action('x+');a.action('y+');a.action('z+');ok(a.model.object3D.rotation.y>0&&a.model.object3D.scale.x>3&&a.model.object3D.position.x>0,'transformação falhou');ok(cam.position.equals(old),'câmera se moveu');});
 test('Limites de escala e distância',()=>{for(let i=0;i<80;i++){a.action('scale+');a.action('z+');}ok(a.model.object3D.scale.x<=5&&a.model.object3D.position.z<=-.95,'limites ultrapassados');});
 test('Painéis VR têm ações e paginação',()=>{ok(document.querySelectorAll('.vr-button').length>=20,'painéis incompletos');a.action('next');ok(s.page===1,'paginação falhou');a.action('tab');ok(s.tab==='move','transformações VR inacessíveis');a.action('tab');});
 test('Painéis usam texturas de texto válidas',()=>{for(const el of document.querySelectorAll('.vr-button')){const m=el.getObject3D('mesh');ok(m.material.map?.image instanceof HTMLCanvasElement,'painel sem textura de texto');}});
 test('Restaurar limpa nomes, seleção, isolamento e transformação',()=>{a.action('restore');ok(s.selected===null&&!s.names&&!s.revealed&&!s.isolated&&s.parts.every(a.isVisible),'estado residual');ok(a.model.object3D.scale.x===3&&a.model.object3D.position.z===-1.5&&a.model.object3D.rotation.y===0,'transformação residual');});
 test('Linhas e nomes aparecem apenas quando solicitados',()=>{a.callouts.update(true);ok(a.callouts.drawn===0,'nomes vazaram');a.action('names');a.callouts.update(true);ok(a.callouts.drawn>0&&a.callouts.drawn<=12,'rótulos ausentes ou excessivos');ok([...document.querySelectorAll('.callout')].some(e=>e.style.display!=='none'&&e.querySelector('path').getAttribute('d')),'linhas ausentes');});
 test('Rótulos acompanham vista e respeitam grupos ocultos',()=>{a.action('view:left');a.callouts.update(true);ok(a.callouts.drawn>0,'vista lateral sem rótulos');a.action('group:ossos');a.callouts.update(true);ok(a.callouts.entries.filter(e=>e.p.group==='ossos').every(e=>e.g.style.display==='none'),'rótulo de osso oculto');});
 test('Nome selecionado é revelado por linha e pode ser limpo',()=>{a.action('restore');a.select(p.id);a.action('reveal');a.callouts.update(true);ok(a.callouts.drawn===1,'revelação individual falhou');a.action('deselect');a.callouts.update(true);ok(!s.selected&&a.callouts.drawn===0,'rótulo residual');});
 test('Olhos preservam múltiplos materiais',()=>{for(const p of s.parts.filter(p=>p.group==='olhos')){const mats=new Set();a.entities.get(p.id).getObject3D('mesh').traverse(n=>{if(n.isMesh)mats.add(n.material.name);});ok(mats.size>=4,'materiais oculares ausentes');}});
 a.action('restore');a.callouts.update(true);
 window.atlasTestResults={passed:results.every(r=>r.passed),results,webgl:!!document.querySelector('a-scene').renderer.getContext(),triangles:a.manifest.triangles};
 const report=document.createElement('pre');report.id='test-report';report.style='position:absolute;top:10px;right:10px;background:#112;padding:15px;z-index:10;max-width:500px;max-height:85vh;overflow:auto;font-size:11px;white-space:pre-wrap';report.textContent=JSON.stringify(window.atlasTestResults,null,2);document.body.append(report);console.log('ATLAS_TEST_RESULTS',window.atlasTestResults);
})();
