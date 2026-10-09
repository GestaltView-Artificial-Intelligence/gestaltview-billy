import './index.css';

import { navigateTo } from '@devvit/web/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4 bg-slate-950 px-5 text-slate-100">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <img
          src="/insight-bot-logo.png"
          alt="Insight-Bot"
          className="h-auto w-full max-w-sm object-contain"
        />
        <p className="text-xs font-semibold tracking-[0.3em] text-cyan-300">GESTALTVIEW</p>
        <p className="text-slate-300">A thoughtful doorway for questions, reflection, and new perspectives.</p>
        <p className="text-sm text-slate-400">Welcome, {context.username ?? 'friend'}. Replies are private by default.</p>
      </div>
      <div className="flex items-center justify-center mt-5">
        <button
          className="flex items-center justify-center bg-cyan-300 text-slate-950 w-auto h-10 rounded-full cursor-pointer transition-colors px-5 font-semibold hover:bg-cyan-200"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'chat')}
        >
          Chat with Billy
        </button>
      </div>
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.8em] text-gray-600 dark:text-gray-400">
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);

