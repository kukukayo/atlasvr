/* Complete, versioned local copies; no CDN dependencies or background telemetry. */
(()=>{
 const section=document.createElement('div');section.innerHTML='<p id="offline-status" role="status"></p><button id="offline-retry" hidden>Tentar baixar novamente</button>';
 document.querySelector('.inspector-bottom').prepend(section);
 const status=section.querySelector('#offline-status'),retry=section.querySelector('#offline-retry');
 if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='Cópia local indisponível neste navegador.';return;}
 let busy=false;
 async function prepare(){
  if(busy)return;busy=true;retry.hidden=true;status.textContent='Preparando cópia local (cerca de 6 MB)…';
  try{
   const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
   reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&reg.waiting)status.textContent='Atualização baixada. Feche todas as abas do atlas e reabra.';});});
   const ready=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('download incompleto')),90000))]);
   const report=await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>reject(Error('sem resposta')),5000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data);};ready.active.postMessage({type:'CHECK_LOCAL'},[channel.port2]);});
   if(!report.complete)throw Error('cópia incompleta');
   status.dataset.version=report.version;
   status.textContent='Cópia local pronta. Teste sem Wi-Fi antes de sair.';
   if(reg.waiting)status.textContent='Atualização baixada. Feche todas as abas do atlas e reabra.';
  }catch(e){status.textContent='Cópia local não concluída. Conecte à internet e tente novamente.';retry.hidden=false;}
  finally{busy=false;}
 }
 retry.addEventListener('click',prepare);
 window.addEventListener('load',prepare,{once:true});
})();
