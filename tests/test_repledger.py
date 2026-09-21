import json
import pytest
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class MockSender:
    def __init__(self, address="0xbc1399c55538ec034d4da550c03c34ae0c357f53"):
        self.sender_account = address
        self.sender_address = address


import types

_mod = types.ModuleType("genlayer")
mock_gl = MagicMock()
mock_gl.message = MockSender()
mock_gl.Contract = object
mock_gl.public.view = lambda f: f
mock_gl.public.write = lambda f: f
mock_gl.vm.UserError = ValueError


# Realistic Prompt Comparative Mock
def mock_prompt_comparative(fn, principle=""):
    return fn()


mock_gl.eq_principle.prompt_comparative = mock_prompt_comparative

_mod.gl = mock_gl
_mod.Address = str
_mod.TreeMap = dict
_mod.DynArray = list
_mod.u256 = int
_mod.__all__ = ["gl", "Address", "TreeMap", "DynArray", "u256"]

sys.modules["genlayer"] = _mod
from contracts import repledger


def create_test_contract(owner="0xbc1399c55538ec034d4da550c03c34ae0c357f53"):
    """Instantiate a test RepLedger contract."""
    mock_gl.message = MockSender(owner)
    contract = repledger.RepLedger()
    contract.owner = owner
    contract.claims = {}
    contract.claim_ids = []
    contract.entity_claims = {}
    contract.entity_list = []
    contract.claimant_bonds = {}
    contract.total_claims_count = 0
    contract.total_accepted_count = 0
    contract.total_rejected_count = 0
    contract.total_overridden_count = 0
    contract.total_slashed_bonds = 0
    contract.min_bond_amount = 1
    return contract


def test_initial_state():
    contract = create_test_contract()
    assert contract.get_owner() == "0xbc1399c55538ec034d4da550c03c34ae0c357f53"
    assert contract.get_all_claim_ids() == []
    assert contract.get_all_entities() == []

    stats = json.loads(contract.get_ledger_stats())
    assert stats["total_claims"] == 0
    assert stats["total_accepted"] == 0
    assert stats["total_rejected"] == 0
    assert stats["total_slashed_bonds"] == 0


def test_input_validation():
    contract = create_test_contract()

    # Empty entity
    with pytest.raises(ValueError, match="Target entity cannot be empty"):
        contract.submit_claim(
            entity="",
            entity_type="protocol",
            claim_text="Valid claim",
            evidence_urls_json="[]",
            bond_amount=10,
            category="exploit",
            sentiment="negative",
        )

    # Empty claim text
    with pytest.raises(ValueError, match="Claim text cannot be empty"):
        contract.submit_claim(
            entity="euler_finance",
            entity_type="protocol",
            claim_text="",
            evidence_urls_json="[]",
            bond_amount=10,
            category="exploit",
            sentiment="negative",
        )

    # Below minimum bond
    with pytest.raises(ValueError, match="Bond amount is below minimum"):
        contract.submit_claim(
            entity="euler_finance",
            entity_type="protocol",
            claim_text="Exploited for $197M",
            evidence_urls_json="[]",
            bond_amount=0,
            category="exploit",
            sentiment="negative",
        )


def test_submit_accepted_claim():
    contract = create_test_contract("0x1111111111111111111111111111111111111111")

    # Mock web & LLM
    mock_gl.nondet.web.get.return_value = MagicMock(
        body=b"<html>Euler Finance was exploited for $197M on March 13 2023 via donateToReserves flash loan.</html>",
        status=200,
    )
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 98,
        "consensus_summary": "Euler Finance donateToReserves exploit verified with $197M loss.",
        "key_findings": ["Euler Finance suffered flash loan attack", "Evidence source confirms $197M lost"],
    }

    claim_res_str = contract.submit_claim(
        entity="euler_finance",
        entity_type="protocol",
        claim_text="Euler Finance was drained for $197M in a flash loan exploit",
        evidence_urls_json=json.dumps(["https://etherscan.io/tx/0xabc"]),
        bond_amount=50,
        category="exploit",
        sentiment="negative",
    )

    claim = json.loads(claim_res_str)
    assert claim["id"] == "claim_1"
    assert claim["entity"] == "euler_finance"
    assert claim["verdict"] == "ACCEPTED"
    assert claim["status"] == "ACCEPTED"
    assert claim["is_slashed"] is False
    assert claim["bond_amount"] == 50
    assert claim["confidence_score"] == 98
    assert contract.total_accepted_count == 1
    assert contract.total_rejected_count == 0
    assert contract.total_slashed_bonds == 0
    assert contract.claimant_bonds["claim_1"] == 50

    # Verify queryable views
    assert "euler_finance" in contract.get_all_entities()
    assert "claim_1" in contract.get_all_claim_ids()
    assert contract.is_flagged("euler_finance", "exploit") is True
    assert contract.is_flagged("euler_finance", "rugpull") is False
    assert contract.is_flagged("euler_finance", "ANY") is True


