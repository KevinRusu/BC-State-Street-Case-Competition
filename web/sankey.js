/* Offline, dependency-free SVG renderer. Shared inputs also serve the UpSet view. */
(() => {
  "use strict";
  const data = JSON.parse(document.getElementById("findings-data").textContent);
  const theme = data.theme;
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value).toLocaleString(theme.numberLocale);
  const pct = (value, total) => total ? (100 * value / total).toFixed(1) + "%" : "0.0%";
  const NS = "http://www.w3.org/2000/svg";
  const checks = new Map(data.checks.map(c => [c.id,c]));
  const categories = new Map(data.categories.map(c => [c.id,c]));
  let state = {population:"holdings", status:"", category:""};
  let current = null;
  for (const token of ["navy","blue","teal","pale","white","slate","text","border","background"]) document.documentElement.style.setProperty("--" + token, theme[token]);
  document.documentElement.style.setProperty("--font",theme.font);
  for (const [token,value] of Object.entries(theme.spacing)) document.documentElement.style.setProperty("--space-"+token,value+"px");
  const snapshot = new Date(data.analysis_snapshot + "T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  $("snapshot").textContent = "Analysis snapshot · " + snapshot;
  for (const population of Object.values(data.populations)) $("population").add(new Option(population.label,population.id));
  for (const status of data.status_order) $("status").add(new Option(status,status));

  function selection(filters=state) {
    const groups = data.groups.filter(g => g.population===filters.population && (!filters.status || g.status===filters.status) && (!filters.category || checks.get(g.check_id).category===filters.category));
    const total = groups.reduce((s,g)=>s+g.entities.length,0);
    const affected = new Set(groups.flatMap(g=>g.entities));
    return {groups,total,affected:affected.size,filters:{...filters}};
  }
  function countFor(groups) { return groups.reduce((s,g)=>s+g.entities.length,0); }
  function distinctFor(groups) { return new Set(groups.flatMap(g=>g.entities)).size; }
  function el(tag,attrs={},parent=null,text=null) {
    const node=document.createElementNS(NS,tag);
    for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));
    if (text!==null) node.textContent=text;
    if(parent) parent.appendChild(node);
    return node;
  }
  function wrap(text,width) {
    const words=text.split(" "), lines=[]; let line="";
    for(const word of words) {
      if(line && (line+" "+word).length>width) { lines.push(line);line=word; }
      else line+=(line?" ":"")+word;
    }
    if(line) lines.push(line);
    return lines;
  }
  function textBlock(svg,text,x,y,options={}) {
    const lines=wrap(text,options.characters||31);
    const node=el("text",{x,y,"font-size":options.size||14,"font-weight":options.weight||600,"text-anchor":options.anchor||"start",class:options.class||"node-label"},svg);
    lines.forEach((line,i)=>el("tspan",{x,dy:i?17:0},node,line));
    return {node,lines:lines.length};
  }
  function resetHighlights() {
    for(const ribbon of document.querySelectorAll(".ribbon")) {ribbon.style.opacity="1";ribbon.classList.remove("is-highlighted");}
    $("tooltip").hidden=true;
  }
  function highlight(kind,id) {
    for(const ribbon of document.querySelectorAll(".ribbon")) {
      const selected=kind==="check" ? ribbon.dataset.check===id : kind==="category" ? ribbon.dataset.category===id : ribbon.dataset.status===id;
      ribbon.style.opacity=selected?"1":".12";
      ribbon.classList.toggle("is-highlighted",selected);
    }
  }
  function bindTooltip(node,kind,id,label,groups,definition) {
    const count=countFor(groups), pop=data.populations[state.population];
    node.setAttribute("tabindex","0");node.setAttribute("role","img");
    node.setAttribute("aria-label",`${label}: ${fmt(count)} flags, ${pct(count,current.total)} of selected ${pop.label.toLowerCase()} flags. ${definition}`);
    function show(event) {
      highlight(kind,id);
      const tip=$("tooltip");tip.replaceChildren();
      const title=document.createElement("strong");title.textContent=label;tip.appendChild(title);
      for(const text of [`${fmt(count)} flags · ${fmt(distinctFor(groups))} distinct ${pop.unit}`,`${pct(count,current.total)} of ${fmt(current.total)} selected ${pop.label.toLowerCase()} flags`,definition]) {
        const span=document.createElement("span");span.textContent=text;tip.appendChild(span);
      }
      tip.hidden=false;
      const rect=node.getBoundingClientRect();
      const x=event.clientX||rect.right, y=event.clientY||rect.top;
      tip.style.left=Math.max(8,Math.min(x+15,window.innerWidth-tip.offsetWidth-12))+"px";
      tip.style.top=Math.max(8,Math.min(y+15,window.innerHeight-tip.offsetHeight-12))+"px";
    }
    node.addEventListener("pointerenter",show);node.addEventListener("focus",show);
    node.addEventListener("pointerleave",resetHighlights);node.addEventListener("blur",resetHighlights);
    node.addEventListener("keydown",event=>{if(event.key==="Escape") resetHighlights();});
  }
  function ribbon(svg,x0,y0,x1,y1,height,color,attributes) {
    const c=(x1-x0)*.48;
    const path=`M${x0},${y0} C${x0+c},${y0} ${x1-c},${y1} ${x1},${y1} L${x1},${y1+height} C${x1-c},${y1+height} ${x0+c},${y0+height} ${x0},${y0+height} Z`;
    return el("path",{d:path,fill:color,class:"ribbon","fill-opacity":.19,...attributes},svg);
  }
  function renderChart() {
    const chart=$("chart");chart.replaceChildren();
    const groupByCheck=new Map();
    for(const c of data.checks) {
      const groups=current.groups.filter(g=>g.check_id===c.id);
      if(groups.length) groupByCheck.set(c.id,{...c,groups,count:countFor(groups)});
    }
    const anomalies=[...groupByCheck.values()];
    if(!anomalies.length) return;
    const W=1280,H=Math.max(760,anomalies.length*84+280),top=148,bottom=H-115;
    const svg=el("svg",{xmlns:NS,viewBox:`0 0 ${W} ${H}`,width:W,height:H,class:"sankey",role:"img","aria-labelledby":"svg-title svg-description","font-family":theme.font},chart);
    el("title",{id:"svg-title"},svg,"Anomaly flags and evidence status");
    el("desc",{id:"svg-description"},svg,`${fmt(current.total)} flags across ${fmt(current.affected)} distinct ${data.populations[state.population].unit}. Links describe classification, not propagation. Exact counts are available in the accompanying table.`);
    el("rect",{x:0,y:0,width:W,height:H,fill:theme.white},svg);
    el("text",{x:32,y:39,"font-size":23,"font-weight":600,fill:theme.navy,"data-export-title":"true"},svg,data.populations[state.population].label);
    el("text",{x:32,y:65,"font-size":13,fill:theme.slate,"data-export-subtitle":"true"},svg,`${fmt(current.total)} flags · ${fmt(current.affected)} distinct affected entities · ${snapshot}`);
    el("text",{x:32,y:89,"font-size":11,fill:theme.slate,"data-export-filters":"true"},svg,`${state.category?categories.get(state.category).label:"All categories"} · ${state.status||"All evidence statuses"}`);
    const columns=[[32,"01  CATEGORY"],[486,"02  SPECIFIC ANOMALY"],[1070,"03  EVIDENCE STATUS"]];
    for(const [x,label] of columns) el("text",{x,y:123,"font-size":10,"font-weight":700,"letter-spacing":1.1,fill:theme.slate},svg,label);
    const avail=bottom-top,gap=22,minLane=52;
    let low=0,high=avail/current.total;
    for(let i=0;i<50;i++) {
      const k=(low+high)/2;
      const used=anomalies.reduce((s,a)=>s+Math.max(a.count*k,minLane),0)+gap*(anomalies.length-1);
      if(used>avail)high=k;else low=k;
    }
    const scale=low;
    let cursor=top;
    const catNodes=[];
    for(const category of data.categories) {
      const items=anomalies.filter(a=>a.category===category.id);
      if(!items.length)continue;
      const start=cursor;
      for(const a of items) {
        const lane=Math.max(a.count*scale,minLane);
        a.height=a.count*scale;a.y=cursor+(lane-a.height)/2;a.center=cursor+lane/2;
        cursor+=lane+gap;
      }
      const end=cursor-gap,count=items.reduce((s,a)=>s+a.count,0),height=count*scale;
      catNodes.push({...category,items,count,height,y:(start+end-height)/2,groups:items.flatMap(a=>a.groups)});
    }
    const presentStatuses=data.status_order.map(status=>({status,groups:current.groups.filter(g=>g.status===status)})).filter(s=>s.groups.length);
    const totalStatusHeight=current.total*scale+35*(presentStatuses.length-1);
    let sy=top+(avail-totalStatusHeight)/2;
    const statusNodes=presentStatuses.map(s=>{const count=countFor(s.groups),height=count*scale;const node={...s,count,height,y:sy,cursor:sy};sy+=height+35;return node;});
    const links=el("g",{},svg),nodes=el("g",{},svg),labels=el("g",{},svg);
    for(const cat of catNodes) {
      let cy=cat.y;
      for(const a of cat.items) {
        const attrs={"data-check":a.id,"data-category":cat.id,"data-status":a.status,"data-value":a.count,"data-stage":"category-anomaly"};
        const path=ribbon(links,304,cy,826,a.y,a.height,theme.categoryColors[cat.id],attrs);
        bindTooltip(path,"check",a.id,a.label,a.groups,a.definition);cy+=a.height;
      }
    }
    for(const a of anomalies) {
      let ay=a.y;
      for(const status of data.status_order) {
        const groups=a.groups.filter(g=>g.status===status);if(!groups.length)continue;
        const target=statusNodes.find(s=>s.status===status),height=countFor(groups)*scale;
        const path=ribbon(links,836,ay,1050,target.cursor,height,theme.statusColors[status],{"data-check":a.id,"data-category":a.category,"data-status":status,"data-value":countFor(groups),"data-stage":"anomaly-status"});
        bindTooltip(path,"check",a.id,a.label,groups,a.definition);ay+=height;target.cursor+=height;
      }
    }
    for(const cat of catNodes) {
      const rect=el("rect",{x:294,y:cat.y,width:10,height:cat.height,fill:theme.categoryColors[cat.id],class:"node"},nodes);
      bindTooltip(rect,"category",cat.id,cat.label,cat.groups,"All selected anomaly flags assigned to this category. An entity can contribute more than one flag.");
      const lines=wrap(cat.short,27),y=cat.y+cat.height/2-(lines.length-1)*8-6;
      const label=textBlock(labels,cat.short,32,y,{characters:27,size:15});
      el("text",{x:32,y:y+label.lines*17+4,"font-size":12,class:"node-count"},labels,`${fmt(cat.count)} flags`);
    }
    for(const a of anomalies) {
      const rect=el("rect",{x:826,y:a.y,width:10,height:Math.max(a.height,.6),fill:theme.categoryColors[a.category],class:"node"},nodes);
      bindTooltip(rect,"check",a.id,a.label,a.groups,a.definition);
      const lines=wrap(a.label,39),y=a.center-(lines.length-1)*8-6;
      const label=textBlock(labels,a.label,808,y,{anchor:"end",characters:39,size:13});
      el("text",{x:808,y:y+label.lines*17+3,"text-anchor":"end","font-size":11,class:"node-label node-count"},labels,`${fmt(a.count)} · ${pct(a.count,current.total)} of selected flags`);
    }
    for(const s of statusNodes) {
      const rect=el("rect",{x:1050,y:s.y,width:10,height:s.height,fill:theme.statusColors[s.status],class:"node"},nodes);
      bindTooltip(rect,"status",s.status,s.status,s.groups,"The existing evidence assessment, with missing assessments defaulted to unresolved. This is not remediation status.");
      const y=s.y+s.height/2-7;
      const label=textBlock(labels,s.status,1075,y,{characters:20,size:13});
      el("text",{x:1075,y:y+label.lines*17+4,"font-size":12,class:"node-count"},labels,`${fmt(s.count)} · ${pct(s.count,current.total)}`);
    }
    el("line",{x1:32,x2:1248,y1:H-88,y2:H-88,stroke:theme.border},svg);
    let lx=32;
    for(const status of data.status_order) {
      el("circle",{cx:lx+4,cy:H-63,r:4,fill:theme.statusColors[status]},svg);
      el("text",{x:lx+15,y:H-59,"font-size":11,fill:theme.slate},svg,status);
      lx+=status==="Unresolved hypothesis"?205:180;
    }
    el("text",{x:32,y:H-34,"font-size":11,fill:theme.slate},svg,"One record may contribute multiple flags. Ribbon widths count flags within this population, not unique records.");
    el("text",{x:32,y:H-15,"font-size":10,fill:theme.slate},svg,"Classification and evidence assessment only · Provisional State Street-inspired palette; not verified official branding.");
  }

  function renderTable() {
    const tbody=$("table-body");tbody.replaceChildren();
    const relevant=data.checks.filter(c=>c.population===state.population&&(!state.category||c.category===state.category));
    let rows=0;
    for(const c of relevant) {
      if(state.status && c.status!==state.status)continue;
      const groups=current.groups.filter(g=>g.check_id===c.id);
      const n=countFor(groups),tr=document.createElement("tr");
      const first=document.createElement("td"),strong=document.createElement("strong"),small=document.createElement("small");
      strong.textContent=c.label;small.textContent=categories.get(c.category).label;first.append(strong,small);
      const status=document.createElement("td"),badge=document.createElement("span"),dot=document.createElement("span");badge.className="status-label";dot.className="status-dot";dot.style.backgroundColor=theme.statusColors[c.status];badge.append(dot,document.createTextNode(c.status));status.append(badge);
      const count=document.createElement("td"),share=document.createElement("td");count.className=share.className="numeric";count.textContent=c.available?fmt(n):"Unavailable";share.textContent=c.available?pct(n,current.total):"—";
      const definition=document.createElement("td"),reference=document.createElement("small"),coverage=document.createElement("small");definition.textContent=c.available?c.definition:c.unavailable_reason;
      reference.textContent=`Assessment: ${c.assessment_reference}${c.assessment_defaulted?" (defaulted)":""}.`;
      coverage.textContent=`${fmt(c.eligible_entities)} population entities; ${fmt(c.unevaluable_entities)} unevaluable for this check.`;
      definition.append(reference,coverage);tr.append(first,status,count,share,definition);tbody.appendChild(tr);rows++;
    }
    $("table-count").textContent=`${rows} check${rows===1?"":"s"}`;
    if(!rows) {const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.textContent="No checks have this evidence assessment in the selected population.";tr.appendChild(td);tbody.appendChild(tr);}
  }
  function renderMethodology() {
    const root=$("methodology");root.replaceChildren();
    const pop=data.populations[state.population];
    for(const text of [pop.grain,`The eligible population has ${fmt(pop.eligible_entities)} ${pop.unit}. The affected-entity measure is the union after all filters; repeated checks on an entity increase flags but not distinct entities. Percentages in the chart and table use the currently selected flag total as their denominator.`,"Flag identity: analysis snapshot + population + stable entity key + check ID. Repeated ingestion of the same finding is idempotent. Duplicate ID case populations are deliberately separate from physical rows."]) {const p=document.createElement("p");p.textContent=text;root.appendChild(p);}
    const ul=document.createElement("ul");for(const limitation of data.limitations) {const li=document.createElement("li");li.textContent=limitation;ul.appendChild(li);}root.appendChild(ul);
    const h=document.createElement("h2");h.textContent="Check coverage in this population";root.appendChild(h);
    const list=document.createElement("ul");for(const c of data.checks.filter(c=>c.population===state.population)) {const li=document.createElement("li");li.textContent=`${c.label}: ${c.available?`${fmt(c.flag_count)} flags; ${fmt(c.unevaluable_entities)} unevaluable`:"unavailable — "+c.unavailable_reason}.`;list.appendChild(li);}root.appendChild(list);
    if(state.population==="holdings") {for(const [name,a] of Object.entries(data.row_accounting)) {const p=document.createElement("p");p.textContent=`${name}: ${fmt(a.raw_rows)} raw rows = ${fmt(a.snapshot_valid_key_rows)} valid keys at snapshot + ${fmt(a.invalid_key_rows)} invalid-key rows + ${fmt(a.outside_snapshot_rows)} rows at other dates.`;root.appendChild(p);}}
  }
  function render() {
    resetHighlights();current=selection();
    const pop=data.populations[state.population];
    $("flag-total").textContent=fmt(current.total);$("entity-total").textContent=fmt(current.affected);
    $("flag-context").textContent=`Across ${current.groups.length} assessed anomaly types`;
    $("entity-context").textContent=`${pct(current.affected,pop.eligible_entities)} of ${fmt(pop.eligible_entities)} ${pop.unit}`;
    $("population-note").textContent=`${pop.label} · Counting unit: ${pop.unit}`;
    $("selection-note").textContent=state.category?"Category focus: "+categories.get(state.category).short:"All available categories in this population";
    const defaulted=current.groups.filter(g=>checks.get(g.check_id).assessment_defaulted).reduce((s,g)=>s+g.entities.length,0);
    $("assessment-note").textContent=defaulted?`${fmt(defaulted)} selected flags have no assessment in the source catalog and default to Unresolved hypothesis. Other assessments preserve the notebook catalog; no clearances are invented.`:"Assessments preserve the source notebook catalog. No clearances or root-cause assignments have been invented.";
    const available=data.checks.filter(c=>c.population===state.population&&(!state.category||c.category===state.category));
    const allUnavailable=available.length>0&&available.every(c=>!c.available);
    $("empty-state").hidden=current.total>0;
    $("empty-state").textContent=allUnavailable?"The selected checks are unavailable. See the data table for the missing evidence.":"No assessed flags match these filters. This does not establish that every record is defect-free.";
    $("chart-scroll").hidden=!current.total;$("export-svg").disabled=$("export-png").disabled=!current.total;
    renderChart();renderTable();renderMethodology();
    $("announcer").textContent=`${fmt(current.total)} flags across ${fmt(current.affected)} distinct ${pop.unit}.`;
  }
  function syncCategories() {
    const select=$("category");select.replaceChildren(new Option("All categories",""));
    for(const c of data.categories) if(data.checks.some(check=>check.population===state.population&&check.category===c.id))select.add(new Option(c.label,c.id));
    if(![...select.options].some(o=>o.value===state.category))state.category="";
    select.value=state.category;
  }
  function serializeSvg() {
    const original=document.querySelector("#chart svg");if(!original)return null;
    const clone=original.cloneNode(true);clone.setAttribute("xmlns",NS);
    clone.querySelector("[data-export-title]").textContent="Anomaly flags and evidence status.";
    clone.querySelector("[data-export-subtitle]").textContent="One record may contribute multiple flags.";
    clone.querySelector("[data-export-filters]").textContent=`${data.populations[state.population].label} · ${fmt(current.total)} flags / ${fmt(current.affected)} affected entities · ${snapshot} · ${state.category?categories.get(state.category).short:"All categories"} · ${state.status||"All statuses"}`;
    for(const node of clone.querySelectorAll("[tabindex]"))node.removeAttribute("tabindex");
    for(const path of clone.querySelectorAll(".ribbon")){path.setAttribute("fill-opacity",".22");path.removeAttribute("style");}
    for(const text of clone.querySelectorAll(".node-label")){text.setAttribute("fill",theme.text);text.setAttribute("stroke",theme.white);text.setAttribute("stroke-width","5");text.setAttribute("paint-order","stroke");text.setAttribute("stroke-linejoin","round");}
    for(const text of clone.querySelectorAll(".node-count"))text.setAttribute("fill",theme.slate);
    for(const rect of clone.querySelectorAll(".node")){rect.setAttribute("stroke",theme.white);rect.setAttribute("stroke-width",".6");}
    return new XMLSerializer().serializeToString(clone);
  }
  function download(blob,name) {
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function pngDataUrl(scale=3) {
    const source=serializeSvg();if(!source)return null;
    const url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml;charset=utf-8"}));
    try {
      const image=new Image();image.src=url;await image.decode();
      const svg=document.querySelector("#chart svg"),box=svg.viewBox.baseVal;
      const canvas=document.createElement("canvas");canvas.width=box.width*scale;canvas.height=box.height*scale;
      const context=canvas.getContext("2d");context.fillStyle=theme.white;context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas.toDataURL("image/png");
    } finally {URL.revokeObjectURL(url);}
  }
  $("export-svg").addEventListener("click",()=>download(new Blob([serializeSvg()],{type:"image/svg+xml;charset=utf-8"}),`anomaly-flags-${state.population}.svg`));
  $("export-png").addEventListener("click",async()=>{try{const uri=await pngDataUrl();const a=document.createElement("a");a.href=uri;a.download=`anomaly-flags-${state.population}.png`;a.click();}catch(error){$("announcer").textContent="PNG export failed. Please use SVG export.";console.error(error);}});
  $("population").addEventListener("change",()=>{state.population=$("population").value;syncCategories();render();});
  $("category").addEventListener("change",()=>{state.category=$("category").value;render();});
  $("status").addEventListener("change",()=>{state.status=$("status").value;render();});
  $("reset").addEventListener("click",()=>{state={population:"holdings",status:"",category:""};$("population").value=state.population;$("status").value="";syncCategories();render();});
  $("population").value=state.population;syncCategories();render();
  // Deterministic hooks for reconciliation tests and presentation export.
  window.sankey={data,selection,serializeSvg,pngDataUrl,get state(){return {...state};},get current(){return {...current};}};
})();
