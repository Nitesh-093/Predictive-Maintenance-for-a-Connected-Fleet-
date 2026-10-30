"""
Root-level wrapper for gemini_service
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
from backend.gemini_service import *
