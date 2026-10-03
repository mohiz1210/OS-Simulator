const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
const appPath = path.join(__dirname, 'src', 'App.tsx');

let cssContent = fs.readFileSync(cssPath, 'utf8');
cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-[#E5F6FD] text-slate-800 antialiased overflow-x-hidden;
    background-image: 
      radial-gradient(circle at top left, #30A4F8 0%, transparent 50%),
      radial-gradient(circle at top right, #4EE2B6 0%, transparent 50%),
      radial-gradient(circle at bottom right, #30A4F8 0%, transparent 40%),
      radial-gradient(circle at bottom left, #4EE2B6 0%, transparent 40%);
    background-color: #D2F2FF;
    min-height: 100vh;
  }
}

@layer components {
  .glass-panel {
    @apply bg-white/70 backdrop-blur-2xl border border-white rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)];
  }

  .btn {
    @apply px-4 py-2 rounded-full font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none;
  }
  
  .btn-primary {
    @apply bg-[#2DB2FF] hover:bg-[#1CA0F2] text-white shadow-[0_4px_14px_rgba(45,178,255,0.4)];
  }
  
  .btn-secondary {
    @apply bg-white hover:bg-slate-50 text-slate-700 shadow-sm border border-slate-200;
  }

  .btn-accent {
    @apply bg-gradient-to-r from-[#2DB2FF] to-[#1DDEB8] hover:from-[#1CA0F2] hover:to-[#15CFAB] text-white shadow-[0_8px_20px_rgba(29,222,184,0.3)];
  }
}
`;
fs.writeFileSync(cssPath, cssContent);

let appContent = fs.readFileSync(appPath, 'utf8');

// Theming replacements
const replacements = [
  // Backgrounds
  [/bg-slate-900\/50/g, 'bg-white/60'],
  [/bg-slate-900\/80/g, 'bg-white/80'],
  [/bg-slate-900\/40/g, 'bg-white/40'],
  [/bg-slate-900\/30/g, 'bg-white/30'],
  [/bg-slate-900/g, 'bg-white'],
  [/bg-slate-800\/80/g, 'bg-white/80'],
  [/bg-slate-800\/60/g, 'bg-white/60'],
  [/bg-slate-800\/50/g, 'bg-white/50'],
  [/bg-slate-800\/30/g, 'bg-[#E5F6FD]/50'],
  [/bg-slate-800/g, 'bg-white/90'],
  [/bg-slate-950/g, 'bg-white/50'],
  
  // Borders
  [/border-slate-700\/50/g, 'border-white'],
  [/border-slate-700/g, 'border-white/80'],
  [/border-slate-600\/50/g, 'border-blue-200'],
  [/border-slate-800\/80/g, 'border-white'],
  [/border-slate-800\/50/g, 'border-white/50'],
  [/border-slate-800/g, 'border-white/80'],
  [/border-white\/10/g, 'border-blue-100/50'],
  [/border-white\/20/g, 'border-blue-200/50'],
  
  // Text Colors
  [/text-white/g, 'text-slate-800'],
  [/text-slate-100/g, 'text-slate-800'],
  [/text-slate-300/g, 'text-slate-700'],
  [/text-slate-400/g, 'text-slate-500'],
  [/text-slate-500/g, 'text-slate-400'],
  [/text-slate-600/g, 'text-slate-400'],
  [/text-cyan-400/g, 'text-blue-500'],
  [/text-cyan-300/g, 'text-blue-600'],
  [/text-emerald-400/g, 'text-teal-500'],
  [/text-emerald-500/g, 'text-teal-600'],
  [/text-amber-400/g, 'text-amber-500'],
  [/text-rose-400/g, 'text-rose-500'],
  [/text-fuchsia-400/g, 'text-fuchsia-500'],
  [/text-blue-400/g, 'text-blue-500'],
  [/text-violet-400/g, 'text-indigo-500'],
  [/text-teal-400/g, 'text-teal-500'],
  [/text-orange-400/g, 'text-orange-500'],
  [/text-red-400/g, 'text-red-500'],
  
  // Shadows
  [/shadow-cyan-500\/30/g, 'shadow-blue-400/40'],
  [/shadow-emerald-500\/30/g, 'shadow-teal-400/40'],
  [/shadow-blue-500\/30/g, 'shadow-blue-400/40'],
  [/shadow-inner/g, 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'],
  
  // Gradients
  [/from-emerald-900\/40/g, 'from-teal-100/40'],
  [/to-slate-800/g, 'to-white/80'],
  
  // Specific tweaks
  [/Nexus OS <span className="text-slate-500 font-normal">/g, 'Nexus OS <span className="text-blue-400 font-normal">'],
];

for (const [regex, replacement] of replacements) {
  appContent = appContent.replace(regex, replacement);
}

// Additional fix: any text-white that got converted to text-slate-800 inside an element that genuinely needs to be white (like the big colored blobs or badges).
// Actually, since cards are white now, text needs to be dark! So text-slate-800 is correct for almost everything.
// But the badges: bg-rose-900/20 text-rose-500 is good.
// The primary blue/green icons:
appContent = appContent.replace(/text-slate-800 animate-pulse/g, 'text-white animate-pulse'); // The logo icon activity
appContent = appContent.replace(/from-cyan-400 to-blue-600/g, 'from-[#4EE2B6] to-[#30A4F8]'); 
appContent = appContent.replace(/bg-blue-500\/20/g, 'bg-blue-100');
appContent = appContent.replace(/bg-amber-500\/20/g, 'bg-amber-100');
appContent = appContent.replace(/bg-rose-900\/20/g, 'bg-rose-100');
appContent = appContent.replace(/bg-emerald-900\/30/g, 'bg-teal-100');
appContent = appContent.replace(/bg-cyan-900\/20/g, 'bg-cyan-100');
appContent = appContent.replace(/bg-amber-900\/20/g, 'bg-amber-100');
appContent = appContent.replace(/bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-slate-800/g, 'bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-700');
appContent = appContent.replace(/bg-indigo-900 hover:bg-indigo-800 px-1.5 py-0.5 rounded text-slate-800/g, 'bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded text-blue-700');


fs.writeFileSync(appPath, appContent);
console.log('Theming updated successfully.');
