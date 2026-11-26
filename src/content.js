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
  { id: 'about', title: 'About', world: 'aboutWindow', line: 'Who I am, how I work and what I’m learning', href: '/about.html' },
  { id: 'work', title: 'Work', world: 'workWindow', line: 'Security tools, AI products and design systems', href: '/work.html' },
  { id: 'contact', title: 'Contact', world: 'contactWindow', line: 'Ideas, internships and collaborations', href: '/contact.html' },
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
    slug: 'penumbra', name: 'Penumbra', scene: 'dusk', year: 2026, featured: true,
    line: 'Network intrusion detection for a security team: a known-threat classifier plus a novelty head that catches attacks it never trained on, measured honestly.',
    tags: ['Python', 'XGBoost', 'FastAPI', 'Next.js'],
    live: 'https://penumbra-nids.vercel.app', repo: 'https://github.com/dhruvv1402/penumbra-nids',
  },
  {
    slug: 'veil', name: 'Veil', scene: 'dusk', year: 2026, featured: true,
    line: 'Private smart-meter totals: a utility reads a neighbourhood’s exact load while every home’s reading stays masked.',
    tags: ['TypeScript', 'Secure aggregation', 'ML-KEM'],
    live: 'https://333veil.vercel.app/', repo: 'https://github.com/333shubh/veil',
  },
  {
    slug: 'skindetect', name: 'SkinDetect', scene: 'water', year: 2026, featured: true,
    line: 'Seven-class skin lesion classification from dermoscopy images, with calibrated probabilities, Grad-CAM explanations and a web app.',
    tags: ['Python', 'PyTorch', 'Grad-CAM'],
    live: 'https://skindetect-d42c.onrender.com', repo: 'https://github.com/ayushswamy30/SkinDetect',
  },
  {
    slug: 'rsashield', name: 'RSAShield', scene: 'desert', year: 2026, featured: true,
    line: 'Finds badly generated RSA keys in industrial fleets before someone else does. Six detectors, one risk score.',
    tags: ['Rust', 'WebAssembly', 'Security'],
    live: 'https://rsashield.vercel.app', repo: 'https://github.com/333shubh/RSAshield',
  },
  {
    slug: 'lowkei', name: 'Lowkei', scene: 'dusk', year: 2026, featured: true,
    line: 'A private journal and mood tracker: check in, vent, talk to the Mirror and see the weather of your weeks. What you write stays on your phone.',
    tags: ['Expo', 'TypeScript', 'Express', 'Supabase'],
    live: 'https://getlowkei.vercel.app', repo: 'https://github.com/ayushswamy30/MirrorSpace',
  },
  {
    slug: 'undercurrent', name: 'Undercurrent', scene: 'water', year: 2026, featured: true,
    line: 'A headless research radar. Eight sources, deterministic scoring, one Discord digest a day, $0 a month.',
    tags: ['Python', 'Scoring', 'Discord'],
    live: 'https://undercurrent-3yvm.onrender.com/', repo: 'https://github.com/333shubh/undercurrent',
  },
  {
    slug: 'prakriva', name: 'Prakriva', scene: 'earth', year: 2026, featured: true,
    line: 'An Ayurvedic diet and wellness app connecting doctors and patients: diet charts, risk screening and personalised plans, in several languages.',
    tags: ['TypeScript', 'Healthcare', 'Multilingual'],
    live: 'https://prakriva.vercel.app', repo: 'https://github.com/snehaa006/prakriva-updated',
  },
  {
    slug: 'userpersonas', name: 'User Personas', scene: 'space', year: 2026, featured: true,
    line: 'Seven stylised consumer personas, each with its own mascot and visual world, built as a tokenised design system.',
    tags: ['Design system', 'Tokens', 'Accessibility QA'],
    live: 'https://userpersonas-five.vercel.app', repo: 'https://github.com/333shubh/userpersonas',
  },
  {
    slug: 'bakesbymom', name: 'Bakes by Mom', scene: 'water', year: 2026, featured: true,
    line: 'A design system and website for an eggless home bakery, built from one Pinterest board: tokens, 29 components and Storybook.',
    tags: ['Design tokens', 'React', 'Storybook'],
    live: 'https://bakesbymom-msbw.vercel.app/', repo: 'https://github.com/Tamanna-57/Bakesbymom_',
  },
  {
    slug: 'solae', name: 'Solae', scene: 'desert', year: 2026,
    line: 'A portfolio and store for a modest swimwear brand for teen girls, designed in Saudi Arabia.',
    tags: ['React', 'TypeScript', 'Vite'],
    live: 'https://solae-mu.vercel.app', repo: 'https://github.com/snehaa006/Solae',
  },
];

