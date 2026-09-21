import React, { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  LogIn,
  LogOut,
  Coins,
  Droplet,
  Wallet,
  Check,
  Copy,
} from "lucide-react";

export function Navbar() {
  const { login, logout, authenticated, user } = usePrivy();
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

  const shortWallet = embeddedAddress
    ? `${embeddedAddress.slice(0, 6)}...${embeddedAddress.slice(-4)}`
    : "";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-whisper-card/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Minimal Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="REP Ledger"
            className="w-8 h-8 object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-emerald-950 font-sans">
            REP <span className="text-emerald font-extrabold">|</span> Ledger
          </span>
        </div>

        {/* Minimal Right Actions */}
        <div className="flex items-center gap-3">
          {authenticated ? (
            <div className="flex items-center gap-3">
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
                  <span>{isDripping ? "..." : dripNotice ? "+50" : "Faucet"}</span>
                </button>
              </div>

              {/* User Identity */}
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-medium text-emerald-950 max-w-[150px] truncate">
                  {displayEmail}
                </span>
                {shortWallet ? (
                  <button
                    onClick={copyWallet}
                    title="Copy wallet address"
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
                    gasless relayer
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs shadow-xs hover:shadow transition-colors focus:outline-none focus:ring-2 focus:ring-emerald/50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
