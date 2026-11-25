// Film grain over everything (DOM + WebGL). One generated tile, animated in CSS.
export function mountGrain(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain-url', `url(${c.toDataURL('image/png')})`);
  const el = document.createElement('div');
  el.className = 'grain';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}
