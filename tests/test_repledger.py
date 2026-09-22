import json
import pytest
from unittest.mock import MagicMock
import sys
from pathlib import Path
import types

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class MockSender:
    def __init__(self, address="0xbc1399c55538ec034d4da550c03c34ae0c357f53", value=0):
        self.sender_account = address
        self.sender_address = address
        self.value = value


class MockContractTarget:
    def __init__(self, address):
        self.address = address
        self.transfers = []

    def emit_transfer(self, value=0, on="finalized"):
        self.transfers.append({"value": int(value), "on": on})


target_registry = {}


def mock_get_contract_at(address):
    addr_str = str(address).lower()
    if addr_str not in target_registry:
        target_registry[addr_str] = MockContractTarget(address)
    return target_registry[addr_str]


_mod = types.ModuleType("genlayer")
mock_gl = MagicMock()
mock_gl.message = MockSender()
mock_gl.Contract = object
mock_gl.public.view = lambda f: f

write_decorator = lambda f: f
write_decorator.payable = lambda f: f
mock_gl.public.write = write_decorator
mock_gl.vm.UserError = ValueError


def mock_prompt_comparative(fn, principle=""):
    return fn()


mock_gl.eq_principle.prompt_comparative = mock_prompt_comparative
mock_gl.get_contract_at = mock_get_contract_at

_mod.gl = mock_gl
_mod.Address = str
_mod.TreeMap = dict
_mod.DynArray = list
_mod.u256 = int
_mod.__all__ = ["gl", "Address", "TreeMap", "DynArray", "u256"]

sys.modules["genlayer"] = _mod
from contracts import repledger


def create_test_contract(
    owner="0xbc1399c55538ec034d4da550c03c34ae0c357f53",
    treasury="0x000000000000000000000000000000000000cafe",
):
    """Instantiate a test RepLedger contract with fresh mock registry."""
    target_registry.clear()
    mock_gl.message = MockSender(owner, value=0)
    contract = repledger.RepLedger()
    contract.owner = owner
    contract.treasury = treasury
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
    contract.total_bonds_refunded = 0
    contract.total_challenger_payouts = 0
    contract.total_bonds_in_custody = 0
    contract.min_bond_amount = 1
    return contract


def test_initial_state():
    contract = create_test_contract()
    assert contract.get_owner() == "0xbc1399c55538ec034d4da550c03c34ae0c357f53"
    assert contract.get_treasury() == "0x000000000000000000000000000000000000cafe"
    assert contract.get_all_claim_ids() == []
    assert contract.get_all_entities() == []

    stats = json.loads(contract.get_ledger_stats())
    assert stats["total_claims"] == 0
    assert stats["total_accepted"] == 0
    assert stats["total_rejected"] == 0
    assert stats["total_overridden"] == 0
    assert stats["total_slashed_bonds"] == 0
    assert stats["total_bonds_refunded"] == 0
    assert stats["total_challenger_payouts"] == 0
    assert stats["total_bonds_in_custody"] == 0


def test_treasury_configuration():
    contract = create_test_contract()
    # Owner updates treasury
    contract.set_treasury("0x1111111111111111111111111111111111111111")
    assert contract.get_treasury() == "0x1111111111111111111111111111111111111111"

    # Non-owner fails
    mock_gl.message = MockSender("0xattacker", value=0)
    with pytest.raises(ValueError, match="Only owner can update treasury address"):
        contract.set_treasury("0xbadtreasury")


def test_input_validation():
    contract = create_test_contract()

    # Empty entity
    mock_gl.message = MockSender("0xclaimant", value=10)
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

    # Bond below min requirement
    mock_gl.message = MockSender("0xclaimant", value=0)
    with pytest.raises(ValueError, match="below minimum requirement"):
        contract.submit_claim(
            entity="euler_finance",
            entity_type="protocol",
            claim_text="Valid claim text",
            evidence_urls_json="[]",
            bond_amount=0,
            category="exploit",
            sentiment="negative",
        )


