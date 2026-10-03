const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
const appPath = path.join(__dirname, 'src', 'App.tsx');

let cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-50 text-slate-800 antialiased overflow-x-hidden;
    background-image: 
      radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
    min-height: 100vh;
  }
}

@layer components {
  .glass-panel {
    @apply bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-sm;
  }

  .btn {
    @apply px-4 py-2 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none;
  }
  
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20;
  }
  
  .btn-secondary {
    @apply bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200;
  }

  .btn-accent {
    @apply bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-md shadow-violet-500/20;
  }
}
`;
fs.writeFileSync(cssPath, cssContent);

let appContent = fs.readFileSync(appPath, 'utf8');

const replacements = [
  // Backgrounds
  [/bg-slate-900\/50/g, 'bg-slate-50'],
  [/bg-slate-900\/80/g, 'bg-slate-100/80'],
  [/bg-slate-900\/40/g, 'bg-slate-50/80'],
  [/bg-slate-900\/30/g, 'bg-slate-100/50'],
  [/bg-slate-900/g, 'bg-slate-100'],
  [/bg-slate-800\/80/g, 'bg-white/80'],
  [/bg-slate-800\/60/g, 'bg-white/60'],
  [/bg-slate-800\/50/g, 'bg-white/50'],
  [/bg-slate-800\/30/g, 'bg-slate-50/50'],
  [/bg-slate-800/g, 'bg-white'],
  [/bg-slate-950/g, 'bg-slate-50'],
  
  // Borders
  [/border-slate-700\/50/g, 'border-slate-200'],
  [/border-slate-700/g, 'border-slate-300'],
  [/border-slate-600\/50/g, 'border-slate-200'],
  [/border-white\/10/g, 'border-slate-200'],
  
  // Text Colors
  [/text-slate-100/g, 'text-slate-800'],
  [/text-slate-300/g, 'text-slate-600'],
  [/text-white/g, 'text-slate-800'],
  
  [/text-slate-400/g, '__TEMP_500__'],
  [/text-slate-500/g, '__TEMP_400__'],
  [/__TEMP_500__/g, 'text-slate-500'],
  [/__TEMP_400__/g, 'text-slate-400'],

  // Accents 
  [/text-cyan-400/g, 'text-cyan-600'],
  [/text-cyan-300/g, 'text-cyan-500'],
  [/text-emerald-400/g, 'text-emerald-600'],
  [/text-emerald-500/g, 'text-emerald-600'],
  [/text-amber-400/g, 'text-amber-600'],
  [/text-rose-400/g, 'text-rose-600'],
  [/text-fuchsia-400/g, 'text-fuchsia-600'],
  [/text-blue-400/g, 'text-blue-600'],
  [/text-violet-400/g, 'text-violet-600'],
  [/text-teal-400/g, 'text-teal-600'],
  [/text-orange-400/g, 'text-orange-600'],
  [/text-red-400/g, 'text-red-600'],
  
  // Hover states
  [/hover:text-white/g, 'hover:text-slate-900'],
  [/hover:border-slate-400/g, 'hover:border-slate-500'],
  [/hover:bg-slate-700/g, 'hover:bg-slate-100'],

  // Misc fixes
  [/from-emerald-900\/40 to-slate-800/g, 'from-emerald-50 to-white'],
  [/from-cyan-400 to-blue-600/g, 'from-blue-500 to-indigo-500'],
  [/bg-blue-500\/20/g, 'bg-blue-100'],
  [/bg-amber-500\/20/g, 'bg-amber-100'],
  [/bg-rose-900\/20/g, 'bg-rose-100'],
  [/bg-emerald-900\/30/g, 'bg-emerald-100'],
  [/bg-cyan-900\/20/g, 'bg-cyan-100'],

  // Buttons specifically broken by text-white to text-slate-800
  [/text-slate-800 hover:text-white hover:border-slate-500/g, 'text-slate-500 hover:text-slate-900 hover:border-slate-500'], // For process button
  [/bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-slate-800/g, 'bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-700'],
  [/bg-indigo-900 hover:bg-indigo-800 px-1.5 py-0.5 rounded text-slate-800/g, 'bg-indigo-100 hover:bg-indigo-200 px-1.5 py-0.5 rounded text-indigo-700'],

  // Tooltip
  [/bg-black text-slate-800/g, 'bg-slate-800 text-white'],
];

for (const [regex, replacement] of replacements) {
  appContent = appContent.replace(regex, replacement);
}

fs.writeFileSync(appPath, appContent);
console.log('Light theme applied.');
