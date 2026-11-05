/* Shared geometry plan, used before static batching and during environment construction. */
'use strict';
window.NZ_ENVIRONMENT_PLAN=(function(){
  const protectedAreas = [
    ['AIS',7,69,-32,18], ['line',53.5,80.5,-43,-38],
    ['storage',11.8,58.2,25.3,53.3], ['disttr',70.5,85.5,6.8,37.1],
    ['stepdown',85.25,98.75,-25,5], ['bus',73.5,82.5,-14,-6],
    ['dcfeed',103.7,116.3,-20,0], ['dc',118.7,149.5,-20.5,5],
    ['genset',161,207,-21,5], ['token',148.5,161.5,25.7,36.8],
    ['fire',118,182,-99,-47], ['svgapf',99.4,104.6,28.3,31.7],
    ['hydrogen',8,65,61,71], ['charging',44,84,82,95], ['chargingSecond',44,84,101,114], ['chargingFirstPower',33.5,40.5,81.5,88.5],
    ['metal',104.8,147,64,87],
    ['logistics',112.5,160,99,131], ['visitorParking',31,79,124,138],
    ['smrIsland',121,147,-118,-93], ['smrTurbine',149,177,-117,-97],
    ['smrCooling',180,203,-125,-102], ['smrElectrical',160,190,-96,-79],
    ['smrAdmin',123,138,-80,-71], ['smrWater',145,162,-80,-71],
    ['smrMaintenance',188,202,-80,-71], ['smrGatehouse',193,201,-67,-63]
  ].map(([key,x0,x1,z0,z1])=>({key,x0,x1,z0,z1}));
  const network = [
    ['north','北侧检修路',-7,-36,217,3.2],
    ['west','西侧环路',-7,-36,5,166],
    ['central','东西主干路',-7,54,217,6],
    ['storage','储能西侧连接',-7,20,17,5],
    ['storage','储能检修路',5,20,5,34],
    ['power','供配电检修路',61,20,6,34],
    ['compute','数据中心入口路',106.5,5,4,49],
    ['compute','数据中心前场',106.5,16,103.5,5],
    ['hydrogen','氢氨服务路',-7,75,107,5],
    ['charging','超充南侧服务路',-7,99,107,5],
    ['industrial','工业与物流连接',100,94.75,110,4],
    ['southwest','西侧入口连接',-7,124,107,6],
    ['entrance','入口大道',90,54,10,96],
    ['logistics','物流南侧主路',100,136,110,8],
    ['east','东侧环路',204,16,6,128],
    // SMR streets sit on the raised site base, at y=.4.
    ['smr','核电分区北侧检修路',112,-132,97,4,.4],
    ['smr','核电分区南侧道路',112,-71,96,4,.4],
    ['smr','核电分区西环路',112,-131.5,4,63,.4],
    ['smr','核电分区东环路',205,-131.5,4,63,.4]
  ];
  const P=window.NZ_MULTI_PLAN;
  for(const b of protectedAreas){const key=b.key.startsWith('smr')?'smr':b.key==='hydrogen'?'pem':b.key;const d=P.moves[key];if(d){b.x0+=d[0];b.x1+=d[0];b.z0+=d[1];b.z1+=d[1];}}
  protectedAreas.push({key:'liquid service corridor',...P.factoryHall.liquidBridge.bounds},{key:'factory',...P.factoryHall.bounds},{key:'factorywaste',x0:192,x1:228,z0:-93,z1:-44});
  for(const f of P.facilities)protectedAreas.push({key:f.key,x0:f.x-f.w/2,x1:f.x+f.w/2,z0:f.z-f.d/2,z1:f.z+f.d/2});
  protectedAreas.push(...window.NZ_CHEMICAL_PLAN.protectedAreas);
  for(const path of P.renewableExport.phasePaths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];protectedAreas.push({key:'v15 renewable export corridor',x0:Math.min(a[0],b[0])-1,x1:Math.max(a[0],b[0])+1,z0:Math.min(a[2],b[2])-1,z1:Math.max(a[2],b[2])+1});}
  return {protectedAreas,roads:P.roads};
})();
