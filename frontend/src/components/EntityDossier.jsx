import React, { useState } from "react";
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
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

  const filteredEntities = entities.filter((ent) => {
    const matchesSearch =
      ent.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ent.entity_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      activeTypeFilter === "all" || ent.entity_type === activeTypeFilter;
    return matchesSearch && matchesType;
  });

  const getGradeStyle = (grade, isExploit) => {
    if (isExploit || grade === "EXPLOIT_FLAG") {
      return "bg-red-500/15 text-red-700 border-red-500/30";
    }
    if (grade && grade.startsWith("A")) {
      return "bg-emerald/15 text-emerald-800 border-emerald/30";
    }
    if (grade && grade.startsWith("B")) {
      return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    }
    return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Search & Filter Bar */}
      <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-950">
            Entity Dossiers
          </h2>
          <span className="text-xs font-mono text-emerald-700/80">
            {entities.length} tracked
          </span>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
          <input
            type="text"
            placeholder="Search wallet, protocol, or agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 placeholder:text-emerald-700/50 focus:outline-none focus:ring-1 focus:ring-emerald"
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
                  : "bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Entity Selector Spool */}
      {entities.length === 0 ? (
        <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-8 text-center flex flex-col items-center gap-3 shadow-sm">
          <Shield className="w-10 h-10 text-emerald-600/40" />
          <h3 className="text-sm font-bold text-emerald-950">
            No entities recorded on-chain yet
          </h3>
          <p className="text-xs text-emerald-800/80 max-w-sm">
            REP Ledger records are created dynamically as validators adjudicate real claims. Submit the first claim to track an entity.
          </p>
          <button
            onClick={() => onOpenSubmitModal()}
            className="mt-1 px-3.5 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs transition-colors shadow-xs"
          >
            Submit First Claim
          </button>
        </div>
      ) : (
        <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-3 max-h-[300px] overflow-y-auto flex flex-col gap-2">
          {filteredEntities.length === 0 ? (
            <div className="py-6 text-center text-xs text-emerald-700/60">
              No tracked entities match your filter.
            </div>
          ) : (
            filteredEntities.map((ent) => {
              const isSelected = selectedEntity?.entity_id === ent.entity_id;
              return (
                <button
                  key={ent.entity_id}
                  onClick={() => onSelectEntity(ent)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-emerald bg-emerald-500/10 shadow-xs"
                      : "border-emerald-500/10 hover:border-emerald-500/30 bg-whisper-base/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        ent.is_exploit_flagged
                          ? "bg-red-500/15 text-red-600"
                          : "bg-emerald/15 text-emerald-800"
                      }`}
                    >
                      {ent.is_exploit_flagged ? (
                        <Flame className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-emerald-950 truncate">
                        {ent.display_name}
                      </p>
                      <p className="text-[10px] font-mono text-emerald-700/80 truncate">
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
                    <span className="text-xs font-mono font-bold text-emerald-950">
                      {ent.trust_score}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Selected Entity Dossier Detail */}
      {selectedEntity && (
        <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-emerald-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-emerald-950">
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
              <p className="text-xs font-mono text-emerald-700/80 mt-0.5">
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
          <div className="bg-whisper-base rounded-lg p-3.5 border border-emerald-500/15 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-900">
                Consensus Trust Score
              </span>
              <span className="text-base font-mono font-extrabold text-emerald-800">
                {selectedEntity.trust_score}
                <span className="text-xs text-emerald-700/70 font-normal">
                  /100
                </span>
              </span>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-emerald-500/15 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  selectedEntity.is_exploit_flagged
                    ? "bg-red-500"
                    : selectedEntity.trust_score >= 70
                    ? "bg-emerald"
                    : selectedEntity.trust_score >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${selectedEntity.trust_score}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-700/80 pt-1">
              <span>0 (critical breach)</span>
              <span>50 (neutral baseline)</span>
              <span>100 (exemplary track record)</span>
            </div>
          </div>

          {/* 4 Block Ledger Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-whisper-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/80">
                Positive Claims
              </p>
              <p className="text-sm font-mono font-bold text-emerald-800">
                +{selectedEntity.accepted_positive || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/80">
                Negative Claims
              </p>
              <p className="text-sm font-mono font-bold text-red-600">
                -{selectedEntity.accepted_negative || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/80">
                Overridden Claims
              </p>
              <p className="text-sm font-mono font-bold text-blue-600">
                {selectedEntity.overridden_count || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-whisper-base border border-emerald-500/15 text-center">
              <p className="text-[10px] text-emerald-700/80">
                Exploit Flag
              </p>
              <p
                className={`text-sm font-mono font-bold ${
                  selectedEntity.is_exploit_flagged
                    ? "text-red-600"
                    : "text-emerald-800"
                }`}
              >
                {selectedEntity.is_exploit_flagged ? "ACTIVE" : "NONE"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
