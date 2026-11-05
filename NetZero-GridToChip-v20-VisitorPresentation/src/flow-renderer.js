/* v15 visual flow repair: independent of power accounting and simulation time. */
'use strict';
window.NZ_FLOW_RENDERER=(function(){
  const CAPACITY=64,EPS=1e-6,projected=new THREE.Vector3();
  const tailRoot=new THREE.Group();tailRoot.name='Flow overlay trails';scene.add(tailRoot);
  let initialized=false,elapsed=0;
  const scopes={
    wind:['wind','trans'],solar:['solar','trans'],nuclear:['smr','trans'],
    compute:['wind','solar','trans','smr','bus2tr','hvDataA','hvDataB','tr2dc','tr2dcB','dcA','dcB','genset'],
    chemical:['trans','bus2dist','feedIn','feedOutW','metalE','panZnAc','panZnDc','pem','nh3E','h2gas','h2use','nh3','fcGas','fc'],
    factory:['trans','bus2dist','feedIn','feedOut','facE'],
    public:['trans','bus2dist','feedIn','scE','panScAc','panScDc','scSecondAc','scSecondDc']
  };
  const kind=e=>['hydrogen','ammonia'].includes(e.media)?'process':'power';
  function contextVisible(e){
    const focus=window.NZ_FLOWS?window.NZ_FLOWS.getFocus():'overview';
    if(focus==='overview'||focus==='energy')return true;
    return (scopes[focus]||[]).includes(e.key);
  }
  function metrics(pts){
    const height=renderer.domElement.clientHeight||900,width=renderer.domElement.clientWidth||1400;
    let pixels=0,world=0;const previous=new THREE.Vector3();
    for(let i=0;i<pts.length;i++){
      projected.set(...pts[i]).project(camera);
      if(i){pixels+=Math.min(Math.hypot((projected.x-previous.x)*width/2,(projected.y-previous.y)*height/2),Math.max(width,height)*2);world+=Math.hypot(...pts[i].map((v,k)=>v-pts[i-1][k]));}
      previous.copy(projected);
    }
    return {pixels:Math.max(1,pixels),worldPerPixel:world/Math.max(1,pixels)};
  }
  function sprite(){
    const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');
    x.fillStyle='rgba(255,255,255,.24)';x.beginPath();x.arc(16,16,15,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(16,16,10,0,Math.PI*2);x.fill();
    return new THREE.CanvasTexture(c);
  }
  function init(){
    if(initialized)return;initialized=true;const map=sprite();
    for(const e of EDGES){
      const geometry=e.points.geometry;geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CAPACITY*3),3));geometry.setDrawRange(0,0);
      e.parts=[];e.partCap=CAPACITY;e.spawnAcc=0;e.flowPhase=0;e.flowMetricAt=-1;e.flowPixels=0;e.flowSpeed=0;
      const material=e.points.material;material.color.setHex(kind(e)==='power'?0xb87012:e.media==='hydrogen'?0x287fab:0x8057a0);
      Object.assign(material,{map,size:5.8,sizeAttenuation:false,transparent:true,opacity:.98,alphaTest:.05,depthTest:true,depthWrite:false,blending:THREE.NormalBlending});material.needsUpdate=true;
      e.points.renderOrder=12;e.points.frustumCulled=false;e.points.name='Flow particles '+e.key;
      const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CAPACITY*3),3));tg.setDrawRange(0,0);
      const tm=new THREE.PointsMaterial({map,color:material.color,size:3.5,sizeAttenuation:false,transparent:true,opacity:.32,alphaTest:.02,depthWrite:false,depthTest:true});
      const trail=new THREE.Points(tg,tm);trail.name='Flow trail '+e.key;trail.frustumCulled=false;trail.renderOrder=11;tailRoot.add(trail);e.flowTrail=trail;
      if(e.visualTube){e.visualTube.material.transparent=true;e.visualTube.material.depthWrite=false;e.visualTube.renderOrder=3;}
      // The original wind/PV tube was both conductor and overlay. Retain a thin conductor when overlays are off.
      if(['wind','solar'].includes(e.key)){
        const curve=new THREE.Curve();curve.getPoint=t=>new THREE.Vector3(...edgePoint(e,t));
        const cable=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,Math.ceil(e.len/4)),.038,5,false),new THREE.MeshStandardMaterial({color:0x78908d,roughness:.8}));
        cable.name='Permanent conductor '+e.key;scene.add(cable);
      }
    }
    updateParticles=update;drawParticles=draw;
  }
  function update(dt){
    const replay=window.NZ_CLOUD_VISIT?.visualReplay?.();if(replay?.active&&replay.paused)dt=0;
    elapsed+=dt;
    const budget=window.NZ_CONFIG.QUALITY[S.quality].particles;
    for(const e of EDGES){
      const rate=Number(e.pw())||0;e.flowRate=rate;
      if(elapsed-e.flowMetricAt>.25||e.flowMetricAt<0){
        const m=metrics(e.pts);e.flowPixels=m.pixels;e.flowWorldPerPixel=m.worldPerPixel;e.flowMetricAt=elapsed;
      }
      const density=replay?.active ? .25+.75*Math.sqrt(Math.min(1,Math.abs(rate)/250)):.72+.28*Math.sqrt(Math.min(1,Math.abs(rate)/100));
      const count=Math.abs(rate)>EPS&&e.flowPixels>=4?Math.min(CAPACITY,budget,Math.max(2,Math.ceil(e.flowPixels/48*density))):0;
      // One speed family in screen space; minimum traversal time keeps close short links calm.
      const worldSpeed=Math.min(45,42*e.flowWorldPerPixel),phaseSpeed=Math.min(.24,worldSpeed/Math.max(e.len,.1));
      e.flowSpeed=worldSpeed;e.flowPhase=(e.flowPhase+dt*phaseSpeed*(rate<0?-1:1)+1)%1;
      e.parts.length=count;
      for(let i=0;i<count;i++)e.parts[i]={d:(i/count+e.flowPhase)%1};
    }
  }
  function draw(){
    for(const e of EDGES){
      const a=e.points.geometry.attributes.position,ta=e.flowTrail.geometry.attributes.position;
      const n=S.reduceMotion?0:Math.min(e.parts.length,a.count,ta.count,window.NZ_CONFIG.QUALITY[S.quality].particles);
      for(let i=0;i<n;i++){
        const d=e.parts[i].d,p=edgePoint(e,d),back=(d-(e.flowRate<0?-1:1)*Math.min(.025,3/Math.max(1,e.flowPixels))+1)%1,t=edgePoint(e,back);
        a.setXYZ(i,p[0],p[1]+.22,p[2]);ta.setXYZ(i,t[0],t[1]+.22,t[2]);
      }
      a.needsUpdate=true;ta.needsUpdate=true;e.points.geometry.setDrawRange(0,n);e.flowTrail.geometry.setDrawRange(0,n);
    }
  }
  function afterVisibility(){for(const e of EDGES)e.flowTrail.visible=e.points.visible&&!S.reduceMotion&&e.points.geometry.drawRange.count>0;}
  function audit(){return {maxParticlesPerRoute:CAPACITY,edges:EDGES.map(e=>({key:e.key,allocated:e.points.geometry.attributes.position.count,count:e.points.geometry.drawRange.count,pixels:e.flowPixels,speed:e.flowSpeed,phase:e.flowPhase,rate:e.flowRate,visible:e.points.visible,trailVisible:e.flowTrail.visible}))};}
  return {init,metrics,contextVisible,afterVisibility,audit};
})();