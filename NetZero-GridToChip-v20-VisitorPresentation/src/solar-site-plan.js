/* Display geometry and NOAA approximate solar position; independent of engine.js. */
'use strict';
(function(root){
  const rad=Math.PI/180, cfg={latitude:44,longitude:87.6,timezone:8,date:'2026-12-21',hour:14,tiltDeg:24,azimuthDeg:180,demonstration:true};
  const width=1.9,depth=1.3,center={x:-128,z:73,y:.95};
  const panels=[];
  for(let bz=0;bz<2;bz++)for(let bx=0;bx<3;bx++)for(let row=0;row<6;row++)for(let col=0;col<11;col++)panels.push({x:center.x-44+bx*33+col*2.45,z:center.z-18+bz*27+row*3.4,y:center.y,bx,bz,row,col});
  const equipment=[
    ...[-162,-129,-96].flatMap((x,i)=>[
      {id:'inverter-'+i,kind:'inverter',name:'组串逆变器组 '+(i+1),x,z:106,w:5,d:3,h:2.1},
      {id:'transformer-'+i,kind:'transformer',name:'箱式升压变 '+(i+1),x,z:116,w:8,d:6,h:3.1}
    ]),
    {id:'secondary',kind:'secondary',name:'计量 · 继保 · 通信',x:-82,z:108,w:8,d:3,h:3},
    {id:'collector',kind:'collector',name:'35 kV 集电开关区',x:-81,z:120,w:12,d:7,h:2.8}
  ];
  function expand(roads,sites,height){
    const distance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz,t=n?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/n)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
    const segments=roads.flatMap(r=>r.pts.slice(1).map((p,i)=>({a:r.pts[i],b:p,w:r.width})));
    const allowed=(x,z)=>height(x,z)<.05&&!sites.some(s=>Math.hypot(x-s.x,z-s.z)<24)&&!segments.some(r=>distance(x,z,r.a,r.b)<r.w/2+2.5);
    for(let bx=0;bx<11;bx++)for(let bz=0;bz<4;bz++)for(let row=0;row<6;row++)for(let col=0;col<11;col++){
      const x=-536+bx*33+col*2.45,z=54+bz*27+row*3.4;
      if(allowed(x,z))panels.push({x,z,y:.95,bx:bx+3,bz,row,col,extension:true});
    }
    for(const [i,x]of [-515,-460,-405,-350,-295,-240].entries()){
      equipment.push({id:'extension-inverter-'+i,kind:'inverter',name:'扩展组串逆变器 '+(i+1),x,z:156.5,w:5,d:3,h:2.1});
      equipment.push({id:'extension-transformer-'+i,kind:'transformer',name:'扩展箱式升压变 '+(i+1),x,z:163,w:8,d:4,h:3.1});
    }
  }
  // Local civil time, east-positive longitude. NOAA fractional-year equations.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  function sun(settings=cfg){
    const date=new Date(settings.date+'T12:00:00Z'),year=date.getUTCFullYear();
    const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    const day=(Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-Date.UTC(year,0,1))/86400000+1;
    const g=2*Math.PI/days*(day-1+(settings.hour-12)/24);
    const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
    const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
    const ha=(settings.hour*60+eq+4*settings.longitude-60*settings.timezone)/4*rad-Math.PI,lat=settings.latitude*rad;
    const x=-Math.cos(decl)*Math.sin(ha),y=Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha);
    const z=Math.sin(lat)*Math.cos(decl)*Math.cos(ha)-Math.cos(lat)*Math.sin(decl);
    return {direction:[x,y,z],elevation:Math.asin(Math.max(-1,Math.min(1,y)))/rad,azimuth:(Math.atan2(x,-z)/rad+360)%360,solarNoon:(720-eq-4*settings.longitude+60*settings.timezone)/60};
  }
  function normal(settings=cfg){const a=settings.azimuthDeg*rad,t=settings.tiltDeg*rad;return [Math.sin(a)*Math.sin(t),Math.cos(t),-Math.cos(a)*Math.sin(t)];}
  function bounds(p,margin=0,settings=cfg){
    const t=settings.tiltDeg*rad,a=(180-settings.azimuthDeg)*rad;
    const dx=Math.abs(Math.cos(a))*width/2+Math.abs(Math.sin(a))*depth*Math.cos(t)/2;
    const dz=Math.abs(Math.sin(a))*width/2+Math.abs(Math.cos(a))*depth*Math.cos(t)/2;
    return {x0:p.x-dx-margin,x1:p.x+dx+margin,z0:p.z-dz-margin,z1:p.z+dz+margin};
  }
  function overlaps(a,b){return a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;}
  function audit(settings=cfg){
    const footprints=equipment.map(e=>({...e,x0:e.x-e.w/2,x1:e.x+e.w/2,z0:e.z-e.d/2,z1:e.z+e.d/2}));
    const conflicts=footprints.flatMap(e=>panels.filter(p=>overlaps(e,bounds(p,2,settings))).map(p=>({equipment:e.id,panel:[p.x,p.z]})));
    const equipmentConflicts=footprints.flatMap((e,i)=>footprints.slice(i+1).filter(b=>overlaps({...e,x0:e.x0-1,x1:e.x1+1,z0:e.z0-1,z1:e.z1+1},b)).map(b=>[e.id,b.id]));
    const dir=normal(settings),tilt=settings.tiltDeg*rad;
    const winter=[10,12,14,16,18].map(hour=>{
      const s=sun({...settings,date:settings.date.slice(0,4)+'-12-21',hour});
      const inc=Math.max(0,dir.reduce((v,n,i)=>v+n*s.direction[i],0));
      const panelRise=depth*Math.sin(tilt),clearRowGap=3.4-depth*Math.cos(tilt);
      const projectedNorthShadow=s.direction[1]>0?panelRise*Math.max(0,s.direction[2])/s.direction[1]:null;
      return {hour,elevation:s.elevation,incidence:inc,clearRowGap,projectedNorthShadow,rowShadowRisk:projectedNorthShadow!==null&&projectedNorthShadow>clearRowGap};
    });
    return {settings:{...settings},normal:dir,panelCount:panels.length,equipment:footprints,conflicts,equipmentConflicts,winter};
  }
  const api={expand,cfg,panels,equipment,center,width,depth,rad,sun,normal,bounds,overlaps,audit};
  root.NZ_SOLAR_PLAN=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
