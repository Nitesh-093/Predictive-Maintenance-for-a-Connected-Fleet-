"""
Streamlit Community Cloud Entry Point
Redirects to app.py
"""
import runpy
import os

app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
runpy.run_path(app_path, run_name="__main__")
