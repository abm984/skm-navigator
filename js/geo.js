/* ==== geo helpers (shared by outdoor + indoor snapping) ==== */
window.SKM=window.SKM||{};
SKM.geo=(function(){
  function hav(a,b){const R=6371000,r=Math.PI/180;const dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;
    const la1=a.lat*r,la2=b.lat*r;const x=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));}
  const toXY=(p,ref)=>({x:p.lng*111320*Math.cos(ref*Math.PI/180),y:p.lat*111320});
  const fromXY=(x,y,ref)=>({lat:y/111320,lng:x/(111320*Math.cos(ref*Math.PI/180))});
  function projSeg(p,a,b){const ref=p.lat;const P=toXY(p,ref),A=toXY(a,ref),B=toXY(b,ref);
    const dx=B.x-A.x,dy=B.y-A.y,l2=dx*dx+dy*dy;let t=l2===0?0:((P.x-A.x)*dx+(P.y-A.y)*dy)/l2;t=Math.max(0,Math.min(1,t));
    const q=fromXY(A.x+t*dx,A.y+t*dy,ref);return{lat:q.lat,lng:q.lng,dist:hav(p,q)};}
  return {hav,toXY,fromXY,projSeg};
})();