// The story on each project's subpage. Facts come from each repo's README and live site.
export const cases = {
  bridgr: {
    intro: 'Bridgr compares what a student has studied with what industry actually hires for, then helps close the gap and land the internship. Institutions get a view of where their curriculum lags.',
    does: ['Turns a resume into evidence-backed skills, each rated 1–5', 'Reads a job description and returns a match score, a radar chart and a gap list', 'Plans the gap week by week, scores resumes for ATS and runs mock interviews you can speak to', 'An internship portal with AI fit-ranking, one-click apply and a kanban tracker', 'Curriculum audits for institutions: alignment score, outdated topics, suggested units'],
    built: 'A vanilla JavaScript single-page app with Chart.js, a Vercel function calling Gemini in JSON mode, and an offline engine that returns the same shapes when no model is reachable. No login: data stays in the browser.',
  },
  penumbra: {
    intro: 'Machine-learning network detection for a security operations team. It catches the attacks signatures miss, and measures honestly how much it actually catches. Built for the Bennett University Hackathon 2026, Microsoft track.',
    does: ['A supervised classifier for known threats plus a benign-only novelty head for attacks it was never trained on', 'On 17 unseen attack types, recall at a 1% false-positive rate rises from 5% to 35% with the novelty head', 'Groups 94,115 alerts into 203 incidents, so analysts see stories instead of noise', 'Re-learns a network’s normal without labels, and measures drift instead of hiding it', 'Alerts the SOC; it never blocks on its own'],
    built: 'Python with scikit-learn and XGBoost, a FastAPI service and a Next.js console, evaluated on CICIDS2017, UNSW-NB15 and NSL-KDD with prevalence-corrected metrics and bootstrap confidence intervals.',
  },
  veil: {
    intro: 'A distribution utility reads the exact total load of a group of homes every few seconds, while each home’s own reading stays masked. Veil is a double-masked secure sum built for smart meters in India.',
    does: ['Exact neighbourhood totals with every individual reading hidden from the coordinator', 'Post-quantum key agreement: X25519 together with ML-KEM-768', 'Secret sharing recovers the round when meters drop out', 'An optional verified mode with commitments and range proofs, and an audit ledger', 'A scroll story told as a pop-up paper city, ending in a live feeder of 240 meters running the real protocol'],
    built: 'TypeScript on Node and in the browser (in web workers), nine experiments behind every number in the report, attack tests with a malicious coordinator and lying meters, and a 10,000-round exactness gate.',
  },
  skindetect: {
    intro: 'Seven-class skin lesion classification from dermoscopy images, with calibrated probabilities, Grad-CAM explanations and a web app. Research and education only: not a medical device.',
    does: ['Predicts one of the seven HAM10000 diagnoses from a dermoscopy image', 'Calibrated probabilities instead of raw scores', 'Grad-CAM heatmaps show what the model looked at', 'An ensemble predictor behind a model API, with a web app on top', 'Cross-validation, an evaluation report and unit and API tests'],
    built: 'Python and PyTorch with class-imbalance handling and augmentations, a model API and website on Render, and a Hugging Face deployment.',
  },
  rsashield: {
    intro: 'Embedded devices often generate RSA keys before they have enough randomness, and substations keep those keys for decades. RSAShield audits a fleet’s public keys offline and lists the ones that need replacing.',
    does: ['Six detectors: batch GCD, Fermat, trial division, bounded ECM, Wiener and metadata checks', 'One 0–100 risk score per key, with the failure mode and how to fix it', 'Findings mapped to IEC 62351, NERC CIP and NIST SP 800-57', 'Perfect precision and recall on a seeded, labelled benchmark', 'The audit engine runs right in the browser for the hosted demo'],
    built: 'Rust compiled to WebAssembly, product/remainder trees for batch GCD, a dashboard, and a reproducible benchmark.',
  },
  lowkei: {
    intro: 'A private journal and mood tracker. Check in, vent, talk to the Mirror and see the weather of your weeks. What you write stays on your phone.',
    does: ['Check in in ten seconds', 'Talk things through with the Mirror', 'A daily 11:11 note and a Today written for each person', 'An Android app, and a browser build that is the iPhone version', 'Notifications, sharing and an offline copy when the connection hangs'],
    built: 'Expo and TypeScript for the app, an Express 5 API on Render, Supabase for Postgres, and a static site on Vercel.',
  },
  undercurrent: {
    intro: 'A headless daily research radar. It collects from eight public sources, dedupes and scores them deterministically, tracks themes over time and posts one Discord digest a day, for $0 a month.',
    does: ['Collect, normalise, dedupe, enrich, remember, score, synthesise, deliver', 'Deterministic code decides what matters; the language model only writes the sentence', 'Near-duplicates are clustered across sources and across 30 days', 'One loud source is capped, and momentum is measured against each theme’s own baseline', 'Discord-only delivery: a hundred readers cost exactly what one does'],
    built: 'Python on free tiers end to end: a scheduler, a scoring engine and one public page.',
  },
  prakriva: {
    intro: 'An Ayurvedic diet and wellness app that connects doctors and patients, in several languages.',
    does: ['Doctors manage patients, build recipes and diet charts, and review dosha and consultation data', 'Maternal disease-risk screening for pregnant patients', 'A personalised diet plan from a health questionnaire and the food in your kitchen', 'Care tracks for pregnancy and PCOD/PCOS decide what each patient sees', 'Exercise suggestions, price comparison and peer-support circles'],
    built: 'A TypeScript web app on Vercel, multilingual throughout.',
  },
  userpersonas: {
    intro: 'Seven stylised consumer personas for an instant-noodle brand, each with its own mascot and visual world, built as a tokenised design system. Concept work.',
    does: ['Seven personas, seven mascots, seven visual worlds', 'One token file is the source of truth for every persona', 'Contrast, colour-blind, naming and rig checks run as automated QA', 'Built gate by gate against a written brief'],
    built: 'A tokens.json source, Python tooling (standard library only) and a static site.',
  },
  bakesbymom: {
    intro: 'A design system and website for an eggless home bakery in Panipat, built from one Pinterest board.',
    does: ['All 16 board pins analysed: layout, sections, components, colour and type', 'A token library exported to CSS, SCSS, JS, Tailwind and Figma', '29 React components, from sticker icons to menu cards', 'The website: cakes by occasion, ten flavours and ordering on WhatsApp', 'Storybook documents every section next to the pins it came from'],
    built: 'W3C design tokens, React and Storybook, deployed to Vercel on every merge.',
  },
  solae: {
    intro: 'A portfolio and store for SOLAE: modest, modern swim sets for teen girls, designed in Saudi Arabia.',
    does: ['Colours, logos, story, vision and mission taken from the brand’s own guidelines', 'A design system for the brand', 'A storefront with shop, signatures and story pages'],
    built: 'React 19, TypeScript, Vite and React Router.',
  },
};

