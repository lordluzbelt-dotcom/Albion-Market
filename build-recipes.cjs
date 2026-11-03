'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('assets/items.js','utf8'),ctx);
const ids=new Set(ctx.window.ALBION_ITEMS.map(x=>x[0]));
const raw=JSON.parse(fs.readFileSync('recipes-source.json','utf8').replace(/^\uFEFF/,''));
const list=Object.values(raw.items).flat().filter(x=>x&&typeof x==='object'&&x['@uniquename']);
const array=x=>x?Array.isArray(x)?x:[x]:[];
const resolve=(id,ench=0)=>ench>0&&!id.includes('@')?id+'@'+ench:id;
const recipes={},meta={};
const refined=/^T\d_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL\d)?$/;
function materials(req){return array(req?.craftresource).map(r=>({id:resolve(r['@uniquename'],Number(r['@enchantmentlevel']||0)),count:Number(r['@count']),returns:r['@maxreturnamount']!=='0'&&refined.test(r['@uniquename'])}));}
function add(item,node,id,upgrade){
 if(!ids.has(id))return;
 const kind=item['@shopsubcategory1']==='refinedresources'?'refine':['weapons','armors','head','shoes','offhands','bags','capes'].includes(item['@shopcategory'])||item['@maxqualitylevel']==='5'?'craft':null;
 const choices=array(node.craftingrequirements).filter(r=>array(r.craftresource).length);
 const req=choices.find(r=>!array(r.craftresource).some(v=>/FACTION|TOKEN/.test(v['@uniquename'])))||choices[0];
 const resources=materials(req);
 // Raw gatherables and the previous-tier refined input also return during refining.
 if(kind==='refine') for(let i=0;i<resources.length;i++) resources[i].returns=array(req.craftresource)[i]['@maxreturnamount']!=='0';
 meta[id]={weight:Number(item['@weight']||0),quality:Number(item['@maxqualitylevel']||1),category:item['@shopcategory']||'',kind};
 if(req&&kind)recipes[id]={kind,output:Number(req['@amountcrafted']||1),silver:Number(req['@silver']||0),focus:Number(req['@craftingfocus']||0),materials:resources};
 const upgrades=array(upgrade?.upgraderesource).map(r=>({id:r['@uniquename'],count:Number(r['@count'])}));
 if(upgrades.length)meta[id].upgrade=upgrades;
}
for(const item of list){const base=item['@uniquename'],ench=Number(item['@enchantmentlevel']||0);add(item,item,resolve(base,ench));for(const e of array(item.enchantments?.enchantment))add(item,e,resolve(base,Number(e['@enchantmentlevel'])),e.upgraderequirements);}
fs.writeFileSync('assets/recipes.js','/* ao-data/ao-bin-dumps recipes; generated '+new Date().toISOString().slice(0,10)+'. */\nwindow.ALBION_RECIPES='+JSON.stringify(recipes)+';\nwindow.ALBION_META='+JSON.stringify(meta)+';\n');
console.log(Object.keys(recipes).length+' recetas; '+Object.keys(meta).length+' variantes con metadatos.');
console.log('T4_BAG@1',recipes['T4_BAG@1'],meta['T4_BAG@1']);
