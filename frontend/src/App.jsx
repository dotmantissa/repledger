import React, { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { EntityDossier } from "./components/EntityDossier";
import { AdjudicationChamber } from "./components/AdjudicationChamber";
import { SubmitClaimModal } from "./components/SubmitClaimModal";
import { ChallengeModal } from "./components/ChallengeModal";
import {
  ShieldCheck,
  Flame,
  Scale,
  Coins,
  Sparkles,
  Users,
  RefreshCw,
  ExternalLink,
  Layers,
} from "lucide-react";

export default function App() {
  const [stats, setStats] = useState({
    totalClaims: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalOverridden: 0,
    totalSlashedBonds: 0,
    uniqueEntities: 0,
    contractAddress: "0xe94A9eD3162b5c1b43f6F3FEF643E484b5B2a847",
  });

  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitInitialEntity, setSubmitInitialEntity] = useState("");
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [targetChallengeClaim, setTargetChallengeClaim] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch initial ledger data
  const loadLedgerData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch Stats
      const statsRes = await fetch("/api/stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch Entities
      const entitiesRes = await fetch("/api/entities");
      if (entitiesRes.ok) {
        const entitiesData = await entitiesRes.json();
        setEntities(entitiesData.entities || []);
        if (!selectedEntity && entitiesData.entities?.length > 0) {
          setSelectedEntity(entitiesData.entities[0]);
        }
      }

      // 3. Fetch Claims
      const claimsRes = await fetch("/api/claims");
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json();
        setClaims(claimsData.claims || []);
      }
    } catch (err) {
      console.error("Failed to load ledger data:", err);
    } finally {
      setLoadingClaims(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, []);

  const handleOpenSubmitModal = (initialEnt = "") => {
    setSubmitInitialEntity(initialEnt);
    setIsSubmitModalOpen(true);
  };

  const handleOpenChallengeModal = (claim) => {
    setTargetChallengeClaim(claim);
    setIsChallengeModalOpen(true);
  };

  const handleClaimSubmitted = (newClaim) => {
    loadLedgerData();
  };

  const handleChallengeSubmitted = (updatedClaim) => {
    loadLedgerData();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-whisper-base text-emerald-950">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Top Protocol Telemetry Header */}
        <section className="bg-whisper-card border border-emerald-500/20 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/25 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald" />
                <span>On-chain Trust Primitive</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-950">
                Write once, append forever.
                <br className="hidden sm:inline" />
                Claims adjudicated by validator consensus.
              </h1>
              <p className="text-xs sm:text-sm text-emerald-800/80 mt-2.5 leading-relaxed font-sans">
                Every reputation system has a flaw: either a centralized cabal
                decides who is trustworthy, or rich wallets game tokens. REP
                Ledger removes human bias. Claimants stake real bonds, GenLayer
                validators fetch public evidence, and accepted claims become
                immutable institutional memory for prediction markets, lending
                vaults, and autonomous agent swarms.
              </p>
            </div>

            {/* Quick Stat Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="p-3.5 rounded-xl bg-whisper-base border border-emerald-500/15 text-center min-w-[120px]">
                <p className="text-[11px] font-mono text-emerald-700/80">
                  Total Claims
                </p>
                <p className="text-xl font-mono font-extrabold text-emerald-950 mt-0.5">
                  {stats.totalClaims || claims.length}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-whisper-base border border-emerald-500/15 text-center min-w-[120px]">
                <p className="text-[11px] font-mono text-emerald-700/80">
                  Accepted on-chain
                </p>
                <p className="text-xl font-mono font-extrabold text-emerald-800 mt-0.5">
                  {stats.totalAccepted || claims.filter((c) => c.status === "ACCEPTED").length}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-whisper-base border border-emerald-500/15 text-center min-w-[120px] col-span-2 sm:col-span-1">
                <p className="text-[11px] font-mono text-emerald-700/80">
                  Slashed Stakes
                </p>
                <p className="text-xl font-mono font-extrabold text-red-600 mt-0.5">
                  {stats.totalSlashedBonds || 0} GEN
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Split-Pane Layout Archetype */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Pane: Entity Dossier (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <EntityDossier
              entities={entities}
              selectedEntity={selectedEntity}
              onSelectEntity={setSelectedEntity}
              onOpenSubmitModal={handleOpenSubmitModal}
            />
          </div>

          {/* Right Pane: Consensus Adjudication Chamber and Live Spool (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <AdjudicationChamber
              claims={claims}
              loading={loadingClaims}
              onOpenSubmitModal={handleOpenSubmitModal}
              onOpenChallengeModal={handleOpenChallengeModal}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </section>
      </main>

      {/* Modals */}
      <SubmitClaimModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        initialEntity={submitInitialEntity}
        onClaimSubmitted={handleClaimSubmitted}
      />

      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => {
          setIsChallengeModalOpen(false);
          setTargetChallengeClaim(null);
        }}
        claim={targetChallengeClaim}
        onChallengeSubmitted={handleChallengeSubmitted}
      />

      {/* Human Footer */}
      <footer className="border-t border-emerald-500/20 py-8 mt-12 bg-whisper-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-emerald-800/80">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Seal" className="w-5 h-5 object-contain" />
            <span>REP Ledger • GenLayer Intelligent Contract Protocol</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://genlayer-explorer.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald transition-colors flex items-center gap-1"
            >
              <span>GenLayer Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-emerald-700/40">•</span>
            <span>Immutable Institutional Memory</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
