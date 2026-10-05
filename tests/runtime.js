// GPU-less CI exercises the same WebGL shaders with a smaller rendering workload.
// Leave this unset on a GPU machine to retain the full-size FPS checks.
export const softwareRendering = process.env.PLAYWRIGHT_SOFTWARE_RENDERING === '1';

export const gpuArgs = softwareRendering
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : [];

export function appUrl(query = '') {
  const params = new URLSearchParams(query);
  if (softwareRendering) {
    params.set('n', String(Math.min(Number(params.get('n')) || 200000, 10000)));
    params.set('dpr', '0.5');
  }
  return `/?${params}`;
}
