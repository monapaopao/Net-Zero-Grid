/* v7: display coordinates only. The twelve engine samples retain their indices. */
'use strict';
window.NZ_RENEWABLE_PLAN = (function () {
  const bounds = window.NZ_MULTI_PLAN.bounds;
  const turbine={towerHeight:31.05,hubHeight:31.65,rotorScale:1.25,hubScale:1.1,headScale:3};
  const sites = [
    ['west',-240,-20],['west',-360,25],['west',-480,-30],['west',-485,100],
    ['ridge',-475,-155],['ridge',-350,-145],['ridge',-225,-180],['ridge',-100,-190],
    ['distant',-465,-310],['distant',-335,-330],['distant',-190,-335],['distant',-50,-315]
  ].map(([zone,x,z],index)=>({zone,x,z,index}));
  const hills = [
    [-477,-175,40,78,65],[-343,-164,31,78,63],[-222,-195,37,74,63],[-97,-212,25,66,62],
    [-466,-344,64,86,68],[-331,-358,55,82,66],[-192,-368,61,82,73],[-54,-357,47,71,69]
  ];
  const smooth = (a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  function naturalHeight(x,z) {
    // Flat PV/campus foreground; softened hill shoulders further north.
    const north = 1-smooth(-105,-47,z);
    const east = 1-smooth(18,92,x);
    let h=0;
    for(const [cx,cz,amp,sx,sz] of hills)h+=amp*Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2)*1.6);
    const edge=smooth(bounds.x0,bounds.x0+27,x)*(1-smooth(bounds.x1-27,bounds.x1,x))*smooth(bounds.z0,bounds.z0+25,z)*(1-smooth(bounds.z1-25,bounds.z1,z));
    return Math.max(0,h*north*east*edge);
  }
  sites.forEach(s=>{s.y=naturalHeight(s.x,s.z);s.padY=s.y+.22;});
  function rawHeight(x,z) {
    let h=naturalHeight(x,z);
    for(const s of sites){const r=Math.hypot(x-s.x,z-s.z);if(r<23)h+=(s.y-h)*(1-smooth(12,23,r));}
    return h;
  }
  const terrainGrid={nx:206,nz:136,dx:(bounds.x1-bounds.x0)/206,dz:(bounds.z1-bounds.z0)/136};
  const elevations=[];
  for(let j=0;j<=terrainGrid.nz;j++)for(let i=0;i<=terrainGrid.nx;i++)elevations.push(rawHeight(bounds.x0+i*terrainGrid.dx,bounds.z0+j*terrainGrid.dz));
  function height(x,z){
    // Sample the rendered triangular mesh, rather than the underlying smooth
    // function: roads/planting now meet the actual surface between grid vertices.
    const gx=Math.max(0,Math.min(terrainGrid.nx-1e-7,(x-bounds.x0)/terrainGrid.dx)),gz=Math.max(0,Math.min(terrainGrid.nz-1e-7,(z-bounds.z0)/terrainGrid.dz));
    const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,k=j*(terrainGrid.nx+1)+i;
    const a=elevations[k],b=elevations[k+1],c=elevations[k+terrainGrid.nx+1],d=elevations[k+terrainGrid.nx+2];
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  const roads = [
    {zone:'west',name:'西侧检修干道',width:4.4,pts:[[-23,-24],[-203,-24],[-219,-6],[-240,-6],[-294,8],[-360,39],[-420,13],[-480,-16],[-501,28],[-501,114],[-485,114]]},
    {zone:'ridge',name:'缓丘检修道路',width:4,pts:[[-203,-24],[-192,-58],[-205,-92],[-243,-114],[-288,-110],[-326,-123],[-350,-131],[-400,-133],[-443,-140],[-475,-141],[-518,-180],[-520,-226]]},
    {zone:'ridge',name:'东侧山脊连接',width:4,pts:[[-288,-110],[-246,-133],[-225,-166],[-185,-156],[-148,-161],[-100,-176]]},
    {zone:'distant',name:'远丘检修道路',width:4,pts:[[-520,-226],[-506,-266],[-490,-296],[-465,-296],[-430,-312],[-383,-299],[-355,-315],[-335,-316],[-285,-320],[-236,-313],[-190,-321],[-145,-300],[-99,-298],[-50,-301]]},
    {zone:'solar',name:'光伏检修环路',width:4,pts:[[-546,45],[-70,45],[-70,172],[-546,172],[-546,45]]},
    {zone:'solar',name:'光伏分区检修通道',width:3,pts:[[-180,78],[-70,78]]},
    {zone:'solar',name:'光伏入口连接',width:4,pts:[[-70,133],[-35,133],[-23,95],[-23,-24]]}
  ];
  for(const z of [77,104,131])roads.push({zone:'solar',name:'扩展分区横向检修道',width:3,pts:[[-546,z],[-193,z]]});
  for(const x of [-507,-441,-375,-309,-243])roads.push({zone:'solar',name:'扩展分区纵向检修道',width:2.4,pts:[[x,45],[x,172]]});
  // Each tower has a dedicated approach to the same connected service network.
  for(const s of sites)roads.push({zone:s.zone,name:'机组 '+(s.index+1)+' 支路',width:3.6,pts:[[s.x,s.z+14],[s.x,s.z+3]]});
  window.NZ_SOLAR_PLAN.expand(roads,sites,height);
  return {bounds,sites,hills,height,rawHeight,naturalHeight,terrainGrid,roads,turbine,rotorDiameter:22.2*turbine.rotorScale,solarBounds:{x0:-550,x1:-72,z0:49,z1:168}};
})();
