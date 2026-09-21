import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  X,
  Plus,
  Trash2,
  Coins,
  ShieldAlert,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function SubmitClaimModal({ isOpen, onClose, initialEntity, onClaimSubmitted }) {
  const { authenticated, login, user } = usePrivy();

  const [entity, setEntity] = useState(initialEntity || "");
  const [entityType, setEntityType] = useState("protocol");
  const [claimText, setClaimText] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState([""]);
  const [bondAmount, setBondAmount] = useState(10);
  const [category, setCategory] = useState("exploit");
  const [sentiment, setSentiment] = useState("negative");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleAddUrl = () => {
    if (evidenceUrls.length < 3) {
      setEvidenceUrls([...evidenceUrls, ""]);
    }
  };

  const handleUrlChange = (index, value) => {
    const updated = [...evidenceUrls];
    updated[index] = value;
    setEvidenceUrls(updated);
  };

  const handleRemoveUrl = (index) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authenticated) {
      login();
      return;
    }

    if (!entity.trim()) {
      setErrorMsg("Please specify a target entity (e.g. euler_finance or 0x...)");
      return;
    }
    if (!claimText.trim()) {
      setErrorMsg("Please describe the claim statement.");
      return;
    }

    const cleanUrls = evidenceUrls.map((u) => u.trim()).filter((u) => u.length > 0);

    setIsSubmitting(true);
    setErrorMsg("");
    setSubmissionStep("Broadcasting transaction to GenLayer Studio Network...");

    try {
      const email =
        user?.email?.address ||
        user?.google?.email ||
        user?.apple?.email ||
        "verified_member";

      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": email,
        },
        body: JSON.stringify({
          entity: entity.trim(),
          entity_type: entityType,
          claim_text: claimText.trim(),
          evidence_urls: cleanUrls,
          bond_amount: Number(bondAmount),
          category,
          sentiment,
        }),
      });

      setSubmissionStep("Validators independently fetching evidence and voting...");

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Claim submission failed");
      }

      setSubmissionStep("Consensus reached. Appending to on-chain record...");
      setTimeout(() => {
        setIsSubmitting(false);
        onClaimSubmitted(data.claim);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Submission error:", err);
      setErrorMsg(err.message || "Failed to submit claim to GenLayer.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-xs">
      <div className="bg-whisper-card border border-emerald-500/20 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-1 rounded-lg text-emerald-800/60 hover:text-emerald hover:bg-emerald-500/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Coins className="w-5 h-5 text-emerald" />
          <h2 className="text-lg font-bold text-emerald-950">
            Submit Claim with Staked Bond
          </h2>
        </div>
        <p className="text-xs text-emerald-800/80 mb-5 leading-relaxed">
          Your claim will be analyzed by GenLayer consensus validators who read
          the attached evidence. Staked bonds ensure only truthful claims are
          admitted. False claims are slashed.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Target Entity & Entity Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-emerald-950 mb-1">
                Target Entity Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. balancer_v2, 0x123..., or eliza_agent"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-950 mb-1">
                Entity Type
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald"
              >
                <option value="protocol">Protocol</option>
                <option value="wallet">Wallet</option>
                <option value="agent">Agent</option>
                <option value="contract">Smart Contract</option>
              </select>
            </div>
          </div>

          {/* Category & Sentiment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-950 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald"
              >
                <option value="exploit">Exploit / Security Breach</option>
                <option value="rugpull">Rugpull / Malicious Drain</option>
                <option value="bad_debt">Insolvency / Bad Debt</option>
                <option value="audit_passed">Passed Security Audit</option>
                <option value="high_quality_work">High Quality Deliverables</option>
                <option value="governance_compromise">Governance Compromise</option>
                <option value="general_reputation">General Reputation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-950 mb-1">
                Sentiment
              </label>
              <select
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald"
              >
                <option value="negative">Negative (Warning / Breach)</option>
                <option value="positive">Positive (Commendation / Audit)</option>
              </select>
            </div>
          </div>

          {/* Claim Statement */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Factual Claim Statement
            </label>
            <textarea
              rows={3}
              placeholder="State the exact factual event. Example: 'Euler Finance was exploited for $197M via donateToReserves flash loan manipulation.'"
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              required
              className="w-full text-xs p-3 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald"
            />
          </div>

          {/* Public Evidence URLs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-emerald-950">
                Public Evidence URLs (Max 3)
              </label>
              {evidenceUrls.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="flex items-center gap-1 text-[11px] font-mono text-emerald-800 hover:underline font-medium"
                >
                  <Plus className="w-3 h-3 text-emerald" />
                  <span>Add URL</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-emerald-800/70 mb-2">
              Block explorer transactions, GitHub commits, official post-mortems, or audit reports.
            </p>

            <div className="flex flex-col gap-2">
              {evidenceUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
                    <input
                      type="url"
                      placeholder="https://etherscan.io/tx/... or https://github.com/..."
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald font-mono"
                    />
                  </div>
                  {evidenceUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(index)}
                      className="p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Staked Bond Input */}
          <div className="p-3.5 rounded-xl bg-whisper-base border border-emerald-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-950">
                  Staked Bond Amount
                </span>
                <p className="text-[11px] text-emerald-800/70">
                  Locked upon acceptance; permanently slashed if rejected.
                </p>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-emerald-900">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={bondAmount}
                  onChange={(e) => setBondAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1 text-right text-xs rounded border border-emerald-500/30 bg-whisper-card font-mono text-emerald-950"
                />
                <span>GEN</span>
              </div>
            </div>
          </div>

          {/* Submission Feedback or Button */}
          {isSubmitting ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center gap-2 text-center">
              <div className="w-6 h-6 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono font-medium text-emerald-900">
                {submissionStep}
              </p>
              <span className="text-[11px] text-emerald-800/80">
                Gasless execution sponsored via relayer. Please do not close this window.
              </span>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald hover:bg-emerald-600 text-obsidian-base font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>
                {authenticated
                  ? `Stake ${bondAmount} GEN & Adjudicate Claim`
                  : "Sign In with Email to Submit"}
              </span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
