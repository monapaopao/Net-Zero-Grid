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
    uniform float uPhase;
    uniform float uDirection;
    uniform float uSpan;
    uniform float uSecond;
    uniform float uStrength;
    uniform float uNight;
    varying vec2 vRibbon;

    float pulseAt(float phase) {
      // The head leaves the path completely before wrapping to its start.
      float head = phase * (1.0 + 2.0 * uSpan) - uSpan;
      float tail = (head - vRibbon.x) * uDirection / uSpan;
      return smoothstep(0.0, .13, tail) * (1.0 - smoothstep(.12, 1.0, tail));
    }

    void main() {
      float pulse = max(pulseAt(uPhase), pulseAt(fract(uPhase + .5)) * uSecond);
      float ends = smoothstep(0.0, .018, vRibbon.x) * smoothstep(0.0, .018, 1.0 - vRibbon.x);
      float across = abs(vRibbon.y);
      float core = exp(-9.0 * across * across);
      float fringe = exp(-2.8 * across * across) * (1.0 - smoothstep(.60, 1.0, across));
      float alpha = min(1.0, ends * uStrength * ((.05 + .72 * pulse) * core + (.28 + .10 * uNight) * pulse * fringe));
      if (alpha < .003) discard;
      vec3 color = mix(uColor, vec3(1.0), (.10 + .13 * uNight) * core * pulse);
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
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms: {
        uViewport: viewport, uNight: night, uColor: { value: new THREE.Color(color) },
        uPhase: { value: (seed % 997) / 997 }, uDirection: { value: 1 },
        uSpan: { value: .25 }, uSecond: { value: 0 }, uWidth: { value: 3 }, uStrength: { value: .75 }
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
      uniforms.uPhase.value + (dt || 0) * speed * direction * (.87 + .20 * intensity), 1);
    uniforms.uSpan.value = clamp(84 / Math.max(84, pixels), .065, .47);
    uniforms.uSecond.value = emphasis ? .85 * clamp((pixels - 200) / 130, 0, 1) : 0;
    uniforms.uWidth.value = emphasis ? 5 : 3.2;
    uniforms.uStrength.value = (emphasis ? .90 : .68) + .09 * intensity;
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
