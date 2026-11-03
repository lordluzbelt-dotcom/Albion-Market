'use strict';
const $ = id => document.getElementById(id);
const num = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const pct = n => num.format(n) + '%';
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog = (window.ALBION_ITEMS || []).map(([id,name,en]) => ({id,name,en, tier:Number(id[1]), enchant:Number(id.split('@')[1] || 0), family:id.slice(3).replace(/@\d+$/, '').replace(/_LEVEL\d+$/, '')}));
const families = new Map();
for (const item of catalog) { if (!families.has(item.family)) families.set(item.family, []); families.get(item.family).push(item); }
const familyIndex = [...families].map(([family,items]) => ({family,items,terms:normalize(items.map(x => x.name + ' ' + x.en).join(' ') + ' ' + ({WOOD:'madera tronco',PLANKS:'madera tablones',ORE:'mineral mena',FIBER:'fibra',ROCK:'piedra roca',HIDE:'piel cuero'}[family] || ''))}));
let selected = families.has('BAG') ? 'BAG' : familyIndex[0]?.family;
let currentRows = [], matches = [], activeIndex = -1, requestId = 0, controller, busy = false, cooldown = 0, lastQuery = null;
const cache = new Map();
const cityColors = ['#d5aa68','#8fadd1','#8eaf78','#b49ac8','#c4d3d1','#d49186','#a29ed1'];
const cityIcons = ['☀','♜','♧','♨','❖','♛','✧'];
function message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
function variant() { return families.get(selected)?.find(x => x.tier === Number($('tier').value) && x.enchant === Number($('enchantment').value)); }
function syncOptions(reset = false) {
  const items = families.get(selected) || [];
  for (const opt of $('tier').options) opt.disabled = !items.some(x => x.tier === Number(opt.value));
  if ($('tier').selectedOptions[0]?.disabled) $('tier').value = String(items[0]?.tier || 4);
  for (const opt of $('enchantment').options) opt.disabled = !items.some(x => x.tier === Number($('tier').value) && x.enchant === Number(opt.value));
  if ($('enchantment').selectedOptions[0]?.disabled) $('enchantment').value = String(items.find(x => x.tier === Number($('tier').value))?.enchant || 0);
  const qualitySupported = /^(MAIN_|2H_|OFF_|ARMOR_|HEAD_|SHOES_|BAG|CAPE)/.test(selected || '');
  $('quality').disabled = !qualitySupported;
  if (!qualitySupported) $('quality').value = '1';
  const item = variant();
  if (!item) return;
  if (reset) $('search').value = item.name;
  $('item-name').textContent = item.name;
  $('item-tier').textContent = `T${item.tier}.${item.enchant}`;
  $('item-quality').textContent = $('quality').selectedOptions[0].textContent;
  $('item-id').textContent = item.id;
  $('item-image').hidden = false; $('image-fallback').hidden = true;
  $('item-image').alt = item.name;
  $('item-image').src = `https://render.albiononline.com/v1/item/${encodeURIComponent(item.id)}.png?quality=${$('quality').value}&size=128`;
}
$('item-image').addEventListener('error', () => { $('item-image').hidden = true; $('image-fallback').hidden = false; });
function closeSuggestions() { $('suggestions').hidden = true; $('search').setAttribute('aria-expanded','false'); $('search').removeAttribute('aria-activedescendant'); activeIndex = -1; }
function searchMatches() {
  const query = normalize($('search').value);
  const tokens = query.split(/\s+/).filter(Boolean);
  // Common community terminology is accepted alongside the localized catalogue.
  const terms = tokens.map(t => t === 'adepto' ? 'iniciado' : t);
  matches = familyIndex.filter(x => terms.every(t => x.terms.includes(t))).sort((a,b) => {
    const an = a.items.find(x => x.tier === Number($('tier').value) && !x.enchant)?.name || a.items[0].name;
    const bn = b.items.find(x => x.tier === Number($('tier').value) && !x.enchant)?.name || b.items[0].name;
    return Number(normalize(bn).startsWith(query)) - Number(normalize(an).startsWith(query)) || an.length - bn.length;
  }).slice(0,35);
  activeIndex = -1;
  $('search').removeAttribute('aria-activedescendant');
  $('suggestions').innerHTML = matches.length ? matches.map((x,i) => { const item = x.items.find(v => v.tier === Number($('tier').value) && !v.enchant) || x.items[0]; return `<li id="suggestion-${i}" role="option" aria-selected="false" data-index="${i}">${esc(item.name)}<small>${esc(item.en)} · T${[...new Set(x.items.map(v => v.tier))].join(' / T')}</small></li>`; }).join('') : '<li role="presentation">No se encontraron objetos. Prueba un nombre más corto.</li>';
  $('suggestions').hidden = false; $('search').setAttribute('aria-expanded','true');
}
function choose(family, query = true) { selected = family; closeSuggestions(); syncOptions(true); if (query) loadPrices(); }
$('search').addEventListener('input', searchMatches);
$('search').addEventListener('focus', searchMatches);
$('clear-search').addEventListener('click', () => { $('search').value = ''; $('search').focus(); searchMatches(); });
$('suggestions').addEventListener('click', e => { const li=e.target.closest('[data-index]'); if(li) choose(matches[Number(li.dataset.index)].family); });
$('search').addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSuggestions(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if ($('suggestions').hidden) searchMatches(); if (!matches.length) return;
    activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    [...$('suggestions').children].forEach((li,i) => li.setAttribute('aria-selected', String(i === activeIndex)));
    $('search').setAttribute('aria-activedescendant', 'suggestion-' + activeIndex); $('suggestion-' + activeIndex).scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter' && !$('suggestions').hidden && matches.length) { e.preventDefault(); choose(matches[Math.max(activeIndex,0)].family); }
});
document.addEventListener('click', e => { if (!e.target.closest('.search-field')) closeSuggestions(); });
for (const button of document.querySelectorAll('[data-family]')) button.addEventListener('click', () => choose(button.dataset.family));
for (const id of ['tier','enchantment','quality']) $(id).addEventListener('change', () => { syncOptions(true); loadPrices(); });
$('server').addEventListener('change', () => { savePrefs(); loadPrices(); });
$('search-form').addEventListener('submit', e => {
  e.preventDefault();
  if (normalize($('search').value) !== normalize(variant()?.name || '')) { searchMatches(); if (matches.length) choose(matches[0].family); else message('Selecciona un objeto válido de las sugerencias.', true); }
  else loadPrices();
});
$('refresh').addEventListener('click', () => loadPrices(true));
function ageHTML(date, price, compact = false) {
  if (!price) return '<span class="no-data">Sin datos</span>';
  const a = Market.age(date);
  if (compact) return `<span class="${a.className}" title="${esc(a.exact)}">● ${esc(a.label)}${a.className === 'old' ? ' · Precio antiguo' : ''}</span>`;
  return `<details class="age ${a.className}"><summary title="${esc(a.exact)}"><i class="dot"></i>${esc(a.label)}</summary><small>${esc(a.exact)}</small></details>`;
}
function render() {
  const best = Market.best(currentRows);
  $('prices').innerHTML = Market.cities.map((city,i) => {
    const r = currentRows.find(x => x.city === city) || {city};
    const price = (v,cls) => v ? `<span class="${cls}">${num.format(v)}</span>` : '<span class="no-data">Sin datos</span>';
    return `<tr><td><span class="city-name"><span class="city-sigil" style="--city:${cityColors[i]}" aria-hidden="true">${cityIcons[i]}</span>${city}</span></td><td>${price(r.sell,best.buy?.city === city ? 'price-buy' : '')}</td><td>${price(r.buy,best.sell?.city === city ? 'price-sell' : '')}</td><td>${ageHTML(r.sellDate,r.sell)}</td><td>${ageHTML(r.buyDate,r.buy)}</td></tr>`;
  }).join('');
  for (const type of ['buy','sell']) {
    const r = best[type], value = type === 'buy' ? r?.sell : r?.buy, date = type === 'buy' ? r?.sellDate : r?.buyDate;
    $('best-' + type + '-city').textContent = r?.city || 'Sin datos';
    $('best-' + type + '-price').innerHTML = value ? num.format(value) + ' <small>plata / ud.</small>' : '—';
    $('best-' + type + '-age').innerHTML = value ? ageHTML(date,value,true) : 'No hay observaciones válidas';
  }
  const result = best.buy && best.sell ? Market.calculate(best.buy.sell,best.sell.buy,1,0,0) : null;
  $('spread-route').textContent = result ? `${best.buy.city} → ${best.sell.city}` : 'Sin datos suficientes';
  $('spread-price').innerHTML = result ? num.format(result.gross) + ' <small>plata / ud.</small>' : '—';
  $('spread-price').classList.toggle('negative',!!result && result.gross < 0);
  $('spread-roi').textContent = result ? `ROI bruto · ${pct(result.grossRoi)}${result.gross <= 0 ? ' · Sin margen positivo' : ''}` : 'ROI bruto · —';
  updateCalculator();
}
function updateCalculator() {
  const best = Market.best(currentRows), order = $('sale-mode').value === 'order';
  const seller = order ? best.order : best.sell;
  const tax = Number($($('premium').checked ? 'tax-premium' : 'tax-standard').value), setup = order ? Number($('setup').value) : 0;
  const fields = ['quantity','tax-standard','tax-premium','setup'];
  const valid = fields.every(id => $(id).value !== '' && $(id).checkValidity());
  $('applied-tax').textContent = `${pct(tax)} + ${pct(setup)}`;
  $('setup').disabled = !order;
  $('fee-note').textContent = order ? 'Al publicar pagas una comisión y, al vender, el impuesto.' : 'Al vender ahora se descuenta el impuesto de mercado.';
  const result = valid && best.buy && seller ? Market.calculate(best.buy.sell,order ? seller.sell : seller.buy,Number($('quantity').value),tax,setup) : null;
  for (const id of ['investment','revenue','gross','fees','net']) $(id).textContent = result ? num.format(result[id]) : '—';
  $('net-roi').textContent = result ? pct(result.roi) : '—';
  $('net').classList.toggle('negative',!!result && result.net < 0); $('net-roi').classList.toggle('negative',!!result && result.net < 0);
  const outdated = best.buy && seller && [best.buy.sellDate,order ? seller.sellDate : seller.buyDate].some(d => Market.age(d).className !== 'fresh');
  $('calc-note').textContent = !valid ? 'Introduce una cantidad entera positiva y tasas entre 0 y 100.' : !result ? 'No hay datos suficientes para calcular esta operación.' : `${best.buy.city} → ${seller.city}. ${order ? 'Precio objetivo estimado; la orden puede no ejecutarse. ' : ''}${outdated ? 'Hay precios antiguos o de fecha no reciente. ' : ''}${result.net <= 0 ? 'Sin ganancia neta positiva. ' : ''}Sin transporte ni garantía de volumen.`;
  savePrefs();
}
for (const id of ['quantity','sale-mode','premium','tax-standard','tax-premium','setup']) $(id).addEventListener('input',updateCalculator);
$('minus').addEventListener('click', () => { $('quantity').value = Math.max(1,Math.floor(Number($('quantity').value) || 1) - 1); updateCalculator(); });
$('plus').addEventListener('click', () => { $('quantity').value = Math.min(1e9,Math.floor(Number($('quantity').value) || 1) + 1); updateCalculator(); });
function savePrefs() { try { const p = {}; for (const id of ['server','quantity','sale-mode','tax-standard','tax-premium','setup']) p[id] = $(id).value; p.premium = $('premium').checked; localStorage.setItem('albion-prefs',JSON.stringify(p)); } catch {} }
function loadPrefs() { try { const p=JSON.parse(localStorage.getItem('albion-prefs') || '{}'); for (const id of ['server','quantity','sale-mode','tax-standard','tax-premium','setup']) if (p[id] !== undefined) { const previous=$(id).value; $(id).value=p[id]; if (!$(id).value || !$(id).checkValidity()) $(id).value=previous; } if (typeof p.premium === 'boolean') $('premium').checked=p.premium; } catch {} }
async function loadPrices(force = false) {
  document.dispatchEvent(new CustomEvent('albion:selection'));
  if (window.activeMarketTool && window.activeMarketTool !== 'market') { controller?.abort(); ++requestId; setBusy(false); message(''); return; }
  const item = variant(); if (!item) { message('El catálogo no está disponible. Revisa assets/items.js.',true); return; }
  const id = ++requestId; controller?.abort();
  currentRows = []; lastQuery = null; render();
  const server = $('server').value, quality = Number($('quality').value), key = `${server}/${item.id}/${quality}`;
  $('query-info').textContent = 'Consultando mercados…';
  if (Date.now() < cooldown) { message('Límite de la API alcanzado. Reintenta después de ' + new Date(cooldown).toLocaleTimeString('es-PE') + '.',true); $('query-info').textContent='Consulta pendiente'; setBusy(false); return; }
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.time < 60000) { applyData(cached.data,item,quality,server,cached.time,true); setBusy(false); return; }
  controller = new AbortController(); const signal = controller.signal;
  const timeout = setTimeout(() => controllerForRequest.abort(),18000); const controllerForRequest = controller;
  setBusy(true); message('Consultando los siete mercados…');
  const url = `https://${server}.albion-online-data.com/api/v2/stats/prices/${encodeURIComponent(item.id)}.json?locations=${encodeURIComponent(Market.cities.join(','))}&qualities=${quality}`;
  try {
    const response = await fetch(url,{signal,headers:{Accept:'application/json'}});
    if (response.status === 429) {
      const reset = Number(response.headers.get('RateLimit-Reset')), retry = Number(response.headers.get('Retry-After'));
      cooldown = Math.max(Date.now()+60000, Number.isFinite(reset) ? reset*1000 : 0, retry > 0 ? Date.now()+retry*1000 : 0);
      throw new Error('La API alcanzó su límite de consultas. Reintenta después de ' + new Date(cooldown).toLocaleTimeString('es-PE') + '.');
    }
    if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}. Intenta de nuevo más tarde.`);
    const data = await response.json(); if (!Array.isArray(data)) throw new Error('La API devolvió una respuesta inesperada.');
    if (id !== requestId) return;
    const time = Date.now(); cache.set(key,{data,time}); applyData(data,item,quality,server,time,false);
  } catch (error) {
    if (id !== requestId) return;
    $('query-info').textContent = 'Consulta no completada';
    message(error.name === 'AbortError' ? 'La consulta tardó demasiado. Comprueba tu conexión y vuelve a actualizar.' : error instanceof TypeError ? 'No se pudo conectar con la API. Comprueba tu conexión y vuelve a actualizar.' : error.message,true);
  } finally { clearTimeout(timeout); if (id === requestId) setBusy(false); }
}
function setBusy(value) { busy=value; $('submit').disabled=value; $('refresh').disabled=value; $('submit').innerHTML=value ? 'Consultando…' : '<span>⌕</span> Consultar precios'; $('prices').setAttribute('aria-busy',String(value)); }
function applyData(data,item,quality,server,time,cached) {
  currentRows = Market.rows(data,item.id,quality); lastQuery = {time,server}; render();
  const count=currentRows.filter(x => x.sell || x.buy).length;
  message(count ? '' : 'Sin datos para esta combinación de objeto, servidor y calidad. Prueba otra variante.');
  $('query-info').textContent = `${$('server').selectedOptions[0].textContent} · ${cached ? 'Caché de consulta' : 'Consultado'} ${new Date(time).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}`;
}
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
document.querySelector('.close-dialog').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', e => { if (e.target === $('help-dialog')) { const r=$('help-dialog').getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) $('help-dialog').close(); } });
loadPrefs();
$('catalog-count').textContent = `${num.format(catalog.length)} variantes · ES / EN`;
if (selected) { syncOptions(true); render(); loadPrices(); }
else { message('No se pudo cargar el catálogo local de objetos.',true); render(); }
setInterval(() => { if (!busy && lastQuery) render(); },60000);




