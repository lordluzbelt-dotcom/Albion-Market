/* Pure economic models. Returns are valued separately from initial capital. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function production(recipe,prices,sale,options){
 const {actions,returnRate,tax,setup,station,focusFactor=1,useFocus=false}=options;
 if(!recipe||!Number.isInteger(actions)||actions<1||!finite(sale)||sale<=0||![returnRate,tax,setup,station,focusFactor].every(finite)||returnRate<0||returnRate>=100||tax<0||tax>100||setup<0||setup>100||station<0||focusFactor<0)return null;
 let materials=0,returned=0;const breakdown=[];
 for(const m of recipe.materials){const price=prices[m.id];if(!finite(price)||price<=0||!finite(m.count)||m.count<=0)return null;const quantity=m.count*actions,cost=quantity*price,credit=m.returns?cost*returnRate/100:0;materials+=cost;returned+=credit;breakdown.push({...m,quantity,price,cost,returned:credit});}
 const units=recipe.output*actions,stationCost=(station+recipe.silver)*actions,investment=materials+stationCost,revenue=sale*units,fees=revenue*(tax+setup)/100,cost=investment-returned,net=revenue-fees-cost,focus=useFocus?Math.ceil(recipe.focus*focusFactor*actions):0;
 return {actions,units,investment,materials,returned,cost,stationCost,revenue,fees,net,roi:investment?net/investment*100:0,focus,breakdown};
}
function allocate(candidates,{budget,maxShare,maxActions,focusBudget=Infinity}){
 if(!finite(budget)||budget<=0||!finite(maxShare)||maxShare<=0||maxShare>100||!Number.isInteger(maxActions)||maxActions<1||focusBudget<0)return null;
 let remaining=budget,focusLeft=focusBudget;const plan=[];
 const sorted=candidates.filter(x=>x.model&&x.model.net>0&&x.model.investment>0).sort((a,b)=>b.model.net/b.model.investment-a.model.net/a.model.investment||a.id.localeCompare(b.id));
 for(const c of sorted){const m=c.model,limit=Math.min(remaining,budget*maxShare/100);const n=Math.min(maxActions,Math.floor((limit+1e-8)/m.investment),m.focus>0?Math.floor(focusLeft/m.focus):Infinity);if(n<1)continue;const investment=n*m.investment,focus=n*m.focus;plan.push({...c,actions:n,units:n*m.units,investment,net:n*m.net,focus});remaining=Math.max(0,remaining-investment);focusLeft-=focus;}
 return {plan,spent:budget-remaining,remaining,net:plan.reduce((n,x)=>n+x.net,0),focus:plan.reduce((n,x)=>n+x.focus,0)};
}
function transport(buy,sell,{quantity,budget,capacity,weight,tax,cost}){
 if(![buy,sell,quantity,budget,capacity,weight,tax,cost].every(finite)||buy<=0||sell<=0||!Number.isInteger(quantity)||quantity<1||budget<=0||capacity<=0||weight<0||tax<0||tax>100||cost<0)return null;
 const units=Math.min(quantity,Math.floor(Math.max(0,budget-cost)/buy),weight>0?Math.floor(capacity/weight):quantity);
 if(units<1)return null;const investment=buy*units+cost,revenue=sell*units,fees=revenue*tax/100,net=revenue-fees-investment;
 return {units,investment,revenue,fees,net,roi:net/investment*100,weight:units*weight,cost};
}
function enchant(base,target,steps,prices,quantity,fee){
 if(!finite(base)||base<=0||!finite(target)||target<=0||!Number.isInteger(quantity)||quantity<1||!finite(fee)||fee<0||!steps.length)return null;
 let materials=0;for(const m of steps){if(!finite(prices[m.id])||prices[m.id]<=0)return null;materials+=prices[m.id]*m.count;}
 const self=(base+materials+fee)*quantity,direct=target*quantity,saving=direct-self;
 return {self,direct,saving,materials:materials*quantity,base:base*quantity,fee:fee*quantity,roi:self?saving/self*100:0};
}
const api={production,allocate,transport,enchant};if(typeof module!=='undefined')module.exports=api;else root.Economy=api;
})(typeof window!=='undefined'?window:globalThis);
