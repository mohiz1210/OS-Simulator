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
  // Misc fixes revert
  [/from-emerald-50 to-white/g, 'from-emerald-900/40 to-slate-800'],
  [/from-blue-500 to-indigo-500/g, 'from-cyan-400 to-blue-600'],
  [/bg-blue-100/g, 'bg-blue-500/20'],
  [/bg-amber-100/g, 'bg-amber-500/20'],
  [/bg-rose-100/g, 'bg-rose-900/20'],
  [/bg-emerald-100/g, 'bg-emerald-900/30'],
  [/bg-cyan-100/g, 'bg-cyan-900/20'],

  // Button fixes revert
  [/text-slate-500 hover:text-slate-900 hover:border-slate-500/g, 'text-slate-800 hover:text-white hover:border-slate-400'], // wait, earlier it was border-slate-400.
  [/bg-slate-200 hover:bg-slate-300 px-1\.5 py-0\.5 rounded text-slate-700/g, 'bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-white'],
  [/bg-indigo-100 hover:bg-indigo-200 px-1\.5 py-0\.5 rounded text-indigo-700/g, 'bg-indigo-900 hover:bg-indigo-800 px-1.5 py-0.5 rounded text-white'],
  
  // Backgrounds revert
  [/bg-slate-100\/80/g, 'bg-slate-900/80'],
  [/bg-slate-50\/80/g, 'bg-slate-900/40'],
  [/bg-slate-100\/50/g, 'bg-slate-900/30'],
  [/bg-slate-50\/50/g, 'bg-slate-800/30'],
  [/bg-slate-100/g, 'bg-slate-900'],
  [/bg-white\/80/g, 'bg-slate-800/80'],
  [/bg-white\/60/g, 'bg-slate-800/60'],
  [/bg-white\/50/g, 'bg-slate-800/50'],
  // bg-slate-50 was used for both bg-slate-900/50 and bg-slate-950. Map all to bg-slate-900/50 first.
  [/bg-slate-50/g, 'bg-slate-900/50'],
  [/bg-white/g, 'bg-slate-800'],
  
  // Borders revert
  [/border-slate-300/g, 'border-slate-700'],
  // border-slate-200 was used for: border-slate-700/50, border-slate-600/50, border-white/10
  // First map all to border-slate-700/50, then fix manual ones.
  [/border-slate-200/g, 'border-slate-700/50'],

  // Text Colors revert
  [/text-slate-800/g, 'text-white'],
  [/text-slate-600/g, 'text-slate-300'],
  
  [/text-slate-400/g, '__TEMP_500__'],
  [/text-slate-500/g, '__TEMP_400__'],
  [/__TEMP_500__/g, 'text-slate-500'],
  [/__TEMP_400__/g, 'text-slate-400'],

  // Accents revert
  [/text-cyan-600/g, 'text-cyan-400'],
  [/text-cyan-500/g, 'text-cyan-300'],
  [/text-emerald-600/g, 'text-emerald-400'],
  [/text-amber-600/g, 'text-amber-400'],
  [/text-rose-600/g, 'text-rose-400'],
  [/text-fuchsia-600/g, 'text-fuchsia-400'],
  [/text-blue-600/g, 'text-blue-400'],
  [/text-violet-600/g, 'text-violet-400'],
  [/text-teal-600/g, 'text-teal-400'],
  [/text-orange-600/g, 'text-orange-400'],
  [/text-red-600/g, 'text-red-400'],
  
  // Hover states revert
  [/hover:text-slate-900/g, 'hover:text-white'],
  [/hover:border-slate-500/g, 'hover:border-slate-400'],
  [/hover:bg-slate-100/g, 'hover:bg-slate-700'],

  // Fix tooltip
  [/bg-slate-800 text-white/g, 'bg-black text-slate-800'],
];

for (const [regex, replacement] of replacements) {
  appContent = appContent.replace(regex, replacement);
}

// Memory block empty fix
appContent = appContent.replace(/border-slate-700\/5 bg-slate-800 hover:bg-slate-900\/50/g, 'border-white/5 bg-slate-800 hover:bg-slate-700');

// Fix the collisions we caused with generic revert
// 1. System Events Log bg-slate-950 (which is now bg-slate-900/50)
appContent = appContent.replace(/className="flex-grow bg-slate-900\/50 border border-slate-700\/50 rounded-xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-1\.5 shadow-inner"/g, 'className="flex-grow bg-slate-950 border border-slate-700/50 rounded-xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-inner"');

// 2. Headings border-white/10 (which are now border-slate-700/50)
appContent = appContent.replace(/border-b border-slate-700\/50 pb-3 flex items-center/g, 'border-b border-white/10 pb-3 flex items-center');

// 3. Thread create button border-slate-600/50 (which is now border-slate-700/50)
appContent = appContent.replace(/border-dashed border-slate-700\/50 text-slate-400/g, 'border-dashed border-slate-600/50 text-slate-400');

// Also one button was text-slate-800 hover:text-white originally
appContent = appContent.replace(/text-white hover:text-white hover:border-slate-400/g, 'text-slate-400 hover:text-white hover:border-slate-400');

// Tooltip was actually text-white but got mapped to text-slate-800
appContent = appContent.replace(/bg-black text-slate-800 text-xs px-2 py-1/g, 'bg-black text-white text-xs px-2 py-1');

// Activity icon color mapping got duplicated maybe? text-white -> text-white since it was white.
// Let's ensure it's white.
appContent = appContent.replace(/<Activity className="text-white" size=\{24\} \/>/g, '<Activity className="text-white" size={24} />');
appContent = appContent.replace(/<Activity className="text-slate-800" size=\{24\} \/>/g, '<Activity className="text-white" size={24} />');

fs.writeFileSync(appPath, appContent);
console.log('Light Theme Reverted!');
