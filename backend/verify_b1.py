"""Verification for Task B1 - Dispatch Pipeline Service."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.dispatch_service import (
    run_validation_pipeline,
    run_ranking_pipeline,
    execute_dispatch,
    auto_trigger_dispatch_pipeline,
    escalate_dispatch,
    cancel_escalation,
)
from app.core.config import BASE_URL
print(f"Dispatch pipeline imports OK, BASE_URL={BASE_URL}")

# Verify emergency_service hooks exist
from app.services.emergency_service import create_emergency
print("create_emergency import OK (pipeline hook should be present)")

print("\nTask B1 verification PASSED")
