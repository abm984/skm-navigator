/* ==== accelerometer: step counter + best-effort floor-change guess (assistive) ==== */
window.SKM=window.SKM||{};
SKM.sensors=(function(){
  let on=false, steps=0, lastPeak=0, win=[];
  let gravity={x:0,y:0,z:9.8};
  let ride={active:false,samples:[],movedAt:0};
  let cb={onStep:null,onRide:null};        // callbacks set by indoor module

  async function enable(){
    try{
      if(typeof DeviceMotionEvent!=="undefined" && typeof DeviceMotionEvent.requestPermission==="function"){
        const p=await DeviceMotionEvent.requestPermission(); if(p!=="granted") return {ok:false,msg:"Motion permission denied"};
      }
      window.addEventListener("devicemotion",onMotion); on=true; return {ok:true};
    }catch(e){ return {ok:false,msg:"Motion sensors unavailable"}; }
  }
  function onMotion(e){
    const g=e.accelerationIncludingGravity, a=e.acceleration; if(!g)return;
    const al=0.9; gravity.x=al*gravity.x+(1-al)*(g.x||0); gravity.y=al*gravity.y+(1-al)*(g.y||0); gravity.z=al*gravity.z+(1-al)*(g.z||0);
    const gm=Math.hypot(gravity.x,gravity.y,gravity.z)||1, gu={x:gravity.x/gm,y:gravity.y/gm,z:gravity.z/gm};
    const lin=(a&&a.x!=null)?a:{x:(g.x||0)-gravity.x,y:(g.y||0)-gravity.y,z:(g.z||0)-gravity.z};
    const vert=lin.x*gu.x+lin.y*gu.y+lin.z*gu.z;
    const mag=Math.hypot(lin.x,lin.y,lin.z); win.push(mag); if(win.length>10)win.shift();
    const avg=win.reduce((s,x)=>s+x,0)/win.length, now=performance.now();
    if(mag>avg+1.4 && mag>2.2 && now-lastPeak>320){steps++;lastPeak=now;cb.onStep&&cb.onStep(steps);}
    if(ride.active){ ride.samples.push({v:vert,t:now});
      const recent=ride.samples.slice(-25), va=recent.reduce((s,x)=>s+Math.abs(x.v),0)/recent.length;
      if(Math.abs(vert)>0.35) ride.movedAt=now;
      if(ride.samples.length>60 && va<0.12 && now-ride.movedAt>1200) finishRide();
    }
  }
  function startRide(){ if(!ride.active) ride={active:true,samples:[],movedAt:performance.now()}; }
  function finishRide(){
    const s=ride.samples; ride.active=false; if(s.length<20){cb.onRide&&cb.onRide(null);return;}
    const dt=(s[s.length-1].t-s[0].t)/1000/s.length;
    const v=[0]; for(let i=1;i<s.length;i++)v.push(v[i-1]+s[i].v*dt);
    const vEnd=v[v.length-1]; for(let i=0;i<v.length;i++)v[i]-=vEnd*(i/(v.length-1));
    let disp=0; for(let i=1;i<v.length;i++)disp+=v[i]*dt;
    cb.onRide&&cb.onRide({disp});
  }
  return {enable,isOn:()=>on,getSteps:()=>steps,setCallbacks:c=>cb=Object.assign(cb,c),startRide};
})();