def test_submit_rejected_claim_slashes_bond():
    contract = create_test_contract("0x2222222222222222222222222222222222222222")

    mock_gl.nondet.web.get.return_value = MagicMock(
        body=b"<html>This is a 404 page not found. Nothing about rug pulls.</html>",
        status=404,
    )
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "REJECTED",
        "is_supported": False,
        "confidence_score": 15,
        "consensus_summary": "No evidence supporting claim; source 404 not found.",
        "key_findings": ["Evidence URL invalid"],
    }

    claim_res_str = contract.submit_claim(
        entity="vitalik.eth",
        entity_type="wallet",
        claim_text="This wallet rugged a meme coin project",
        evidence_urls_json=json.dumps(["https://fake-scam-site.com"]),
        bond_amount=100,
        category="rugpull",
        sentiment="negative",
    )

    claim = json.loads(claim_res_str)
    assert claim["id"] == "claim_1"
    assert claim["verdict"] == "REJECTED"
    assert claim["status"] == "REJECTED"
    assert claim["is_slashed"] is True
    assert contract.total_rejected_count == 1
    assert contract.total_slashed_bonds == 100
    assert contract.claimant_bonds["claim_1"] == 0

    # Entity score should not be penalized by a REJECTED claim!
    score_data = json.loads(contract.get_entity_score("vitalik.eth"))
    assert score_data["score"] == 50
    assert score_data["is_exploit_flagged"] is False


def test_trust_score_calculation():
    contract = create_test_contract()

    # Add positive claim
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 95,
        "consensus_summary": "Security audit passed with zero critical vulnerabilities.",
        "key_findings": ["All high severity issues resolved"],
    }
    contract.submit_claim(
        entity="aave_v3",
        entity_type="protocol",
        claim_text="Aave V3 completed comprehensive OpenZeppelin audit",
        evidence_urls_json="[]",
        bond_amount=25,
        category="audit_passed",
        sentiment="positive",
    )

    score_data = json.loads(contract.get_entity_score("aave_v3"))
    assert score_data["score"] == 65  # 50 base + 15
    assert score_data["accepted_positive"] == 1
    assert score_data["grade"] == "BBB"

    # Add another positive claim (high quality work)
    contract.submit_claim(
        entity="aave_v3",
        entity_type="protocol",
        claim_text="Delivered seamless cross-chain liquidity deployment",
        evidence_urls_json="[]",
        bond_amount=25,
        category="high_quality_work",
        sentiment="positive",
    )
    score_data2 = json.loads(contract.get_entity_score("aave_v3"))
    assert score_data2["score"] == 80  # 65 + 15
    assert score_data2["grade"] == "AA"


def test_challenge_success_overrides_claim_and_transfers_bond():
    contract = create_test_contract("0xclaimant")

    # Step 1: Submit accepted claim
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 90,
        "consensus_summary": "Initial report indicated funds were stuck.",
        "key_findings": ["Report published"],
    }
    contract.submit_claim(
        entity="starkgate_bridge",
        entity_type="contract",
        claim_text="Starkgate Bridge contract frozen, preventing withdrawals",
        evidence_urls_json="[]",
        bond_amount=40,
        category="exploit",
        sentiment="negative",
    )
    assert contract.total_accepted_count == 1
    assert contract.claimant_bonds["claim_1"] == 40
    assert contract.is_flagged("starkgate_bridge", "exploit") is True

    # Step 2: Challenge with counter-evidence (planned maintenance proved)
    mock_gl.message = MockSender("0xchallenger")
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "OVERRIDDEN",
        "challenge_successful": True,
        "confidence_score": 99,
        "reasoning": "Official Starkware notice and on-chain upgrades prove this was a scheduled 2-hour upgrade, not an exploit. Withdrawals resumed.",
    }

    chal_res_str = contract.challenge_claim(
        claim_id="claim_1",
        rebuttal_text="Withdrawals were paused for a planned bridge upgrade, not an exploit. Proof in announcement.",
        counter_evidence_urls_json=json.dumps(["https://starkware.co/blog/upgrade"]),
        counter_bond=40,
    )

    chal_res = json.loads(chal_res_str)
    assert chal_res["verdict"] == "OVERRIDDEN"
    assert chal_res["challenge_successful"] is True
    assert "transferred to challenger" in chal_res["message"]

    # Verify claim state
    updated_claim = json.loads(contract.get_claim("claim_1"))
    assert updated_claim["status"] == "OVERRIDDEN"
    assert contract.total_overridden_count == 1
    assert contract.claimant_bonds["claim_1"] == 0

    # Verify that Starkgate is NO LONGER flagged as exploit!
    assert contract.is_flagged("starkgate_bridge", "exploit") is False


