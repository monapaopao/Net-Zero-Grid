'use strict';

window.NZ_FLOW_HALO = (function () {
  const viewport = { value: new THREE.Vector2(1, 1) };
  const minViewport = new THREE.Vector2(1, 1);
  const night = { value: 0 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const vertexShader = `
    attribute vec3 previous;
    attribute vec3 following;
    attribute vec2 ribbon;
    uniform vec2 uViewport;
    uniform float uWidth;
    varying vec2 vRibbon;

    vec2 screenPosition(vec4 point) {
      return point.xy / max(.001, point.w) * uViewport;
    }

    void main() {
      vec4 center = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 a = projectionMatrix * modelViewMatrix * vec4(previous, 1.0);
      vec4 b = projectionMatrix * modelViewMatrix * vec4(following, 1.0);
      vec2 before = screenPosition(center) - screenPosition(a);
      vec2 after = screenPosition(b) - screenPosition(center);
      if (length(before) < .001) before = after;
      if (length(after) < .001) after = before;
      before /= max(.001, length(before));
      after /= max(.001, length(after));
      vec2 normal = vec2(-after.y, after.x);
      vec2 join = before + after;
      if (length(join) > .001) {
        join = normalize(vec2(-join.y, join.x));
        normal = join / max(.68, dot(join, normal));
      }
      center.xy += normal * ribbon.y * uWidth * 2.0 * center.w / uViewport;
      gl_Position = center;
      vRibbon = ribbon;
    }`;
  const fragmentShader = `
    uniform vec3 uColor;
    uniform vec3 uOutline;
    uniform float uWidth;
    uniform float uCoreWidth;
    uniform float uPhase;
    uniform float uDirection;
    uniform float uSpan;
    uniform float uSecond;
    uniform float uStrength;
    uniform float uNight;
    varying vec2 vRibbon;

    float tailAt(float phase) {
      // The head leaves the path completely before wrapping to its start.
      float head = phase * (1.0 + 2.0 * uSpan) - uSpan;
      float tail = (head - vRibbon.x) * uDirection / uSpan;
      return tail;
    }

    float envelope(float tail) {
      return smoothstep(0.0, .055, tail) * (1.0 - smoothstep(.22, 1.0, tail));
    }

    void main() {
      float tailA = tailAt(uPhase);
      float tailB = tailAt(fract(uPhase + .5));
      float a = envelope(tailA);
      float b = envelope(tailB) * uSecond;
      float pulse = max(a, b);
      float tail = a >= b ? tailA : tailB;
      float ends = smoothstep(0.0, .018, vRibbon.x) * smoothstep(0.0, .018, 1.0 - vRibbon.x);
      float across = abs(vRibbon.y) * uWidth;
      float spindle = mix(.18, 1.0, smoothstep(0.0, .16, max(0.0, tail)));
      float core = 1.0 - smoothstep(uCoreWidth * spindle - .35, uCoreWidth * spindle + .35, across);
      float outline = 1.0 - smoothstep(uCoreWidth * spindle + .35, uCoreWidth * spindle + 1.0, across);
      float fringe = exp(-3.0 * across * across / (uWidth * uWidth));
      fringe *= 1.0 - smoothstep(uWidth - 1.5, uWidth, across);
      float alpha = ends * min(1.0, uStrength * pulse * max(outline, fringe * .30));
      if (alpha < .003) discard;
      vec3 color = mix(uOutline, uColor, core);
      float head = 1.0 - smoothstep(.08, .25, max(0.0, tail));
      color = mix(color, vec3(1.0), .09 * head * core);
      gl_FragColor = vec4(color, alpha);
      #include <colorspace_fragment>
    }`;

  function create(points, color, name) {
    const path = [];
    const lengths = [];
    let length = 0;
    for (const point of points) {
      const last = path.at(-1);
      const segment = last ? Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2]) : 0;
      if (last && segment < .0001) continue;
      length += segment;
      lengths.push(length);
      path.push(point);
    }
    const vertices = [], previous = [], following = [], coordinates = [], indices = [];
    for (let i = 0; i < path.length; i++) {
      for (const side of [-1, 1]) {
        vertices.push(...path[i]);
        previous.push(...path[Math.max(0, i - 1)]);
        following.push(...path[Math.min(path.length - 1, i + 1)]);
        coordinates.push(lengths[i] / (length || 1), side);
      }
      if (i > 0) {
        const start = (i - 1) * 2;
        indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('previous', new THREE.Float32BufferAttribute(previous, 3));
    geometry.setAttribute('following', new THREE.Float32BufferAttribute(following, 3));
    geometry.setAttribute('ribbon', new THREE.Float32BufferAttribute(coordinates, 2));
    geometry.setIndex(indices);
    let seed = 0;
    for (const letter of name) seed = (Math.imul(31, seed) + letter.charCodeAt(0)) >>> 0;
    const saturated = new THREE.Color(color);
    const hsl = saturated.getHSL({});
    saturated.setHSL(hsl.h, Math.max(.88, hsl.s), .49);
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms: {
        uViewport: viewport, uNight: night, uColor: { value: saturated },
        uOutline: { value: saturated.clone().multiplyScalar(.25) }, uCoreWidth: { value: 1.4 },
        uPhase: { value: (seed % 997) / 997 }, uDirection: { value: 1 },
        uSpan: { value: .25 }, uSecond: { value: 0 }, uWidth: { value: 5 }, uStrength: { value: 1 }
      },
      transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false, forceSinglePass: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Flow halo · ' + name;
    mesh.userData.flowHalo = true;
    mesh.visible = false;
    mesh.renderOrder = 11;
    mesh.raycast = () => {};
    return mesh;
  }

  function step(mesh, { rate, dt, speed, shown, pixels = 180, emphasis = false }) {
    const uniforms = mesh.material.uniforms;
    mesh.visible = shown && Math.abs(rate) > 1e-6;
    if (!mesh.visible) return;
    const direction = rate < 0 ? -1 : 1;
    const intensity = Math.sqrt(clamp(Math.abs(rate) / 80, 0, 1));
    uniforms.uDirection.value = direction;
    uniforms.uPhase.value = THREE.MathUtils.euclideanModulo(
      uniforms.uPhase.value + (dt || 0) * Math.min(.4, speed * 1.5) * direction * (.92 + .12 * intensity), 1);
    uniforms.uSpan.value = clamp(105 / Math.max(105, pixels), .08, .48);
    const second = emphasis || Math.abs(rate) > 15;
    uniforms.uSecond.value = second ? .95 * clamp((pixels - 320) / 130, 0, 1) : 0;
    uniforms.uWidth.value = emphasis ? 6 : 5;
    uniforms.uCoreWidth.value = emphasis ? 1.9 : 1.4;
    uniforms.uStrength.value = (night.value ? .80 : 1) * (.94 + .06 * intensity);
  }

  function count(mesh) {
    return mesh?.visible ? (mesh.material.uniforms.uSecond.value > 0 ? 2 : 1) : 0;
  }

  function frame(renderer, isNight) {
    renderer.getSize(viewport.value);
    viewport.value.max(minViewport);
    night.value = isNight ? 1 : 0;
  }

  return { create, step, count, frame };
})();