def test_claim_accepted_holds_bond_in_custody():
    """Outcome 1: Claim Accepted -> Bond held in on-chain custody, no slashing."""
    contract = create_test_contract()

    mock_gl.message = MockSender(address="0xclaimant", value=25)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 92,
        "consensus_summary": "Exploit confirmed by security disclosures and on-chain logs.",
        "key_findings": ["197M drained via flash loan donation exploit"],
    }

    claim_res_str = contract.submit_claim(
        entity="euler_finance",
        entity_type="protocol",
        claim_text="Euler Finance was exploited for 197 million USD in flash loan attack",
        evidence_urls_json=json.dumps(["https://en.wikipedia.org/wiki/Euler_Finance"]),
        bond_amount=25,
        category="exploit",
        sentiment="negative",
    )

    claim_res = json.loads(claim_res_str)
    assert claim_res["id"] == "claim_1"
    assert claim_res["verdict"] == "ACCEPTED"
    assert claim_res["status"] == "ACCEPTED"
    assert claim_res["is_slashed"] is False
    assert claim_res["bond_amount"] == 25

    # Verify custody state
    assert contract.total_accepted_count == 1
    assert contract.claimant_bonds["claim_1"] == 25
    assert contract.total_bonds_in_custody == 25
    assert contract.total_slashed_bonds == 0

    # No slashing transfers emitted
    treasury_target = target_registry.get(contract.treasury.lower())
    assert treasury_target is None or len(treasury_target.transfers) == 0

    # Entity score updated
    score_data = json.loads(contract.get_entity_score("euler_finance"))
    assert score_data["score"] == 10  # 50 - 40
    assert score_data["is_exploit_flagged"] is True


def test_claim_rejected_slashes_bond_to_treasury():
    """Outcome 2: Claim Rejected -> Bond slashed on-chain to protocol treasury."""
    contract = create_test_contract()
    treasury_addr = contract.treasury.lower()

    mock_gl.message = MockSender(address="0xspammer", value=30)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "REJECTED",
        "is_supported": False,
        "confidence_score": 88,
        "consensus_summary": "Evidence does not substantiate any exploit. False claim.",
        "key_findings": ["No malicious transactions found"],
    }

    claim_res_str = contract.submit_claim(
        entity="uniswap_v3",
        entity_type="protocol",
        claim_text="Uniswap V3 router was drained by unauthorized hacker",
        evidence_urls_json=json.dumps(["https://unrelated.com/random"]),
        bond_amount=30,
        category="exploit",
        sentiment="negative",
    )

    claim_res = json.loads(claim_res_str)
    assert claim_res["id"] == "claim_1"
    assert claim_res["verdict"] == "REJECTED"
    assert claim_res["status"] == "REJECTED"
    assert claim_res["is_slashed"] is True

    # Custody state: bond slashed, not in custody
    assert contract.total_rejected_count == 1
    assert contract.claimant_bonds["claim_1"] == 0
    assert contract.total_bonds_in_custody == 0
    assert contract.total_slashed_bonds == 30

    # On-chain transfer to treasury emitted!
    treasury_target = target_registry.get(treasury_addr)
    assert treasury_target is not None
    assert len(treasury_target.transfers) == 1
    assert treasury_target.transfers[0]["value"] == 30
    assert treasury_target.transfers[0]["on"] == "finalized"


def test_refund_bond_for_accepted_claim():
    """Outcome 3: Bond Refund -> Claimant refunds bonded stake from accepted claim."""
    contract = create_test_contract()

    # Step 1: Submit accepted claim with 20 bond
    mock_gl.message = MockSender(address="0xhonestclaimant", value=20)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 95,
        "consensus_summary": "Audit report verified and confirmed passed.",
        "key_findings": ["Audit verified"],
    }
    contract.submit_claim(
        entity="compound_v3",
        entity_type="protocol",
        claim_text="Compound V3 passed OpenZeppelin formal audit",
        evidence_urls_json="[]",
        bond_amount=20,
        category="audit_passed",
        sentiment="positive",
    )
    assert contract.claimant_bonds["claim_1"] == 20
    assert contract.total_bonds_in_custody == 20

    # Step 2: Claimant requests refund
    mock_gl.message = MockSender(address="0xhonestclaimant", value=0)
    refund_res_str = contract.refund_bond("claim_1")
    refund_res = json.loads(refund_res_str)

    assert refund_res["status"] == "REFUNDED"
    assert refund_res["refunded_amount"] == 20
    assert refund_res["recipient"] == "0xhonestclaimant"

    # Verify custody cleared and telemetry updated
    assert contract.claimant_bonds["claim_1"] == 0
    assert contract.total_bonds_refunded == 20
    assert contract.total_bonds_in_custody == 0

    # Verify native refund transfer emitted to claimant!
    claimant_target = target_registry.get("0xhonestclaimant")
    assert claimant_target is not None
    assert len(claimant_target.transfers) == 1
    assert claimant_target.transfers[0]["value"] == 20
    assert claimant_target.transfers[0]["on"] == "finalized"

    # Step 3: Attempting double refund reverts
    with pytest.raises(ValueError, match="No bond remaining in custody to refund"):
        contract.refund_bond("claim_1")


