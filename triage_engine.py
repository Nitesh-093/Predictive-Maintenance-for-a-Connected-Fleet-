"""
Root-level wrapper for triage_engine
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
from backend.triage_engine import *
