/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 精致档后期 post.js
 * GobiLight-NetZero  v1.0.0
 *
 * 载入顺序：… → legacy-scene → 【post】→ premium（premium 末尾同步启动，
 *           因此本层必须先行载入）
 *
 * 作用：精致档的深度环境光遮蔽、抗锯齿和夜间轻量泛光。
 * 设计原则（与验收口径一致）：
 *   · 不引入任何外部依赖（不使用 three 示例目录里的 EffectComposer，离线可用）；
 *   · 任何一步失败（着色器编译、浮点纹理不支持、上下文丢失）都必须
 *     自动退回直出渲染，绝不让画面变黑或卡死；
 *   · 不改动场景内容，只做全屏后处理，因此不影响任何核算数值。
 * ===================================================================== */
'use strict';
(function () {
  const VERT = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  /* 亮部提取：软阈值，避免硬边界导致的闪烁 */
  const FRAG_BRIGHT = `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    uniform float uKnee;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = max(c.r, max(c.g, c.b));
      float soft = clamp((l - uThreshold) / max(uKnee, 1e-4), 0.0, 1.0);
      soft = soft * soft;
      float w = max(soft, step(uThreshold, l) * 0.0);
      gl_FragColor = vec4(c * w, 1.0);
    }
  `;

  /* 可分离高斯：9 抽样，方向由 uDir 决定 */
  const FRAG_BLUR = `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    void main(){
      vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      s += (texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb
          + texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
      s += (texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb
          + texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(s, 1.0);
    }
  `;

  /* 合成：底图 + 泛光；同时给出轻微暗角与冷暖分离，贴合展厅观感 */
  const FRAG_COMPOSITE = `
    varying vec2 vUv;
    uniform sampler2D tBase;
    uniform sampler2D tBloom;
    uniform float uStrength;
    uniform float uVignette;
    uniform sampler2D tDepth;
    uniform mat4 uInverseProjection;
    uniform mat4 uProjection;
    uniform vec2 uResolution;
    uniform float uAO;
    vec3 viewPosition(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      vec4 p = uInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      return p.xyz / p.w;
    }
    float ambientOcclusion() {
      if (uAO < .5 || texture2D(tDepth, vUv).r > .99999) return 1.0;
      vec2 pixel = 1.0 / uResolution;
      vec3 p = viewPosition(vUv);
      vec3 r = viewPosition(vUv + vec2(pixel.x, 0.0)) - p;
      vec3 l = p - viewPosition(vUv - vec2(pixel.x, 0.0));
      vec3 t = viewPosition(vUv + vec2(0.0, pixel.y)) - p;
      vec3 b = p - viewPosition(vUv - vec2(0.0, pixel.y));
      vec3 normal = normalize(cross(abs(r.z) < abs(l.z) ? r : l, abs(t.z) < abs(b.z) ? t : b));
      if (dot(normal, p) > 0.0) normal = -normal;
      float radius = 2.0;
      vec2 uvRadius = vec2(uProjection[0][0], uProjection[1][1]) * radius / max(-p.z, .01) * .5;
      float occlusion = 0.0;
      for (int i = 0; i < 16; i++) {
        float angle = float(i) * 2.39996323;
        float fraction = sqrt((float(i) + .5) / 16.0);
        vec2 uv = vUv + vec2(cos(angle), sin(angle)) * uvRadius * fraction;
        if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) continue;
        vec3 delta = viewPosition(uv) - p;
        float distance = length(delta);
        float horizon = max(0.0, dot(normal, delta) / max(distance, .001) - .08);
        occlusion += horizon * (1.0 - smoothstep(.15, radius, distance));
      }
      return clamp(1.0 - occlusion / 16.0 * 1.8, .58, 1.0);
    }
    void main(){
      vec3 base = texture2D(tBase, vUv).rgb;
      vec3 bloom = texture2D(tBloom, vUv).rgb;
      vec3 c = base * ambientOcclusion() + bloom * uStrength;
      vec2 d = vUv - vec2(0.5);
      float vig = 1.0 - uVignette * dot(d, d) * 1.15;
      c *= clamp(vig, 0.0, 1.0);
      gl_FragColor = vec4(c, 1.0);
      // Solid scene backgrounds bypass tone mapping in the direct renderer too.
      if (texture2D(tDepth, vUv).r < .999999) {
        #include <tonemapping_fragment>
      }
      #include <encodings_fragment>
    }
  `;

  function makeRT(w, h, useFloat) {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: useFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });
    rt.texture.generateMipmaps = false;
    return rt;
  }

  function create(renderer, scene, camera) {
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const matBright = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_BRIGHT,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.72 }, uKnee: { value: 0.25 } },
      depthTest: false, depthWrite: false
    });
    const matBlur = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_BLUR,
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false
    });
    const matComp = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_COMPOSITE,
      uniforms: {
        tBase: { value: null }, tBloom: { value: null },
        uStrength: { value: .16 }, uVignette: { value: .025 },
        tDepth: { value: null }, uInverseProjection: { value: new THREE.Matrix4() },
        uProjection: { value: new THREE.Matrix4() }, uResolution: { value: new THREE.Vector2(2, 2) }, uAO: { value: 1 }
      },
      depthTest: false, depthWrite: false
    });

    const quad = new THREE.Mesh(quadGeo, matBright);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);

    /* 浮点纹理支持探测。本渲染管线的中间缓冲是线性空间：8bit 线性缓冲会在
     * 暗部与渐变处产生肉眼可见的色带，因此不支持浮点时直接判定泛光不可用，
     * 由界面/报告如实标注，而不是给一个有瑕疵的“精致档”。 */
    const gl = renderer.getContext();
    let gpuName = '';
    try {
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) gpuName = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
      if (!gpuName && gl) gpuName = gl.getParameter(gl.RENDERER) || '';
    } catch (e) { gpuName = ''; }
    const canFloat = !!(gl && (gl.getExtension('EXT_color_buffer_half_float') ||
      gl.getExtension('EXT_color_buffer_float')));

    let rtScene = null, rtA = null, rtB = null;
    let W = 2, H = 2, enabled = false, failed = false;
    const canDepth = renderer.capabilities.isWebGL2 || !!gl.getExtension('WEBGL_depth_texture');
    let unsupported = !canFloat || !canDepth;
    /* 场景通道的绘制统计：合成阶段会再画若干全屏四边形，
     * 若不单独记录，renderer.info 读到的只是最后一遍合成（draws=1），
     * 会被误当成"精致档几乎没画东西"。 */
    let sceneDraws = 0, sceneTriangles = 0;
    let params = { threshold: 1.1, knee: .4, strength: .16, radius: 1.0, vignette: .025, ao: true };

    function size(w, h) {
      W = Math.max(2, w | 0); H = Math.max(2, h | 0);
      if (rtScene) { rtScene.dispose(); rtA.dispose(); rtB.dispose(); }
      rtScene = makeRT(W, H, canFloat);
      if (renderer.capabilities.isWebGL2) rtScene.samples = Math.min(4, renderer.capabilities.maxSamples);
      if (canDepth) rtScene.depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
      matComp.uniforms.uResolution.value.set(W, H);
      const bw = Math.max(2, W >> 1), bh = Math.max(2, H >> 1);
      rtA = makeRT(bw, bh, canFloat);
      rtB = makeRT(bw, bh, canFloat);
    }

    function setEnabled(v) { enabled = !!v && !failed && !unsupported; }
    function setParams(p) {
      if (!p) return;
      for (const k in p) if (k in params) params[k] = p[k];
      matBright.uniforms.uThreshold.value = params.threshold;
      matBright.uniforms.uKnee.value = params.knee;
      matComp.uniforms.uStrength.value = params.strength;
      matComp.uniforms.uVignette.value = params.vignette;
      matComp.uniforms.uAO.value = params.ao ? 1 : 0;
    }

    function drawQuad(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target || null);
      renderer.clear();
      renderer.render(quadScene, quadCam);
    }

    function render() {
      if (gl.isContextLost()) return;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }

    // Intermediate passes remain linear. Only the final pass applies display encoding.
    matBright.toneMapped = false; matBlur.toneMapped = false;
    function renderWithBloom() {
      if (gl.isContextLost()) return;
      if (!enabled || failed || unsupported || !rtScene) { render(); return; }
      try {
        renderer.setRenderTarget(rtScene);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete post render target');
        renderer.clear();
        renderer.render(scene, camera);
        sceneDraws = renderer.info.render.calls;
        sceneTriangles = renderer.info.render.triangles;
        renderer.setRenderTarget(null);

        const bw = rtA.width, bh = rtA.height;

        if (params.strength > 0) {
        matBright.uniforms.tDiffuse.value = rtScene.texture;
        drawQuad(matBright, rtA);

        /* 横向 + 纵向，第二轮以半径放大弱扩散 */
        matBlur.uniforms.tDiffuse.value = rtA.texture;
        matBlur.uniforms.uDir.value.set(params.radius / bw, 0);
        drawQuad(matBlur, rtB);

        matBlur.uniforms.tDiffuse.value = rtB.texture;
        matBlur.uniforms.uDir.value.set(0, params.radius / bh);
        drawQuad(matBlur, rtA);

        matBlur.uniforms.tDiffuse.value = rtA.texture;
        matBlur.uniforms.uDir.value.set(params.radius * 1.8 / bw, 0);
        drawQuad(matBlur, rtB);

        matBlur.uniforms.tDiffuse.value = rtB.texture;
        matBlur.uniforms.uDir.value.set(0, params.radius * 1.8 / bh);
        drawQuad(matBlur, rtA);

        } else {
          renderer.setRenderTarget(rtA); renderer.clear();
        }
        matComp.uniforms.tDepth.value = rtScene.depthTexture;
        matComp.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        matComp.uniforms.uProjection.value.copy(camera.projectionMatrix);
        matComp.uniforms.tBase.value = rtScene.texture;
        matComp.uniforms.tBloom.value = rtA.texture;
        drawQuad(matComp, null);
      } catch (e) {
        if (gl.isContextLost()) return;
        /* 任一步失败：永久退回直出，并在控制台留下可追溯记录 */
        failed = true; enabled = false;
        if (window.console) console.warn('[NZPost] 泛光后处理失败，已退回直出渲染：', e && e.message);
        render();
      }
    }

    return {
      size, setEnabled, setParams, render, renderWithBloom,
      contextRestored() {
        // The lost context already released GPU resources. Disposing old targets
        // through their old listeners after restoration would delete invalid handles.
        rtScene = rtA = rtB = null;
        matComp.uniforms.tDepth.value = null;
        matComp.uniforms.tBase.value = null;
        matComp.uniforms.tBloom.value = null;
        matBright.uniforms.tDiffuse.value = null;
        matBlur.uniforms.tDiffuse.value = null;
        failed = false;
      },
      get enabled() { return enabled && !failed && !unsupported; },
      get ao() { return enabled && params.ao && !failed && !unsupported; },
      get bloom() { return enabled && params.strength > 0 && !failed && !unsupported; },
      get sceneDraws() { return sceneDraws; },
      get sceneTriangles() { return sceneTriangles; },
      get failed() { return failed; },
      get float() { return canFloat; },
      get gpu() { return gpuName; },
      get reason() {
        if (failed) return 'shader-error（着色器或渲染目标异常，已退回直出）';
        if (unsupported) return 'no-float-or-depth-render-target（环境光遮蔽与泛光不可用，保留精致模型并直出）';
        return null;
      },
      dispose() {
        if (rtScene) { rtScene.dispose(); rtA.dispose(); rtB.dispose(); }
        matBright.dispose(); matBlur.dispose(); matComp.dispose(); quadGeo.dispose();
      }
    };
  }

  window.NZPost = { create };
})();

