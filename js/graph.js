/* ==== generic weighted graph + A* ==== */
window.SKM=window.SKM||{};
SKM.graph=(function(){
  const hav=()=>SKM.geo.hav;
  function make(){return {V:new Map(),adj:new Map(),seg:[]};}
  function addV(g,id,lat,lng){if(!g.V.has(id)){g.V.set(id,{lat,lng});g.adj.set(id,[]);}}
  function link(g,a,b,w){g.adj.get(a).push({to:b,w});g.adj.get(b).push({to:a,w});}
  function addE(g,a,b){const w=SKM.geo.hav(g.V.get(a),g.V.get(b));link(g,a,b,w);g.seg.push([a,b]);}
  let acc=0;
  function snap(g,pt){let best=null;
    for(const [a,b] of g.seg){const pr=SKM.geo.projSeg(pt,g.V.get(a),g.V.get(b));if(!best||pr.dist<best.pr.dist)best={a,b,pr};}
    if(!best)return null;const id="__a"+(acc++);addV(g,id,best.pr.lat,best.pr.lng);
    link(g,id,best.a,SKM.geo.hav(g.V.get(id),g.V.get(best.a)));
    link(g,id,best.b,SKM.geo.hav(g.V.get(id),g.V.get(best.b)));
    return {id,dist:best.pr.dist,at:best.pr};}
  // A* with a supplied heuristic function h(id)->cost-to-goal
  function astar(g,s,t,h){
    if(!g.adj.has(s)||!g.V.has(t))return null;
    const G={[s]:0},F={[s]:h(s)},came={},open=new Set([s]);
    while(open.size){let cur=null,best=Infinity;for(const id of open){const v=F[id]??Infinity;if(v<best){best=v;cur=id;}}
      if(cur===t){const p=[cur];while(came[cur]!==undefined){cur=came[cur];p.unshift(cur);}return {path:p,cost:G[t]};}
      open.delete(cur);for(const{to,w}of(g.adj.get(cur)||[])){const nt=G[cur]+w;if(nt<(G[to]??Infinity)){came[to]=cur;G[to]=nt;F[to]=nt+h(to);open.add(to);}}}
    return null;}
  return {make,addV,addE,link,snap,astar};
})();
