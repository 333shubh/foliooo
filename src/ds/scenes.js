// Flat 2D horizons for each category world: project cards, case-study heroes.
/* ---------------- 2D world horizons for cards (same palette as 3D) ------- */
const INK = '#160923';
export const SCENES = {
  earth: `<path d="M0 205 Q60 170 120 190 T250 180 T400 175 V300 H0Z" fill="#6cbf5f" stroke="${INK}" stroke-width="1.5"/><path d="M0 240 Q90 215 180 235 T400 225 V300 H0Z" fill="#a6e083" stroke="${INK}" stroke-width="1.5"/><g stroke="${INK}" stroke-width="1.5"><rect x="292" y="178" width="7" height="22" fill="#7a3a26"/><circle cx="296" cy="168" r="16" fill="#4fae5a"/><rect x="82" y="196" width="6" height="18" fill="#7a3a26"/><circle cx="85" cy="187" r="12" fill="#4fae5a"/></g>`,
  water: `<path d="M0 150 L70 120 L120 160 L190 110 L260 165 L330 125 L400 150 V300 H0Z" fill="#2a7a6f" stroke="${INK}" stroke-width="1.5"/><rect x="0" y="190" width="400" height="110" fill="#c58cf5" stroke="${INK}" stroke-width="1.5"/><g stroke="#e6b8ff" stroke-width="3" stroke-linecap="round"><path d="M40 220h50M150 245h70M280 215h60M90 270h40"/></g><path d="M300 198 q30 -18 70 0Z" fill="#3a9a85" stroke="${INK}" stroke-width="1.5"/>`,
  desert: `<path d="M0 175 H40 V130 H110 V175 H180 V150 H240 V110 H320 V175 H400 V300 H0Z" fill="#9c4535" stroke="${INK}" stroke-width="1.5"/><path d="M0 200 Q120 185 220 205 T400 195 V300 H0Z" fill="#d4704e" stroke="${INK}" stroke-width="1.5"/><ellipse cx="300" cy="245" rx="26" ry="12" fill="#9c4535" stroke="${INK}" stroke-width="1.5"/>`,
  space: `<circle cx="80" cy="360" r="190" fill="#7a3aa8" stroke="${INK}" stroke-width="1.5"/><path d="M290 70 l14 8 -3 16 -16 4 -10 -12 4 -14z" fill="#2f1547" stroke="${INK}" stroke-width="1.5"/><rect x="330" y="150" width="8" height="34" fill="#e2a4ff" stroke="${INK}" stroke-width="1.5" transform="rotate(30 334 167)"/><path d="M220 210 l18 -6 12 14 -6 18 -18 2 -10 -14z" fill="#a6f78f" stroke="${INK}" stroke-width="1.5"/><g fill="#fff"><circle cx="210" cy="60" r="1.6"/><circle cx="360" cy="40" r="1.4"/><circle cx="150" cy="120" r="1.2"/></g>`,
  dusk: `<path d="M0 230 L0 160 L70 205 L110 240Z M400 230 L400 140 L320 200 L290 240Z" fill="#4a1f6e" stroke="${INK}" stroke-width="1.5"/><rect x="0" y="230" width="400" height="70" fill="#2a7a6f" stroke="${INK}" stroke-width="1.5"/><g fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="3 4"><path d="M90 60 L160 100 L230 50 L300 110"/></g><g fill="#fff"><circle cx="90" cy="60" r="3"/><circle cx="160" cy="100" r="3.5"/><circle cx="230" cy="50" r="3"/><circle cx="300" cy="110" r="3"/></g>`,
};
export function mountScenes(root = document) {
  root.querySelectorAll('[data-scene]').forEach((el) => {
    const fit = el.closest('.case-hero') ? 'none' : 'xMidYMax slice';
    el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 400 300" preserveAspectRatio="${fit}" aria-hidden="true">${SCENES[el.dataset.scene] || ''}</svg>`);
  });
}
