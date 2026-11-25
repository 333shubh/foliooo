import * as THREE from 'three';

// Pin .tag labels to 3D points. items: [{ label, live?, leader?, get(outVec3) }]
const v = new THREE.Vector3();
export function pinTags(stage, layer, items) {
  const els = items.map((it) => {
    const el = document.createElement('div');
    el.className = 'tag' + (it.live ? ' tag--live' : '');
    el.innerHTML = `<span class="tag__label">${it.label}</span><span class="tag__leader" style="height:${it.leader ?? 46}px"></span>`;
    layer.appendChild(el);
    return el;
  });
  const prev = stage.onFrame;
  stage.onFrame = (s) => {
    prev?.(s);
    const w = stage.canvas.clientWidth, h = stage.canvas.clientHeight;
    items.forEach((it, i) => {
      it.get(v); v.project(stage.camera);
      els[i].style.opacity = v.z > 1 ? 0 : 1;
      els[i].style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      els[i].style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    });
  };
  return els;
}