def test_refund_bond_authorization_and_guards():
    """Test access control and status checks on refund_bond."""
    contract = create_test_contract()

    # Submit accepted claim
    mock_gl.message = MockSender(address="0xoriginalclaimant", value=15)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 90,
        "consensus_summary": "Accepted",
        "key_findings": [],
    }
    contract.submit_claim(
        entity="makerdao",
        entity_type="protocol",
        claim_text="MakerDAO passed Dai governance milestone",
        evidence_urls_json="[]",
        bond_amount=15,
        category="general_reputation",
        sentiment="positive",
    )

    # Random attacker tries to refund claimant's bond
    mock_gl.message = MockSender(address="0xthief", value=0)
    with pytest.raises(ValueError, match="Only the claimant or contract owner"):
        contract.refund_bond("claim_1")

    # Submit rejected claim
    mock_gl.message = MockSender(address="0xclaimant2", value=15)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "REJECTED",
        "is_supported": False,
        "confidence_score": 90,
        "consensus_summary": "Rejected",
        "key_findings": [],
    }
    contract.submit_claim(
        entity="fake_target",
        entity_type="protocol",
        claim_text="Bad claim",
        evidence_urls_json="[]",
        bond_amount=15,
        category="exploit",
        sentiment="negative",
    )

    # Cannot refund rejected claim
    mock_gl.message = MockSender(address="0xclaimant2", value=0)
    with pytest.raises(ValueError, match="Only currently ACCEPTED claims can be refunded"):
        contract.refund_bond("claim_2")


def test_challenge_success_overrides_claim_and_pays_challenger():
    """Outcome 4: Challenge Succeeded -> Original bond + counter-bond paid to challenger."""
    contract = create_test_contract("0xclaimant")

    # Step 1: Submit accepted claim with 40 bond
    mock_gl.message = MockSender(address="0xclaimant", value=40)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 90,
        "consensus_summary": "Initial report indicated bridge was halted.",
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
    assert contract.total_bonds_in_custody == 40
    assert contract.is_flagged("starkgate_bridge", "exploit") is True

    # Step 2: Challenge with counter-evidence and 40 counter-bond
    mock_gl.message = MockSender(address="0xchallenger", value=40)
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "OVERRIDDEN",
        "challenge_successful": True,
        "confidence_score": 99,
        "reasoning": "Starkware official release proves scheduled upgrade, not exploit.",
    }

    chal_res_str = contract.challenge_claim(
        claim_id="claim_1",
        rebuttal_text="Withdrawals were paused for a planned bridge upgrade, not an exploit.",
        counter_evidence_urls_json=json.dumps(["https://starkware.co/upgrade"]),
        counter_bond=40,
    )

    chal_res = json.loads(chal_res_str)
    assert chal_res["verdict"] == "OVERRIDDEN"
    assert chal_res["challenge_successful"] is True
    assert "Challenger payout of 80" in chal_res["message"]

    # Verify claim state
    updated_claim = json.loads(contract.get_claim("claim_1"))
    assert updated_claim["status"] == "OVERRIDDEN"
    assert contract.total_overridden_count == 1
    assert contract.claimant_bonds["claim_1"] == 0
    assert contract.total_bonds_in_custody == 0
    assert contract.total_challenger_payouts == 80  # 40 original + 40 counter-bond

    # Verify on-chain challenger payout emitted!
    challenger_target = target_registry.get("0xchallenger")
    assert challenger_target is not None
    assert len(challenger_target.transfers) == 1
    assert challenger_target.transfers[0]["value"] == 80
    assert challenger_target.transfers[0]["on"] == "finalized"

    # Exploit flag removed from entity!
    assert contract.is_flagged("starkgate_bridge", "exploit") is False


