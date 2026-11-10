// The retained ribbon geometry and animation use a native TSL material on WebGPU.
import * as T from 'three/webgpu';
import { Fn, If, Discard, attribute, cameraProjectionMatrix, modelViewMatrix, uniform, varying,
  vec2, vec4, float, mix, max, min, dot, normalize, smoothstep, exp, fract, abs, select } from 'three/tsl';

export function createHaloMaterial(settings) {
  const u = Object.fromEntries(Object.entries(settings.uniforms).map(([name, box]) => [name, uniform(box.value)]));
  const material = new T.MeshBasicNodeMaterial({
    transparent: true, depthTest: true, depthWrite: false, side: T.DoubleSide,
    toneMapped: false, forceSinglePass: true, fog: false
  });
  material.name = 'Directional flow halo · TSL';
  material.uniforms = u;
  const ribbon = varying(attribute('ribbon', 'vec2'), 'vHaloRibbon');
  material.vertexNode = Fn(() => {
    const project = name => cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(attribute(name, 'vec3'), 1)));
    const center = project('position').toVar();
    const a = project('previous'), b = project('following');
    const screen = point => point.xy.div(max(.001, point.w)).mul(u.uViewport);
    const before = screen(center).sub(screen(a)).toVar();
    const after = screen(b).sub(screen(center)).toVar();
    If(before.length().lessThan(.001), () => { before.assign(after); });
    If(after.length().lessThan(.001), () => { after.assign(before); });
    before.divAssign(max(.001, before.length()));
    after.divAssign(max(.001, after.length()));
    const normal = vec2(after.y.negate(), after.x).toVar();
    const join = before.add(after).toVar();
    If(join.length().greaterThan(.001), () => {
      join.assign(normalize(vec2(join.y.negate(), join.x)));
      normal.assign(join.div(max(.68, dot(join, normal))));
    });
    center.xy.addAssign(normal.mul(ribbon.y).mul(u.uWidth).mul(2).mul(center.w).div(u.uViewport));
    return center;
  })();
  material.fragmentNode = Fn(() => {
    const tailAt = phase => phase.mul(float(1).add(u.uSpan.mul(2))).sub(u.uSpan).sub(ribbon.x).mul(u.uDirection).div(u.uSpan);
    const envelope = tail => smoothstep(0, .055, tail).mul(float(1).sub(smoothstep(.22, 1, tail)));
    const tailA = tailAt(u.uPhase), tailB = tailAt(fract(u.uPhase.add(.5)));
    const a = envelope(tailA), b = envelope(tailB).mul(u.uSecond);
    const pulse = max(a, b), tail = select(a.greaterThanEqual(b), tailA, tailB);
    const ends = smoothstep(0, .018, ribbon.x).mul(smoothstep(0, .018, float(1).sub(ribbon.x)));
    const across = abs(ribbon.y).mul(u.uWidth);
    const spindle = mix(.18, 1, smoothstep(0, .16, max(0, tail)));
    const core = float(1).sub(smoothstep(u.uCoreWidth.mul(spindle).sub(.35), u.uCoreWidth.mul(spindle).add(.35), across));
    const outline = float(1).sub(smoothstep(u.uCoreWidth.mul(spindle).add(.35), u.uCoreWidth.mul(spindle).add(1), across));
    const fringe = exp(across.mul(across).mul(-3).div(u.uWidth.mul(u.uWidth)))
      .mul(float(1).sub(smoothstep(u.uWidth.sub(1.5), u.uWidth, across)));
    const alpha = ends.mul(min(1, u.uStrength.mul(pulse).mul(max(outline, fringe.mul(.30)))));
    Discard(alpha.lessThan(.003));
    const body = mix(u.uOutline, u.uColor, core);
    const head = float(1).sub(smoothstep(.08, .25, max(0, tail)));
    return vec4(mix(body, vec4(1).rgb, head.mul(core).mul(.09)), alpha);
  })();
  return material;
}
