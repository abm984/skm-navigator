/* ==== INDOOR: per-building multi-floor editor + floor-aware routing + sensors ==== */
window.SKM=window.SKM||{};
SKM.indoor=(function(){
  const FLOOR_COST=200;
  const $=s=>document.querySelector(s);
  const uid=()=>Math.random().toString(36).slice(2,9);
  let svg,vp;
  let bId=null, ui={floor:0,tool:"select",selected:null,edgeFrom:null,route:null,view:{s:1,tx:60,ty:60},curFloor:0};

  function building(){return SKM.data.getStore().buildings.find(b=>b.id===bId);}
  function floor(){return building().floors[ui.floor];}
  function persist(){SKM.data.save();}

  function bootDom(){
    svg=$("#isvg"); vp=$("#ivp");
    // tools
    document.querySelectorAll("#indoorView .tool").forEach(b=>b.onclick=()=>{
      document.querySelectorAll("#indoorView .tool").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");ui.tool=b.dataset.tool;ui.edgeFrom=null;hud();render();});
    $("#iBgIn").addEventListener("change",onBg);
    $("#iName").addEventListener("input",e=>{const n=nodeById(ui.selected);if(n){n.name=e.target.value;render();dropdowns();persist();}});
    $("#iGroup").addEventListener("input",e=>{const n=nodeById(ui.selected);if(n){n.group=e.target.value;render();dropdowns();persist();}});
    $("#iGo").onclick=route; $("#iClr").onclick=()=>{ui.route=null;$("#iDirs").innerHTML="";tabs();render();};
    $("#izin").onclick=()=>zoom(1.2);$("#izout").onclick=()=>zoom(1/1.2);$("#ifit").onclick=fit;
    $("#iExp").onclick=exportB; $("#iImp").addEventListener("change",importB);
    $("#iMotion").onclick=enableMotion;
    // pointer
    svg.addEventListener("pointerdown",pDown);svg.addEventListener("pointermove",pMove);svg.addEventListener("pointerup",pUp);
    svg.addEventListener("wheel",wheel,{passive:false});
    SKM.sensors.setCallbacks({onStep:onStep,onRide:onRide});
    setInterval(()=>{if(SKM.sensors.isOn())maybeRide();},1500);
  }

  /* ---- open/close ---- */
  function open(buildingId,destNodeId){
    bId=buildingId; ui.floor=0; ui.curFloor=0; ui.selected=null; ui.route=null;
    $("#iBuilding").textContent=building().name;
    tabs();chips();dropdowns();render();fit();hud();
    if(destNodeId){ // pre-set destination = the room, start = ground entrance
      $("#iToSel").value=destNodeId;
      const ent=groundStart(); if(ent)$("#iFromSel").value=ent;
      route();
    }
  }
  function groundStart(){ // pick a ground-floor destination/entrance node as start
    const g=building().floors[0]; const ent=g.nodes.find(n=>n.type==="dest")||g.nodes[0]; return ent?ent.id:null;
  }

  /* ---- coords ---- */
  function toWorld(cx,cy){const r=svg.getBoundingClientRect();const{s,tx,ty}=ui.view;return{x:(cx-r.left-tx)/s,y:(cy-r.top-ty)/s};}
  function applyView(){vp.setAttribute("transform","translate("+ui.view.tx+","+ui.view.ty+") scale("+ui.view.s+")");}

  /* ---- routing across floors ---- */
  function floorIndexOf(id){const b=building();for(let i=0;i<b.floors.length;i++)if(b.floors[i].nodes.some(n=>n.id===id))return i;return -1;}
  function nodeById(id){const b=building();for(const f of b.floors){const n=f.nodes.find(n=>n.id===id);if(n)return n;}return null;}
  function buildGraph(){const adj=new Map();const push=(a,b,w)=>{(adj.get(a)||adj.set(a,[]).get(a)).push({to:b,w});(adj.get(b)||adj.set(b,[]).get(b)).push({to:a,w});};
    const b=building();
    b.floors.forEach(f=>f.edges.forEach(e=>{const a=f.nodes.find(n=>n.id===e.a),bb=f.nodes.find(n=>n.id===e.b);if(a&&bb)push(a.id,bb.id,Math.hypot(a.x-bb.x,a.y-bb.y));}));
    const groups={};b.floors.forEach((f,fi)=>f.nodes.forEach(n=>{if(n.type==="stairs"||n.type==="lift"){const k=n.type+"|"+(n.group||"").trim().toLowerCase();(groups[k]=groups[k]||[]).push({n,fi});}}));
    Object.values(groups).forEach(arr=>{arr.sort((a,b)=>a.fi-b.fi);for(let i=0;i<arr.length-1;i++)if(arr[i+1].fi-arr[i].fi===1)push(arr[i].n.id,arr[i+1].n.id,FLOOR_COST);});
    return adj;}
  function astar(s,t){const adj=buildGraph();if(!adj.has(s))return null;const fT=floorIndexOf(t),T=nodeById(t);
    const h=id=>{const n=nodeById(id),fi=floorIndexOf(id);return Math.abs(fi-fT)*FLOOR_COST+(fi===fT?Math.hypot(n.x-T.x,n.y-T.y):0);};
    const G={[s]:0},F={[s]:h(s)},came={},open=new Set([s]);
    while(open.size){let cur=null,bb=Infinity;for(const id of open){const v=F[id]??Infinity;if(v<bb){bb=v;cur=id;}}
      if(cur===t){const p=[cur];while(came[cur]!==undefined){cur=came[cur];p.unshift(cur);}return p;}
      open.delete(cur);for(const{to,w}of(adj.get(cur)||[])){const nt=G[cur]+w;if(nt<(G[to]??Infinity)){came[to]=cur;G[to]=nt;F[to]=nt+h(to);open.add(to);}}}
    return null;}
  function route(){const s=$("#iFromSel").value,t=$("#iToSel").value;if(!s||!t){toast("Pick From and To");return;}
    if(s===t){toast("Same start and destination");return;}
    const path=astar(s,t);if(!path){$("#iDirs").innerHTML='<div class="hint">No route. Link points, and give stairs/lift the same group on each floor.</div>';ui.route=null;render();return;}
    ui.route={path};ui.floor=floorIndexOf(s);ui.curFloor=ui.floor;buildDirs(path);tabs();refreshAll();fit();}
  function nm(n){return n.name||(n.type==="stairs"?"Stairs":n.type==="lift"?"Lift":"point");}
  function buildDirs(path){const b=building();const nodes=path.map(id=>({n:nodeById(id),fi:floorIndexOf(id)}));const segs=[];
    segs.push({cls:"start",mk:"A",html:"Start at <b>"+esc(nm(nodes[0].n))+"</b> ("+b.floors[nodes[0].fi].name+" floor)"});
    for(let i=1;i<nodes.length;i++){const p=nodes[i-1],c=nodes[i];if(p.fi!==c.fi){const up=c.fi>p.fi;const kind=(p.n.type==="lift"||c.n.type==="lift")?"lift":"stairs";
      segs.push({cls:up?"up":"dn",mk:up?"↑":"↓",fromFloor:p.fi,toFloor:c.fi,kind,html:"Take <b>"+esc(p.n.group||kind)+"</b> "+kind+" "+(up?"UP":"DOWN")+" to <b>"+b.floors[c.fi].name+" floor</b>"});}}
    const end=nodes[nodes.length-1];segs.push({cls:"end",mk:"B",html:"Arrive at <b>"+esc(nm(end.n))+"</b> ("+b.floors[end.fi].name+" floor)"});
    ui.route.segs=segs;dirs();}
  function dirs(){const segs=ui.route?ui.route.segs:null;if(!segs){$("#iDirs").innerHTML="";return;}
    $("#iDirs").innerHTML='<div class="steps">'+segs.map(s=>{const cur=(s.fromFloor!==undefined&&ui.curFloor===s.fromFloor)?" cur":"";
      return '<div class="step '+s.cls+cur+'"><div class="mk">'+s.mk+'</div><div>'+s.html+'</div></div>';}).join("")+"</div>";}

  /* ---- render ---- */
  function render(){const f=floor();const bg=$("#ibg");if(f.bg){bg.setAttribute("href",f.bg);bg.style.display="";}else bg.style.display="none";
    const eL=$("#iedges");eL.innerHTML="";f.edges.forEach(e=>{const a=f.nodes.find(n=>n.id===e.a),b=f.nodes.find(n=>n.id===e.b);if(a&&b)eL.appendChild(line(a.x,a.y,b.x,b.y,"#2c3b5e",2));});
    const rL=$("#iroute");rL.innerHTML="";if(ui.route){for(let i=0;i<ui.route.path.length-1;i++){const a=nodeById(ui.route.path[i]),b=nodeById(ui.route.path[i+1]);
      if(floorIndexOf(a.id)===ui.floor&&floorIndexOf(b.id)===ui.floor){const l=line(a.x,a.y,b.x,b.y,"var(--route)",4);l.setAttribute("stroke-linecap","round");rL.appendChild(l);}}}
    const nL=$("#inodes");nL.innerHTML="";f.nodes.forEach(n=>nL.appendChild(nodeEl(n)));applyView();}
  function line(x1,y1,x2,y2,st,w){const l=document.createElementNS("http://www.w3.org/2000/svg","line");l.setAttribute("x1",x1);l.setAttribute("y1",y1);l.setAttribute("x2",x2);l.setAttribute("y2",y2);l.setAttribute("stroke",st);l.setAttribute("stroke-width",w);return l;}
  function nodeEl(n){const gg=document.createElementNS("http://www.w3.org/2000/svg","g");gg.setAttribute("transform","translate("+n.x+","+n.y+")");gg.dataset.id=n.id;gg.style.cursor="pointer";
    const inR=ui.route&&ui.route.path.includes(n.id),sel=ui.selected===n.id,ef=ui.edgeFrom===n.id;
    let color=n.type==="dest"?"var(--dest)":n.type==="stairs"?"var(--stairs)":n.type==="lift"?"var(--lift)":"var(--walk)";let R=n.type==="walk"?6:9;if(inR)color="var(--route)";
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("r",R);c.setAttribute("fill",color);c.setAttribute("stroke",(sel||ef)?"#fff":"#0a1120");c.setAttribute("stroke-width",(sel||ef)?2.5:2);gg.appendChild(c);
    if(n.type==="stairs"||n.type==="lift"){const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.textContent=n.type==="lift"?"⬍":"⇅";t.setAttribute("text-anchor","middle");t.setAttribute("dy","3.5");t.setAttribute("font-size","10");t.setAttribute("fill","#0a1120");t.setAttribute("font-weight","700");gg.appendChild(t);}
    const label=n.name||((n.type==="stairs"||n.type==="lift")?(n.group||""):"");
    if(label&&n.type!=="walk"){const l=document.createElementNS("http://www.w3.org/2000/svg","text");l.textContent=label;l.setAttribute("x",13);l.setAttribute("y",4);l.setAttribute("font-size","12");l.setAttribute("fill","var(--ink)");l.style.paintOrder="stroke";l.setAttribute("stroke","#0b1020");l.setAttribute("stroke-width","3");gg.appendChild(l);}
    return gg;}

  /* ---- sidebars ---- */
  function tabs(){const c=$("#iFloortabs");c.innerHTML="";building().floors.forEach((f,i)=>{const d=document.createElement("div");
    d.className="ftab"+(i===ui.floor?" active":"")+(ui.route&&ui.route.path.some(id=>floorIndexOf(id)===i)?" hasroute":"");d.textContent=f.name;
    d.onclick=()=>{ui.floor=i;ui.selected=null;ui.edgeFrom=null;refreshAll();};c.appendChild(d);});}
  function chips(){const c=$("#iChips");c.innerHTML="";building().floors.forEach((f,i)=>{const d=document.createElement("div");d.className="chip"+(i===ui.curFloor?" on":"");
    d.textContent=i===0?"G":i;d.onclick=()=>{ui.curFloor=i;chips();dirs();};c.appendChild(d);});}
  function dropdowns(){const b=building();const named=[],all=[];
    b.floors.forEach((f,fi)=>f.nodes.forEach(n=>{if(n.name&&n.type==="dest")named.push({id:n.id,label:n.name+" · "+f.name});
      const lb=n.name||((n.type==="stairs"||n.type==="lift")?(n.group||n.type):null);if(lb)all.push({id:n.id,label:lb+" · "+f.name});}));
    const fill=(sel,arr,ph)=>{const keep=sel.value;sel.innerHTML=arr.length?arr.map(d=>'<option value="'+d.id+'">'+esc(d.label)+"</option>").join(""):'<option value="">'+ph+"</option>";if([...sel.options].some(o=>o.value===keep))sel.value=keep;};
    fill($("#iFromSel"),all,"— add points —");fill($("#iToSel"),named,"— add rooms —");}
  function insp(){const i=$("#iInsp");if(!ui.selected){i.style.display="none";return;}const n=nodeById(ui.selected);if(!n){i.style.display="none";return;}
    i.style.display="";$("#iName").value=n.name||"";const isC=n.type==="stairs"||n.type==="lift";$("#iGrpWrap").style.display=isC?"":"none";$("#iGroup").value=n.group||"";
    $("#iMeta").textContent=n.type+" · "+building().floors[floorIndexOf(n.id)].name+" floor";}
  function refreshAll(){render();tabs();chips();dropdowns();insp();hud();persist();SKM.outdoor&&SKM.outdoor.invalidate();}
  function esc(s){return(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function hud(){$("#iHud").innerHTML="Floor: <b>"+floor().name+"</b> · Tool: <b>"+ui.tool+"</b>";}

  /* ---- interaction ---- */
  let drag=null,pan=null;
  function pDown(e){const gg=e.target.closest("#inodes g");const w=toWorld(e.clientX,e.clientY);
    if(gg){const id=gg.dataset.id;if(ui.tool==="del"){delNode(id);return;}if(ui.tool==="edge"){edge(id);return;}
      ui.selected=id;insp();render();drag={id,moved:false};svg.setPointerCapture(e.pointerId);return;}
    if(["walk","dest","stairs","lift"].includes(ui.tool)){addNode(ui.tool,w.x,w.y);return;}
    if(ui.tool==="edge"){ui.edgeFrom=null;render();return;}
    pan={x:e.clientX,y:e.clientY,tx:ui.view.tx,ty:ui.view.ty};svg.setPointerCapture(e.pointerId);ui.selected=null;insp();render();}
  function pMove(e){if(drag){const w=toWorld(e.clientX,e.clientY);const n=nodeById(drag.id);if(n){n.x=w.x;n.y=w.y;drag.moved=true;render();}}
    else if(pan){ui.view.tx=pan.tx+(e.clientX-pan.x);ui.view.ty=pan.ty+(e.clientY-pan.y);applyView();}}
  function pUp(){if(drag){if(drag.moved)persist();drag=null;}pan=null;}
  function wheel(e){e.preventDefault();const r=svg.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const f=e.deltaY<0?1.12:1/1.12;const ns=Math.min(6,Math.max(.15,ui.view.s*f));ui.view.tx=mx-(mx-ui.view.tx)*(ns/ui.view.s);ui.view.ty=my-(my-ui.view.ty)*(ns/ui.view.s);ui.view.s=ns;applyView();}
  function addNode(type,x,y){const n={id:uid(),x,y,type,name:"",group:""};if(type==="dest")n.name="New room";if(type==="stairs")n.group="Stairs A";if(type==="lift")n.group="Lift 1";
    floor().nodes.push(n);ui.selected=n.id;refreshAll();if(type!=="walk"){(type==="stairs"||type==="lift")?$("#iGroup").focus():$("#iName").focus();}}
  function delNode(id){const f=floor();f.nodes=f.nodes.filter(n=>n.id!==id);f.edges=f.edges.filter(e=>e.a!==id&&e.b!==id);if(ui.selected===id)ui.selected=null;ui.route=null;refreshAll();}
  function edge(id){if(ui.edgeFrom===null){ui.edgeFrom=id;render();toast("Now tap the point to link to");return;}if(ui.edgeFrom===id){ui.edgeFrom=null;render();return;}
    const f=floor();if(!f.nodes.find(n=>n.id===ui.edgeFrom)||!f.nodes.find(n=>n.id===id)){toast("Link points on the same floor");ui.edgeFrom=null;render();return;}
    if(!f.edges.some(e=>(e.a===ui.edgeFrom&&e.b===id)||(e.a===id&&e.b===ui.edgeFrom)))f.edges.push({a:ui.edgeFrom,b:id});ui.edgeFrom=id;refreshAll();}
  function onBg(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{floor().bg=r.result;const img=new Image();img.onload=()=>{$("#ibg").setAttribute("width",img.width);$("#ibg").setAttribute("height",img.height);refreshAll();fit();};img.src=r.result;};r.readAsDataURL(file);e.target.value="";}
  function zoom(f){const r=svg.getBoundingClientRect();const mx=r.width/2,my=r.height/2;const ns=Math.min(6,Math.max(.15,ui.view.s*f));ui.view.tx=mx-(mx-ui.view.tx)*(ns/ui.view.s);ui.view.ty=my-(my-ui.view.ty)*(ns/ui.view.s);ui.view.s=ns;applyView();}
  function fit(){const f=floor();const r=svg.getBoundingClientRect();let box=null;
    if(f.nodes.length){let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;f.nodes.forEach(n=>{x1=Math.min(x1,n.x);y1=Math.min(y1,n.y);x2=Math.max(x2,n.x);y2=Math.max(y2,n.y);});box={x1,y1,x2,y2};}
    else if(f.bg){const bg=$("#ibg");box={x1:0,y1:0,x2:+bg.getAttribute("width")||800,y2:+bg.getAttribute("height")||600};}
    if(!box){ui.view={s:1,tx:60,ty:60};applyView();return;}const pad=60,w=Math.max(10,box.x2-box.x1),h=Math.max(10,box.y2-box.y1);
    const s=Math.min((r.width-pad*2)/w,(r.height-pad*2)/h,4);ui.view.s=Math.max(.15,s);ui.view.tx=(r.width-w*ui.view.s)/2-box.x1*ui.view.s;ui.view.ty=(r.height-h*ui.view.s)/2-box.y1*ui.view.s;applyView();}
  function exportB(){const b=new Blob([JSON.stringify(SKM.data.getStore(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="skm-buildings.json";a.click();toast("Exported buildings");}
  function importB(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.buildings)throw 0;SKM.data.setStore(d);bId=d.buildings[0].id;open(bId);toast("Imported");SKM.search&&SKM.search.reindex();}catch(err){toast("Invalid file");}};r.readAsText(file);e.target.value="";}

  /* ---- sensors → floor guess ---- */
  function enableMotion(){SKM.sensors.enable().then(r=>{if(r.ok){$("#iSens").style.display="";$("#iMotion").textContent="📱 Motion ON";$("#iMotion").classList.add("active");toast("Motion active");}else toast(r.msg||"No motion");});}
  function onStep(steps){$("#iStep").textContent=steps;
    if(!ui.route||!ui.route.segs)return;const seg=ui.route.segs.find(s=>s.fromFloor!==undefined&&ui.curFloor===s.fromFloor);if(!seg||seg.kind!=="stairs")return;
    const spf=Math.max(6,parseInt($("#iSpf").value)||16);if(seg._base===undefined)seg._base=steps;
    const climbed=Math.floor((steps-seg._base)/spf);if(climbed>=1){const dir=seg.toFloor>seg.fromFloor?1:-1;const guess=seg.fromFloor+dir*climbed;
      if((dir>0&&guess>=seg.toFloor)||(dir<0&&guess<=seg.toFloor)){ui.curFloor=seg.toFloor;seg._base=undefined;ui.floor=seg.toFloor;toast("Reached "+building().floors[seg.toFloor].name+" floor");refreshAll();}
      else{ui.curFloor=Math.max(0,Math.min(building().floors.length-1,guess));chips();dirs();$("#iSensState").textContent="climbing… ~"+building().floors[ui.curFloor].name;}}}
  function maybeRide(){const seg=ui.route&&ui.route.segs&&ui.route.segs.find(s=>s.fromFloor!==undefined&&ui.curFloor===s.fromFloor&&s.kind==="lift");if(seg){SKM.sensors.startRide();$("#iSensState").textContent="in lift — detecting…";}}
  function onRide(res){if(!res){$("#iSensState").textContent="idle";return;}const fh=Math.max(2.5,parseFloat($("#iFhm").value)||3.5);const floors=Math.round(Math.abs(res.disp)/fh);
    const seg=ui.route&&ui.route.segs&&ui.route.segs.find(x=>x.kind==="lift"&&x.fromFloor===ui.curFloor);
    if(seg&&floors>=1){ui.curFloor=seg.toFloor;ui.floor=seg.toFloor;toast("Lift → "+building().floors[seg.toFloor].name+" floor");refreshAll();}else $("#iSensState").textContent="lift: ~"+floors+" floors";}

  function toast(m){SKM.app&&SKM.app.toast(m);}
  return {bootDom,open,building:()=>building};
})();