// About: everything on the About page. Placeholders in [brackets] are for Shubh to fill.
export const about = {
  hello: 'Hi, I’m Shubh.',
  lede: 'Developer and designer turning interesting ideas into things you can actually use: security tools, AI products, health apps and design systems.',
  facts: [
    { k: 'Based in', v: '[ your city ]' },
    { k: 'Right now', v: '[ what you’re doing ]' },
    { k: 'On GitHub', v: '@333shubh', href: 'https://github.com/333shubh' },
  ],
  does: [
    { t: 'Security', d: 'Tools that find what others miss: weak RSA keys in industrial fleets, network attacks no signature knows.' },
    { t: 'Data', d: 'Exact answers without exposing anyone: private smart-meter totals, deterministic research scoring.' },
    { t: 'AI', d: 'Models that explain themselves and products built around them, from skin-lesion analysis to career mapping.' },
    { t: 'Design', d: 'Design systems first: tokens, components and brands that hold together across every screen.' },
  ],
  principles: [
    { t: 'Measure it honestly', d: 'Prevalence-corrected metrics, matched alert budgets, an exactness gate. If a number is in the README, a command regenerates it.' },
    { t: 'Make it work without me', d: 'No logins where none are needed, offline fallbacks when a model is down, and data that stays on your device.' },
    { t: 'Keep it cheap to run', d: 'Free tiers end to end where possible. Undercurrent costs $0 a month, however many people read it.' },
    { t: 'Systems before screens', d: 'Start with the tokens and the rules, so the hundredth screen looks as considered as the first.' },
  ],
  numbers: [
    { n: '914', t: 'contributions this year' },
    { n: '22', t: 'day longest streak' },
    { n: '11', t: 'projects shipped' },
    { n: '6', t: 'built with teams' },
  ],
  // ---- MOCK: placeholder entries the user allowed for now; replace with the real ones ----
  facts2: [ // MOCK
    { k: 'Based in', v: 'Mumbai, India' },
    { k: 'Studying', v: 'B.Tech, Computer Science' },
    { k: 'Right now', v: 'Building security + AI tools' },
  ],
  experience: [ // MOCK
    { when: '2026 — now', role: 'Security engineering intern', org: 'Northwind Labs', d: 'Building internal tooling that audits key material across device fleets.' },
    { when: '2025', role: 'Frontend developer (freelance)', org: 'Independent', d: 'Design systems and marketing sites for small brands, tokens to Storybook.' },
    { when: '2025', role: 'ML research assistant', org: 'University AI Lab', d: 'Calibrated classifiers and explainability for medical imaging.' },
    { when: '2024', role: 'Hackathon lead', org: 'Smart India Hackathon', d: 'Led a team of six from idea to working demo in 36 hours.' },
  ],
  education: [ // MOCK
    { when: '2023 — 2027', t: 'B.Tech, Computer Science', where: 'University of Mumbai', d: 'Security, machine learning and human-computer interaction.' },
    { when: '2021 — 2023', t: 'Higher Secondary (Science)', where: 'Mumbai', d: 'Physics, chemistry, maths and a lot of side projects.' },
    { when: 'Always', t: 'Self-taught', where: 'The internet', d: 'Rust, three.js, cryptography and design systems, one project at a time.' },
  ],
  achievements: [ // MOCK (the numbers above are real, these awards are not)
    { t: 'Winner', d: 'Smart India Hackathon, software edition', when: '2024' },
    { t: 'Top 10', d: 'National cybersecurity CTF, college track', when: '2025' },
    { t: 'Featured', d: 'Undercurrent on a developer newsletter', when: '2026' },
  ],
  exploring: [ // from the stack his projects actually use (Veil, RSAShield, SkinDetect, Lowkei)
    { t: 'Post-quantum crypto', d: 'ML-KEM and secure aggregation, from building Veil.' },
    { t: 'Rust + WebAssembly', d: 'Fast audits in the browser, from RSAShield.' },
    { t: 'Honest ML', d: 'Calibration and Grad-CAM, from SkinDetect.' },
    { t: 'On-device apps', d: 'Private by default with Expo, from Lowkei.' },
  ],
  interests: [ // MOCK
    { t: 'Lo-fi and synthwave', d: 'Always on while I build.' },
    { t: 'Photography', d: 'Night streets and neon.' },
    { t: 'Chess', d: 'Blitz, badly.' },
    { t: 'Sci-fi', d: 'Books and films with big ideas.' },
    { t: 'Cooking', d: 'Experiments, mostly edible.' },
    { t: 'Cycling', d: 'Early mornings by the sea.' },
  ],
  toolkit: [
    { g: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'Rust'] },
    { g: 'Front end', items: ['React', 'Next.js', 'Vite', 'three.js', 'Tailwind'] },
    { g: 'Back end and data', items: ['FastAPI', 'Flask', 'Express', 'Supabase', 'Pandas', 'NumPy'] },
    { g: 'Machine learning', items: ['PyTorch', 'scikit-learn', 'XGBoost'] },
    { g: 'Testing', items: ['Vitest', 'Pytest'] },
  ],
};

// Contact: how to reach Shubh. Email and LinkedIn are the ones on his GitHub profile.
export const contact = {
  email: 'shubhjaadiya@gmail.com',
  links: [
    { label: 'GitHub', handle: '@333shubh', href: 'https://github.com/333shubh' },
    { label: 'LinkedIn', handle: 'in/shubhjadiya', href: 'https://www.linkedin.com/in/shubhjadiya' },
  ],
};
