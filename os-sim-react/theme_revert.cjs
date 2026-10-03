const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
const appPath = path.join(__dirname, 'src', 'App.tsx');

let cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-900 text-slate-100 antialiased overflow-x-hidden;
    background-image: 
      radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 50%);
    min-height: 100vh;
  }
}

@layer components {
  .glass-panel {
    @apply bg-slate-800/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl;
  }

  .btn {
    @apply px-4 py-2 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none;
  }
  
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30;
  }
  
  .btn-secondary {
    @apply bg-slate-700 hover:bg-slate-600 text-white;
  }

  .btn-accent {
    @apply bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/30;
  }
}
`;
fs.writeFileSync(cssPath, cssContent);

let appContent = fs.readFileSync(appPath, 'utf8');

const replacements = [
  // Specific tweaks
  [/from-\[\#4EE2B6\] to-\[\#30A4F8\]/g, 'from-cyan-400 to-blue-600'],
  [/bg-slate-200 hover:bg-slate-300 px-1\.5 py-0\.5 rounded text-slate-700/g, 'bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-white'],
  [/bg-blue-100 hover:bg-blue-200 px-1\.5 py-0\.5 rounded text-blue-700/g, 'bg-indigo-900 hover:bg-indigo-800 px-1.5 py-0.5 rounded text-white'],

  // Backgrounds
  [/bg-white\/60/g, 'bg-slate-900/50'],
  [/bg-white\/80/g, 'bg-slate-900/80'],
  [/bg-white\/40/g, 'bg-slate-900/40'],
  [/bg-white\/30/g, 'bg-slate-900/30'],
  [/bg-\[\#E5F6FD\]\/50/g, 'bg-slate-800/30'],
  [/bg-white\/90/g, 'bg-slate-800'],
  [/bg-white\/50/g, 'bg-slate-950'],
  [/bg-white/g, 'bg-slate-900'],
  
  // Borders
  [/border-white\/80/g, 'border-slate-700'],
  [/border-blue-200\/50/g, 'border-white/20'],
  [/border-blue-100\/50/g, 'border-white/10'],
  [/border-blue-200/g, 'border-slate-600/50'],
  [/border-white\/50/g, 'border-slate-800/50'],
  [/border-white/g, 'border-slate-700/50'],
  
  // Text Colors
  [/text-slate-800/g, 'text-white'],
  [/text-slate-700/g, 'text-slate-300'],
  
  [/text-slate-500/g, '__TEMP_400__'],
  [/text-slate-400/g, '__TEMP_500__'],
  [/__TEMP_400__/g, 'text-slate-400'],
  [/__TEMP_500__/g, 'text-slate-500'],

  [/text-blue-500/g, 'text-cyan-400'],
  [/text-blue-600/g, 'text-cyan-300'],
  [/text-teal-500/g, 'text-emerald-400'],
  [/text-teal-600/g, 'text-emerald-500'],
  [/text-amber-500/g, 'text-amber-400'],
  [/text-rose-500/g, 'text-rose-400'],
  [/text-fuchsia-500/g, 'text-fuchsia-400'],
  [/text-indigo-500/g, 'text-violet-400'],
  [/text-orange-500/g, 'text-orange-400'],
  [/text-red-500/g, 'text-red-400'],

  // Shadows
  [/shadow-blue-400\/40/g, 'shadow-cyan-500/30'],
  [/shadow-teal-400\/40/g, 'shadow-emerald-500/30'],
  [/shadow-\[inset_0_2px_4px_rgba\(0,0,0,0\.02\)\]/g, 'shadow-inner'],

  // Gradients
  [/from-teal-100\/40/g, 'from-emerald-900/40'],
  [/to-white\/80/g, 'to-slate-800'],
  
  // Revert specific color backgrounds that were 100
  [/bg-blue-100/g, 'bg-blue-500/20'],
  [/bg-amber-100/g, 'bg-amber-500/20'],
  [/bg-rose-100/g, 'bg-rose-900/20'],
  [/bg-teal-100/g, 'bg-emerald-900/30'],
  [/bg-cyan-100/g, 'bg-cyan-900/20'],

  // Hardcode fixes from manual edits
  [/<div className="w-px h-8 bg-slate-900"><\/div>/g, '<div className="w-px h-8 bg-slate-700"></div>'],
  [/Nexus OS <span className="text-cyan-400 font-normal">/g, 'Nexus OS <span className="text-slate-400 font-normal">'],
];

for (const [regex, replacement] of replacements) {
  appContent = appContent.replace(regex, replacement);
}

// Tooltip fix
appContent = appContent.replace(/bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-xl border border-slate-100/g, 'bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20');
// Also if the border-slate-100 was already replaced to border-something-else:
appContent = appContent.replace(/bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-xl border border-slate-700\/50/g, 'bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20');
// Just a brute force replace for tooltip
appContent = appContent.replace(/<div className="absolute bottom-full mb-1 left-1\/2 -translate-x-1\/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20.*?>/g, '<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">');

fs.writeFileSync(appPath, appContent);
console.log('Theming reverted successfully.');
