/* ==== OUTDOOR: Leaflet map, live GPS, OSM real-road routing, place pins ==== */
window.SKM=window.SKM||{};
SKM.outdoor=(function(){
  const g=SKM.geo, gr=SKM.graph;
  let map, gRoads, gRoute, gPins, gpsMarker, gpsCircle;
  let gps=null, follow=false, showRoads=false;
  let G=null, mode="offline";
  let routeCache=null;
  const LM=()=>SKM.data.campus.nodes, EDGES=()=>SKM.data.campus.edges;

  function init(){
    map=L.map("map",{zoomControl:true,attributionControl:true}).setView([31.44803,74.27182],17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:"© OpenStreetMap"}).addTo(map);
    gRoads=L.layerGroup().addTo(map); gRoute=L.layerGroup().addTo(map); gPins=L.layerGroup().addTo(map);
    renderPins();
    map.fitBounds(L.latLngBounds(LM().map(n=>[n.lat,n.lng])).pad(.15));
    startGPS(); loadRoads();
  }

  /* ---- graph from OSM ways, then attach landmarks ---- */
  function bbox(){let s=90,w=180,n=-90,e=-180;LM().forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lng);e=Math.max(e,p.lng);});
    return [s-0.0016,w-0.0016,n+0.0016,e+0.0016];}
  async function fetchOSM(){
    const [s,w,n,e]=bbox();
    const q='[out:json][timeout:25];way["highway"]('+s+','+w+','+n+','+e+');out geom;';
    for(const url of ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]){
      try{const r=await fetch(url,{method:"POST",body:"data="+encodeURIComponent(q)});if(!r.ok)continue;
        const j=await r.json(); if(j&&j.elements&&j.elements.some(el=>el.type==="way"&&el.geometry))return j;}catch(e){}
    } return null;
  }
  function buildFromOSM(osm){
    const graph=gr.make(); let ways=0;
    for(const el of osm.elements){ if(el.type!=="way"||!el.geometry||!el.nodes)continue; ways++;
      for(let i=0;i<el.nodes.length;i++){const p=el.geometry[i]; gr.addV(graph,"w"+el.nodes[i],p.lat,p.lon);}
      for(let i=0;i<el.nodes.length-1;i++){const a="w"+el.nodes[i],b="w"+el.nodes[i+1]; if(a!==b) gr.addE(graph,a,b);} }
    LM().forEach(lm=>{const ac=gr.snap(graph,lm); if(!ac)return; gr.addV(graph,lm.id,lm.lat,lm.lng);
      gr.link(graph,lm.id,ac.id,g.hav(graph.V.get(lm.id),graph.V.get(ac.id)));});
    return {graph,ways};
  }
  function buildFallback(){const graph=gr.make(); LM().forEach(lm=>gr.addV(graph,lm.id,lm.lat,lm.lng));
    EDGES().forEach(e=>{if(graph.V.has(e.a)&&graph.V.has(e.b))gr.addE(graph,e.a,e.b);}); return graph;}
  async function loadRoads(force){
    SKM.app&&SKM.app.status(true,"Loading campus roads…");
    const osm=await fetchOSM();
    if(osm){const {graph,ways}=buildFromOSM(osm);G=graph;mode="osm";SKM.app&&SKM.app.status(false,ways+" roads mapped");renderRoads();}
    else{G=buildFallback();mode="offline";SKM.app&&SKM.app.status(false,"roads offline — direct links");}
    if(routeCache)routeToLandmark(routeCache);
  }

  /* ---- routing ---- */
  function routeToLandmark(destId,opts){
    opts=opts||{}; const dest=LM().find(n=>n.id===destId); if(!dest||!G) return null;
    if(!gps){ SKM.app&&SKM.app.toast("Waiting for GPS — enable location"); return null; }
    const s=gr.snap(G,gps); if(!s){SKM.app&&SKM.app.toast("No road network");return null;}
    const h=id=>g.hav(G.V.get(id),G.V.get(destId));
    const res=gr.astar(G,s.id,destId,h);
    if(!res){SKM.app&&SKM.app.toast("No route found");clearRoute();return null;}
    const pts=res.path.map(id=>{const v=G.V.get(id);return [v.lat,v.lng];});
    gRoute.clearLayers();
    L.polyline([[gps.lat,gps.lng],...pts],{color:"#ffb020",weight:6,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(gRoute);
    routeCache=destId;
    const total=res.cost+s.dist;
    if(!opts.silent) map.flyTo([dest.lat,dest.lng],18,{duration:.5});
    return {name:dest.name,metres:total,mode};
  }
  function clearRoute(){gRoute.clearLayers();routeCache=null;}

  /* ---- pins (buildings only; roads are searchable, not drawn) ---- */
  function renderPins(){gPins.clearLayers();
    LM().forEach(n=>{const isB=n.kind==="BUILDING"||n.type==="dest"; if(!isB)return;
      const m=L.circleMarker([n.lat,n.lng],{radius:6,weight:2,color:"#0b1020",fillColor:"#38bdf8",fillOpacity:1}).addTo(gPins);
      m.on("click",ev=>{L.DomEvent.stop(ev);SKM.app&&SKM.app.pickOutdoor(n.id);});
      m.bindTooltip(n.name,{permanent:true,direction:"right",className:"plabel",offset:[9,0]});});}
  function renderRoads(){gRoads.clearLayers();if(!showRoads||!G)return;const seen=new Set();
    G.seg.forEach(([a,b])=>{if(String(a).startsWith("__a")||String(b).startsWith("__a"))return;
      const A=G.V.get(a),B=G.V.get(b),k=a<b?a+b:b+a;if(seen.has(k))return;seen.add(k);
      L.polyline([[A.lat,A.lng],[B.lat,B.lng]],{color:"#2f6d5b",weight:2,opacity:.5}).addTo(gRoads);});}
  function toggleRoads(){showRoads=!showRoads;renderRoads();return showRoads;}

  /* ---- GPS ---- */
  function startGPS(){ if(!("geolocation" in navigator)){SKM.app&&SKM.app.banner("This browser has no geolocation.");return;}
    if(!window.isSecureContext)SKM.app&&SKM.app.banner('GPS needs <b>https</b> (GitHub Pages) or <b>localhost</b>.');
    navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:1000,timeout:12000});}
  function onPos(p){gps={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};
    SKM.app&&SKM.app.gpsLive(true);SKM.app&&SKM.app.hideBanner();drawGPS();if(follow)map.setView([gps.lat,gps.lng]);
    if(routeCache)SKM.app&&SKM.app.refreshRoute();}
  function onErr(e){SKM.app&&SKM.app.gpsLive(false);if(e.code===1)SKM.app&&SKM.app.banner("Location denied. Allow location, then reload.");}
  function drawGPS(){const ll=[gps.lat,gps.lng];
    if(!gpsMarker){gpsCircle=L.circle(ll,{radius:gps.acc,color:"#39d98a",weight:1,fillColor:"#39d98a",fillOpacity:.1}).addTo(map);
      gpsMarker=L.circleMarker(ll,{radius:7,color:"#0b1020",weight:3,fillColor:"#39d98a",fillOpacity:1}).addTo(map);}
    else{gpsMarker.setLatLng(ll);gpsCircle.setLatLng(ll).setRadius(gps.acc);}}
  function centerOnMe(){if(gps)map.setView([gps.lat,gps.lng],18);else SKM.app&&SKM.app.toast("No GPS fix yet");}
  function toggleFollow(){follow=!follow;if(follow&&gps)map.setView([gps.lat,gps.lng]);return follow;}

  function getGPS(){return gps;}
  function invalidate(){renderPins();}   // called after store edits change building entrances
  function refreshRoute(){if(routeCache)return routeToLandmark(routeCache,{silent:true});return null;}

  return {init,routeToLandmark,clearRoute,toggleRoads,centerOnMe,toggleFollow,getGPS,loadRoads,invalidate,refreshRoute,getMode:()=>mode};
})();
