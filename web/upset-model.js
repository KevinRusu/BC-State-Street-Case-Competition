/* Pure projection model, also exercised in Node without a browser. */
(function(root){
  "use strict";
  function compute(cohorts,selectedChecks,selectedStatuses,options={}) {
    const selected=new Set(selectedChecks),statuses=new Set(selectedStatuses),groups=new Map();
    const checkTotals=Object.fromEntries([...selected].map(id=>[id,0]));
    for(const cohort of cohorts) {
      const members=[...new Set(cohort.members.filter(m=>selected.has(m.check_id)&&statuses.has(m.status)).map(m=>m.check_id))].sort();
      if(!members.length)continue;
      const key=JSON.stringify(members);
      if(!groups.has(key))groups.set(key,{key,checks:members,size:members.length,count:0,examples:[]});
      const combination=groups.get(key);combination.count+=cohort.count;
      combination.examples.push(...(cohort.examples||[]));
      for(const id of members)checkTotals[id]+=cohort.count;
    }
    const all=[...groups.values()];
    for(const combination of all)combination.examples.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
    all.sort((a,b)=>options.sort==="size" ? b.size-a.size||b.count-a.count||(a.key<b.key?-1:1) : b.count-a.count||b.size-a.size||(a.key<b.key?-1:1));
    const distinct=all.reduce((n,c)=>n+c.count,0),flags=all.reduce((n,c)=>n+c.count*c.size,0),multiple=all.filter(c=>c.size>=2).reduce((n,c)=>n+c.count,0);
    const focused=options.multipleOnly?all.filter(c=>c.size>=2):all;
    const limit=Number(options.limit)||0,visible=limit?focused.slice(0,limit):focused;
    const focusedRecords=focused.reduce((n,c)=>n+c.count,0),visibleRecords=visible.reduce((n,c)=>n+c.count,0);
    const limitedRecords=focusedRecords-visibleRecords,limitedCombinations=focused.length-visible.length;
    return {all,focused,visible,distinct,flags,multiple,checkTotals,visibleRecords,focusedRecords,limitedRecords,limitedCombinations,focusExcludedRecords:distinct-focusedRecords};
  }
  root.UpSetModel={compute};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.UpSetModel;
})(globalThis);
