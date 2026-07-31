/* ==== unified search: outdoor landmarks + indoor rooms, dispatches to the right mode ==== */
window.SKM=window.SKM||{};
SKM.search=(function(){
  const $=s=>document.querySelector(s);
  let idx=[];
  function reindex(){
    idx=[];
    SKM.data.campus.nodes.forEach(n=>{if(n.name)idx.push({kind:"outdoor",id:n.id,name:n.name,sub:n.kind==="BUILDING"?"building":"road",lat:n.lat,lng:n.lng,isB:n.kind==="BUILDING"});});
    SKM.data.indoorRooms().forEach(r=>idx.push({kind:"indoor",id:r.nodeId,buildingId:r.buildingId,name:r.name,sub:r.buildingName+" · "+r.floorName+" floor",indoor:true}));
  }
  function render(q){
    q=(q||"").trim().toLowerCase();const gps=SKM.outdoor.getGPS();
    let list=idx.slice();
    if(q)list=list.filter(x=>x.name.toLowerCase().includes(q)||x.sub.toLowerCase().includes(q));
    list=list.map(x=>{let d=null;if(gps&&x.lat)d=SKM.geo.hav(gps,x);return {x,d};});
    if(gps)list.sort((a,b)=>(a.d??1e12)-(b.d??1e12));
    list=list.slice(0,30);const box=$("#results");
    if(!list.length){box.classList.remove("show");return;}
    box.innerHTML='<div class="rrow head">'+(q?"Matches":(gps?"Nearest":"All places"))+"</div>"+list.map(({x,d})=>{
      const ic=x.indoor?'<div class="ic i">🏢</div>':(x.isB?'<div class="ic b">◆</div>':'<div class="ic r">•</div>');
      return '<div class="rrow" data-kind="'+x.kind+'" data-id="'+x.id+'" data-b="'+(x.buildingId||"")+'">'+ic+
        '<div class="nm">'+esc(x.name)+'<div class="sub">'+esc(x.sub)+"</div></div>"+(d!=null?'<div class="dist">'+(d>=1000?(d/1000).toFixed(1)+"km":Math.round(d)+"m")+"</div>":"")+"</div>";}).join("");
    box.classList.add("show");
    box.querySelectorAll(".rrow[data-id]").forEach(r=>r.onclick=()=>{box.classList.remove("show");$("#search").value=r.querySelector(".nm").firstChild.textContent;$("#search").blur();
      if(r.dataset.kind==="indoor")SKM.app.navigateIndoor(r.dataset.b,r.dataset.id);else SKM.app.pickOutdoor(r.dataset.id);});
  }
  function esc(s){return(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function wire(){const el=$("#search");el.addEventListener("input",e=>render(e.target.value));el.addEventListener("focus",()=>render(el.value));
    document.addEventListener("click",e=>{if(!e.target.closest(".searchwrap"))$("#results").classList.remove("show");});}
  return {reindex,render,wire};
})();
