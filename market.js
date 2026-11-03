/* Shared, dependency-free market calculations; also usable from Node tests. */
(function (root) {
  'use strict';
  const cities = ['Bridgewatch', 'Martlock', 'Lymhurst', 'Thetford', 'Fort Sterling', 'Caerleon', 'Brecilien'];
  const positive = x => Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null;
  function parseDate(value) {
    if (!value || /^0001-|^1970-01-01T00:00:00/.test(value)) return null;
    const time = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + 'Z');
    return Number.isFinite(time) ? time : null;
  }
  function age(value, now = Date.now()) {
    const time = parseDate(value);
    if (time === null) return {className:'unknown', label:'Fecha desconocida', exact:'Sin fecha de observación'};
    if (time > now + 300000) return {className:'unknown', label:'Fecha inconsistente', exact:new Date(time).toLocaleString('es-PE')};
    const minutes = Math.floor(Math.max(0, now - time) / 60000);
    const hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
    const text = days ? `${days} ${days === 1 ? 'día' : 'días'}` : hours ? `${hours} ${hours === 1 ? 'hora' : 'horas'}` : minutes ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}` : 'menos de 1 minuto';
    return {className: minutes < 60 ? 'fresh' : hours < 24 ? 'moderate' : 'old', label:'Hace ' + text, exact:new Date(time).toLocaleString('es-PE', {dateStyle:'medium', timeStyle:'short'})};
  }
  function rows(data, item, quality) {
    return cities.map(city => {
      const row = data.find(x => x.city === city && x.item_id === item && Number(x.quality) === Number(quality));
      return {city, sell:positive(row?.sell_price_min), buy:positive(row?.buy_price_max), sellDate:row?.sell_price_min_date, buyDate:row?.buy_price_max_date};
    });
  }
  function best(rows) {
    const buys = rows.filter(x => x.sell !== null), sells = rows.filter(x => x.buy !== null);
    return {buy:buys.reduce((a,b) => !a || b.sell < a.sell ? b : a, null), sell:sells.reduce((a,b) => !a || b.buy > a.buy ? b : a, null), order:buys.reduce((a,b) => !a || b.sell > a.sell ? b : a, null)};
  }
  function calculate(buy, sell, quantity, tax, setup) {
    if (![buy,sell,quantity].every(x => Number.isFinite(x) && x > 0) || !Number.isInteger(quantity) || ![tax,setup].every(x => Number.isFinite(x) && x >= 0 && x <= 100)) return null;
    const investment = buy * quantity, revenue = sell * quantity, gross = revenue - investment, fees = revenue * (tax + setup) / 100, net = gross - fees;
    return {investment, revenue, gross, fees, net, grossRoi:gross / investment * 100, roi:net / investment * 100};
  }
  const api = {cities, positive, parseDate, age, rows, best, calculate};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Market = api;
})(typeof window !== 'undefined' ? window : globalThis);
