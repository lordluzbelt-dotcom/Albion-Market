(function(root){
'use strict';
const cached=new Map();
async function fetchPrices(ids,cities,quality,signal,onProgress){
 const region=document.getElementById('server').value;
 if(Date.now()<cooldown)throw new Error('La API está en espera por límite de consultas. Reintenta después de '+new Date(cooldown).toLocaleTimeString('es-PE')+'.');
 const unique=[...new Set(ids)].sort(),locations=[...new Set(cities)].sort(),qualities=[...new Set([1,Number(quality)])].sort();
 const groups=[];let group=[];
 for(const item of unique){if(group.length>=35||encodeURIComponent([...group,item].join(',')).length>2900){groups.push(group);group=[];}group.push(item);}if(group.length)groups.push(group);
 const all=[];
 for(let i=0;i<groups.length;i++){
  if(signal.aborted)throw new DOMException('Consulta cancelada','AbortError');
  const key=[region,groups[i].join(','),locations.join(','),qualities.join(',')].join('/');
  const previous=cached.get(key);
  if(previous&&Date.now()-previous.time<60000){all.push(...previous.data);onProgress?.(i+1,groups.length);continue;}
  const url=`https://${region}.albion-online-data.com/api/v2/stats/prices/${encodeURIComponent(groups[i].join(','))}.json?locations=${encodeURIComponent(locations.join(','))}&qualities=${qualities.join(',')}`;
  const request=new AbortController(),abort=()=>request.abort();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,20000);
  try{
   const response=await fetch(url,{signal:request.signal,headers:{Accept:'application/json'}});
   if(response.status===429){const reset=Number(response.headers.get('RateLimit-Reset')),retry=Number(response.headers.get('Retry-After'));cooldown=Math.max(Date.now()+60000,Number.isFinite(reset)?reset*1000:0,retry>0?Date.now()+retry*1000:0);throw new Error('Límite de la API alcanzado. Espera hasta '+new Date(cooldown).toLocaleTimeString('es-PE')+'.');}
   if(!response.ok)throw new Error('La API respondió HTTP '+response.status+'. Vuelve a intentarlo más tarde.');
   const data=await response.json();if(!Array.isArray(data))throw new Error('Respuesta de mercado inesperada.');
   const valid=data.filter(x=>x&&typeof x==='object'&&typeof x.item_id==='string');cached.set(key,{time:Date.now(),data:valid});all.push(...valid);
  }finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
  onProgress?.(i+1,groups.length);
 }
 return all;
}
root.ToolData={fetchPrices};
})(window);
