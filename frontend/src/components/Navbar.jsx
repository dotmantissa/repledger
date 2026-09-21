import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useTheme } from "../context/ThemeContext";
import {
  Sun,
  Moon,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  LogIn,
  LogOut,
  Sparkles,
  Layers,
} from "lucide-react";

export function Navbar({ contractAddress, stats }) {
  const { login, logout, authenticated, user } = usePrivy();
  const { isDark, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const displayEmail =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    "Authenticated Member";

  const copyAddress = () => {
    if (!contractAddress) return;
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = contractAddress
    ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
    : "0x9158...a661";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-whisper-card/90 dark:bg-obsidian-base/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="REP Ledger Seal"
            className="w-9 h-9 object-contain drop-shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-emerald-900 dark:text-emerald-50 font-sans">
                REP <span className="text-emerald font-extrabold">|</span> Ledger
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald/10 text-emerald border border-emerald/20">
                consensus verified
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/60 hidden md:block">
              Immutable institutional memory on-chain
            </p>
          </div>
        </div>

        {/* Center: Live Contract Badge & Explorer Link */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-200">
            <Layers className="w-3.5 h-3.5 text-emerald" />
            <span className="text-emerald-700/70 dark:text-emerald-400/70">Contract:</span>
            <span className="font-semibold">{shortAddress}</span>
            <button
              onClick={copyAddress}
              title="Copy full contract address"
              className="ml-1 p-0.5 hover:text-emerald transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href="https://genlayer-explorer.vercel.app"
              target="_blank"
              rel="noreferrer"
              title="View on GenLayer Studio Explorer"
              className="ml-0.5 hover:text-emerald transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span>GenLayer Studio Network</span>
          </div>
        </div>

        {/* Right Actions: Theme Toggle & Privy Email Auth */}
        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-lg border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald/40"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-emerald" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-800" />
            )}
          </button>

          {/* Privy Email Authentication */}
          {authenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100 max-w-[160px] truncate">
                  {displayEmail}
                </span>
                <span className="text-[10px] text-emerald font-mono">
                  gasless relayer active
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-red-400/40 bg-whisper-card dark:bg-obsidian-card hover:bg-red-500/10 text-xs font-medium text-emerald-900 dark:text-emerald-100 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs shadow-sm hover:shadow transition-colors focus:outline-none focus:ring-2 focus:ring-emerald/50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In with Email</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
