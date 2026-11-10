/* Linear HDR scene, half-size depth AO, quarter-size bloom, edge AA at output. */
'use strict';
window.NZPost = (function () {
  const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const reconstruct = `
    varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 inverseProjection;
    uniform mat4 projection; uniform vec2 resolution;
    vec3 viewPosition(vec2 uv){float d=texture2D(tDepth,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
  `;
  const aoFragment = reconstruct + `
    uniform float gain;
    void main(){
      float depth=texture2D(tDepth,vUv).r;
      if(depth>.99999){gl_FragColor=vec4(1.,depth,0.,1.);return;}
      vec2 pixel=1./resolution;vec3 p=viewPosition(vUv);
      vec3 r=viewPosition(vUv+vec2(pixel.x,0.))-p,l=p-viewPosition(vUv-vec2(pixel.x,0.));
      vec3 t=viewPosition(vUv+vec2(0.,pixel.y))-p,b=p-viewPosition(vUv-vec2(0.,pixel.y));
      vec3 normal=normalize(cross(abs(r.z)<abs(l.z)?r:l,abs(t.z)<abs(b.z)?t:b));
      if(dot(normal,p)>0.)normal=-normal;
      vec2 radius=vec2(projection[0][0],projection[1][1])/max(-p.z,.01);
      float occlusion=0.;
      for(int i=0;i<8;i++){
        float angle=float(i)*2.39996323;float fraction=sqrt((float(i)+.5)/8.);
        vec2 uv=vUv+vec2(cos(angle),sin(angle))*radius*fraction;
        if(uv.x<=0.||uv.x>=1.||uv.y<=0.||uv.y>=1.)continue;
        vec3 delta=viewPosition(uv)-p;float distance=length(delta);
        occlusion+=max(0.,dot(normal,delta)/max(distance,.001)-.08)*(1.-smoothstep(.15,2.,distance));
      }
      gl_FragColor=vec4(clamp(1.-occlusion/8.*gain,.65,1.),depth,0.,1.);
    }`;
  const brightFragment = `varying vec2 vUv;uniform sampler2D image;uniform float threshold;
    void main(){vec3 c=texture2D(image,vUv).rgb;float w=smoothstep(threshold,threshold+.4,max(c.r,max(c.g,c.b)));gl_FragColor=vec4(c*w,1.);}`;
  const blurFragment = `varying vec2 vUv;uniform sampler2D image;uniform vec2 direction;
    void main(){vec3 c=texture2D(image,vUv).rgb*.227027;c+=(texture2D(image,vUv+direction*1.384615).rgb+texture2D(image,vUv-direction*1.384615).rgb)*.316216;
    c+=(texture2D(image,vUv+direction*3.230769).rgb+texture2D(image,vUv-direction*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`;
  const compositeFragment = `
    varying vec2 vUv;uniform sampler2D image;uniform sampler2D aoImage;uniform sampler2D bloomImage;uniform sampler2D tDepth;
    uniform vec2 pixel;uniform vec2 aoPixel;uniform float useAO;uniform float strength;uniform float vignette;
    float nzLuma(vec3 c){return dot(c,vec3(.299,.587,.114));}
    void main(){
      vec3 c=texture2D(image,vUv).rgb;
      vec3 n=texture2D(image,vUv+vec2(0.,pixel.y)).rgb,s=texture2D(image,vUv-vec2(0.,pixel.y)).rgb;
      vec3 e=texture2D(image,vUv+vec2(pixel.x,0.)).rgb,w=texture2D(image,vUv-vec2(pixel.x,0.)).rgb;
      float l=nzLuma(c);float range=max(max(nzLuma(n),nzLuma(s)),max(nzLuma(e),nzLuma(w)))-min(min(nzLuma(n),nzLuma(s)),min(nzLuma(e),nzLuma(w)));
      float edge=smoothstep(.10,.35,range/max(l,.15));c=mix(c,(n+s+e+w)*.25,edge*.35);
      float depth=texture2D(tDepth,vUv).r;
      if(useAO>.5){
        vec2 a=texture2D(aoImage,vUv).rg;float sum=a.r,weight=1.;
        for(int i=0;i<4;i++){
          vec2 offset=i==0?vec2(aoPixel.x,0.):i==1?vec2(-aoPixel.x,0.):i==2?vec2(0.,aoPixel.y):vec2(0.,-aoPixel.y);
          vec2 sampleAO=texture2D(aoImage,vUv+offset).rg;
          float k=exp(-abs(sampleAO.g-depth)*4000.);sum+=sampleAO.r*k;weight+=k;
        }c*=sum/weight;
      }
      if(strength>0.)c+=texture2D(bloomImage,vUv).rgb*strength;
      vec2 d=vUv-.5;c*=1.-vignette*dot(d,d);
      gl_FragColor=vec4(c,1.);
      if(depth<.999999){
        #include <tonemapping_fragment>
      }
      #include <colorspace_fragment>
    }`;

  function create(renderer, scene, camera) {
    const T=THREE,gl=renderer.getContext();
    const supported=!!gl.getExtension('EXT_color_buffer_float')&&typeof gl.texImage3D==='function';
    const gpuExt=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=gpuExt?gl.getParameter(gpuExt.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    const params={ao:true,aoGain:1.35,strength:0,threshold:1.1,vignette:.025};
    let enabled=false,failed=false,W=2,H=2,sceneDraws=0,sceneTriangles=0;
    let sceneRT,aoRT,bloomA,bloomB;
    const camera2=new T.OrthographicCamera(-1,1,1,-1,0,1),quadScene=new T.Scene();
    const geometry=new T.PlaneGeometry(2,2),quad=new T.Mesh(geometry);quad.frustumCulled=false;quadScene.add(quad);
    const material=(fragmentShader,uniforms)=>new T.ShaderMaterial({vertexShader:vertex,fragmentShader,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    const ao=material(aoFragment,{tDepth:{value:null},inverseProjection:{value:new T.Matrix4()},projection:{value:new T.Matrix4()},resolution:{value:new T.Vector2()},gain:{value:1.35}});
    const bright=material(brightFragment,{image:{value:null},threshold:{value:1.1}});
    const blur=material(blurFragment,{image:{value:null},direction:{value:new T.Vector2()}});
    const comp=material(compositeFragment,{image:{value:null},aoImage:{value:null},bloomImage:{value:null},tDepth:{value:null},pixel:{value:new T.Vector2()},aoPixel:{value:new T.Vector2()},useAO:{value:1},strength:{value:0},vignette:{value:.025}});
    comp.toneMapped=true;
    function rt(w,h,depth=false){const target=new T.WebGLRenderTarget(w,h,{type:T.HalfFloatType,depthBuffer:depth,minFilter:T.LinearFilter,magFilter:T.LinearFilter});target.texture.generateMipmaps=false;if(depth)target.depthTexture=new T.DepthTexture(w,h,T.UnsignedIntType);return target;}
    function size(w,h){w=Math.max(2,w|0);h=Math.max(2,h|0);if(sceneRT&&w===W&&h===H)return;W=w;H=h;for(const target of [sceneRT,aoRT,bloomA,bloomB])target?.dispose();
      sceneRT=rt(w,h,true);aoRT=rt(Math.max(2,w>>1),Math.max(2,h>>1));bloomA=rt(Math.max(2,w>>2),Math.max(2,h>>2));bloomB=rt(bloomA.width,bloomA.height);
      comp.uniforms.pixel.value.set(1/w,1/h);comp.uniforms.aoPixel.value.set(1/aoRT.width,1/aoRT.height);ao.uniforms.resolution.value.set(w,h);
    }
    function draw(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.clear();renderer.render(quadScene,camera2);}
    function render(){renderer.setRenderTarget(null);renderer.render(scene,camera);}
    function renderWithBloom(){
      if(gl.isContextLost())return;if(!enabled||failed||!supported||!sceneRT){render();return;}
      try{
        renderer.setRenderTarget(sceneRT);renderer.clear();renderer.render(scene,camera);sceneDraws=renderer.info.render.calls;sceneTriangles=renderer.info.render.triangles;
        if(params.ao){ao.uniforms.tDepth.value=sceneRT.depthTexture;ao.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);ao.uniforms.projection.value.copy(camera.projectionMatrix);ao.uniforms.gain.value=params.aoGain;draw(ao,aoRT);}
        if(params.strength>0){bright.uniforms.image.value=sceneRT.texture;bright.uniforms.threshold.value=params.threshold;draw(bright,bloomA);blur.uniforms.image.value=bloomA.texture;blur.uniforms.direction.value.set(1.4/bloomA.width,0);draw(blur,bloomB);blur.uniforms.image.value=bloomB.texture;blur.uniforms.direction.value.set(0,1.4/bloomA.height);draw(blur,bloomA);}
        Object.assign(comp.uniforms.image,{value:sceneRT.texture});comp.uniforms.aoImage.value=aoRT.texture;comp.uniforms.bloomImage.value=bloomA.texture;comp.uniforms.tDepth.value=sceneRT.depthTexture;comp.uniforms.useAO.value=+params.ao;comp.uniforms.strength.value=params.strength;comp.uniforms.vignette.value=params.vignette;draw(comp,null);
      }catch(error){failed=true;enabled=false;console.warn('[NZPost budget]',error.message);render();}
    }
    return {size,render,renderWithBloom,setEnabled:value=>{enabled=!!value;},setParams:values=>Object.assign(params,values),contextRestored:()=>{failed=false;const w=W,h=H;sceneRT?.dispose();sceneRT=null;size(w,h);},
      get enabled(){return enabled&&!failed&&supported;},get ao(){return this.enabled&&params.ao;},get bloom(){return this.enabled&&params.strength>0;},get sceneDraws(){return sceneDraws;},get sceneTriangles(){return sceneTriangles;},get failed(){return failed;},get float(){return supported;},get gpu(){return gpu;},get reason(){return failed?'post-error':supported?null:'no-float-render-target';},
      budget:()=>({scene:[W,H],ao:aoRT?[aoRT.width,aoRT.height]:null,bloom:bloomA?[bloomA.width,bloomA.height]:null,samples:8,msaa:0}),
      dispose(){for(const value of [sceneRT,aoRT,bloomA,bloomB,ao,bright,blur,comp,geometry])value?.dispose();}};
  }
  return {create};
})();
