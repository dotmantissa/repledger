import React, { useState } from "react";
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Terminal,
  Play,
  RotateCcw,
  Sparkles,
  Award,
  FileText,
  UserCheck,
} from "lucide-react";

export function EntityDossier({
  entities,
  selectedEntity,
  onSelectEntity,
  onOpenSubmitModal,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState("all");
  const [simulationType, setSimulationType] = useState("lending_protocol");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const filteredEntities = entities.filter((ent) => {
    const matchesSearch =
      ent.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ent.entity_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      activeTypeFilter === "all" || ent.entity_type === activeTypeFilter;
    return matchesSearch && matchesType;
  });

  const runSimulation = async () => {
    if (!selectedEntity) return;
    setSimulationLoading(true);
    setSimulationResult(null);
    try {
      const res = await fetch("/api/simulate-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: selectedEntity.entity_id,
          consumer_type: simulationType,
        }),
      });
      const data = await res.json();
      setSimulationResult(data);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulationLoading(false);
    }
  };

  const getGradeStyle = (grade, isExploit) => {
    if (isExploit || grade === "EXPLOIT_FLAG") {
      return "bg-red-500/15 text-red-500 border-red-500/30";
    }
    if (grade.startsWith("A")) {
      return "bg-emerald/15 text-emerald border-emerald/30";
    }
    if (grade.startsWith("B")) {
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    }
    return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Search & Filter Bar */}
      <div className="bg-whisper-card dark:bg-obsidian-card border border-emerald-500/20 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">
            Entity Dossiers
          </h2>
          <span className="text-xs font-mono text-emerald-700/70 dark:text-emerald-400/70">
            {entities.length} tracked
          </span>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60 dark:text-emerald-300/60" />
          <input
            type="text"
            placeholder="Search wallet, protocol, or agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-emerald-500/20 bg-whisper-base dark:bg-obsidian-base text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-700/40 dark:placeholder:text-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {["all", "protocol", "wallet", "agent", "contract"].map((type) => (
            <button
              key={type}
              onClick={() => setActiveTypeFilter(type)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-colors ${
                activeTypeFilter === type
                  ? "bg-emerald text-obsidian-base font-bold shadow-xs"
                  : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Entity Selector Spool */}
      <div className="bg-whisper-card dark:bg-obsidian-card border border-emerald-500/20 rounded-xl p-3 max-h-[300px] overflow-y-auto flex flex-col gap-2">
        {filteredEntities.length === 0 ? (
          <div className="py-6 text-center text-xs text-emerald-700/60 dark:text-emerald-400/60">
            No tracked entities match your filter.
          </div>
        ) : (
          filteredEntities.map((ent) => {
            const isSelected = selectedEntity?.entity_id === ent.entity_id;
            return (
              <button
                key={ent.entity_id}
                onClick={() => {
                  onSelectEntity(ent);
                  setSimulationResult(null);
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? "border-emerald bg-emerald-500/10 shadow-xs"
                    : "border-emerald-500/10 hover:border-emerald-500/30 bg-whisper-base/60 dark:bg-obsidian-base/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      ent.is_exploit_flagged
                        ? "bg-red-500/15 text-red-500"
                        : "bg-emerald/15 text-emerald"
                    }`}
                  >
                    {ent.is_exploit_flagged ? (
                      <Flame className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-50 truncate">
                      {ent.display_name}
                    </p>
                    <p className="text-[10px] font-mono text-emerald-700/70 dark:text-emerald-400/70 truncate">
                      {ent.entity_type} • {ent.total_claims} claims
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getGradeStyle(
                      ent.trust_grade,
                      ent.is_exploit_flagged
                    )}`}
                  >
                    {ent.is_exploit_flagged ? "EXPLOIT" : ent.trust_grade}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-100">
                    {ent.trust_score}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selected Entity Dossier Detail */}
      {selectedEntity && (
        <div className="bg-whisper-card dark:bg-obsidian-card border border-emerald-500/20 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-emerald-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-50">
                  {selectedEntity.display_name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getGradeStyle(
                    selectedEntity.trust_grade,
                    selectedEntity.is_exploit_flagged
                  )}`}
                >
                  {selectedEntity.is_exploit_flagged
                    ? "EXPLOIT FLAGGED"
                    : `GRADE ${selectedEntity.trust_grade}`}
                </span>
              </div>
              <p className="text-xs font-mono text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                ID: {selectedEntity.entity_id}
              </p>
            </div>

            <button
              onClick={() => onOpenSubmitModal(selectedEntity.entity_id)}
              className="px-3 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs transition-colors shrink-0 shadow-xs"
            >
              Submit Claim
            </button>
          </div>

          {/* Trust Score Visualizer */}
          <div className="bg-whisper-base dark:bg-obsidian-base rounded-lg p-3.5 border border-emerald-500/15 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                Consensus Trust Score
              </span>
              <span className="text-base font-mono font-extrabold text-emerald">
                {selectedEntity.trust_score}
                <span className="text-xs text-emerald-700/60 dark:text-emerald-400/60 font-normal">
                  /100
                </span>
              </span>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-emerald-500/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  selectedEntity.is_exploit_flagged
                    ? "bg-red-500"
                    : selectedEntity.trust_score >= 70
                    ? "bg-emerald"
                    : selectedEntity.trust_score >= 50
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${selectedEntity.trust_score}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-700/70 dark:text-emerald-400/70 pt-1">
              <span>0 (critical breach)</span>
              <span>50 (neutral baseline)</span>
              <span>100 (exemplary track record)</span>
            </div>
          </div>

          {/* 4 Block Ledger Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-whisper-base dark:bg-obsidian-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                Positive Claims
              </p>
              <p className="text-sm font-mono font-bold text-emerald">
                +{selectedEntity.accepted_positive || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base dark:bg-obsidian-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                Negative Claims
              </p>
              <p className="text-sm font-mono font-bold text-red-400">
                -{selectedEntity.accepted_negative || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base dark:bg-obsidian-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                Overridden Claims
              </p>
              <p className="text-sm font-mono font-bold text-blue-400">
                {selectedEntity.overridden_count || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base dark:bg-obsidian-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                Exploit Flag
              </p>
              <p
                className={`text-sm font-mono font-bold ${
                  selectedEntity.is_exploit_flagged
                    ? "text-red-500"
                    : "text-emerald"
                }`}
              >
                {selectedEntity.is_exploit_flagged ? "ACTIVE" : "NONE"}
              </p>
            </div>
          </div>

          {/* Composable Query Simulator (How other protocols read RepLedger) */}
          <div className="mt-2 border-t border-emerald-500/15 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-emerald" />
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-50 uppercase tracking-wider">
                Composable Query Simulator
              </h4>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mb-3">
              Test how external smart contracts query this entity on RepLedger
              before executing loans, settling predictions, or routing agents.
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={simulationType}
                  onChange={(e) => {
                    setSimulationType(e.target.value);
                    setSimulationResult(null);
                  }}
                  className="flex-1 text-xs py-1.5 px-2.5 rounded-lg border border-emerald-500/20 bg-whisper-base dark:bg-obsidian-base text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald"
                >
                  <option value="lending_protocol">
                    Lending Market (Borrower Risk Check)
                  </option>
                  <option value="prediction_market">
                    Prediction Market (Exploit Resolution Oracle)
                  </option>
                  <option value="agentic_marketplace">
                    Agent Swarm (Autonomous Task Routing)
                  </option>
                </select>

                <button
                  onClick={runSimulation}
                  disabled={simulationLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 disabled:opacity-50 text-obsidian-base font-semibold text-xs transition-colors shrink-0 shadow-xs"
                >
                  <Play className="w-3 h-3" />
                  <span>{simulationLoading ? "Querying..." : "Simulate"}</span>
                </button>
              </div>

              {/* Simulation Result Output */}
              {simulationResult && (
                <div className="mt-2 p-3 rounded-lg bg-whisper-base dark:bg-obsidian-base border border-emerald-500/25 font-mono text-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/15 pb-1">
                    <span className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                      ON-CHAIN RESPONSE
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        simulationResult.approved
                          ? "bg-emerald/20 text-emerald"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {simulationResult.decision}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-950 dark:text-emerald-100 leading-relaxed font-sans pt-1">
                    {simulationResult.rationale}
                  </p>
                  <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 pt-1">
                    Queried Contract: {simulationResult.queriedContract.slice(0, 10)}...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
