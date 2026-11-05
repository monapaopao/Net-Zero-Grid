/* Native Three.js adapter for the Anatomy storage assemblies. */
'use strict';
window.NZ_STORAGE=(function(){
 const data=window.NZ_STORAGE_MODEL.create(),validation=window.NZ_STORAGE_MODEL.audit(data);if(!validation.passed)throw Error(JSON.stringify(validation.errors));
 let root,medium,fine,heroShell,heroDoors;const status=[];let lastTime=0;
 const local=p=>p.map((v,i)=>v-data.origin[i]);
 function build(T){
  const m=T.model('storage',28,30);root=m.root;root.name='Detailed storage';
  medium=T.group(root,'Storage standard components');fine=T.group(m.fine,'Storage high components');
  heroShell=T.movable(root,'Representative battery enclosure',[0,5.1,0]);heroDoors=T.movable(root,'Representative service doors',[0,0,2.25]);
  const heroMid={heroShell:T.group(heroShell,'Shell medium details'),heroDoors:T.group(heroDoors,'Door medium details')},heroFine={heroShell:T.group(heroShell,'Shell high details'),heroDoors:T.group(heroDoors,'Door high details')};
  const choose=p=>p.assembly==='fixed'?(p.tier==='high'?fine:p.tier==='medium'?medium:root):(p.tier==='high'?heroFine[p.assembly]:p.tier==='medium'?heroMid[p.assembly]:p.assembly==='heroShell'?heroShell:heroDoors);
  for(const p of data.parts){const g=choose(p),c=data.colors[p.mat];
   if(p.type==='box')T.box(...p.size,c,...local(p.p),g);
   else if(p.type==='rod')T.rod(local(p.a),local(p.b),p.r,c,g);
   else if(p.type==='cyl'){const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...p.axis)),e=new THREE.Euler().setFromQuaternion(q);T.shape('cyl',[p.r,p.r,p.h],c,local(p.p),g,e.toArray().slice(0,3));}
   else{const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...p.axis)),e=new THREE.Euler().setFromQuaternion(q);T.ring(p.r,p.t,c,...local(p.p),g,e.toArray().slice(0,3));}
  }
  const lens=new THREE.MeshStandardMaterial({color:0x238e83,roughness:.4,emissive:0x238e83,emissiveIntensity:.12});
  const bgmat=new THREE.MeshStandardMaterial({color:0x405b58,roughness:.65}),geo=new THREE.BoxGeometry(1,1,1);
  for(const u of data.units.filter(u=>u.kind==='battery')){const parent=u.hero?heroDoors:root;const back=new THREE.Mesh(geo,bgmat);back.position.fromArray(local([u.x,3.58,u.z+1.92]));back.scale.set(3.5,.12,.05);parent.add(back);const fill=new THREE.Mesh(geo,lens);fill.position.copy(back.position);fill.position.z+=.035;fill.scale.set(3.4,.08,.025);parent.add(fill);status.push({fill,x:back.position.x});}
  const lab=LABELS3D.storage;if(lab){lab.anc.set(35.5,6,39);lab.el.querySelector('.nm').textContent='储能电站';const sub=lab.el.querySelector('.pr');if(sub)sub.textContent='300 MWh / 150 MW · 分组电池 / PCS / 升压配电';}
  const info=INFO.storage;info.d='三排代表性液冷电池舱组成储能阵列，按组连接双向 PCS 与升压配电设备。南侧配置站控、通信和消防器材，行间保留检修通道。近侧一舱可拆解，观察电池架、模组、直流汇流、液冷及消防监测。';
  info.p=info.p.filter(r=>!['展示配置','图示配置'].includes(r[0]));info.p.push(['图示配置','12 座代表性电池舱 / 6 面 PCS / 3 组升压配电'],['站级容量','300 MWh / 150 MW（沿用调度配置）'],['内部观察','近侧代表舱可拆解；SOC 灯条与运行状态同步']);info.note='设备数量、外观和间距为展示比例，不由图示舱数推算容量；储能服务多园区，不替代数据中心楼内 UPS。';
  TICKERS.push(()=>{const now=performance.now(),dt=lastTime?Math.min(.1,(now-lastTime)/1000):.016;lastTime=now;const S=window.NZ_ENGINE.S;const q=S.quality;medium.visible=q!=='compat';fine.visible=q==='high';for(const g of Object.values(heroMid))g.visible=q!=='compat';for(const g of Object.values(heroFine))g.visible=q==='high';
   const level=Math.max(.03,Math.min(1,S.soc/100));for(const {fill,x}of status){fill.scale.x+=(3.4*level-fill.scale.x)*(1-Math.exp(-dt*8));fill.position.x=x-(3.4-fill.scale.x)/2;}
   const pulse=S.running&&!S.reduceMotion&&Math.abs(S.stP)>.1&&camera.position.distanceTo(root.position)<160?.08*(.5+.5*Math.sin(now*.0018)):0;lens.emissiveIntensity=.12+pulse;
  });return m;
 }
 function audit(){return {...validation,geometry:data,root:root?.uuid};}
 return {build,audit,data};
})();
