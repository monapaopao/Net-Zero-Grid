/* v9: one geographic registry. Display coordinates are not engineering metres. */
'use strict';
(function(root,factory){const p=factory();if(typeof module!=='undefined')module.exports=p;root.NZ_MULTI_PLAN=p;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const sites={
    compute:{name:'数据中心园区',x0:84,x1:214,z0:-36,z1:150,gate:[95,150],polygon:[[84,-36],[214,-36],[214,150],[84,150],[84,40],[88,40],[88,6],[84,6]]},
    chemical:{name:'化工与电冶金园区',x0:90,x1:310,z0:-275,z1:-125,gate:[296,-125]},
    nuclear:{name:'独立 SMR 核电研究园区',x0:227,x1:333,z0:-392,z1:-318,gate:[304,-319]},
    factory:{name:'智能制造与柔性用能区',x0:238,x1:326,z0:-90,z1:135,gate:[249,135],westGate:[238,23]},
    energy:{name:'共享能源枢纽',x0:-10,x1:87,z0:-44,z1:59,gate:[2,59],polygon:[[-10,-44],[82,-44],[82,6],[87,6],[87,40],[82,40],[82,59],[-10,59]]},
    public:{name:'公共交通与充电服务区',x0:24,x1:86,z0:75,z1:142,gate:[64,142]},
    emergency:{name:'消防站',x0:118,x1:182,z0:-99,z1:-47,gate:[150,-47],serviceGate:[174,-99]}
  };
  const factoryHall={
    center:[280,18],w:56,d:192,h:9,bounds:{x0:252,x1:308,z0:-78,z1:114},
    rawZone:{z0:-74,z1:-56},production:{z0:-50,z1:86},packZone:{z0:92,z1:110},
    lineScale:.5,columns:[269,291],workcell:{w:18,d:9.9,gap:3},centralAisle:{x0:278,x1:282},sideAisles:[{x0:254,x1:260},{x0:300,x1:306}],
    ports:{control:[260,2,127.5],utility:[308,1.4,117],process:[304,1.4,114],heat:[308,5.3,122]}
  };
  const rowCount=10,rowSpan=rowCount*factoryHall.workcell.d+(rowCount-1)*factoryHall.workcell.gap;
  factoryHall.rows=Array.from({length:rowCount},(_,i)=>factoryHall.columns.map((x,column)=>({center:[x,Number((18-rowSpan/2+factoryHall.workcell.d/2+i*12.9).toFixed(4))],rotationY:0,row:i,column}))).flat();
  factoryHall.waste={x0:193,x1:227,z0:-92,z1:-52,center:[210,-72]};
  factoryHall.liquidBridge={bounds:{x0:222,x1:263,z0:-69,z1:-50},clearHeight:5.8,wallX:252,lanes:[-66,-62,-58,-54]};
  const moves={metal:[19,-301],panamaZn:[19,-301],pem:[165,-240],h2tank:[165,-240],nh3:[165,-240],fc:[165,-240],factory:[99,-60],smr:[120,-255]};
  const facilities=[
    {key:'cooling',name:'闭式冷站与液冷换热',x:130,z:75,w:32,d:24,h:5,zone:'compute',status:'对应现有辅助负荷'},
    {key:'ups',name:'直流后备电源与电池服务中心',x:172,z:74,w:23,d:16,h:5,zone:'compute',status:'代表性配套；未核算备用时长'},
    {key:'noc',name:'网络接入与运维中心',x:183,z:103,w:22,d:16,h:6,zone:'compute',status:'对应现有辅助负荷'},
    {key:'firewater',name:'消防泵房与水池',x:183,z:52,w:16,d:10,h:3,zone:'compute',status:'配套示意'},
    {key:'maintenance',name:'设备检修与备件周转区',x:180,z:32,w:28,d:24,h:5,zone:'compute',status:'检修与备件周转',kind:'maintenance'},
    {key:'phase2',name:'A2 二期机房预留',x:130,z:32,w:28,d:20,h:0,zone:'compute',status:'未建设 / 未投运'},
    {key:'phase3',name:'A3 二期机房预留',x:181,z:128,w:28,d:18,h:0,zone:'compute',status:'未建设 / 未投运'},
    {key:'nitrogen',name:'氮气供应与净化接口',x:246,z:-174,w:16,d:12,h:4,zone:'chemical',status:'配套示意 / 待配置'},
    {key:'chemwater',name:'分质水处理与公用工程',x:264,z:-226,w:25,d:16,h:4,zone:'chemical',status:'配套示意 / 待配置'},
    {key:'zincstock',name:'电解锌原料与产品接驳',x:203,z:-225,w:30,d:18,h:5,zone:'chemical',status:'上游供料边界 / 待配置'},
    {key:'ammoniastock',name:'氨产品储运接口',x:276,z:-174,w:16,d:14,h:3,zone:'chemical',status:'储运接口示意 / 待配置'},
    {key:'chemicalfeed',name:'化工计量与受电',x:115,z:-151,w:12,d:9,h:3,zone:'chemical',status:'分区受电示意'},
    {key:'factoryfeed',name:'制造区计量与受电',x:260,z:123,w:12,d:9,h:3,zone:'factory',status:'分区受电示意'}
  ];
  facilities.push(...[
  {
    "key": "panamaSc2",
    "name": "新能源充电站南排直流电源",
    "x": 37,
    "z": 109,
    "w": 7,
    "d": 7,
    "h": 3,
    "zone": "public",
    "status": "原充电容量内分配；车辆侧可调直流",
    "kind": "power"
  },
  {
    "key": "parking",
    "name": "普通停车区（混合停放）",
    "x": 55,
    "z": 131,
    "w": 48,
    "d": 14,
    "h": 0,
    "zone": "public",
    "status": "混合停车；保留油车与无障碍车位",
    "kind": "parking"
  },
  {
    "key": "factoryraw",
    "name": "制造原料与入厂检验库",
    "x": 280,
    "z": -65,
    "w": 36,
    "d": 18,
    "h": 5,
    "zone": "factory",
    "status": "配套空间；计入原工厂负荷边界",
    "kind": "warehouse",
    "integrated": true
  },
  {
    "key": "factoryproduct",
    "name": "制造成品与包装库",
    "x": 280,
    "z": 101,
    "w": 36,
    "d": 18,
    "h": 5,
    "zone": "factory",
    "status": "配套空间；计入原工厂负荷边界",
    "kind": "warehouse",
    "integrated": true
  },
  {
    "key": "factoryutility",
    "name": "制造动力公用工程",
    "x": 308,
    "z": 122,
    "w": 10,
    "d": 10,
    "h": 4,
    "zone": "factory",
    "status": "空压 / 冷却接口；参数待配置",
    "kind": "utility"
  },
  {
    "key": "factorydispatch",
    "name": "制造出货与维修库",
    "x": 290,
    "z": 122,
    "w": 20,
    "d": 12,
    "h": 5,
    "zone": "factory",
    "status": "配套空间；计入原工厂负荷边界",
    "kind": "warehouse"
  },
  {
    "key": "factorystaging",
    "name": "制造装卸待装区",
    "x": 274,
    "z": 122,
    "w": 8,
    "d": 12,
    "h": 0,
    "zone": "factory",
    "status": "物流通道与装卸接口",
    "kind": "staging"
  },
  {
    "key": "chempower",
    "name": "化工配电与保护室",
    "x": 115,
    "z": -250,
    "w": 16,
    "d": 12,
    "h": 4,
    "zone": "chemical",
    "status": "原化工负荷受电分配；不另加产能",
    "kind": "power"
  },
  {
    "key": "chemcontrol",
    "name": "化工控制与分析室",
    "x": 284,
    "z": -252,
    "w": 20,
    "d": 12,
    "h": 4,
    "zone": "chemical",
    "status": "过程控制 / 分析接口；待配置",
    "kind": "control"
  },
  {
    "key": "zincair",
    "name": "锌车间通风与酸雾处理",
    "x": 145,
    "z": -246,
    "w": 22,
    "d": 8,
    "h": 4,
    "zone": "chemical",
    "status": "锌工段辅助接口；待配置",
    "kind": "scrubber"
  },
  {
    "key": "zincfilter",
    "name": "电解液循环与过滤",
    "x": 174,
    "z": -246,
    "w": 14,
    "d": 10,
    "h": 3,
    "zone": "chemical",
    "status": "锌工段辅助接口；待配置",
    "kind": "liquid"
  },
  {
    "key": "zincfinish",
    "name": "锌产品整理与包装库",
    "x": 204,
    "z": -251,
    "w": 32,
    "d": 14,
    "h": 5,
    "zone": "chemical",
    "status": "产品整理与仓储；不增加锌产能",
    "kind": "warehouse"
  },
  {
    "key": "zincstaging",
    "name": "锌原料与产品装卸场",
    "x": 248,
    "z": -249,
    "w": 30,
    "d": 16,
    "h": 0,
    "zone": "chemical",
    "status": "物流接驳；上游供料接口",
    "kind": "staging"
  },
  {
    "key": "h2purify",
    "name": "氢气纯化与压缩",
    "x": 155,
    "z": -174,
    "w": 18,
    "d": 12,
    "h": 3,
    "zone": "chemical",
    "status": "原制氢工段接口；电耗范围待确认",
    "kind": "process"
  },
  {
    "key": "nh3cycle",
    "name": "氨合成循环压缩与换热",
    "x": 215,
    "z": -186,
    "w": 18,
    "d": 8,
    "h": 3,
    "zone": "chemical",
    "status": "原合成氨工段辅助接口；待配置",
    "kind": "process"
  },
  {
    "key": "nh3cool",
    "name": "氨产品冷却与分离",
    "x": 246,
    "z": -190,
    "w": 16,
    "d": 8,
    "h": 3,
    "zone": "chemical",
    "status": "产品冷却接口；待配置",
    "kind": "liquid"
  },
  {
    "key": "ammoniaload",
    "name": "氨产品专用装卸接口",
    "x": 276,
    "z": -151,
    "w": 26,
    "d": 14,
    "h": 0,
    "zone": "chemical",
    "status": "危险介质储运示意；距离待设计",
    "kind": "hazard"
  },
  {
    "key": "chemspares",
    "name": "化工备件与检修库",
    "x": 173,
    "z": -149,
    "w": 28,
    "d": 14,
    "h": 4,
    "zone": "chemical",
    "status": "普通备件与维修；分开储运危险介质",
    "kind": "warehouse"
  },
  {
    "key": "chemfire",
    "name": "化工消防与应急设施",
    "x": 130,
    "z": -175,
    "w": 14,
    "d": 12,
    "h": 3,
    "zone": "chemical",
    "status": "应急设施示意；能力待配置",
    "kind": "fire"
  }
]);
  const roads=[
    ['energy','枢纽北侧检修',-7,-36,91,3.2],['energy','枢纽西环路',-7,-36,5,93],
    ['energy','储能接驳',-7,20,17,5],['energy','储能检修',5,20,5,34],['energy','配电检修',61,20,6,34],
    ['compute','数据区东西主路',88,57,122,5],['compute','数据区北侧道路',89,-33,121,4],
    ['compute','机房服务通道',106.5,5,4,52],['compute','机房前场',106.5,16,103.5,4],
    ['compute','南侧物流主路',100,140,110,6],['compute','东侧消防环路',204,16,6,130],
    ['compute','检修周转区接驳',194,38,16,4],
    ['compute','入口大道',90,16,10,134],['compute','冷站与运维接驳',100,91,104,4],
    ['public','公共交通接驳',-7,54,95,5],['public','充电站中央通行车道',24,95,62,6],
    ['public','公共区西侧道路',24,54,5,88],['public','访客入口接驳',24,140,71,5],
    ['public','普通停车区北侧接驳',29,121,55,3],['public','停车场入口',29,129,2,4],
    ['chemical','化工北环路',95,-270,210,5],['chemical','化工南环路',95,-138,210,5],
    ['chemical','化工西环路',95,-270,5,137],['chemical','化工东环路',300,-270,5,145],
    ['chemical','工艺分区接驳',100,-200,200,5],
    ['chemical','锌仓储与公辅检修通道',100,-240.2,200,2.8],
    ['chemical','制氢与检修库连接',141,-182,4,44],
    ['factory','制造区北道路',241,-85,80,5],['factory','制造区南道路',241,128,80,5],
    ['factory','制造区西道路',241,-85,5,218],['factory','制造区东道路',316,-85,5,218],
    ['factory','制造区西侧应急入口',238,20,8,6],
    ['regional','片区西侧联络道路',74,-300,6,246],['regional','片区北侧联络道路',74,-301,262,6],
    ['regional','化工专用入口支路',293,-133,6,26],['regional','化工外侧运输道路',80,-112,256,6],
    ['regional','东侧片区联络道路',330,-301,6,451],['regional','核电受控入口支路',301,-319,6,24],
    ['regional','消防站北侧接驳',171,-106,6,7],['regional','消防站南侧出警通道',147,-47,6,18],
    ['regional','三园区应急联络道路',207,20,39,6],
    ['regional','制造区入口支路',246,132,6,18],['regional','南侧片区联络道路',90,150,246,6],
    ['regional','公共区连接大道',24,145,71,5],
    ['nuclear','核电北侧道路',232,-387,97,4,.4],['nuclear','核电南侧道路',232,-326,96,4,.4],
    ['nuclear','核电西环路',232,-386.5,4,63,.4],['nuclear','核电东环路',325,-386.5,4,63,.4]
  ];
  const zoneFor={dc:'compute',dcfeed:'compute',genset:'compute',stepdown:'compute',logistics:'compute',fire:'compute',token:'compute',metal:'chemical',panamaZn:'chemical',pem:'chemical',h2tank:'chemical',nh3:'chemical',fc:'chemical',smr:'nuclear',factory:'factory',supercharge:'public',carport:'public',panamaSc:'public',storage:'energy',substation:'energy',bus:'energy',disttr:'energy',svgapf:'compute'};
  zoneFor.fire='emergency';zoneFor.factorywaste='factory';
  function movePoint(key,p){const d=moves[key]||[0,0];return [p[0]+d[0],p[1],p[2]+d[1]];}
  function contains(b,x,z,r=0){
    if(!(x-r>=b.x0&&x+r<=b.x1&&z-r>=b.z0&&z+r<=b.z1))return false;
    if(!b.polygon)return true;
    const inside=(x,z)=>{let yes=false;for(let i=0,j=b.polygon.length-1;i<b.polygon.length;j=i++){const a=b.polygon[i],c=b.polygon[j];if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
    return [[x-r,z-r],[x+r,z-r],[x-r,z+r],[x+r,z+r]].every(([a,c])=>inside(a,c));
  }
  const charging={x:64,rows:[{z:89,terminalZ:84,vehicleZ:89,heading:0},{z:107,terminalZ:112,vehicleZ:107,heading:Math.PI}],parkingPositions:21,busBay:{center:[52,107],row:1,mergedSlots:[0,1,2,3],heading:Math.PI/2,w:12,d:3.6},canopy:{x:64,z:98,w:38,d:32,h:5.4},aisle:{x0:44,x1:84,z0:95,z1:101},dcSupplies:[{key:'panamaSc',x:37,z:85},{key:'panamaSc2',x:37,z:109}],columns:[46,64,82].flatMap(x=>[83,113].map(z=>({x,z}))),parking:{x0:31,x1:79,z0:124,z1:138,spaces:24}};
  const renewableExport={spineZ:-40.5,height:13.2,towerX:[56,67,78],towers:[56,67,78].map(x=>({x,z:-40.5})),path:[[56,6,-18],[56,13.2,-18],[56,13.2,-40.5],[67,13.2,-40.5],[78,13.2,-40.5],[78,13.2,-10],[78,8.6,-10]]};
  renewableExport.phasePaths=[-.7,0,.7].map(d=>[[56+d,6,-18],[56+d,13.2,-18],[56+d,13.2,-40.5+d],[67,13.2,-40.5+d],[78+d,13.2,-40.5+d],[78+d,13.2,-10],[78+d,8.6,-10]]);
  return {sites,factoryHall,moves,facilities,roads,zoneFor,movePoint,contains,charging,renewableExport,bounds:{x0:-565,x1:360,z0:-425,z1:190},home:{pos:[650,600,660],tgt:[-90,8,-108]}};
});