def test_challenge_failed_slashes_challenger_counter_bond():
    contract = create_test_contract("0xclaimant")

    # Step 1: Submit accepted exploit claim
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 95,
        "consensus_summary": "Exploit confirmed by security team.",
        "key_findings": ["Confirmed"],
    }
    contract.submit_claim(
        entity="bad_protocol",
        entity_type="protocol",
        claim_text="Bad Protocol lost all user funds in reentrancy attack",
        evidence_urls_json="[]",
        bond_amount=30,
        category="exploit",
        sentiment="negative",
    )

    # Step 2: Spurious challenge
    mock_gl.message = MockSender("0xfakechallenger")
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "UPHELD",
        "challenge_successful": False,
        "confidence_score": 92,
        "reasoning": "Challenger provided no credible counter-evidence. Exploit remains undisputed.",
    }

    chal_res_str = contract.challenge_claim(
        claim_id="claim_1",
        rebuttal_text="No guys trust me it was just a test transaction",
        counter_evidence_urls_json="[]",
        counter_bond=30,
    )

    chal_res = json.loads(chal_res_str)
    assert chal_res["verdict"] == "UPHELD"
    assert chal_res["challenge_successful"] is False
    assert "slashed" in chal_res["message"]

    # Challenger's counter-bond of 30 was slashed!
    assert contract.total_slashed_bonds == 30
    # Original claim remains ACCEPTED
    updated_claim = json.loads(contract.get_claim("claim_1"))
    assert updated_claim["status"] == "ACCEPTED"


def test_challenge_validation_checks():
    contract = create_test_contract()

    # Non-existent claim
    with pytest.raises(ValueError, match="Claim does not exist"):
        contract.challenge_claim(
            claim_id="claim_999",
            rebuttal_text="Rebuttal",
            counter_evidence_urls_json="[]",
            counter_bond=10,
        )

    # Submit a rejected claim first
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "REJECTED",
        "is_supported": False,
        "confidence_score": 0,
        "consensus_summary": "Rejected",
        "key_findings": [],
    }
    contract.submit_claim(
        entity="foo",
        entity_type="protocol",
        claim_text="Fake claim",
        evidence_urls_json="[]",
        bond_amount=20,
        category="exploit",
        sentiment="negative",
    )

    # Cannot challenge a REJECTED claim
    with pytest.raises(ValueError, match="Only currently ACCEPTED claims can be challenged"):
        contract.challenge_claim(
            claim_id="claim_1",
            rebuttal_text="Rebuttal",
            counter_evidence_urls_json="[]",
            counter_bond=20,
        )


def test_recent_claims_pagination():
    contract = create_test_contract()
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 90,
        "consensus_summary": "Claim verified",
        "key_findings": [],
    }

    for i in range(5):
        contract.submit_claim(
            entity=f"entity_{i}",
            entity_type="agent",
            claim_text=f"High quality autonomous execution {i}",
            evidence_urls_json="[]",
            bond_amount=10,
            category="high_quality_work",
            sentiment="positive",
        )

    recent_3 = json.loads(contract.get_recent_claims(3))
    assert len(recent_3) == 3
    # Most recent first
    assert recent_3[0]["id"] == "claim_5"
    assert recent_3[1]["id"] == "claim_4"
    assert recent_3[2]["id"] == "claim_3"
