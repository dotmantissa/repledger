import React, { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  LogIn,
  LogOut,
  Sparkles,
  Layers,
  Coins,
  Droplet,
  Wallet,
} from "lucide-react";

export function Navbar({ contractAddress, stats }) {
  const { login, logout, authenticated, user } = usePrivy();
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [genBalance, setGenBalance] = useState(100);
  const [isDripping, setIsDripping] = useState(false);
  const [dripNotice, setDripNotice] = useState(false);

  const displayEmail =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    "Authenticated Member";

  const embeddedAddress = user?.wallet?.address || "";

  // Fetch live balance
  const refreshBalance = () => {
    if (authenticated && displayEmail) {
      fetch(`/api/faucet/balance/${encodeURIComponent(displayEmail)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data.balance === "number") {
            setGenBalance(data.balance);
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    refreshBalance();
  }, [authenticated, displayEmail]);

  const copyContract = () => {
    if (!contractAddress) return;
    navigator.clipboard.writeText(contractAddress);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const copyWallet = () => {
    if (!embeddedAddress) return;
    navigator.clipboard.writeText(embeddedAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleDripFaucet = async () => {
    setIsDripping(true);
    try {
      const res = await fetch("/api/faucet/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: displayEmail,
          address: embeddedAddress,
          amount: 50,
        }),
      });
      const data = await res.json();
      if (data && data.balance) {
        setGenBalance(data.balance);
        setDripNotice(true);
        setTimeout(() => setDripNotice(false), 2500);
      }
    } catch (err) {
      console.error("Faucet error:", err);
    } finally {
      setIsDripping(false);
    }
  };

  const shortAddress = contractAddress
    ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
    : "0x9158...a661";

  const shortWallet = embeddedAddress
    ? `${embeddedAddress.slice(0, 6)}...${embeddedAddress.slice(-4)}`
    : "";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-whisper-card/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="REP Ledger Seal"
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-emerald-950 font-sans">
                REP <span className="text-emerald font-extrabold">|</span> Ledger
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald/10 text-emerald-800 border border-emerald/20">
                consensus verified
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/70 hidden md:block">
              Immutable institutional memory on-chain
            </p>
          </div>
        </div>

        {/* Center: Live Contract Badge & Explorer Link */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-900">
            <Layers className="w-3.5 h-3.5 text-emerald" />
            <span className="text-emerald-700/80">Contract:</span>
            <span className="font-semibold">{shortAddress}</span>
            <button
              onClick={copyContract}
              title="Copy full contract address"
              className="ml-1 p-0.5 hover:text-emerald transition-colors"
            >
              {copiedContract ? (
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

          <div className="flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-500/25">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span>GenLayer Studio Network</span>
          </div>
        </div>

        {/* Right Actions: Faucet & Privy Email Auth */}
        <div className="flex items-center gap-2.5">
          {authenticated ? (
            <div className="flex items-center gap-2.5">
              {/* Faucet Balance & Drip Button */}
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald" />
                <span className="text-xs font-mono font-bold text-emerald-950">
                  {genBalance} GEN
                </span>
                <button
                  onClick={handleDripFaucet}
                  disabled={isDripping}
                  title="Claim testnet GEN tokens"
                  className="ml-1 px-2 py-0.5 rounded bg-emerald hover:bg-emerald-600 text-obsidian-base text-[11px] font-mono font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Droplet className="w-3 h-3" />
                  <span>{isDripping ? "..." : dripNotice ? "+50!" : "Faucet"}</span>
                </button>
              </div>

              {/* User Email & Embedded Wallet */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-medium text-emerald-950 max-w-[140px] truncate">
                  {displayEmail}
                </span>
                {shortWallet ? (
                  <button
                    onClick={copyWallet}
                    title="Click to copy embedded wallet address"
                    className="text-[10px] text-emerald-800/70 hover:text-emerald font-mono flex items-center gap-1"
                  >
                    <Wallet className="w-2.5 h-2.5 text-emerald" />
                    <span>{shortWallet}</span>
                    {copiedWallet ? (
                      <Check className="w-2.5 h-2.5 text-emerald" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald font-mono">
                    gasless relayer active
                  </span>
                )}
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-red-400/40 bg-whisper-card hover:bg-red-500/10 text-xs font-medium text-emerald-950 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs shadow-xs hover:shadow transition-colors focus:outline-none focus:ring-2 focus:ring-emerald/50"
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
