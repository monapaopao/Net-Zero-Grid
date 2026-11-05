/* v15: display topology only. No equipment counts or geometry imply production capacity. */
'use strict';
(function(root,factory){const plan=factory();if(typeof module!=='undefined')module.exports=plan;root.NZ_CHEMICAL_PLAN=plan;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ports={
    pemRaw:[175.5,2.1,-176.5],purifyIn:[155,2.2,-169.5],purifyOut:[162,2.5,-177],
    h2In:[194.2,2.5,-176.2],h2Out:[204.4,2.5,-176.2],fresh:[210.5,1.9,-184.5],
    compressorOut:[213,2.8,-186],hxColdIn:[218,2.5,-187],hxColdOut:[219.3,3,-184.5],
    reactorIn:[213.8,2.9,-174],reactorOut:[216.2,7.8,-174],
    hxHotIn:[219.3,5.1,-184.5],hxHotOut:[220.3,3.6,-187],
    coolIn:[241,2.1,-190],product:[251,1.8,-188.5],recycle:[251.5,3.6,-188.5],
    recycleIn:[211,2.6,-189],nitrogenOut:[252,2.6,-176.8],
    stockIn:[270,1.3,-179],stockOut:[282,1.4,-169],loadIn:[276,2.5,-157.6],
    coolantOut:[240,1.5,-187.2],coolantReturn:[240,1.7,-186.8],hxCoolIn:[220.5,1.5,-183],hxCoolOut:[220.5,1.7,-183.4]
  };
  const p=id=>ports[id].slice();
  const paths={
    h2gas:{name:'制氢 → 纯化压缩 → 储氢',from:'pemRaw',to:'h2In',media:'hydrogen',meter:'既有制氢产量',pts:[p('pemRaw'),[171,2.1,-176.5],[171,2.1,-166],[155,2.1,-166],p('purifyIn'),[155,2.5,-174],p('purifyOut'),[162,2.5,-180.8],[162,6.5,-180.8],[162,6.5,-192],[194.2,6.5,-192],[194.2,6.5,-181],[194.2,2.5,-181],p('h2In')]},
    h2use:{name:'储氢 → 合成气压缩换热 → 反应器',from:'h2Out',to:'reactorIn',media:'hydrogen',meter:'既有合成氨用氢量',pts:[p('h2Out'),[204.4,2.5,-179.5],[204.4,6.7,-179.5],[204.4,6.7,-192],[208.5,6.7,-192],[208.5,6.7,-184.5],[208.5,1.9,-184.5],p('fresh'),p('compressorOut'),p('hxColdIn'),p('hxColdOut'),[220.4,3,-184.5],[220.4,3,-174],p('reactorIn')]},
    nh3:{name:'反应器 → 换热冷却分离 → 氨产品储运',from:'reactorOut',to:'stockIn',media:'ammonia',meter:'既有合成氨产量；出口前为含氨混合气',pts:[p('reactorOut'),[219.3,7.8,-174],[219.3,7.8,-184.5],p('hxHotIn'),p('hxHotOut'),[225.5,3.6,-187],[225.5,3.6,-192],[225.5,7,-192],[241,7,-192],[241,2.1,-192],p('coolIn'),[246,2.1,-190],p('product'),[257,1.8,-188.5],[257,4.1,-188.5],[257,4.1,-182.5],[264.5,4.1,-182.5],[264.5,1.3,-182.5],[270,1.3,-182.5],p('stockIn')]},
    nitrogen:{name:'供氮净化 → 合成气入口',from:'nitrogenOut',to:'fresh',media:'nitrogen',meter:'路径示意；流量未配置',pts:[p('nitrogenOut'),[256,2.6,-176.8],[256,2.6,-184],[256,6.1,-184],[256,6.1,-192],[210.5,6.1,-192],[210.5,6.1,-184.5],p('fresh')]},
    recycle:{name:'气液分离 → 循环压缩返回',from:'recycle',to:'recycleIn',media:'synthesis',meter:'路径示意；循环量未配置',pts:[p('recycle'),[255,3.6,-188.5],[255,3.6,-192],[255,7.4,-192],[211,7.4,-192],p('recycleIn')]},
    loading:{name:'氨储运泵组 → 专用装卸',from:'stockOut',to:'loadIn',media:'ammonia',meter:'装卸接口；不表示已建立出库模型',pts:[p('stockOut'),[286.5,1.4,-169],[286.5,1.4,-160],[276,1.4,-160],p('loadIn')]},
    coolSupply:{name:'冷却供流 → 换热接口',from:'coolantOut',to:'hxCoolIn',media:'cooling',meter:'既有冷却示意；冷热功率未配置',pts:[p('coolantOut'),[237,1.5,-187.2],[237,1.5,-181.3],[220.5,1.5,-181.3],p('hxCoolIn')]},
    coolReturn:{name:'换热接口 → 冷却回流',from:'hxCoolOut',to:'coolantReturn',media:'cooling',meter:'既有冷却示意；冷热功率未配置',pts:[p('hxCoolOut'),[220.5,1.7,-180.9],[237.5,1.7,-180.9],[237.5,1.7,-186.8],p('coolantReturn')]}
  };
  const custom=['h2purify','nitrogen','nh3cycle','nh3cool','ammoniastock','ammoniaload'];
  const bays=[
    {key:'pem',x:181,z:-174,w:14,d:8,h:4.5},
    {key:'h2tank',x:199,z:-174,w:13,d:8,h:6.4},
    {key:'nh3',x:215,z:-174,w:12,d:12,h:11.6}
  ];
  const reserves=[
    {key:'chemical-service-reserve',name:'氢氨公用工程预留',x0:225,x1:245,z0:-234,z1:-216},
    {key:'chemical-maintenance',name:'氢氨检修操作通道',x0:149,x1:260,z0:-162,z1:-159}
  ];
  const rack={x0:150,x1:286,z:-192,width:4,deck:5.9,top:7.9,posts:[150,162,174,186,198,206,224,230,256,270,282,286]};
  const rackExclusions=[
    {key:'compressor canopy',x0:206.65,x1:215.35,z0:-189.35,z1:-182.65},
    {key:'heat exchangers',x0:215.5,x1:222.5,z0:-189,z1:-183},
    {key:'cooler west',x0:239.3,x1:242.7,z0:-191.85,z1:-188.75},
    {key:'cooler east',x0:243.3,x1:246.7,z0:-191.85,z1:-188.75},
    {key:'separator',x0:250,x1:252,z0:-189.5,z1:-187.5}
  ];
  const protectedAreas=[...bays.map(b=>({key:'v15 bay '+b.key,x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2})),...reserves,{key:'v15 pipe rack',x0:rack.x0-1,x1:rack.x1+1,z0:rack.z-2,z1:rack.z+2}];
  // Reserve the actual corridors so landscaping cannot be generated inside process branches.
  for(const [key,path]of Object.entries(paths))for(let i=1;i<path.pts.length;i++){
    const a=path.pts[i-1],b=path.pts[i];protectedAreas.push({key:'v15 process '+key,x0:Math.min(a[0],b[0])-.5,x1:Math.max(a[0],b[0])+.5,z0:Math.min(a[2],b[2])-.5,z1:Math.max(a[2],b[2])+.5});
  }
  const boundaries={production:'沿用既有制氢、储氢及合成氨账本；展示数量不推导产能',auxiliaries:'纯化、供氮、压缩、冷却与储运电耗是否已含，仍需逐项配置',storage:'氨罐采用压力容器外形示意；压力、温度、容积及出入库模型待配置',safety:'展示隔离与检修空间；防火距离、事故处置和设备选型待工程设计',route:'管廊及端口是展示拓扑，不是施工管仪图'};
  return {version:'15.0.0',ports,paths,custom,bays,reserves,rack,rackExclusions,protectedAreas,boundaries};
});
