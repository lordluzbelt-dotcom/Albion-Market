(function(){
'use strict';
const recipes=window.ALBION_RECIPES||{},meta=window.ALBION_META||{},byId=new Map(catalog.map(x=>[x.id,x]));
const configs={
 market:{title:'Comparador de precios',description:'Compara siete mercados y descubre dónde comprar o vender.',icon:'T4_BAG'},
 refine:{title:'Calculadora de refinamiento',description:'Calcula materiales, retorno y beneficio al refinar con o sin foco.',icon:'T4_METALBAR',family:'METALBAR'},
 smartRefine:{title:'Refinamiento inteligente',description:'Distribuye tu presupuesto entre tiers y encantamientos rentables de un recurso.',icon:'T6_METALBAR_LEVEL2@2',family:'METALBAR'},
 craft:{title:'Crafteo',description:'Recetas reales, materiales, artefactos y ganancia neta de tu equipo.',icon:'T4_MAIN_SWORD',family:'MAIN_SWORD'},
 smartCraft:{title:'Crafteo inteligente',description:'Reparte la inversión entre variantes del mismo objeto para diversificar tu producción.',icon:'T6_MAIN_SWORD@2',family:'MAIN_SWORD'},
 transport:{title:'Profit de transporte',description:'Encuentra rutas de compra y venta con impuestos, carga y transporte.',icon:'T4_MOUNT_OX'},
 black:{title:'Mercado Negro',description:'Compara ofertas de las ciudades con órdenes de compra del Black Market.',icon:'T4_ARMOR_PLATE_SET1'},
 enchant:{title:'Ahorra plata encantando',description:'Compara el objeto encantado con comprar la base y mejorarlo tú mismo.',icon:'T4_RUNE',family:'MAIN_SWORD'}
};
let tool='market',runId=0,aborter=null,snapshot=null,overrides=new Map(),lastOutputTime=0;
window.activeMarketTool='market';
const el=id=>document.getElementById(id),text=(id,s)=>{el(id).textContent=s;};
const image=id=>`https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?size=64`;
function name(id){if(byId.has(id))return byId.get(id).name;const family=id.replace(/^T\d_/,'').replace(/_LEVEL\d+/, '').replace(/@\d+/,''),tier=id.match(/^T(\d)_/)?.[1];return ({METALBAR:'Lingote',PLANKS:'Tablón',CLOTH:'Tela',LEATHER:'Cuero',STONEBLOCK:'Bloque de piedra',ORE:'Mineral',WOOD:'Troncos',FIBER:'Fibra',HIDE:'Piel',ROCK:'Piedra',RUNE:'Runa',SOUL:'Alma',RELIC:'Reliquia'}[family]||family.replaceAll('_',' ').toLowerCase())+(tier?' · T'+tier:'');}
const itemLine=id=>`<span class="recipe-line"><img loading="lazy" src="${image(id)}" alt=""><span>${esc(name(id))}<small>${esc(id)}</small></span></span>`;
function selectField(id,label,options,value,cls=''){return `<div class="${cls}"><label for="${id}">${label}</label><select id="${id}">${options.map(([v,n])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(n)}</option>`).join('')}</select></div>`;}
function numberField(id,label,value,min=0,max=1e12,step='any',cls=''){return `<div class="${cls}"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></div>`;}
function checkField(id,label,checked=false){return `<div class="check-field"><input type="checkbox" id="${id}" ${checked?'checked':''}><label for="${id}">${label}</label></div>`;}
const cities=Market.cities.map(x=>[x,x]),refineOptions=[['METALBAR','Mineral → lingotes'],['PLANKS','Madera → tablones'],['CLOTH','Fibra → tela'],['LEATHER','Piel → cuero'],['STONEBLOCK','Piedra → bloques']];
function isProduction(){return ['refine','smartRefine','craft','smartCraft'].includes(tool);}
function isSmart(){return ['smartRefine','smartCraft'].includes(tool);}
const rawToRefined={ORE:'METALBAR',WOOD:'PLANKS',FIBER:'CLOTH',HIDE:'LEATHER',ROCK:'STONEBLOCK'};
function isRefine(){return ['refine','smartRefine'].includes(tool);}
function status(message,error=false,pending=false){text('tool-status',message);el('tool-status').className='tool-status'+(error?' error':'')+(pending?' pending':'');}
function metric(label,value,tone=''){return `<div class="tool-metric ${tone}"><span>${label}</span><strong>${value}</strong></div>`;}
function table(headers,body){return `<div class="table-scroll"><table><thead><tr>${headers.map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${body}</tbody></table></div>`;}
function money(n){return Number.isFinite(n)?num.format(n):'Sin datos';}
function stamp(date,price){return ageHTML(date,price);}
function queryRow(data,id,city,quality=1){return data.find(x=>x.item_id===id&&(x.city===city||(city==='Black Market'&&String(x.city)==='3003'))&&Number(x.quality)===Number(quality));}
function quote(data,id,city,side,quality=1){const row=queryRow(data,id,city,quality),field=side==='sell'?'sell_price_min':'buy_price_max';return {price:Market.positive(row?.[field]),date:row?.[field+'_date']};}
function read(id){return Number(el(id).value);}
function effectiveTax(){return el('tool-premium').checked?read('tool-tax-premium'):read('tool-tax');}
function controlForm() {
 const taxFields = () =>
  numberField('tool-tax', 'Impuesto sin Premium (%)', 8, 0, 100, .1) +
  numberField('tool-tax-premium', 'Impuesto con Premium (%)', 4, 0, 100, .1);
 const advanced = fields => `<details class="profit-options span-full"><summary>Ajustes avanzados</summary><div class="profit-options-grid">${fields}</div></details>`;
 const hint = text => `<p class="hint span-full">${text}</p>`;
 const premium = checkField('tool-premium', 'Tengo Premium en Albion', true);

 if (isProduction()) {
  const resource = isRefine() ? selectField('refine-resource', '¿Qué quieres refinar?', refineOptions, selected) : '';
  const amount = isSmart()
   ? numberField('tool-budget', 'Plata disponible para invertir', 1000000, 1)
   : numberField('tool-actions', 'Veces que harás la receta', 1, 1, 1000000, 1);
  const limits = isSmart()
   ? numberField('max-share', 'Límite del presupuesto por versión (%)', 25, 1, 100, 1) +
     numberField('max-actions', 'Máximo de recetas por versión', 100, 1, 1000000, 1)
   : numberField('manual-sale', 'Precio de venta por unidad (plata, opcional)', '', 0);
  const focusBudget = isSmart() ? numberField('focus-budget', 'Puntos de foco disponibles', 30000, 0, 10000000, 1) : '';

  return resource +
   selectField('input-city', '¿Dónde compras los materiales?', cities, 'Martlock') +
   selectField('output-city', '¿Dónde vendes lo producido?', cities, 'Caerleon') +
   amount +
   hint(isSmart() ? 'El presupuesto cubre todos los materiales iniciales. Cada versión es una combinación de tier y encantamiento.' : 'Ingresa cuántas veces repites la receta. La herramienta calcula cuántas unidades produces y cuántos materiales necesitas.') +
   checkField('use-focus', 'Usaré foco al producir') +
   numberField('return-normal', 'Materiales que recuperas sin foco (%)', 15.2, 0, 99.9, .1) +
   numberField('return-focus', 'Materiales que recuperas con foco (%)', 43.5, 0, 99.9, .1) +
   numberField('station-fee', 'Pago a la estación por receta (plata)', 0, 0) +
   hint('Copia el porcentaje de devolución que muestra la estación con tu opción de foco. Ingresa cuánto cobra por una receta y usa 0 si es gratis.') +
   selectField('tool-sale', '¿Cómo vendes?', [['instant', 'Vender ahora a un comprador'], ['order', 'Publicar mi propia oferta de venta']], 'instant') +
   premium +
   advanced(taxFields() +
    numberField('tool-setup', 'Comisión por publicar una oferta (%)', 2.5, 0, 100, .1) +
    numberField('focus-factor', 'Porcentaje del coste base de foco que pagas', 100, .01, 100, .01) +
    focusBudget + limits +
    hint('Deja 100% si usas el coste base de foco. Por ejemplo, si la receta cuesta 800 puntos de base y tú pagas 400, ingresa 50%. El precio de venta usa la calidad seleccionada.'));
 }
 if (tool === 'transport' || tool === 'black') {
  const destinations = tool === 'black' ? [['Black Market', 'Mercado Negro de Caerleon']] : [['all', 'Todas las ciudades'], ...cities];
  return selectField('scan-scope', '¿Qué objetos quieres comparar?', [['family', 'Todas las versiones del objeto seleccionado'], ['equipment', 'Selección de 12 familias de equipo']], 'family', 'span-two') +
   selectField('route-from', '¿Dónde compras?', [['all', 'Todas las ciudades'], ...cities], 'all') +
   selectField('route-to', '¿Dónde vendes?', destinations, destinations[0][0]) +
   numberField('route-budget', 'Plata disponible para una ruta', 1000000, 1) +
   numberField('route-quantity', 'Máximo de unidades que quieres llevar', 100, 1, 1000000, 1) +
   numberField('route-capacity', 'Carga libre para los objetos (kg)', 3000, .01) +
   numberField('route-cost', 'Gasto de transporte por viaje (plata)', 0, 0) +
   premium +
   hint('Usa la carga que te queda libre. Incluye en el gasto del viaje los costes que quieras descontar de la ganancia. La herramienta estima cuántas unidades puedes llevar con tu plata y tu carga.') +
   advanced(selectField('max-age', 'Usar precios de hasta', [['1', '1 hora'], ['6', '6 horas'], ['24', '24 horas'], ['168', '7 días'], ['all', 'Cualquier antigüedad, incluso sin fecha']], '24') +
    selectField('route-sort', 'Mostrar primero', [['net', 'Mayor ganancia en plata'], ['roi', 'Mayor ganancia por cada 100 de plata invertida']], 'net') +
    taxFields());
 }
 return selectField('enchant-city', '¿Dónde compras el objeto y las piedras?', cities, 'Martlock') +
  selectField('enchant-from', 'Nivel del objeto que comprarías', [['0', '.0 · Sin encantar'], ['1', '.1 · Poco común'], ['2', '.2 · Raro']], '0') +
  selectField('enchant-to', 'Nivel al que quieres llegar', [['1', '.1 · Poco común'], ['2', '.2 · Raro'], ['3', '.3 · Excepcional']], '1') +
  numberField('enchant-quantity', '¿Cuántos objetos quieres encantar?', 1, 1, 1000000, 1) +
  hint('Elige el tier y la calidad en el buscador. La herramienta suma las piedras de cada paso y compara el coste con comprar el objeto ya encantado.') +
  advanced(numberField('enchant-fee', 'Gasto adicional por objeto (plata)', 0, 0) +
   hint('Incluye aquí gastos adicionales que quieras sumar al coste de encantar. Las piedras se calculan automáticamente.'));
}
function mount(){
 const c=configs[tool];
 el('tool-workbench').innerHTML=`<div class="section-heading"><div><div class="eyebrow">${isSmart()?'PLANIFICA TU INVERSIÓN':'HERRAMIENTAS DEL MERCADER'}</div><h2 id="tool-heading">${c.title}</h2><p class="tool-description">${c.description}</p></div><span class="tool-badge">${isSmart()?'PRESUPUESTO DIVERSIFICADO':'DATOS REALES + TUS PARÁMETROS'}</span></div><form id="tool-form"><div class="tool-form">${controlForm()}</div><div class="tool-actions"><button class="primary" id="tool-run" type="submit">${isSmart()?'Analizar y repartir presupuesto':tool==='transport'||tool==='black'?'Buscar oportunidades':'Calcular con precios de mercado'}</button><p id="tool-selection-note"></p></div></form><div id="tool-status" class="tool-status" role="status" aria-live="polite"></div><div id="tool-output" class="tool-output"><div class="tool-empty">Elige un objeto y calcula para consultar los precios necesarios.</div></div><p class="tool-footnote">Recetas: ao-data/ao-bin-dumps · Precios: Albion Online Data Project. Los resultados son estimaciones; comprueba las fechas, cantidades disponibles y costes en el juego.</p>`;
 el('tool-form').addEventListener('invalid', e => { const group = e.target.closest('details'); if (group) group.open = true; }, true);
 el('tool-form').addEventListener('submit',e=>{e.preventDefault();run();});
 el('tool-form').addEventListener('input',e=>{if(e.target.id!=='refine-resource')cancel('Parámetros modificados. Vuelve a calcular para actualizar el resultado.');});
 el('refine-resource')?.addEventListener('change',()=>choose(el('refine-resource').value));
 el('tool-output').addEventListener('input',e=>{
  const input=e.target.closest('[data-price]');if(!input||!snapshot)return;
  if(input.value===''||!input.checkValidity())overrides.delete(input.dataset.price);else overrides.set(input.dataset.price,Number(input.value));
  // Preserve the field and caret; recalculate explicitly with the button below the table.
  el('recalculate-manual')?.removeAttribute('hidden'); status('Precios manuales modificados. Pulsa «Recalcular con precios manuales» para actualizar.');
 });
 el('tool-output').addEventListener('click',e=>{if(e.target.closest('#recalculate-manual')&&snapshot)display(snapshot);});
 updateSelectionNote();
}
function cancel(note){++runId;aborter?.abort();snapshot=null;overrides.clear();lastOutputTime=0;if(tool==='market')return;text('query-info','Herramientas · selección modificada');el('tool-run').disabled=false;el('tool-output').innerHTML='<div class="tool-empty">'+esc(note||'Selección modificada. Vuelve a calcular.')+'</div>';status('');updateSelectionNote();}
function updateSelectionNote(){if(!el('tool-selection-note'))return;if(el('refine-resource')&&refineOptions.some(x=>x[0]===selected))el('refine-resource').value=selected;const item=variant();text('tool-selection-note',item?`Objeto: ${item.name} · T${item.tier}.${item.enchant} · ${el('quality').selectedOptions[0].textContent}`:'Selecciona un objeto del catálogo.');}
function activate(id){
 if(!configs[id])return;aborter?.abort();++runId;tool=id;window.activeMarketTool=id;document.body.classList.toggle('tool-mode',id!=='market');snapshot=null;overrides.clear();
 for(const b of document.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===id));
 document.querySelector('.summary-grid').hidden=id!=='market';document.querySelector('.workspace').hidden=id!=='market';el('tool-workbench').hidden=id==='market';message('');
 if(id==='market'){loadPrices();return;}
 const item=variant(),recipe=item&&recipes[item.id];
 if(configs[id].family&&((isRefine()&&recipe?.kind!=='refine')||(['craft','smartCraft'].includes(id)&&recipe?.kind!=='craft')||(id==='enchant'&&!meta[item?.id]?.upgrade&&!meta[`T${item?.tier||4}_${selected}@1`]?.upgrade)))choose(isRefine()?(rawToRefined[selected]||configs[id].family):configs[id].family,false);
 mount(); text('query-info','Herramientas · listo para calcular');
}
el('tool-navigation').innerHTML=Object.entries(configs).map(([id,c])=>`<button class="tool-tile" type="button" data-tool="${id}" aria-pressed="${id==='market'}" aria-controls="${id==='market'?'mercados':'tool-workbench'}"><img loading="lazy" src="${image(c.icon)}" alt=""><span><strong>${c.title}</strong><small>${c.description}</small></span><span class="tile-arrow" aria-hidden="true">›</span></button>`).join('');
el('tool-navigation').addEventListener('click',e=>{const tile=e.target.closest('[data-tool]');if(tile){activate(tile.dataset.tool);(tile.dataset.tool==='market'?document.querySelector('.search-panel'):el('tool-workbench')).scrollIntoView({behavior:'instant',block:'start'});}});
for(const a of document.querySelectorAll('nav a[href="#mercados"],nav a[href="#calculadora"]'))a.addEventListener('click',()=>activate('market'));
document.addEventListener('albion:selection',()=>{if(tool!=='market'){if(isRefine()&&rawToRefined[selected])choose(rawToRefined[selected],false);cancel();}});
function params(){
 const p={};for(const input of el('tool-form').querySelectorAll('input,select')){if(input.type==='number'){if(input.id!=='manual-sale'&&input.value==='')throw new Error('Completa los campos numéricos.');if(!input.checkValidity())throw new Error('Revisa los valores: cantidades enteras positivas y porcentajes dentro del rango indicado.');p[input.id]=input.value===''?null:Number(input.value);}else p[input.id]=input.type==='checkbox'?input.checked:input.value;}return p;
}
function productionOptions(p,actions=1){return {actions,returnRate:p['use-focus']?p['return-focus']:p['return-normal'],tax:p['tool-premium']?p['tool-tax-premium']:p['tool-tax'],setup:p['tool-sale']==='order'?p['tool-setup']:0,station:p['station-fee'],focusFactor:p['focus-factor']/100,useFocus:p['use-focus']};}
function productionCandidates(item){return isSmart()?(families.get(item.family)||[]).filter(x=>recipes[x.id]?.kind===(isRefine()?'refine':'craft')):[item].filter(x=>recipes[x.id]?.kind===(isRefine()?'refine':'craft'));}
function scanItems(item,p){
 const popular=['BAG','CAPE','MAIN_SWORD','2H_CLAYMORE','MAIN_AXE','2H_BOW','MAIN_FIRESTAFF','ARMOR_PLATE_SET1','ARMOR_LEATHER_SET1','ARMOR_CLOTH_SET1','HEAD_PLATE_SET1','SHOES_LEATHER_SET1'];
 const familiesToScan=p['scan-scope']==='equipment'?popular:[item.family];
 return catalog.filter(x=>familiesToScan.includes(x.family)&&(tool!=='black'||meta[x.id]?.kind==='craft'));
}
function enchantPlan(item,p){
 const start=p['enchant-from'],end=p['enchant-to'];
 if(Number(end)<=Number(start))throw new Error('El encantamiento objetivo debe ser mayor que el de partida.');
 const items=families.get(item.family)||[],base=items.find(x=>x.tier===item.tier&&x.enchant===Number(start)),target=items.find(x=>x.tier===item.tier&&x.enchant===Number(end));
 if(!base||!target)throw new Error('Esta combinación no tiene variantes de encantamiento compatibles. Selecciona un arma, armadura, bolsa o capa.');
 const steps=[];for(let level=Number(start)+1;level<=Number(end);level++){const next=items.find(x=>x.tier===item.tier&&x.enchant===level),up=meta[next?.id]?.upgrade;if(!up?.length)throw new Error('Este objeto no dispone de una receta de mejora con runas, almas o reliquias para todos esos pasos.');steps.push(...up.map(m=>({...m,level})));}
 return {base,target,steps};
}
async function run(){
 let p,item=variant(),ids=[],locations=[],candidates=[],enchantInfo;
 try{
  p=params();if(!item)throw new Error('Selecciona un objeto del catálogo.');
  if(isProduction()){
   candidates=productionCandidates(item);
   if(!candidates.length)throw new Error(isRefine()?'Selecciona un recurso refinado, como lingotes, tela o tablones.':'Este objeto no tiene una receta de equipo incluida. Selecciona un arma, armadura, bolsa o capa.');
   ids=candidates.flatMap(x=>[x.id,...recipes[x.id].materials.map(m=>m.id)]);locations=[p['input-city'],p['output-city']];
  }else if(tool==='transport'||tool==='black'){
   candidates=scanItems(item,p);if(!candidates.length)throw new Error('No hay equipo compatible en la selección. Elige un arma, armadura, bolsa o capa para Mercado Negro.');
   ids=candidates.map(x=>x.id);locations=[...Market.cities,...(tool==='black'?['Black Market']:[])];
  }else if(tool==='enchant'){
   enchantInfo=enchantPlan(item,p);ids=[enchantInfo.base.id,enchantInfo.target.id,...enchantInfo.steps.map(m=>m.id)];locations=[p['enchant-city']];
  }
 }catch(e){status(e.message,true);return;}
 const id=++runId;aborter?.abort();aborter=new AbortController();const signal=aborter.signal;
 snapshot=null;overrides.clear();el('tool-run').disabled=true;el('tool-output').innerHTML='';status(`Consultando ${new Set(ids).size} objetos en ${el('server').selectedOptions[0].textContent}…`,false,true);
 try{
  const data=await ToolData.fetchPrices(ids,locations,Number(el('quality').value),signal,(done,total)=>{if(id===runId)status(`Consultando mercados · lote ${done} de ${total}…`,false,true);});
  if(id!==runId)return;
  snapshot={mode:tool,p,item,candidates,enchantInfo,data,quality:Number(el('quality').value),server:el('server').selectedOptions[0].textContent};lastOutputTime=Date.now();display(snapshot);
 }catch(e){if(id!==runId)return;status(e.name==='AbortError'?'La consulta tardó demasiado o se canceló. Vuelve a intentarlo.':e instanceof TypeError?'No se pudo conectar con la API. Comprueba tu conexión.':e.message,true);el('tool-output').innerHTML='<div class="tool-empty">No se han calculado resultados con datos incompletos.</div>';}
 finally{if(id===runId)el('tool-run').disabled=false;}
}
function staleNote(quotes){const used=quotes.filter(x=>x.price),aged=used.filter(x=>Market.age(x.date).className!=='fresh');return aged.length?`${aged.length} de ${used.length} precios no son recientes o no tienen fecha válida. `:'';}
function warning(s){return '<p class="tool-warning">'+s+'</p>';}
function finishStatus(s,extra=''){text('query-info',s.server+' · Herramienta consultada');status(`${s.server} · Consultado ${new Date(lastOutputTime).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}. ${extra}`);}
function modelFor(s,item,actions=1){
 const r=recipes[item.id],prices={},quotes=[];
 for(const m of r.materials){const q=quote(s.data,m.id,s.p['input-city'],'sell');quotes.push(q);prices[m.id]=overrides.get(m.id)||q.price;}
 const sale=quote(s.data,item.id,s.p['output-city'],s.p['tool-sale']==='order'?'sell':'buy',s.quality);
 quotes.push(sale);const manual=!isSmart()&&s.p['manual-sale']>0?s.p['manual-sale']:null;
 return {model:Economy.production(r,prices,manual||sale.price,productionOptions(s.p,actions)),quotes,prices,sale,manual};
}
function materialTable(s,item,canEdit=true){
 const r=recipes[item.id],actions=isSmart()?1:s.p['tool-actions'];
 const rows=r.materials.map(m=>{
  const q=quote(s.data,m.id,s.p['input-city'],'sell'),manual=overrides.get(m.id);
  return `<tr><td>${itemLine(m.id)}<small>${m.returns?'Admite retorno':'No retornable · coste completo'}</small></td><td>${num.format(m.count*actions)}</td><td>${money(q.price)}</td><td>${stamp(q.date,q.price)}</td>${canEdit?`<td><label class="sr-only" for="override-${esc(m.id)}">Precio manual de ${esc(name(m.id))}</label><input class="manual-price" id="override-${esc(m.id)}" data-price="${esc(m.id)}" type="number" min="0.01" step="any" placeholder="Opcional" value="${manual||''}"></td>`:''}</tr>`;
 }).join('');
 return table(['Material','Cantidad inicial','Precio / ud.','Antigüedad',...(canEdit?['Precio manual / ud.']:[])],rows)+(canEdit?'<button class="primary" id="recalculate-manual" type="button" hidden style="margin-top:12px">Recalcular con precios manuales</button>':'');
}
function displayProduction(s){
 const item=s.item,info=modelFor(s,item,s.p['tool-actions']),m=info.model,r=recipes[item.id];
 let html='';
 if(m){
  html='<div class="tool-metrics">'+metric('Inversión inicial · materiales + estación',money(m.investment))+metric('Retorno esperado · valor de materiales',money(m.returned))+metric('Ganancia neta estimada',money(m.net),m.net>0?'positive':'negative')+metric('ROI sobre capital inicial',pct(m.roi),m.roi>0?'positive':'negative')+'</div>';
  html+=table(['Resultado del lote','Valor'],[
   ['Producción total',num.format(m.units)+' unidades · '+num.format(m.actions)+' acciones'],['Coste neto de materiales',money(m.materials-m.returned)],['Estación y plata de receta',money(m.stationCost)],['Ingreso bruto',money(m.revenue)],['Impuestos + setup',money(m.fees)],['Foco estimado consumido',num.format(m.focus)],['Retorno usado',pct(productionOptions(s.p).returnRate)]
  ].map(([label,value])=>`<tr><td>${label}</td><td>${value}</td></tr>`).join(''));
 }else html+='<div class="tool-empty">Faltan precios para calcular la rentabilidad. Puedes introducir los precios de materiales y el precio de venta manual.</div>';
 html+='<h3>Receta y compra de materiales · '+esc(s.p['input-city'])+'</h3>'+materialTable(s,item);
 html+='<h3>Precio de salida · '+esc(s.p['output-city'])+'</h3>'+table(['Objeto','Precio / ud.','Antigüedad'],`<tr><td>${itemLine(item.id)}<small>Calidad ${s.quality} · ${s.p['tool-sale']==='order'?'Orden de venta estimada':'Orden de compra existente'}</small></td><td>${money(info.manual||info.sale.price)}${info.manual?'<small>Precio manual</small>':''}</td><td>${info.manual?'Manual · sin fecha API':stamp(info.sale.date,info.sale.price)}</td></tr>`);
 const manualCount=overrides.size+(info.manual?1:0);
 html+=warning(esc(staleNote(info.quotes))+`${manualCount?manualCount+' precios manuales; verifica sus valores. ':''}El retorno es un valor esperado de materiales, no plata recibida: el capital inicial cubre la receta completa. No se supone reinversión automática ni venta de lo recuperado. ${s.p['tool-sale']==='order'?'El precio objetivo no garantiza ejecución. ':''}El foco base proviene de la receta; ajusta su coste a tu especialización. ${m&&m.net<=0?'La operación tiene ganancia neta nula o negativa. ':''}Sin transporte ni garantía de calidad o volumen.`);
 el('tool-output').innerHTML=html;finishStatus(s,m?'Receta calculada.':'Faltan precios; no se reemplazan por cero.');
}
function displaySmart(s){
 const candidates=s.candidates.map(item=>({id:item.id,item,...modelFor(s,item,1)}));
 const result=Economy.allocate(candidates,{budget:s.p['tool-budget'],maxShare:s.p['max-share'],maxActions:s.p['max-actions'],focusBudget:s.p['use-focus']?s.p['focus-budget']:Infinity});
 if(!result){status('Revisa los límites de presupuesto y foco.',true);return;}
 const missing=candidates.filter(x=>!x.model).length,loss=candidates.filter(x=>x.model&&x.model.net<=0).length;
 let html='<div class="tool-metrics">'+metric('Capital inicial asignado',money(result.spent))+metric('Presupuesto disponible',money(result.remaining))+metric('Ganancia neta estimada',money(result.net),result.net>0?'positive':'')+metric('Foco asignado',num.format(result.focus))+'</div>';
 if(result.plan.length){
  html+=table(['Variante','Acciones / unidades','Capital inicial','Ganancia neta','ROI','Foco','Fechas de precios'],result.plan.map(x=>`<tr><td>${itemLine(x.id)}<small class="plan-row-label">T${x.item.tier}.${x.item.enchant}</small></td><td>${num.format(x.actions)} / ${num.format(x.units)}</td><td>${money(x.investment)}</td><td class="price-buy">${money(x.net)}</td><td>${pct(x.model.roi)}</td><td>${num.format(x.focus)}</td><td>${x.quotes.map(q=>stamp(q.date,q.price)).join('')}</td></tr>`).join(''));
 }else html+='<div class="tool-empty">Ninguna variante permite una asignación rentable con estos precios, presupuesto, límites y foco.</div>';
 const ranked=candidates.filter(x=>x.model).sort((a,b)=>b.model.roi-a.model.roi);
 html+='<h3>Comparación de variantes antes de distribuir</h3>'+table(['Variante','Capital por acción','Ganancia por acción','ROI','Estado'],ranked.map(x=>`<tr><td>${itemLine(x.id)}<small>T${x.item.tier}.${x.item.enchant}</small></td><td>${money(x.model.investment)}</td><td class="${x.model.net>0?'price-buy':'negative'}">${money(x.model.net)}</td><td>${pct(x.model.roi)}</td><td>${x.model.net>0?'Rentable según observaciones':'Sin margen positivo'}</td></tr>`).join('')||'<tr><td colspan="5">Sin precios suficientes.</td></tr>');
 html+=warning(`${missing} variantes excluidas por falta de precios; ${loss} sin ganancia positiva. ${esc(staleNote(result.plan.flatMap(x=>x.quotes)))}Distribución heurística por ganancia / capital inicial, con máximo ${s.p['max-share']}% del presupuesto por variante y ${s.p['max-actions']} acciones por variante. No garantiza el óptimo global ni evita saturación: no se conoce la demanda. Los retornos se valoran como materiales, sin reinvertirlos automáticamente. Los precios presuponen la calidad seleccionada; no está garantizada al fabricar.`);
 if(missing)html+='<details class="tool-footnote"><summary>Ver variantes sin datos suficientes</summary>'+candidates.filter(x=>!x.model).map(x=>esc(name(x.id))+' · '+esc(x.id)).join('<br>')+'</details>';
 el('tool-output').innerHTML=html;finishStatus(s,`${s.candidates.length} variantes comparadas · ${result.plan.length} asignadas.`);
}
function isAgeAllowed(date,p){
 if(p['max-age']==='all')return true;
 const time=Market.parseDate(date);return time!==null&&time<=Date.now()+300000&&Date.now()-time<=Number(p['max-age'])*3600000;
}
function displayRoutes(s){
 const p=s.p,from=p['route-from']==='all'?Market.cities:[p['route-from']],to=tool==='black'?['Black Market']:p['route-to']==='all'?Market.cities:[p['route-to']],found=[];let missing=0,aged=0,unprofitable=0,capacity=0;
 for(const item of s.candidates){
  const quality=meta[item.id]?.quality===1?1:s.quality;
  for(const source of from)for(const dest of to){
   if(source===dest)continue;
   const buy=quote(s.data,item.id,source,'sell',quality),sell=quote(s.data,item.id,dest,'buy',quality);
   if(!buy.price||!sell.price){missing++;continue;}if(!isAgeAllowed(buy.date,p)||!isAgeAllowed(sell.date,p)){aged++;continue;}
   const weight=meta[item.id]?.weight;
   if(!Number.isFinite(weight)||weight<=0){capacity++;continue;}
   const model=Economy.transport(buy.price,sell.price,{quantity:p['route-quantity'],budget:p['route-budget'],capacity:p['route-capacity'],weight,tax:p['tool-premium']?p['tool-tax-premium']:p['tool-tax'],cost:p['route-cost']});
   if(!model){capacity++;continue;}if(model.net<=0){unprofitable++;continue;}found.push({item,source,dest,buy,sell,model});
  }
 }
 found.sort((a,b)=>b.model[p['route-sort']]-a.model[p['route-sort']]||a.item.id.localeCompare(b.item.id));const top=found[0],shown=found.slice(0,150);
 let html='<div class="tool-metrics">'+metric('Rutas con margen positivo',num.format(found.length))+metric('Ganancia de la primera ruta',top?money(top.model.net):'—',top?'positive':'')+metric('Capital de esa ruta',top?money(top.model.investment):'—')+metric('ROI de esa ruta',top?pct(top.model.roi):'—')+'</div>';
 if(shown.length)html+=table(['Objeto','Ruta','Cantidad / kg','Compra / ud.','Venta / ud.','Capital total','Neto / ROI','Antigüedad compra / venta'],shown.map(x=>`<tr><td>${itemLine(x.item.id)}<small>T${x.item.tier}.${x.item.enchant} · calidad ${meta[x.item.id]?.quality===1?1:s.quality}</small></td><td>${esc(x.source)} → ${esc(x.dest)}</td><td>${num.format(x.model.units)} / ${num.format(x.model.weight)}</td><td>${money(x.buy.price)}</td><td>${money(x.sell.price)}</td><td>${money(x.model.investment)}</td><td class="price-buy">${money(x.model.net)}<small>${pct(x.model.roi)}</small></td><td>${stamp(x.buy.date,x.buy.price)}${stamp(x.sell.date,x.sell.price)}</td></tr>`).join(''));
 else html+='<div class="tool-empty">No se encontraron rutas rentables con estos precios y filtros. Prueba otra familia, antigüedad o ciudad.</div>';
 html+=warning(`${missing} pares sin datos; ${aged} excluidos por antigüedad; ${unprofitable} sin ganancia positiva; ${capacity} fuera de capital/carga o sin peso conocido. Se muestran hasta 150 rutas. Las operaciones son alternativas, no un plan conjunto de inversión. ${tool==='black'?'El Mercado Negro está en Caerleon: las órdenes observadas no garantizan compra ni cantidad disponible; contempla el riesgo del trayecto. ':''}Peso base sin modificadores; no se asumen precios de transporte ni riesgos monetizados distintos del coste que introduzcas. ${esc(staleNote(shown.flatMap(x=>[x.buy,x.sell])))}`);
 el('tool-output').innerHTML=html;finishStatus(s,`${s.candidates.length} variantes analizadas · ${found.length} rutas rentables según los filtros.`);
}
function displayEnchant(s){
 const {base,target,steps}=s.enchantInfo,p=s.p,city=p['enchant-city'],quantity=p['enchant-quantity'],priceMap={};
 const baseQuote=quote(s.data,base.id,city,'sell',s.quality),targetQuote=quote(s.data,target.id,city,'sell',s.quality),quotes=[baseQuote,targetQuote];
 const materialRows=steps.map(m=>{const q=quote(s.data,m.id,city,'sell');priceMap[m.id]=q.price;quotes.push(q);return `<tr><td>${itemLine(m.id)}<small>Mejora .${m.level-1} → .${m.level}</small></td><td>${num.format(m.count)} × ${num.format(quantity)}</td><td>${money(q.price)}</td><td>${q.price?money(q.price*m.count*quantity):'Sin datos'}</td><td>${stamp(q.date,q.price)}</td></tr>`;}).join('');
 const result=Economy.enchant(baseQuote.price,targetQuote.price,steps,priceMap,quantity,p['enchant-fee']);
 let html='';
 if(result)html+='<div class="tool-metrics">'+metric('Comprar ya encantado · total',money(result.direct))+metric('Comprar base y encantar · total',money(result.self))+metric('Ahorro al encantar tú mismo',money(result.saving),result.saving>0?'positive':'negative')+metric('Ahorro / coste de encantar',pct(result.roi),result.saving>0?'positive':'negative')+'</div>';
 else html+='<div class="tool-empty">Faltan precios del objeto o de las piedras. No se puede concluir qué opción es más barata.</div>';
 html+=table(['Alternativa','Precio / objeto','Antigüedad'],`<tr><td>${itemLine(base.id)}<small>Objeto base · calidad ${s.quality}</small></td><td>${money(baseQuote.price)}</td><td>${stamp(baseQuote.date,baseQuote.price)}</td></tr><tr><td>${itemLine(target.id)}<small>Compra directa del objetivo · calidad ${s.quality}</small></td><td>${money(targetQuote.price)}</td><td>${stamp(targetQuote.date,targetQuote.price)}</td></tr>`);
 html+='<h3>Piedras necesarias para todos los pasos</h3>'+table(['Material / paso','Cantidad','Precio / piedra','Coste total','Antigüedad'],materialRows);
 html+=warning(esc(staleNote(quotes))+`Coste extra incluido: ${money(p['enchant-fee']*quantity)} plata en total. Se comparan precios de compra directa; no se resta un impuesto de venta. ${result?(result.saving>0?'Según estos precios, encantar tú mismo cuesta menos.':'Según estos precios, comprar el objeto ya encantado cuesta igual o menos.'):'Faltan datos para recomendar una alternativa.'} Sin garantía de stock ni transporte incluido.`);
 el('tool-output').innerHTML=html;finishStatus(s,result?'Comparación calculada.':'Sin precios suficientes para comparar.');
}
function display(s){if(s.mode!==tool)return;if(isProduction()){if(isSmart())displaySmart(s);else displayProduction(s);}else if(tool==='transport'||tool==='black')displayRoutes(s);else displayEnchant(s);}
})();







