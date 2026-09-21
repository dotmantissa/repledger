# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import re


class RepLedger(gl.Contract):
    """
    REP | Ledger: On-Chain Immutable Consensus-Adjudicated Reputation Protocol.

    A write-once, append-only ledger of verified claims about entities (wallets, protocols, agents, contracts).
    Claims are submitted with bonded stakes and public evidence links.
    GenLayer validators fetch the evidence and adjudicate whether the claim is factually supported.
    Accepted claims are permanently written to the entity's ledger record.
    Rejected claims slash the claimant's stake.
    Accepted claims can be challenged with counter-evidence; successful challenges override the claim
    and transfer the original claimant's bond to the challenger.
    """

    owner: Address
    claims: TreeMap[str, str]
    claim_ids: DynArray[str]
    entity_claims: TreeMap[str, str]
    entity_list: DynArray[str]
    claimant_bonds: TreeMap[str, u256]
    total_claims_count: u256
    total_accepted_count: u256
    total_rejected_count: u256
    total_overridden_count: u256
    total_slashed_bonds: u256
    min_bond_amount: u256

    VALID_ENTITY_TYPES = ("protocol", "wallet", "agent", "contract")
    VALID_CATEGORIES = (
        "exploit",
        "rugpull",
        "bad_debt",
        "high_quality_work",
        "audit_passed",
        "governance_compromise",
        "general_reputation",
    )
    VALID_SENTIMENTS = ("positive", "negative")

    def __init__(self):
        self.owner = gl.message.sender_address
        self.total_claims_count = u256(0)
        self.total_accepted_count = u256(0)
        self.total_rejected_count = u256(0)
        self.total_overridden_count = u256(0)
        self.total_slashed_bonds = u256(0)
        self.min_bond_amount = u256(1)

    # ─────────────────────────────────────────────────────────────────────────────
    # Public View Methods
    # ─────────────────────────────────────────────────────────────────────────────

    @gl.public.view
    def get_owner(self) -> Address:
        return self.owner

    @gl.public.view
    def get_ledger_stats(self) -> str:
        """
        Return comprehensive aggregate telemetry of the RepLedger protocol.
        """
        return json.dumps({
            "total_claims": int(self.total_claims_count),
            "total_accepted": int(self.total_accepted_count),
            "total_rejected": int(self.total_rejected_count),
            "total_overridden": int(self.total_overridden_count),
            "total_slashed_bonds": int(self.total_slashed_bonds),
            "unique_entities_count": len(self.entity_list),
            "min_bond_amount": int(self.min_bond_amount),
            "owner": str(self.owner),
        })

    @gl.public.view
    def get_all_claim_ids(self) -> DynArray[str]:
        return self.claim_ids

    @gl.public.view
    def get_all_entities(self) -> DynArray[str]:
        return self.entity_list

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        """
        Return a single claim record by ID.
        """
        cid = str(claim_id).strip()
        if cid not in self.claims:
            return json.dumps({
                "found": False,
                "id": cid,
                "error": "Claim not found in registry",
            })
        return self.claims[cid]

    @gl.public.view
    def get_entity_claims(self, entity: str) -> str:
        """
        Return all claim IDs associated with a specific entity.
        """
        key = self._normalize_entity(entity)
        if key not in self.entity_claims:
            return json.dumps([])
        return self.entity_claims[key]

    @gl.public.view
    def get_entity_score(self, entity: str) -> str:
        """
        Composable Trust and Risk Evaluation Primitive.
        Any external contract (prediction market, lending market, agent router)
        can call this view to evaluate an entity's standing based strictly on
        consensus-verified claims.
        """
        key = self._normalize_entity(entity)
        if key not in self.entity_claims:
            return json.dumps({
                "entity": key,
                "found": False,
                "score": 50,
                "grade": "NEUTRAL",
                "total_claims": 0,
                "accepted_positive": 0,
                "accepted_negative": 0,
                "overridden": 0,
                "is_exploit_flagged": False,
                "status": "UNASSESSED",
            })

        cids_json = self.entity_claims[key]
        try:
            cids = json.loads(cids_json)
        except Exception:
            cids = []

        total_claims = len(cids)
        accepted_pos = 0
        accepted_neg = 0
        overridden_count = 0
        has_exploit_or_rug = False

        score = 50

        for cid in cids:
            if cid in self.claims:
                try:
                    c_data = json.loads(self.claims[cid])
                    status = c_data.get("status", "")
                    sentiment = c_data.get("sentiment", "")
                    category = c_data.get("category", "")

                    if status == "ACCEPTED":
                        if sentiment == "positive":
                            accepted_pos += 1
                            score += 15
                        else:
                            accepted_neg += 1
                            if category in ("exploit", "rugpull"):
                                score -= 35
                                has_exploit_or_rug = True
                            elif category in ("bad_debt", "governance_compromise"):
                                score -= 25
                            else:
                                score -= 15
                    elif status == "OVERRIDDEN":
                        overridden_count += 1
                except Exception:
                    continue

        if score < 0:
            score = 0
        if score > 100:
            score = 100

        grade = self._calculate_grade(score, has_exploit_or_rug)
        status_label = "TRUSTED"
        if has_exploit_or_rug:
            status_label = "EXPLOIT_FLAGGED"
        elif score < 40:
            status_label = "HIGH_RISK"
        elif score >= 75:
            status_label = "EXEMPLARY"

        return json.dumps({
            "entity": key,
            "found": True,
            "score": score,
            "grade": grade,
            "total_claims": total_claims,
            "accepted_positive": accepted_pos,
            "accepted_negative": accepted_neg,
            "overridden": overridden_count,
            "is_exploit_flagged": has_exploit_or_rug,
            "status": status_label,
        })

    @gl.public.view
    def is_flagged(self, entity: str, flag_category: str) -> bool:
        """
        Fast Boolean Trust Filter for Smart Contracts.
        Prediction markets and lending protocols can query whether an entity is flagged
        for specific malicious activities (e.g. 'exploit', 'rugpull', 'bad_debt', or 'ANY').
        """
        key = self._normalize_entity(entity)
        target_cat = str(flag_category).strip().lower()

        if key not in self.entity_claims:
            return False

        try:
            cids = json.loads(self.entity_claims[key])
        except Exception:
            return False

        for cid in cids:
            if cid in self.claims:
                try:
                    c_data = json.loads(self.claims[cid])
                    if c_data.get("status") == "ACCEPTED":
                        c_cat = str(c_data.get("category", "")).lower()
                        c_sent = str(c_data.get("sentiment", "")).lower()
                        if target_cat == "any" and c_sent == "negative":
                            return True
                        if target_cat == c_cat:
                            return True
                except Exception:
                    continue

        return False

    @gl.public.view
    def get_recent_claims(self, limit: int) -> str:
        """
        Return the most recent claims as a JSON list.
        """
        max_items = max(1, min(limit, 50))
        total = len(self.claim_ids)
        start_idx = max(0, total - max_items)
        items = []
        for i in range(total - 1, start_idx - 1, -1):
            cid = self.claim_ids[i]
            if cid in self.claims:
                try:
                    items.append(json.loads(self.claims[cid]))
                except Exception:
                    continue
        return json.dumps(items)

    # ─────────────────────────────────────────────────────────────────────────────
    # Public Write Methods (State Mutations & Consensus Adjudications)
    # ─────────────────────────────────────────────────────────────────────────────

    @gl.public.write
    def submit_claim(
        self,
        entity: str,
        entity_type: str,
        claim_text: str,
        evidence_urls_json: str,
        bond_amount: int,
        category: str,
        sentiment: str,
    ) -> str:
        """
        Submit a new claim about any entity with a staked bond and evidence URLs.
        GenLayer validators independently fetch the evidence URLs, parse the content,
        and reach consensus on whether the evidence substantiates the claim.

        If ACCEPTED: Claim is permanently written to the entity's ledger record.
        If REJECTED: The claimant's bond is slashed.
        """
        norm_entity = self._normalize_entity(entity)
        clean_type = str(entity_type).strip().lower()
        clean_claim = str(claim_text).strip()
        clean_cat = str(category).strip().lower()
        clean_sent = str(sentiment).strip().lower()

        if not norm_entity:
            raise gl.vm.UserError("[EXPECTED] Target entity cannot be empty")
        if not clean_claim:
            raise gl.vm.UserError("[EXPECTED] Claim text cannot be empty")
        if clean_type not in self.VALID_ENTITY_TYPES:
            clean_type = "contract"
        if clean_cat not in self.VALID_CATEGORIES:
            clean_cat = "general_reputation"
        if clean_sent not in self.VALID_SENTIMENTS:
            clean_sent = "negative"

        bond = int(bond_amount)
        if bond < int(self.min_bond_amount):
            raise gl.vm.UserError("[EXPECTED] Bond amount is below minimum requirement")

        sender = str(gl.message.sender_address)

        # Parse evidence URLs safely
        urls = []
        try:
            parsed_urls = json.loads(evidence_urls_json)
            if isinstance(parsed_urls, list):
                for u in parsed_urls[:3]:
                    if isinstance(u, str) and u.startswith("http"):
                        urls.append(u.strip())
        except Exception:
            pass

        # Non-deterministic consensus adjudication
        def adjudicate_evidence() -> str:
            retrieved_sources = []
            for url in urls:
                try:
                    res = gl.nondet.web.get(url)
                    body_text = ""
                    if hasattr(res, "body"):
                        if isinstance(res.body, bytes):
                            body_text = res.body.decode("utf-8", errors="ignore")
                        else:
                            body_text = str(res.body)
                    # Strip tags and truncate to 2500 chars to keep context clean
                    clean_text = re.sub(r"<[^>]+>", " ", body_text)
                    clean_text = re.sub(r"\s+", " ", clean_text).strip()[:2500]
                    retrieved_sources.append({
                        "url": url,
                        "status": getattr(res, "status", 200),
                        "snippet": clean_text if clean_text else "Empty response from evidence source",
                    })
                except Exception as err:
                    retrieved_sources.append({
                        "url": url,
                        "status": 500,
                        "snippet": f"Evidence fetch failed: {str(err)}",
                    })

            sources_summary = "\n".join([
                f"- Source: {s['url']}\n  Content: {s['snippet']}"
                for s in retrieved_sources
            ])

            adjudication_prompt = f"""
You are an impartial on-chain consensus validator for REP | Ledger.
Evaluate whether the evidence provided substantiates the claim.

TARGET ENTITY: {norm_entity} (Type: {clean_type})
CLAIM: {clean_claim}
CATEGORY: {clean_cat}
INTENDED SENTIMENT: {clean_sent}

SUBMITTED EVIDENCE SOURCES:
{sources_summary if retrieved_sources else "No valid evidence URLs retrieved."}

CRITICAL ADJUDICATION RULES:
1. If the retrieved evidence clearly documents, proves, or confirms the claim about the entity:
   - Return verdict 'ACCEPTED' and is_supported true.
2. If evidence is absent, completely unrelated, speculative, refutes the claim, or fails to link the target entity:
   - Return verdict 'REJECTED' and is_supported false.
3. If the claim text is a well-known verifiable public fact in Web3 or security post-mortems and the evidence aligns:
   - Return verdict 'ACCEPTED' and is_supported true.

Respond in pure JSON:
{{
  "verdict": "ACCEPTED" or "REJECTED",
  "is_supported": true or false,
  "confidence_score": integer between 0 and 100,
  "consensus_summary": "Concise factual reason for the consensus decision",
  "key_findings": ["Key finding 1", "Key finding 2"]
}}
"""

            try:
                adjudication = gl.nondet.exec_prompt(adjudication_prompt, response_format="json")
                if not isinstance(adjudication, dict):
                    adjudication = {}
            except Exception:
                adjudication = {
                    "verdict": "REJECTED",
                    "is_supported": False,
                    "confidence_score": 0,
                    "consensus_summary": "Consensus prompt evaluation failed to return structured result",
                    "key_findings": ["Evaluation timeout or syntax error"],
                }

            raw_verdict = str(adjudication.get("verdict", "REJECTED")).strip().upper()
            if raw_verdict != "ACCEPTED":
                raw_verdict = "REJECTED"

            is_supported = bool(adjudication.get("is_supported", False))
            if raw_verdict == "ACCEPTED":
                is_supported = True

            conf = adjudication.get("confidence_score", 75)
            try:
                conf = int(conf)
            except Exception:
                conf = 75

            summary = str(adjudication.get("consensus_summary", "")).strip()
            findings = adjudication.get("key_findings", [])
            if not isinstance(findings, list):
                findings = [str(findings)]

            result_obj = {
                "verdict": raw_verdict,
                "is_supported": is_supported,
                "confidence_score": max(0, min(100, conf)),
                "consensus_summary": summary if summary else f"Evidence adjudicated with verdict: {raw_verdict}",
                "key_findings": findings[:4],
                "evidence_sources_checked": len(retrieved_sources),
            }
            return json.dumps(result_obj, sort_keys=True)

        # Multi-validator consensus equivalence principle
        consensus_output_str = gl.eq_principle.prompt_comparative(
            adjudicate_evidence,
            """
            Validators must strictly agree on:
            1. 'verdict': MUST match ("ACCEPTED" or "REJECTED").
            2. 'is_supported': MUST match (true or false).
            Minor differences in phrasing for 'consensus_summary' or 'key_findings' are acceptable as long as the factual conclusion matches.
            When within consensus, choose the output with the highest confidence score and clearest factual findings.
            """,
        )

        try:
            consensus_data = json.loads(consensus_output_str)
        except Exception:
            raise gl.vm.UserError("[EXPECTED] Validator consensus output was invalid JSON")

        verdict = str(consensus_data.get("verdict", "REJECTED")).upper()
        if verdict != "ACCEPTED":
            verdict = "REJECTED"

        new_total = int(self.total_claims_count) + 1
        self.total_claims_count = u256(new_total)
        claim_id = f"claim_{new_total}"

        if verdict == "ACCEPTED":
            status = "ACCEPTED"
            self.total_accepted_count = u256(int(self.total_accepted_count) + 1)
            self.claimant_bonds[claim_id] = u256(bond)
            slashed = False
        else:
            status = "REJECTED"
            self.total_rejected_count = u256(int(self.total_rejected_count) + 1)
            self.total_slashed_bonds = u256(int(self.total_slashed_bonds) + bond)
            self.claimant_bonds[claim_id] = u256(0)
            slashed = True

        claim_record = {
            "id": claim_id,
            "entity": norm_entity,
            "entity_type": clean_type,
            "claim_text": clean_claim,
            "evidence_urls": urls,
            "claimant": sender,
            "bond_amount": bond,
            "category": clean_cat,
            "sentiment": clean_sent,
            "verdict": verdict,
            "status": status,
            "is_slashed": slashed,
            "confidence_score": consensus_data.get("confidence_score", 80),
            "consensus_summary": consensus_data.get("consensus_summary", ""),
            "key_findings": consensus_data.get("key_findings", []),
            "evidence_sources_checked": consensus_data.get("evidence_sources_checked", len(urls)),
            "challenges": [],
        }

        record_str = json.dumps(claim_record, sort_keys=True)
        self.claims[claim_id] = record_str
        self.claim_ids.append(claim_id)

        # Update entity claims index
        if norm_entity not in self.entity_claims:
            self.entity_list.append(norm_entity)
            entity_cids = [claim_id]
        else:
            try:
                entity_cids = json.loads(self.entity_claims[norm_entity])
                if not isinstance(entity_cids, list):
                    entity_cids = []
            except Exception:
                entity_cids = []
            entity_cids.append(claim_id)

        self.entity_claims[norm_entity] = json.dumps(entity_cids)
        return record_str

    @gl.public.write
    def challenge_claim(
        self,
        claim_id: str,
        rebuttal_text: str,
        counter_evidence_urls_json: str,
        counter_bond: int,
    ) -> str:
        """
        Challenge an already-accepted claim with counter-evidence.
        If counter-evidence disproves or supersedes the claim:
        - Claim status changes to OVERRIDDEN.
        - Original claimant's bond is transferred/credited to the challenger.
        - Counter-bond is returned.
        If challenge fails:
        - Counter-bond is slashed.
        """
        cid = str(claim_id).strip()
        if cid not in self.claims:
            raise gl.vm.UserError("[EXPECTED] Claim does not exist")

        clean_rebuttal = str(rebuttal_text).strip()
        if not clean_rebuttal:
            raise gl.vm.UserError("[EXPECTED] Rebuttal explanation cannot be empty")

        try:
            claim_data = json.loads(self.claims[cid])
        except Exception:
            raise gl.vm.UserError("[EXPECTED] Existing claim data is corrupted")

        if claim_data.get("status") != "ACCEPTED":
            raise gl.vm.UserError("[EXPECTED] Only currently ACCEPTED claims can be challenged")

        original_bond = int(self.claimant_bonds[cid])
        cbond = int(counter_bond)
        if cbond < original_bond:
            raise gl.vm.UserError(f"[EXPECTED] Counter-bond must be at least the original bond of {original_bond}")

        challenger = str(gl.message.sender_address)

        # Parse counter evidence URLs
        counter_urls = []
        try:
            parsed = json.loads(counter_evidence_urls_json)
            if isinstance(parsed, list):
                for u in parsed[:3]:
                    if isinstance(u, str) and u.startswith("http"):
                        counter_urls.append(u.strip())
        except Exception:
            pass

        # Non-deterministic consensus adjudication for challenge
        def adjudicate_challenge() -> str:
            retrieved_sources = []
            for url in counter_urls:
                try:
                    res = gl.nondet.web.get(url)
                    body_text = ""
                    if hasattr(res, "body"):
                        if isinstance(res.body, bytes):
                            body_text = res.body.decode("utf-8", errors="ignore")
                        else:
                            body_text = str(res.body)
                    clean_text = re.sub(r"<[^>]+>", " ", body_text)
                    clean_text = re.sub(r"\s+", " ", clean_text).strip()[:2500]
                    retrieved_sources.append({
                        "url": url,
                        "status": getattr(res, "status", 200),
                        "snippet": clean_text if clean_text else "Empty response from counter evidence",
                    })
                except Exception as err:
                    retrieved_sources.append({
                        "url": url,
                        "status": 500,
                        "snippet": f"Counter evidence fetch failed: {str(err)}",
                    })

            sources_summary = "\n".join([
                f"- Source: {s['url']}\n  Content: {s['snippet']}"
                for s in retrieved_sources
            ])

            challenge_prompt = f"""
You are an impartial on-chain consensus validator for REP | Ledger.
A challenger is attempting to OVERTURN an accepted claim with counter-evidence.

TARGET ENTITY: {claim_data.get('entity')}
ORIGINAL ACCEPTED CLAIM: {claim_data.get('claim_text')}
ORIGINAL SUMMARY: {claim_data.get('consensus_summary')}

CHALLENGER REBUTTAL:
{clean_rebuttal}

CHALLENGER COUNTER-EVIDENCE SOURCES:
{sources_summary if retrieved_sources else "No valid counter evidence URLs retrieved."}

RULES:
1. If the counter-evidence definitively disproves, overturns, or invalidates the original claim (e.g. proof of mistaken identity, bug bounty whitehat return, exoneration, retracted report):
   - Return verdict 'OVERRIDDEN', challenge_successful true.
2. If counter-evidence is weak, irrelevant, or fails to debunk the original verified claim:
   - Return verdict 'UPHELD', challenge_successful false.

Respond in pure JSON:
{{
  "verdict": "OVERRIDDEN" or "UPHELD",
  "challenge_successful": true or false,
  "confidence_score": integer between 0 and 100,
  "reasoning": "Clear explanation of why the challenge succeeded or failed"
}}
"""

            try:
                adj = gl.nondet.exec_prompt(challenge_prompt, response_format="json")
                if not isinstance(adj, dict):
                    adj = {}
            except Exception:
                adj = {
                    "verdict": "UPHELD",
                    "challenge_successful": False,
                    "confidence_score": 0,
                    "reasoning": "Challenge adjudication failed to parse",
                }

            raw_v = str(adj.get("verdict", "UPHELD")).strip().upper()
            if raw_v != "OVERRIDDEN":
                raw_v = "UPHELD"

            success = bool(adj.get("challenge_successful", False))
            if raw_v == "OVERRIDDEN":
                success = True

            conf = adj.get("confidence_score", 75)
            try:
                conf = int(conf)
            except Exception:
                conf = 75

            return json.dumps({
                "verdict": raw_v,
                "challenge_successful": success,
                "confidence_score": max(0, min(100, conf)),
                "reasoning": str(adj.get("reasoning", "")).strip(),
            }, sort_keys=True)

        consensus_challenge_str = gl.eq_principle.prompt_comparative(
            adjudicate_challenge,
            """
            Validators must strictly agree on:
            1. 'verdict': MUST match ("OVERRIDDEN" or "UPHELD").
            2. 'challenge_successful': MUST match (true or false).
            Minor phrasing differences in 'reasoning' are tolerated.
            """,
        )

        try:
            challenge_result = json.loads(consensus_challenge_str)
        except Exception:
            raise gl.vm.UserError("[EXPECTED] Consensus challenge output was invalid JSON")

        verdict = str(challenge_result.get("verdict", "UPHELD")).upper()
        if verdict != "OVERRIDDEN":
            verdict = "UPHELD"

        challenge_entry = {
            "challenger": challenger,
            "rebuttal": clean_rebuttal,
            "counter_evidence_urls": counter_urls,
            "counter_bond": cbond,
            "verdict": verdict,
            "confidence_score": challenge_result.get("confidence_score", 80),
            "reasoning": challenge_result.get("reasoning", ""),
        }

        if "challenges" not in claim_data or not isinstance(claim_data["challenges"], list):
            claim_data["challenges"] = []
        claim_data["challenges"].append(challenge_entry)

        if verdict == "OVERRIDDEN":
            claim_data["status"] = "OVERRIDDEN"
            self.total_overridden_count = u256(int(self.total_overridden_count) + 1)
            # Original claimant bond transferred to challenger
            awarded_bond = original_bond
            self.claimant_bonds[cid] = u256(0)
            challenge_entry["bond_awarded_to_challenger"] = awarded_bond
            outcome_msg = f"Challenge succeeded. Claim overridden. Bond of {awarded_bond} transferred to challenger."
        else:
            # Challenger slashed
            self.total_slashed_bonds = u256(int(self.total_slashed_bonds) + cbond)
            challenge_entry["bond_awarded_to_challenger"] = 0
            outcome_msg = f"Challenge rejected. Claim upheld. Counter-bond of {cbond} slashed."

        claim_data["latest_challenge_verdict"] = verdict
        updated_str = json.dumps(claim_data, sort_keys=True)
        self.claims[cid] = updated_str

        return json.dumps({
            "claim_id": cid,
            "verdict": verdict,
            "challenge_successful": (verdict == "OVERRIDDEN"),
            "message": outcome_msg,
            "reasoning": challenge_result.get("reasoning", ""),
        })

    # ─────────────────────────────────────────────────────────────────────────────
    # Internal Helpers
    # ─────────────────────────────────────────────────────────────────────────────

    def _normalize_entity(self, entity: str) -> str:
        s = str(entity).strip().lower()
        s = re.sub(r"\s+", "_", s)
        return s

    def _calculate_grade(self, score: int, has_exploit: bool) -> str:
        if has_exploit:
            return "EXPLOIT_FLAG"
        if score >= 90:
            return "AAA"
        if score >= 80:
            return "AA"
        if score >= 70:
            return "A"
        if score >= 60:
            return "BBB"
        if score >= 50:
            return "BB"
        if score >= 40:
            return "B"
        if score >= 25:
            return "CCC"
        return "D"
