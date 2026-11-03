'use strict';
const assert = require('node:assert/strict');
const M = require('./market.js');
const now = Date.parse('2026-10-25T18:00:00Z');
assert.equal(M.parseDate('2026-10-25T17:00:00'), now-3600000);
assert.equal(M.parseDate('2026-10-25T17:00:00Z'), now-3600000);
assert.equal(M.parseDate('0001-01-01T00:00:00'), null);
assert.equal(M.age('2026-10-25T17:57:00',now).label,'Hace 3 minutos');
assert.equal(M.age('2026-10-25T17:00:00',now).className,'moderate');
assert.equal(M.age('2026-10-24T18:00:00',now).className,'old');
assert.equal(M.age('2026-10-25T19:00:00',now).className,'unknown');
const data = [
 {item_id:'T4_BAG',quality:1,city:'Martlock',sell_price_min:125000,buy_price_max:0},
 {item_id:'T4_BAG',quality:1,city:'Caerleon',sell_price_min:150000,buy_price_max:145000},
 {item_id:'T4_BAG',quality:2,city:'Thetford',sell_price_min:1,buy_price_max:999999},
 {item_id:'T5_BAG',quality:1,city:'Brecilien',sell_price_min:1,buy_price_max:999999}
];
const rows=M.rows(data,'T4_BAG',1), best=M.best(rows);
assert.equal(rows.length,7);
assert.equal(best.buy.city,'Martlock'); assert.equal(best.sell.city,'Caerleon');
assert.equal(rows.find(x=>x.city==='Brecilien').sell,null);
assert.equal(M.best(M.rows([],'T4_BAG',1)).buy,null);
const result=M.calculate(125000,145000,100,4,0);
assert.equal(result.investment,12500000); assert.equal(result.revenue,14500000);
assert.equal(result.gross,2000000); assert.equal(result.net,1420000);
assert.equal(result.grossRoi,16); assert(Math.abs(result.roi - 11.36) < 1e-10);
assert.equal(M.calculate(125000,145000,100,8,2.5).net,477500);
assert.equal(M.calculate(145000,125000,1,4,0).net,-25000);
assert.equal(M.calculate(0,1,1,4,0),null); assert.equal(M.calculate(1,2,1.5,4,0),null);
assert.equal(M.calculate(1,2,1,101,0),null);
for (const bad of [0,-1,null,undefined,NaN,Infinity,'x']) assert.equal(M.positive(bad),null);
const vm=require('node:vm'), fs=require('node:fs'), ctx={window:{}};
vm.runInNewContext(fs.readFileSync('assets/items.js','utf8'),ctx);
assert(ctx.window.ALBION_ITEMS.some(x=>x[0]==='T4_ORE_LEVEL4@4'));
assert(ctx.window.ALBION_ITEMS.some(x=>x[0]==='T8_BAG@4'));
console.log('OK: fechas UTC, antigüedad, filtrado, siete ciudades, ceros, ROI, cantidad, impuestos, pérdidas y catálogo.');

