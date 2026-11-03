(() => {
  "use strict";
  const data=JSON.parse(document.getElementById("upset-data").textContent),theme=data.theme;
  const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
  const fmt=n=>Number(n).toLocaleString(theme.numberLocale),pct=(n,d)=>d?(100*n/d).toFixed(1)+"%":"0.0%";
  const checks=new Map(data.checks.map(c=>[c.id,c])),categories=new Map(data.categories.map(c=>[c.id,c]));
  const allStatuses=[...data.status_order];
  let state={population:"holdings",status:"",category:"",checks:[],sort:"count",limit:12,multipleOnly:false,selectedKey:null};
  let current=null;
  for(const name of ["navy","blue","teal","pale","white","slate","text","border","background"])document.documentElement.style.setProperty("--"+name,theme[name]);
  document.documentElement.style.setProperty("--font",theme.font);
  for(const [name,value] of Object.entries(theme.spacing))document.documentElement.style.setProperty("--space-"+name,value+"px");
  const snapshot=new Date(data.analysis_snapshot+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  $("snapshot").textContent="Analysis snapshot · "+snapshot;$("sankey-link").href=data.sankey_href;
  for(const population of Object.values(data.populations))$("population").add(new Option(population.label,population.id));
  for(const status of allStatuses)$("status").add(new Option(status,status));
  function populationChecks(){return data.checks.filter(c=>c.population===state.population);}
  function statuses(){return state.status?[state.status]:allStatuses;}
  function labelFor(ids){return ids.map(id=>checks.get(id).label).join(" + ");}
  function chartOptions(){return {sort:state.sort,limit:state.limit,multipleOnly:state.multipleOnly};}
  function compute(filters=state){return UpSetModel.compute(data.cohorts[filters.population]||[],filters.checks,filters.status?[filters.status]:allStatuses,{sort:filters.sort,limit:filters.limit,multipleOnly:filters.multipleOnly});}
  function svgEl(tag,attributes={},parent=null,text=null){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes))node.setAttribute(k,String(v));if(text!==null)node.textContent=text;if(parent)parent.append(node);return node;}
  function wrap(text,max){const lines=[];let line="";for(const word of text.split(" ")){if(line&&(line+" "+word).length>max){lines.push(line);line=word;}else line+=(line?" ":"")+word;}if(line)lines.push(line);return lines;}
  function lines(svg,text,x,y,options={}){const values=wrap(text,options.characters||39),node=svgEl("text",{x,y,"font-size":options.size||13,"font-weight":options.weight||500,"text-anchor":options.anchor||"start",fill:options.fill||theme.text},svg);values.forEach((value,i)=>svgEl("tspan",{x,dy:i?17:0},node,value));return values.length;}
  function hideTooltip(){$("tooltip").hidden=true;}
  function tooltip(node,heading,content){
    function show(event){const tip=$("tooltip");tip.replaceChildren();const title=document.createElement("strong");title.textContent=heading;tip.append(title);for(const line of content){const span=document.createElement("span");span.textContent=line;tip.append(span);}tip.hidden=false;const rect=node.getBoundingClientRect(),x=event.clientX||rect.right,y=event.clientY||rect.top;tip.style.left=Math.max(8,Math.min(x+14,window.innerWidth-tip.offsetWidth-12))+"px";tip.style.top=Math.max(8,Math.min(y+14,window.innerHeight-tip.offsetHeight-12))+"px";}
    node.addEventListener("pointerenter",show);node.addEventListener("focus",show);node.addEventListener("pointerleave",hideTooltip);node.addEventListener("blur",hideTooltip);node.addEventListener("keydown",e=>{if(e.key==="Escape")hideTooltip();});
  }
  function updateCheckPicker(reset=false){
    const list=populationChecks(),available=list.filter(c=>c.available);
    if(reset){state.checks=available.slice(0,8).map(c=>c.id);state.category="";}
    $("category").replaceChildren(new Option("All available categories",""));
    for(const category of data.categories)if(list.some(c=>c.category===category.id))$("category").add(new Option(category.label,category.id));
    $("category").value=state.category;
    const field=$("checks");field.replaceChildren();
    for(const check of list){const label=document.createElement("label"),input=document.createElement("input"),text=document.createElement("span"),small=document.createElement("small"),accent=document.createElement("i");label.className="check-choice";input.type="checkbox";input.value=check.id;input.checked=state.checks.includes(check.id);input.disabled=!check.available;input.dataset.check=check.id;accent.className="category-accent";accent.style.backgroundColor=theme.categoryColors[check.category];text.append(accent,document.createTextNode(check.label));small.textContent=check.available?categories.get(check.category).short:"Unavailable: "+check.unavailable_reason;text.append(small);label.append(input,text);field.append(label);input.addEventListener("change",()=>{state.checks=list.filter(c=>c.available&&field.querySelector(`input[value="${c.id}"]`).checked).map(c=>c.id);state.category="";$("category").value="";state.selectedKey=null;render();});}
  }
  function selectCombination(key){
    state.selectedKey=key;
    for(const group of document.querySelectorAll(".combination"))group.classList.toggle("selected",group.dataset.key===key);
    renderRecords();const combination=current.all.find(c=>c.key===key);
    $("announcer").textContent=combination?`${fmt(combination.count)} records selected: ${labelFor(combination.checks)}.`:"Selection closed.";
  }
  function renderChart(){
    const container=$("chart");container.replaceChildren();if(!current.visible.length)return;
    const selected=populationChecks().filter(c=>state.checks.includes(c.id)),n=current.visible.length;
    const W=Math.max(1280,480+n*60+40),left=480,right=W-36,top=190,baseline=366,rowStart=420,rowGap=55;
    const matrixBottom=rowStart+(selected.length-1)*rowGap+28,H=Math.max(720,matrixBottom+140),column=(right-left)/n;
    const svg=svgEl("svg",{xmlns:NS,viewBox:`0 0 ${W} ${H}`,width:W,height:H,class:"upset-chart",role:"img","aria-labelledby":"upset-title upset-description","font-family":theme.font},container);
    svg.style.minWidth=W+"px"; // Scroll on small screens instead of shrinking labels.
    svgEl("title",{id:"upset-title"},svg,"Which anomaly flags occur together?");
    svgEl("desc",{id:"upset-description"},svg,`${fmt(current.distinct)} unique ${data.populations[state.population].unit} in ${current.all.length} exact combinations. Showing ${n} combinations. The aligned dot matrix marks present flags; muted dots do not establish passed checks. The accessible table contains all combinations.`);
    svgEl("rect",{x:0,y:0,width:W,height:H,fill:theme.white},svg);
    svgEl("text",{x:28,y:37,"font-size":23,"font-weight":600,fill:theme.navy,"data-export-title":"true"},svg,data.populations[state.population].label+" · exact flag combinations");
    svgEl("text",{x:28,y:62,"font-size":13,fill:theme.slate,"data-export-subtitle":"true"},svg,`${fmt(current.distinct)} records with selected flags · ${fmt(current.flags)} flags · ${fmt(current.multiple)} records with 2+ flags`);
    svgEl("text",{x:28,y:86,"font-size":11,fill:theme.slate},svg,`${data.populations[state.population].label} · ${fmt(current.distinct)} records / ${fmt(current.flags)} flags · ${snapshot} · ${state.status||"All evidence statuses"} · Relative to ${selected.length} selected checks`);
    svgEl("text",{x:28,y:108,"font-size":11,fill:theme.slate},svg,`${state.multipleOnly?"Chart focuses on 2+ selected flags":"Single-flag records included"} · ${state.sort==="size"?"Ordered by combination size":"Ordered by record count"} · Showing ${n} of ${current.focused.length} combinations in focus`);
    svgEl("text",{x:28,y:153,"font-size":10,"font-weight":700,"letter-spacing":1,fill:theme.slate},svg,"INDIVIDUAL CHECK TOTALS");
    svgEl("text",{x:250,y:153,"font-size":10,"font-weight":700,"letter-spacing":1,fill:theme.slate},svg,"SELECTED CHECKS");
    svgEl("text",{x:left,y:153,"font-size":10,"font-weight":700,"letter-spacing":1,fill:theme.slate},svg,"EXACT COMBINATION · UNIQUE RECORDS");
    const largest=Math.max(...current.visible.map(c=>c.count)),targetStep=largest/4,power=Math.pow(10,Math.floor(Math.log10(targetStep||1))),fraction=targetStep/power;
    const step=Math.max(1,(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power),axisMax=Math.ceil(largest/step)*step,ticks=axisMax/step;
    for(let i=0;i<=ticks;i++){const value=i*step,y=baseline-(baseline-top)*value/axisMax;svgEl("line",{x1:left,x2:right,y1:y,y2:y,stroke:theme.border,"stroke-width":.65},svg);svgEl("text",{x:left-14,y:y+4,"text-anchor":"end","font-size":11,fill:theme.slate},svg,fmt(value));}
    const maxCheck=Math.max(1,...Object.values(current.checkTotals));
    for(let i=0;i<selected.length;i++){
      const check=selected[i],y=rowStart+i*rowGap,count=current.checkTotals[check.id]||0;
      if(i%2===0)svgEl("rect",{x:left,y:y-23,width:right-left,height:46,fill:theme.background},svg);
      const group=svgEl("g",{class:"individual-check",tabindex:0,role:"img","aria-label":`${check.label}: ${fmt(count)} unique records, ${pct(count,current.distinct)} of records with selected flags. ${check.definition}`,"data-check":check.id,"data-count":count},svg);
      svgEl("rect",{x:28,y:y-6,width:count/maxCheck*104,height:12,fill:theme.navy},group);
      svgEl("text",{x:144,y:y+4,"font-size":12,fill:theme.slate},group,fmt(count));
      const labelLines=wrap(check.label,37),labelY=y-(labelLines.length-1)*8+4;
      lines(group,check.label,446,labelY,{characters:37,anchor:"end",size:13});
      svgEl("rect",{x:458,y:y-6,width:5,height:12,fill:theme.categoryColors[check.category]},group);
      tooltip(group,check.label,[`${fmt(count)} unique ${data.populations[state.population].unit}`,`${pct(count,current.distinct)} of ${fmt(current.distinct)} records with at least one selected flag`,check.definition]);
    }
    current.visible.forEach((combination,index)=>{
      const x=left+(index+.5)*column,barWidth=Math.min(40,column*.58),height=combination.count/axisMax*(baseline-top);
      const group=svgEl("g",{class:"combination"+(state.selectedKey===combination.key?" selected":""),tabindex:0,role:"button","aria-label":`${labelFor(combination.checks)}: ${fmt(combination.count)} unique records. ${pct(combination.count,current.distinct)} of records with selected flags. Select to view evidence.`,"data-key":combination.key,"data-center":x,"data-count":combination.count,"data-size":combination.size},svg);
      svgEl("rect",{x:x-column/2+3,y:top-25,width:column-6,height:matrixBottom-top+45,class:"column-hit",rx:3},group);
      svgEl("rect",{x:x-barWidth/2,y:baseline-height,width:barWidth,height:height,class:"intersection-bar","data-center":x},group);
      svgEl("text",{x,y:baseline-height-10,"text-anchor":"middle","font-size":12,"font-weight":600,fill:theme.navy},group,fmt(combination.count));
      const memberRows=selected.map((c,i)=>combination.checks.includes(c.id)?i:null).filter(i=>i!==null);
      if(memberRows.length>1)svgEl("line",{x1:x,x2:x,y1:rowStart+Math.min(...memberRows)*rowGap,y2:rowStart+Math.max(...memberRows)*rowGap,stroke:theme.navy,"stroke-width":2,class:"membership-line"},group);
      selected.forEach((check,i)=>{const present=combination.checks.includes(check.id);svgEl("circle",{cx:x,cy:rowStart+i*rowGap,r:5.5,fill:present?theme.navy:theme.border,class:present?"present-dot":"absent-dot","data-check":check.id,"data-center":x},group);});
      tooltip(group,labelFor(combination.checks),[`${fmt(combination.count)} unique ${data.populations[state.population].unit}`,`${pct(combination.count,current.distinct)} of ${fmt(current.distinct)} records with at least one selected flag`,"No other selected checks are flagged in this exact combination. Unselected checks may still be flagged."]);
      group.addEventListener("click",()=>selectCombination(combination.key));group.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectCombination(combination.key);}});
    });
    svgEl("line",{x1:28,x2:W-28,y1:H-105,y2:H-105,stroke:theme.border},svg);
    svgEl("circle",{cx:34,cy:H-80,r:5,fill:theme.navy},svg);svgEl("text",{x:47,y:H-76,"font-size":11,fill:theme.slate},svg,"Included check");
    svgEl("circle",{cx:197,cy:H-80,r:5,fill:theme.border},svg);svgEl("text",{x:210,y:H-76,"font-size":11,fill:theme.slate},svg,"No selected flag; not proof of passing");
    svgEl("rect",{x:505,y:H-86,width:10,height:12,fill:theme.teal},svg);svgEl("text",{x:524,y:H-76,"font-size":11,fill:theme.slate},svg,"Selected combination");
    const omitted=`${fmt(current.limitedRecords)} records / ${current.limitedCombinations} combinations omitted by display limit; ${fmt(current.focusExcludedRecords)} single-flag records excluded by chart focus.`;
    svgEl("text",{x:28,y:H-51,"font-size":11,fill:theme.slate},svg,omitted);
    svgEl("text",{x:28,y:H-30,"font-size":11,fill:theme.slate},svg,"Exclusive relative to selected checks and statuses. Each record counts once. Co-occurrence is not correlation or causation.");
    svgEl("text",{x:28,y:H-11,"font-size":10,fill:theme.slate},svg,"Private synthetic competition data · Provisional State Street-inspired palette; not verified official branding.");
  }
  function recordDisplay(key){try{const parts=JSON.parse(key);if((state.population.endsWith("_rows"))&&parts.length===2)return `${state.population==="transaction_rows"?"Transaction":state.population==="price_rows"?"Price":"FX"} source row ${fmt(parts[1])}`;return parts.join(" · ");}catch{return key;}}
  function renderRecords(){
    const combination=current.all.find(c=>c.key===state.selectedKey),panel=$("record-panel"),body=$("record-body");panel.hidden=!combination;body.replaceChildren();if(!combination)return;
    $("record-title").textContent=labelFor(combination.checks);$("record-context").textContent=`${fmt(combination.count)} unique ${data.populations[state.population].unit} · ${pct(combination.count,current.distinct)} of records with selected flags`;
    const seen=new Set(),examples=combination.examples.filter(e=>{if(seen.has(e.key))return false;seen.add(e.key);return true;}).slice(0,data.preview_limit);
    for(const entity of examples){const tr=document.createElement("tr"),keyCell=document.createElement("td"),members=document.createElement("td"),evidence=document.createElement("td"),strong=document.createElement("strong");strong.textContent=recordDisplay(entity.key);keyCell.append(strong);const detail=document.createElement("details"),summary=document.createElement("summary"),code=document.createElement("code");summary.textContent="Full stable key";code.textContent=entity.key;detail.append(summary,code);keyCell.append(detail);
      for(const m of entity.members.filter(m=>combination.checks.includes(m.check_id)&&statuses().includes(m.status))){const line=document.createElement("div"),label=document.createElement("span"),dot=document.createElement("i");line.className="status-label";dot.className="status-dot";dot.style.backgroundColor=theme.statusColors[m.status];label.textContent=checks.get(m.check_id).label+" — "+m.status+(m.assessment_defaulted?" (defaulted)":"");line.append(dot,label);members.append(line);}
      const link=document.createElement("a");link.href=`evidence/${encodeURIComponent(state.population)}.html#${entity.anchor}`;link.target="_blank";link.rel="noopener";link.textContent="View source evidence ↗";evidence.append(link);tr.append(keyCell,members,evidence);body.append(tr);
    }
    $("record-preview-note").textContent=`Showing ${examples.length} of ${fmt(combination.count)} contributing entities in stable-key order. Preview rows are illustrative, not a representative sample. Complete record memberships are available in memberships.csv; source findings retain all evidence references.`;
  }
  function renderTable(){const body=$("table-body");body.replaceChildren();for(const combination of current.focused){const tr=document.createElement("tr"),name=document.createElement("td"),count=document.createElement("td"),share=document.createElement("td"),size=document.createElement("td"),actions=document.createElement("td"),button=document.createElement("button");name.textContent=labelFor(combination.checks);count.textContent=fmt(combination.count);share.textContent=pct(combination.count,current.distinct);size.textContent=combination.size;count.className=share.className=size.className="numeric";button.type="button";button.className="combo-link";button.textContent=current.visible.some(c=>c.key===combination.key)?"Inspect records":"Hidden by limit · inspect";button.addEventListener("click",()=>{selectCombination(combination.key);$("record-panel").scrollIntoView({block:"nearest"});});actions.append(button);tr.append(name,count,share,size,actions);body.append(tr);}$("table-count").textContent=`${current.focused.length} combinations, including those hidden by the chart limit`;if(!current.focused.length){const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=5;cell.textContent="No combinations match the current selection and chart focus.";row.append(cell);body.append(row);}}
  function renderCoverage(){
    const target=$("coverage");target.replaceChildren();const table=document.createElement("table");table.className="coverage-table";const head=document.createElement("thead"),hr=document.createElement("tr");for(const label of ["Check","Selected unique records","Eligible entities","Unevaluable inputs","Availability"]){const th=document.createElement("th");th.scope="col";th.textContent=label;hr.append(th);}head.append(hr);table.append(head);const body=document.createElement("tbody");for(const c of populationChecks()){const row=document.createElement("tr");for(const value of [c.label,state.checks.includes(c.id)?fmt(current.checkTotals[c.id]||0):"Not selected",fmt(c.eligible_entities),fmt(c.unevaluable_entities),c.available?"Available":c.unavailable_reason]){const td=document.createElement("td");td.textContent=value;row.append(td);}body.append(row);}table.append(body);const wrap=document.createElement("div");wrap.className="table-scroll";wrap.append(table);target.append(wrap);
    const note=document.createElement("p");note.className="coverage-note";note.textContent="Unevaluable counts describe separate check inputs and can overlap; no unique unevaluable-record total is available. Missing flags are not assumed to be passed checks.";target.append(note);
    if(state.population==="transaction_rows"){const excluded=data.checks.filter(c=>["transaction_groups","pipeline_groups","reversal_groups"].includes(c.population)),p=document.createElement("p");p.className="coverage-note";p.textContent="Excluded from transaction-row intersections: "+excluded.map(c=>c.label).join("; ")+". These findings use ID-group, pipeline-ID or reversal-original case units. No validated mapping to transaction rows is applied; inspect their separate population views.";target.append(p);}
  }
  function renderMethodology(){const root=$("methodology");root.replaceChildren();const pop=data.populations[state.population];const points=[pop.grain,"Each source entity is assigned its distinct set of check IDs after the evidence-status filter. Exact intersections are relative only to currently selected checks; deselecting a check can merge combinations.","Every entity counts once across all exact-combination bars, including bars hidden by the display limit. Individual check totals can count the same entity more than once across checks. Intersection count × combination size sums to the selected flag count.","The summaries always describe all records with selected flags. The optional multiple-flag focus changes only the plotted combinations and combination table; its excluded single-flag records are explicitly disclosed.","The browser receives disjoint precomputed membership cohorts and bounded evidence previews, not raw transaction, price or holdings files. Cohorts were derived from stable record-level keys in the same findings dataset used by the Sankey.",...data.limitations];const ul=document.createElement("ul");for(const value of points){const li=document.createElement("li");li.textContent=value;ul.append(li);}root.append(ul);const p=document.createElement("p"),link=document.createElement("a"),members=document.createElement("a");link.href=data.shared_findings_href;link.textContent="Shared findings CSV";members.href="memberships.csv";members.textContent="Complete record memberships CSV";p.append(link,document.createTextNode(" · "),members);root.append(p);}
  function render(){
    hideTooltip();current=compute();const pop=data.populations[state.population];
    $("entity-total").textContent=fmt(current.distinct);$("flag-total").textContent=fmt(current.flags);$("multiple-total").textContent=fmt(current.multiple);
    $("entity-context").textContent=!Number.isFinite(pop.eligible_entities)?"Eligible population unavailable":`${pct(current.distinct,pop.eligible_entities)} of ${fmt(pop.eligible_entities)} ${pop.unit}`;$("multiple-context").textContent=`${pct(current.multiple,current.distinct)} of records with selected flags`;
    $("check-selection-label").textContent=`${state.checks.length} of ${populationChecks().filter(c=>c.available).length} available checks selected · combinations are relative to this selection`;
    $("population-note").textContent=`${pop.label} · Counting unit: ${pop.unit}`;$("selection-note").textContent="Unique records, not flag frequency";
    $("chart-scroll").hidden=!current.visible.length;$("empty-state").hidden=!!current.visible.length;
    const noAvailable=populationChecks().every(c=>!c.available);
    $("empty-state").textContent=noAvailable?"Record-level memberships are unavailable for this population. See check availability below.":!state.checks.length?"Select at least one available check to form exact combinations.":!current.distinct?"No flags match the selected checks and evidence assessments. This does not establish that the records passed those checks.":"No records have two or more of the selected flags. Include single-flag records to see the available combinations.";
    $("export-svg").disabled=$("export-png").disabled=!current.visible.length;$("export-csv").disabled=!current.focused.length;
    $("omission-note").textContent=`Showing ${current.visible.length} of ${current.focused.length} combinations in focus, representing ${fmt(current.visibleRecords)} records. Display limit omits ${current.limitedCombinations} combinations and ${fmt(current.limitedRecords)} records.${state.multipleOnly?` Multiple-flag focus separately excludes ${fmt(current.focusExcludedRecords)} single-flag records.`:" Single-flag records are included."} Choose “All combinations” or export CSV to inspect every combination in focus.`;
    $("no-flags-note").textContent=!Number.isFinite(pop.eligible_entities)?"Records with no selected flags: unavailable because the eligible population is unknown.":`${fmt(pop.eligible_entities-current.distinct)} ${pop.unit} have no selected flags. Inputs may remain unevaluated or carry flags outside this selection; absence of a flag does not establish a passed check.`;
    if(!current.all.some(c=>c.key===state.selectedKey))state.selectedKey=null;
    renderChart();renderRecords();renderTable();renderCoverage();renderMethodology();$("announcer").textContent=`${fmt(current.distinct)} records with selected flags, ${fmt(current.flags)} flags, ${fmt(current.multiple)} records with multiple flags.`;
  }
  function serializeSvg(){const original=document.querySelector("#chart svg");if(!original)return null;const clone=original.cloneNode(true);clone.setAttribute("xmlns",NS);clone.querySelector("[data-export-title]").textContent="Which anomaly flags occur together?";clone.querySelector("[data-export-subtitle]").textContent="Unique records grouped by their combination of selected flags.";for(const node of clone.querySelectorAll("[tabindex]"))node.removeAttribute("tabindex");for(const group of clone.querySelectorAll(".combination")){const selected=group.classList.contains("selected");group.querySelector(".column-hit").setAttribute("fill","transparent");group.querySelector(".intersection-bar").setAttribute("fill",selected?theme.teal:theme.navy);for(const dot of group.querySelectorAll(".present-dot"))dot.setAttribute("fill",selected?theme.teal:theme.navy);for(const line of group.querySelectorAll(".membership-line"))line.setAttribute("stroke",selected?theme.teal:theme.navy);}return new XMLSerializer().serializeToString(clone);}
  async function pngDataUrl(scale=3){const source=serializeSvg();if(!source)return null;const url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml;charset=utf-8"}));try{const image=new Image();image.src=url;await image.decode();const box=document.querySelector("#chart svg").viewBox.baseVal,canvas=document.createElement("canvas");canvas.width=box.width*scale;canvas.height=box.height*scale;const context=canvas.getContext("2d");context.fillStyle=theme.white;context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/png");}finally{URL.revokeObjectURL(url);}}
  function csvText(){
    const selected=populationChecks().filter(c=>state.checks.includes(c.id)),header=["snapshot","population","counting_unit","selected_check_ids","selected_check_definitions","selected_evidence_statuses","chart_multiple_flag_focus","sort","chart_display_limit","combination_check_ids","combination_labels","combination_size","unique_records","records_with_selected_flags_denominator","percent_of_records_with_selected_flags","selected_flag_count","drawn_in_chart",...selected.map(c=>c.id)];
    const rows=current.focused.map(c=>[data.analysis_snapshot,state.population,data.populations[state.population].unit,JSON.stringify(state.checks),JSON.stringify(Object.fromEntries(selected.map(c=>[c.id,c.definition]))),JSON.stringify(statuses()),state.multipleOnly,state.sort,state.limit,JSON.stringify(c.checks),labelFor(c.checks),c.size,c.count,current.distinct,current.distinct?100*c.count/current.distinct:0,current.flags,current.visible.some(v=>v.key===c.key),...selected.map(check=>c.checks.includes(check.id)?1:0)]);
    const quote=value=>'"'+String(value).replaceAll('"','""')+'"';return [header,...rows].map(row=>row.map(quote).join(",")).join("\r\n");
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $("export-svg").addEventListener("click",()=>download(new Blob([serializeSvg()],{type:"image/svg+xml;charset=utf-8"}),`upset-${state.population}.svg`));
  $("export-png").addEventListener("click",async()=>{try{const a=document.createElement("a");a.href=await pngDataUrl();a.download=`upset-${state.population}.png`;a.click();}catch(e){$("announcer").textContent="PNG export failed. Please use SVG export.";console.error(e);}});
  $("export-csv").addEventListener("click",()=>download(new Blob([csvText()],{type:"text/csv;charset=utf-8"}),`upset-${state.population}-all-combinations.csv`));
  $("population").addEventListener("change",()=>{state.population=$("population").value;state.selectedKey=null;updateCheckPicker(true);render();});
  $("status").addEventListener("change",()=>{state.status=$("status").value;state.selectedKey=null;render();});
  $("category").addEventListener("change",()=>{state.category=$("category").value;state.checks=populationChecks().filter(c=>c.available&&(!state.category||c.category===state.category)).map(c=>c.id);state.selectedKey=null;updateCheckPicker();render();});
  $("sort").addEventListener("change",()=>{state.sort=$("sort").value;render();});$("limit").addEventListener("change",()=>{state.limit=Number($("limit").value);render();});$("multiple-only").addEventListener("change",()=>{state.multipleOnly=$("multiple-only").checked;render();});
  $("select-all").addEventListener("click",()=>{state.checks=populationChecks().filter(c=>c.available).map(c=>c.id);state.category="";updateCheckPicker();render();});$("select-none").addEventListener("click",()=>{state.checks=[];state.category="";state.selectedKey=null;updateCheckPicker();render();});
  $("close-records").addEventListener("click",()=>selectCombination(null));
  $("reset").addEventListener("click",()=>{state={population:"holdings",status:"",category:"",checks:[],sort:"count",limit:12,multipleOnly:false,selectedKey:null};$("population").value="holdings";$("status").value="";$("sort").value="count";$("limit").value="12";$("multiple-only").checked=false;updateCheckPicker(true);render();});
  $("population").value=state.population;updateCheckPicker(true);render();
  window.upset={data,compute,serializeSvg,pngDataUrl,csvText,selectCombination,get state(){return {...state,checks:[...state.checks]};},get current(){return current;}};
})();