def test_challenge_failed_slashes_challenger_counter_bond_to_treasury():
    """Outcome 5: Challenge Failed -> Challenger's counter-bond slashed to treasury."""
    contract = create_test_contract("0xclaimant")
    treasury_addr = contract.treasury.lower()

    # Step 1: Submit accepted exploit claim with 30 bond
    mock_gl.message = MockSender(address="0xclaimant", value=30)
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
        claim_text="Bad Protocol lost user funds in reentrancy attack",
        evidence_urls_json="[]",
        bond_amount=30,
        category="exploit",
        sentiment="negative",
    )
    assert contract.claimant_bonds["claim_1"] == 30
    assert contract.total_bonds_in_custody == 30

    # Step 2: Spurious challenger posts 30 counter-bond
    mock_gl.message = MockSender(address="0xfakechallenger", value=30)
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

    # Challenger's counter-bond of 30 was slashed to treasury!
    assert contract.total_slashed_bonds == 30
    # Original claimant's bond remains safe in custody!
    assert contract.claimant_bonds["claim_1"] == 30
    assert contract.total_bonds_in_custody == 30

    # Verify slashing transfer to treasury!
    treasury_target = target_registry.get(treasury_addr)
    assert treasury_target is not None
    assert len(treasury_target.transfers) == 1
    assert treasury_target.transfers[0]["value"] == 30
    assert treasury_target.transfers[0]["on"] == "finalized"

    # Original claim remains ACCEPTED
    updated_claim = json.loads(contract.get_claim("claim_1"))
    assert updated_claim["status"] == "ACCEPTED"


def test_challenge_validation_checks():
    contract = create_test_contract()

    # Non-existent claim
    mock_gl.message = MockSender("0xchallenger", value=10)
    with pytest.raises(ValueError, match="Claim does not exist"):
        contract.challenge_claim(
            claim_id="claim_999",
            rebuttal_text="Rebuttal",
            counter_evidence_urls_json="[]",
            counter_bond=10,
        )

    # Submit a rejected claim first
    mock_gl.message = MockSender("0xclaimant", value=20)
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
    mock_gl.message = MockSender("0xchallenger", value=20)
    with pytest.raises(ValueError, match="Only currently ACCEPTED claims can be challenged"):
        contract.challenge_claim(
            claim_id="claim_1",
            rebuttal_text="Rebuttal",
            counter_evidence_urls_json="[]",
            counter_bond=20,
        )


def test_trust_score_calculation():
    contract = create_test_contract()

    # Add positive claim
    mock_gl.message = MockSender("0xclaimant", value=25)
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


def test_recent_claims_and_bond_views():
    contract = create_test_contract()
    mock_gl.nondet.exec_prompt.return_value = {
        "verdict": "ACCEPTED",
        "is_supported": True,
        "confidence_score": 90,
        "consensus_summary": "Claim verified",
        "key_findings": [],
    }

    for i in range(3):
        mock_gl.message = MockSender(f"0xclaimant_{i}", value=10)
        contract.submit_claim(
            entity=f"entity_{i}",
            entity_type="agent",
            claim_text=f"High quality autonomous execution {i}",
            evidence_urls_json="[]",
            bond_amount=10,
            category="high_quality_work",
            sentiment="positive",
        )

    recent = json.loads(contract.get_recent_claims(2))
    assert len(recent) == 2
    assert recent[0]["id"] == "claim_3"
    assert recent[1]["id"] == "claim_2"

    bond_view = json.loads(contract.get_claim_bond("claim_1"))
    assert bond_view["bond_amount"] == 10
    assert bond_view["in_custody"] is True
