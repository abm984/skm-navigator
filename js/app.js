/* ==== app orchestrator: outdoor<->indoor switching, entrance hand-off, boot ==== */
window.SKM=window.SKM||{};
SKM.app=(function(){
  const $=s=>document.querySelector(s);
  let pendingIndoor=null; // {buildingId,nodeId} waiting after outdoor walk to entrance

  /* ui helpers used by other modules */
  function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),1900);}
  function banner(h){const b=$("#banner");b.innerHTML=h;b.style.display="block";}
  function hideBanner(){$("#banner").style.display="none";}
  function status(spin,txt){const s=$("#status");$("#statusTxt").textContent=txt;s.querySelector(".sp").style.display=spin?"":"none";s.classList.remove("hide");if(!spin){clearTimeout(s._t);s._t=setTimeout(()=>s.classList.add("hide"),2600);}}
  function gpsLive(on){$("#gpsDot").classList.toggle("live",!!on);}
  function refreshRoute(){const r=SKM.outdoor.refreshRoute();if(r)showNav(r);}

  /* ---- outdoor selection ---- */
  function pickOutdoor(id){const r=SKM.outdoor.routeToLandmark(id);if(r){pendingIndoor=null;showNav(r);}}

  /* ---- indoor destination: walk to building entrance first, then hand off ---- */
  function navigateIndoor(buildingId,nodeId){
    const b=SKM.data.getStore().buildings.find(x=>x.id===buildingId);if(!b){toast("Building not found");return;}
    pendingIndoor={buildingId,nodeId};
    const r=SKM.outdoor.routeToLandmark(b.entranceId);
    if(r){ r.enter=b.name; showNav(r); }
    else { // no GPS yet — offer to enter directly
      enterIndoor(buildingId,nodeId);
    }
  }
  function enterIndoor(buildingId,nodeId){
    $("#outdoorView").style.display="none";$("#indoorView").style.display="flex";
    SKM.indoor.open(buildingId,nodeId);pendingIndoor=null;
  }
  function backToMap(){$("#indoorView").style.display="none";$("#outdoorView").style.display="flex";
    setTimeout(()=>{if(window.__map)window.__map.invalidateSize&&window.__map.invalidateSize();},60);}

  /* ---- nav card ---- */
  function showNav(r){const c=$("#navinfo");c.classList.add("show");
    $("#navDist").textContent=r.metres>=1000?(r.metres/1000).toFixed(2)+" km":Math.round(r.metres)+" m";
    $("#navEta").textContent="~"+Math.max(1,Math.round(r.metres/1.35/60))+" min walk";
    $("#navTo").textContent="→ "+r.name;
    $("#navMeta").textContent=(r.mode==="osm"?"along campus roads":"direct network")+(r.enter?" · to "+r.enter+" entrance":"");
    const btn=$("#enterBtn");
    if(r.enter&&pendingIndoor){btn.style.display="";btn.textContent="Enter "+r.enter+" →";btn.onclick=()=>enterIndoor(pendingIndoor.buildingId,pendingIndoor.nodeId);}
    else btn.style.display="none";
    measure();}
  function clearNav(){$("#navinfo").classList.remove("show");SKM.outdoor.clearRoute();pendingIndoor=null;measure();}
  function measure(){document.documentElement.style.setProperty("--sheeth",$("#sheet").offsetHeight+"px");}

  /* ---- boot ---- */
  async function boot(){
    await SKM.data.load();
    SKM.indoor.bootDom();
    SKM.outdoor.init(); window.__map=null;
    SKM.search.reindex(); SKM.search.wire();
    // wire outdoor chrome
    $("#navX").onclick=clearNav;
    $("#locateBtn").onclick=()=>SKM.outdoor.centerOnMe();
    $("#followBtn").onclick=()=>$("#followBtn").classList.toggle("on",SKM.outdoor.toggleFollow());
    $("#roadsToggle").onclick=()=>$("#roadsToggle").classList.toggle("on",SKM.outdoor.toggleRoads());
    $("#reloadRoads").onclick=()=>SKM.outdoor.loadRoads(true);
    $("#buildingsBtn").onclick=()=>{const b=SKM.data.getStore().buildings[0];if(b)enterIndoor(b.id,null);else toast("No buildings yet");};
    $("#iBack").onclick=backToMap;
    measure();window.addEventListener("resize",measure);
  }
  return {boot,toast,banner,hideBanner,status,gpsLive,refreshRoute,pickOutdoor,navigateIndoor,enterIndoor,backToMap};
})();
document.addEventListener("DOMContentLoaded",SKM.app.boot);
