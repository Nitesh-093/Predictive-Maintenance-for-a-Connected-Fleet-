"""
Root-level wrapper for mlops_engine
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
from backend.mlops_engine import *
