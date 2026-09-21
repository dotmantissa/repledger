import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  X,
  Swords,
  Plus,
  Trash2,
  AlertTriangle,
  Coins,
  Link as LinkIcon,
  CheckCircle2,
  Flame,
} from "lucide-react";

export function ChallengeModal({ isOpen, onClose, claim, onChallengeSubmitted }) {
  const { authenticated, login, user } = usePrivy();

  const [rebuttalText, setRebuttalText] = useState("");
  const [counterEvidenceUrls, setCounterEvidenceUrls] = useState([""]);
  const [counterBond, setCounterBond] = useState(claim ? claim.bond_amount || 10 : 10);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !claim) return null;

  const handleAddUrl = () => {
    if (counterEvidenceUrls.length < 3) {
      setCounterEvidenceUrls([...counterEvidenceUrls, ""]);
    }
  };

  const handleUrlChange = (index, value) => {
    const updated = [...counterEvidenceUrls];
    updated[index] = value;
    setCounterEvidenceUrls(updated);
  };

  const handleRemoveUrl = (index) => {
    setCounterEvidenceUrls(counterEvidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authenticated) {
      login();
      return;
    }

    if (!rebuttalText.trim()) {
      setErrorMsg("Please provide your factual rebuttal explanation.");
      return;
    }

    const cleanUrls = counterEvidenceUrls
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    setIsSubmitting(true);
    setErrorMsg("");
    setStepMsg("Broadcasting challenge transaction to GenLayer Network...");

    try {
      const email =
        user?.email?.address ||
        user?.google?.email ||
        user?.apple?.email ||
        "verified_challenger";

      const res = await fetch(`/api/claims/${claim.claim_id || claim.id}/challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": email,
        },
        body: JSON.stringify({
          rebuttal_text: rebuttalText.trim(),
          counter_evidence_urls: cleanUrls,
          counter_bond: Number(counterBond),
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Server returned an invalid response");
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || "Challenge submission failed");
      }

      const txHash = data.txHash;
      setStepMsg(`Challenge broadcast: ${txHash.slice(0, 10)}... Polling consensus...`);

      // Poll challenge status
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          if (attempts === 2) {
            setStepMsg("Validators cross-examining rebuttal against counter-evidence...");
          } else if (attempts === 6) {
            setStepMsg("Adjudicating bond award / slash conditions...");
          }

          const pollRes = await fetch(`/api/challenges/status/${txHash}?claimId=${claim.claim_id || claim.id}`);
          if (pollRes.ok) {
            const statusData = await pollRes.json();
            if (statusData.finalized) {
              clearInterval(pollTimer);
              if (statusData.status === "FAILED") {
                setIsSubmitting(false);
                setErrorMsg(statusData.error || "Challenge rejected on-chain.");
              } else {
                setStepMsg("Consensus finalized! Record updated on-chain.");
                setTimeout(() => {
                  setIsSubmitting(false);
                  onChallengeSubmitted(statusData.updatedClaim);
                  onClose();
                }, 1400);
              }
            }
          }
        } catch (pollErr) {
          console.warn("Challenge poll note:", pollErr.message);
        }
      }, 2500);
    } catch (err) {
      console.error("Challenge error:", err);
      setErrorMsg(err.message || "Failed to challenge claim.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-xs">
      <div className="bg-whisper-card border border-amber-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-1 rounded-lg text-emerald-800/60 hover:text-emerald hover:bg-emerald-500/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-emerald-950">
            Challenge Accepted Claim
          </h2>
        </div>
        <p className="text-xs text-emerald-800/80 mb-4 leading-relaxed">
          Staked claims can be overturned with superior evidence. If your
          counter-evidence disproves this claim, the original claimant bond is
          awarded to you. If your challenge is rejected, your counter-bond is slashed.
        </p>

        {/* Original Claim Card Preview */}
        <div className="mb-4 p-3.5 rounded-xl bg-whisper-base border border-emerald-500/20 text-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-emerald-700/80 font-mono text-[11px]">
            <span>CHALLENGING RECORD #{claim.claim_id || claim.id}</span>
            <span>Target: {claim.entity}</span>
          </div>
          <p className="font-medium text-emerald-950 font-sans leading-relaxed">
            "{claim.claim_text}"
          </p>
          <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-amber-700 font-bold">
            <Coins className="w-3.5 h-3.5" />
            <span>Target Claimant Bond: {claim.bond_amount} GEN</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Rebuttal Statement */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Factual Rebuttal Explanation
            </label>
            <textarea
              rows={3}
              placeholder="Explain why this claim is incorrect, debunked, or superseded. Example: 'The paused bridge was part of an officially announced planned upgrade, not an exploit. Funds were completely safe and withdrawals resumed.'"
              value={rebuttalText}
              onChange={(e) => setRebuttalText(e.target.value)}
              required
              className="w-full text-xs p-3 rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Counter-evidence URLs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-emerald-950">
                Counter-Evidence URLs (Max 3)
              </label>
              {counterEvidenceUrls.length < 3 && (
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
              Official announcement, post-mortem retraction, whitehat bug bounty receipt, or blockchain proof.
            </p>

            <div className="flex flex-col gap-2">
              {counterEvidenceUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60" />
                    <input
                      type="url"
                      placeholder="https://officialannouncement.org/... or https://etherscan.io/..."
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-emerald-500/20 bg-whisper-base text-emerald-950 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  {counterEvidenceUrls.length > 1 && (
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

          {/* Counter Bond */}
          <div className="p-3.5 rounded-xl bg-whisper-base border border-amber-500/30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-950">
                  Counter-Bond Stake
                </span>
                <p className="text-[11px] text-emerald-800/70">
                  Must be at least {claim.bond_amount} GEN to challenge this claim.
                </p>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-700">
                <input
                  type="number"
                  min={claim.bond_amount || 1}
                  value={counterBond}
                  onChange={(e) =>
                    setCounterBond(Math.max(claim.bond_amount || 1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-16 px-2 py-1 text-right text-xs rounded border border-amber-500/30 bg-whisper-card font-mono text-emerald-950"
                />
                <span>GEN</span>
              </div>
            </div>
          </div>

          {/* Submission Status or Button */}
          {isSubmitting ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center gap-2 text-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono font-medium text-amber-700">
                {stepMsg}
              </p>
              <span className="text-[11px] text-emerald-800/80">
                Gasless challenge adjudication. Please keep this window open.
              </span>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-obsidian-base font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              <span>
                {authenticated
                  ? `Stake ${counterBond} GEN & Submit Challenge`
                  : "Sign In with Email to Challenge"}
              </span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
