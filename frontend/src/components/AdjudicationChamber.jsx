import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Flame,
  Scale,
  ExternalLink,
  Coins,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Award,
  Layers,
  FileSearch,
  Swords,
  ChevronDown,
  ChevronUp,
  ArrowDownToLine,
} from "lucide-react";

export function AdjudicationChamber({
  claims,
  loading,
  onOpenSubmitModal,
  onOpenChallengeModal,
  selectedCategory,
  onSelectCategory,
  onRefreshLedger,
}) {
  const [expandedClaimId, setExpandedClaimId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);
  const [refundNotice, setRefundNotice] = useState("");

  const handleRefundBond = async (claimId) => {
    setRefundingId(claimId);
    try {
      const res = await fetch(`/api/claims/${claimId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setRefundNotice(`Refund broadcast: ${data.txHash?.slice(0, 10)}...`);
        setTimeout(() => setRefundNotice(""), 4000);
        if (onRefreshLedger) onRefreshLedger();
      } else {
        alert(data.error || "Failed to process bond refund");
      }
    } catch (err) {
      console.error("Bond refund error:", err);
    } finally {
      setRefundingId(null);
    }
  };

  const categories = [
    { id: "all", label: "All Records" },
    { id: "exploit", label: "Exploits" },
    { id: "rugpull", label: "Rugpulls" },
    { id: "audit_passed", label: "Passed Audits" },
    { id: "high_quality_work", label: "Quality Work" },
    { id: "bad_debt", label: "Bad Debt" },
  ];

  const filteredClaims = claims.filter((c) => {
    if (selectedCategory === "all") return true;
    return c.category === selectedCategory;
  });

  const toggleExpand = (id) => {
    setExpandedClaimId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header and Action Banner */}
      <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald" />
            <h2 className="text-base font-bold text-emerald-950">
              Consensus Adjudication Spool
            </h2>
          </div>
          <p className="text-xs text-emerald-800/80 mt-1 max-w-xl leading-relaxed">
            Every entry is verified by GenLayer validators who fetch evidence
            and reach consensus before permanently appending to the ledger.
            False claims are slashed; truthful challenges are rewarded.
          </p>
        </div>

        <button
          onClick={() => onOpenSubmitModal()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-bold text-xs transition-colors shrink-0 shadow-xs"
        >
          <Coins className="w-4 h-4" />
          <span>Submit Claim with Bond</span>
        </button>
      </div>

      {/* Category Filter Spool */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat.id
                ? "bg-emerald text-obsidian-base font-bold shadow-xs"
                : "bg-whisper-card text-emerald-900 border border-emerald-500/20 hover:border-emerald-500/40"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Claims Feed */}
      {loading ? (
        <div className="py-16 text-center text-xs font-mono text-emerald-800/70 flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing consensus records from GenLayer Studio...</span>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-whisper-card border border-emerald-500/20 rounded-xl p-12 text-center flex flex-col items-center gap-3 shadow-sm">
          <FileSearch className="w-10 h-10 text-emerald-600/40" />
          <h3 className="text-sm font-bold text-emerald-950">
            No claims recorded in this category yet
          </h3>
          <p className="text-xs text-emerald-800/80 max-w-md">
            Be the first to stake a bond and submit a claim backed by public
            evidence URLs. If accepted, it will be written to the ledger forever.
          </p>
          <button
            onClick={() => onOpenSubmitModal()}
            className="mt-2 px-3.5 py-1.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-semibold text-xs transition-colors shadow-xs"
          >
            Submit First Claim
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredClaims.map((c) => {
            const isExpanded = expandedClaimId === c.claim_id || expandedClaimId === c.id;
            const isAccepted = c.status === "ACCEPTED";
            const isRejected = c.status === "REJECTED";
            const isOverridden = c.status === "OVERRIDDEN";

            return (
              <div
                key={c.claim_id || c.id}
                className="bg-whisper-card border border-emerald-500/20 rounded-xl overflow-hidden transition-all shadow-sm"
              >
                {/* Structural Device: Consensus Verdict Stamp Top Ribbon */}
                <div className="px-5 py-3 border-b border-emerald-500/15 bg-emerald-500/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {/* Visual Notary Stamp */}
                    <div
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold uppercase tracking-wide border flex items-center gap-1.5 ${
                        isAccepted
                          ? "bg-emerald/20 text-emerald-900 border-emerald/40"
                          : isRejected
                          ? "bg-red-500/15 text-red-700 border-red-500/40"
                          : "bg-blue-500/15 text-blue-700 border-blue-500/40"
                      }`}
                    >
                      {isAccepted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>RECORDED ON-CHAIN</span>
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>BOND SLASHED</span>
                        </>
                      ) : (
                        <>
                          <Swords className="w-3.5 h-3.5 text-blue-600" />
                          <span>CHALLENGE OVERRIDDEN</span>
                        </>
                      )}
                    </div>

                    <span className="text-xs font-mono font-semibold text-emerald-950">
                      #{c.claim_id || c.id}
                    </span>
                    <span className="text-xs font-mono text-emerald-700/70">
                      • {c.entity}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1 text-emerald-900">
                      <Coins className="w-3.5 h-3.5 text-emerald" />
                      <span>{c.bond_amount} GEN Bond</span>
                    </div>

                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald" />
                      <span>{c.confidence_score}% Quorum</span>
                    </div>
                  </div>
                </div>

                {/* Claim Statement Body */}
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-emerald-950 leading-relaxed font-sans">
                        "{c.claim_text}"
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-emerald-700/80">
                        <span className="capitalize">Category: {c.category}</span>
                        <span>•</span>
                        <span className="capitalize">
                          Target: {c.entity_type || "contract"}
                        </span>
                        <span>•</span>
                        <span>Claimant: {c.claimant_email || "verified member"}</span>
                      </div>
                    </div>

                    {/* Action Buttons for Accepted Claims */}
                    {isAccepted && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRefundBond(c.claim_id || c.id)}
                          disabled={refundingId === (c.claim_id || c.id) || c.bond_refunded}
                          title="Reclaim locked bond for verified claim"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20 text-xs font-mono font-semibold transition-colors disabled:opacity-50 shrink-0"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald" />
                          <span>
                            {c.bond_refunded
                              ? "Bond Refunded"
                              : refundingId === (c.claim_id || c.id)
                              ? "Refunding..."
                              : "Refund Bond"}
                          </span>
                        </button>
                        <button
                          onClick={() => onOpenChallengeModal(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 text-xs font-mono font-semibold transition-colors shrink-0"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Challenge Claim</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slashed Notice if Rejected */}
                  {isRejected && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-700 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Economic Penalty: </span>
                        Validators determined the evidence was unsubstantiated
                        or fabricated. The claimant bond of {c.bond_amount} GEN
                        has been slashed and forfeited to protocol security.
                      </div>
                    </div>
                  )}

                  {/* Overridden Notice if Challenge Succeeded */}
                  {isOverridden && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 flex items-start gap-2">
                      <Swords className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Challenge Upheld: </span>
                        A challenger submitted counter evidence overturning
                        this record. The original bond was transferred to the
                        challenger and this claim no longer docks the entity score.
                      </div>
                    </div>
                  )}

                  {/* Accordion Toggle for Evidence & Consensus Findings */}
                  <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between">
                    <button
                      onClick={() => toggleExpand(c.claim_id || c.id)}
                      className="flex items-center gap-1.5 text-xs font-mono text-emerald-800 hover:underline"
                    >
                      <span>
                        {isExpanded
                          ? "Hide consensus evidence and findings"
                          : "Audit validator consensus and evidence"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {c.genlayer_tx_hash && (
                      <a
                        href="https://genlayer-explorer.vercel.app"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-emerald-700/70 hover:text-emerald-900 flex items-center gap-1"
                      >
                        <span>Tx: {c.genlayer_tx_hash.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Expanded Accordion: Validator Consensus & Evidence Links */}
                  {isExpanded && (
                    <div className="p-4 rounded-lg bg-whisper-base border border-emerald-500/15 flex flex-col gap-3 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-emerald-700/80 uppercase font-semibold">
                          Validator Consensus Summary
                        </span>
                        <p className="text-xs text-emerald-950 font-sans mt-0.5 leading-relaxed">
                          {c.consensus_summary ||
                            "Consensus reached through multi-validator LLM execution."}
                        </p>
                      </div>

                      {/* Evidence URLs */}
                      {c.evidence_urls && c.evidence_urls.length > 0 && (
                        <div>
                          <span className="text-[10px] text-emerald-700/80 uppercase font-semibold">
                            Submitted Evidence Sources
                          </span>
                          <div className="flex flex-col gap-1 mt-1">
                            {c.evidence_urls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-emerald-800 hover:underline truncate"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{url}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Findings */}
                      {c.key_findings && c.key_findings.length > 0 && (
                        <div>
                          <span className="text-[10px] text-emerald-700/80 uppercase font-semibold">
                            Consensus Key Findings
                          </span>
                          <ul className="list-disc list-inside mt-1 flex flex-col gap-0.5 text-emerald-950 font-sans text-xs">
                            {c.key_findings.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Challenge History */}
                      {c.challenges && c.challenges.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-emerald-500/15">
                          <span className="text-[10px] text-amber-700 uppercase font-bold">
                            Challenge Adjudication History
                          </span>
                          {c.challenges.map((chal, i) => (
                            <div
                              key={i}
                              className="mt-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-sans"
                            >
                              <p className="text-amber-800 font-mono font-bold text-[11px]">
                                Verdict: {chal.verdict} • Counter Bond: {chal.counter_bond} GEN
                              </p>
                              <p className="text-emerald-950 mt-1">
                                Rebuttal: "{chal.rebuttal}"
                              </p>
                              {chal.reasoning && (
                                <p className="text-emerald-800/80 text-[11px] mt-1 font-mono">
                                  Validator Rationale: {chal.reasoning}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
