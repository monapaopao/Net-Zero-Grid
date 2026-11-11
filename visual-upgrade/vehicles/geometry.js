/* Geometry adapters inside NZ_VEHICLES: construction only, no frame-time rebuilds. */
 function geom(p){
  if(p.type==='box')return new T.BoxGeometry(...p.size);
  if(p.type==='roundbox'){
   const g=new T.BoxGeometry(...p.size,2,2,2),a=g.attributes.position,n=g.attributes.normal,half=p.size.map(x=>x/2),r=Math.min(.055,...p.size.map(x=>x*.22));
   for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i),q=new T.Vector3(...half.map((h,k)=>Math.max(-h+r,Math.min(h-r,v.getComponent(k))))),normal=v.clone().sub(q).normalize();v.copy(q).addScaledVector(normal,r);a.setXYZ(i,...v.toArray());n.setXYZ(i,...normal.toArray());}return g;
  }
  if(p.type==='cyl')return new T.CylinderGeometry(p.size[0],p.size[0],p.size[1],16);
  if(p.type==='ring')return new T.TorusGeometry(p.size[0],p.size[1],5,24);
  if(p.type==='oval')return new T.SphereGeometry(1,16,10);
  if(p.type==='tyre'){
   const [r,w]=p.size,profile=[[r*.59,-w*.48],[r*.83,-w*.5],[r*.965,-w*.35],[r,-w*.19],[r,w*.19],[r*.965,w*.35],[r*.83,w*.5],[r*.59,w*.48]];
   return new T.LatheGeometry(profile.map(v=>new T.Vector2(...v)),16);
  }
  if(p.type==='vessel'){
   const [r,len]=p.size,h=len/2,cap=.38,pts=[];
   for(let j=0;j<=8;j++){const t=j*Math.PI/16;pts.push(new T.Vector2(r*Math.sin(t),-h+cap*(1-Math.cos(t))));}
   pts.push(new T.Vector2(r,h-cap));
   for(let j=1;j<=8;j++){const t=j*Math.PI/16;pts.push(new T.Vector2(r*Math.cos(t),h-cap+cap*Math.sin(t)));}
   return new T.LatheGeometry(pts,32);
  }
  if(p.type==='rod'){
   const a=new T.Vector3(...p.p),b=new T.Vector3(...p.b),g=new T.CylinderGeometry(p.size[0],p.size[0],a.distanceTo(b),6),o=new T.Object3D();o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());o.updateMatrix();g.applyMatrix4(o.matrix);return g;
  }
  if(p.type==='panel'){
   const positions=[],normal=new T.Vector3(...p.normal),a=new T.Vector3(...p.vertices[0]);
   for(let i=1;i<p.vertices.length-1;i++){let b=new T.Vector3(...p.vertices[i]),c=new T.Vector3(...p.vertices[i+1]);if(b.clone().sub(a).cross(c.clone().sub(a)).dot(normal)<0)[b,c]=[c,b];positions.push(...a.toArray(),...b.toArray(),...c.toArray());}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));g.computeVertexNormals();return g;
  }
  if(p.type!=='hull')throw Error('Unsupported vehicle primitive '+p.type);
  const sections=p.sections,rows=[],positions=[],uv=[],indices=[];
  // Interpolate the silhouette monotonically; wheel openings are actual lower boundaries.
  for(let i=0;i<sections.length-1;i++){
   const a=sections[i],b=sections[i+1],steps=Math.max(3,Math.ceil((b[0]-a[0])/.095));
   for(let j=0;j<steps;j++){const t=j/steps,e=t*t*(3-2*t);rows.push(a.map((v,k)=>v+(b[k]-v)*(k===0?t:e)));}
  }rows.push(sections.at(-1));
  const N=12;
  for(let i=0;i<rows.length;i++){
   const [z,w,bottom,top]=rows[i];let lo=bottom;
   for(const a of p.arches||[]){const d=z-a.z;if(Math.abs(d)<a.r)lo=Math.max(lo,a.y+Math.sqrt(a.r*a.r-d*d));}
   lo=Math.min(top-.025,lo);const bevel=Math.min(.055,(top-lo)*.20),crown=p.crown||0;
   const ring=[[-w+bevel,lo],[-w,lo+bevel],[-w,top-bevel],[-w+bevel,top],[ -w*.50,top+crown*.75],[0,top+crown],[w*.50,top+crown*.75],[w-bevel,top],[w,top-bevel],[w,lo+bevel],[w-bevel,lo],[0,lo]];
   ring.forEach(([x,y],k)=>{positions.push(x,y,z);uv.push(k/N,i/(rows.length-1));});
  }
  for(let j=0;j<rows.length-1;j++)for(let k=0;k<N;k++){const n=(k+1)%N,a=j*N+k,b=(j+1)*N+k,c=(j+1)*N+n,d=j*N+n;indices.push(a,b,c,a,c,d);}
  for(const [row,rear]of [[0,true],[rows.length-1,false]]){
   const s=rows[row],center=positions.length/3;positions.push(0,(s[2]+s[3])/2,s[0]);uv.push(.5,.5);const base=positions.length/3;
   for(let k=0;k<N;k++){positions.push(...positions.slice(row*N*3+k*3,row*N*3+k*3+3));uv.push(.5,.5);}
   for(let k=0;k<N;k++){const next=(k+1)%N;rear?indices.push(center,base+k,base+next):indices.push(center,base+next,base+k);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
