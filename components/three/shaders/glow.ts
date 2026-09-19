/** Soft radial glow for the wandering nebula lights. */

export const glowVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    float distance = length(vUv - 0.5) * 2.0;
    float falloff = pow(max(0.0, 1.0 - distance), 3.0);
    gl_FragColor = vec4(uColor, falloff * uOpacity);

    #include <colorspace_fragment>
  }
`;
