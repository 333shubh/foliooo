// All the words on the site live here. Source: github.com/333shubh (profile, repos, READMEs).

export const site = {
  name: 'Shubh Jadiya',
  role: 'Developer & Designer',
  bio: 'Developer and designer turning interesting ideas into things you can actually use.',
  github: 'https://github.com/333shubh',
  githubHandle: '333shubh',
  // from the profile README summary
  stats: { contributions: 914, streak: 22, repos: 9 },
  stack: ['Python', 'TypeScript', 'JavaScript', 'Rust', 'React', 'Next.js', 'Vite', 'three.js', 'Tailwind', 'FastAPI', 'Flask', 'Supabase', 'Pandas', 'NumPy', 'Vitest', 'Pytest'],
};

// Facts pinned to the rocks you fly past on the way to the cockpit.
export const facts = [
  { eyebrow: 'What I do', title: 'Security, data, AI and design.', body: 'RSA key audits, privacy-preserving smart meters, AI career tools and design systems.' },
  { eyebrow: 'This year', title: '914 contributions.', body: 'A 22-day longest streak and nine public projects.' },
  { eyebrow: 'Toolkit', title: 'Python · TypeScript · Rust', body: 'React, three.js, FastAPI, Next.js, Supabase and whatever the idea needs.' },
  { eyebrow: 'Almost there', title: 'Climb aboard.', body: 'The pod turns around for you. Look through the window.' },
];

// The cockpit windows are the site's doors. Each opens onto its page's world.
export const pages = [
  { id: 'about', title: 'About', world: 'earth', line: 'Who I am, how I work and what I’m learning', href: '/about.html' },
  { id: 'work', title: 'Work', world: 'space', line: 'Security tools, AI products and design systems', href: '/work.html' },
  { id: 'contact', title: 'Contact', world: 'water', line: 'Ideas, internships and collaborations', href: '/contact.html' },
];

// Projects are one list, with no categories. `scene` only picks the painted horizon on the card.
export const projects = [
  {
    slug: 'bridgr', name: 'Bridgr', scene: 'earth', year: 2026, featured: true,
    line: 'An AI career platform that maps a student’s skills against real job descriptions, plans the gap and lands the internship.',
    tags: ['JavaScript', 'LLM prompts', 'Web Speech API'],
    live: 'https://bridgr-rose.vercel.app', repo: 'https://github.com/333shubh/bridgr',
  },
  {
    slug: 'veil', name: 'Veil', scene: 'dusk', year: 2026, featured: true,
    line: 'Private smart-meter totals: a utility reads a neighbourhood’s exact load while every home’s reading stays masked.',
    tags: ['TypeScript', 'Secure aggregation', 'ML-KEM'],
    live: 'https://333veil.vercel.app/', repo: 'https://github.com/333shubh/veil',
  },
  {
    slug: 'rsashield', name: 'RSAShield', scene: 'desert', year: 2026, featured: true,
    line: 'Finds badly generated RSA keys in industrial fleets before someone else does. Six detectors, one risk score.',
    tags: ['Rust', 'WebAssembly', 'Security'],
    live: 'https://rsashield.vercel.app', repo: 'https://github.com/333shubh/RSAshield',
  },
  {
    slug: 'undercurrent', name: 'Undercurrent', scene: 'water', year: 2026, featured: true,
    line: 'A headless research radar. Eight sources, deterministic scoring, one Discord digest a day, $0 a month.',
    tags: ['Python', 'Scoring', 'Discord'],
    live: 'https://undercurrent-3yvm.onrender.com/', repo: 'https://github.com/333shubh/undercurrent',
  },
  {
    slug: 'userpersonas', name: 'User Personas', scene: 'space', year: 2026, featured: true,
    line: 'Seven stylised consumer personas, each with its own mascot and visual world, built as a tokenised design system.',
    tags: ['Design system', 'Tokens', 'Accessibility QA'],
    live: 'https://userpersonas-five.vercel.app', repo: 'https://github.com/333shubh/userpersonas',
  },
  {
    slug: 'vinyasgen', name: 'VinyasGen', scene: 'earth', year: 2026, featured: true,
    line: 'A planning tool for urban regeneration: draw a site boundary, load the zoning rules and check compliance.',
    tags: ['Python', 'FastAPI', 'Maps'],
    repo: 'https://github.com/333shubh/VinyasGen',
  },
  {
    slug: 'folio', name: 'Folio v1', scene: 'water', year: 2026,
    line: 'An earlier portfolio: a rigged 3D character over a parallax media collage.',
    tags: ['Next.js', 'three.js'],
    repo: 'https://github.com/333shubh/folio',
  },
];
