#!/usr/bin/env python3
import subprocess
import os
import sys
import time
import shutil
from pathlib import Path

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
VENV_DIR = BACKEND_DIR / ".venv"

def run_command(cmd, cwd=None, env=None, shell=False):
    """Run a shell command and return its success."""
    try:
        subprocess.check_call(cmd, cwd=cwd, env=env, shell=shell)
        return True
    except subprocess.CalledProcessError:
        return False

def setup_backend():
    """Ensure backend venv and requirements are ready."""
    print("📦 [1/2] Checking Backend environment...")
    
    if not VENV_DIR.exists():
        print("   Creating virtual environment in backend/.venv...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])

    if sys.platform == "win32":
        python_exe = VENV_DIR / "Scripts" / "python.exe"
        pip_exe = VENV_DIR / "Scripts" / "pip.exe"
    else:
        python_exe = VENV_DIR / "bin" / "python"
        pip_exe = VENV_DIR / "bin" / "pip"

    try:
        subprocess.check_call([str(python_exe), "-m", "uvicorn", "--version"], 
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        has_requirements = True
    except:
        has_requirements = False

    marker_file = VENV_DIR / ".last_install"
    req_file = BACKEND_DIR / "requirements.txt"
    
    needs_install = not has_requirements
    if not needs_install and req_file.exists() and marker_file.exists():
        needs_install = req_file.stat().st_mtime > marker_file.stat().st_mtime

    if needs_install:
        print("   Installing/Updating backend dependencies in .venv...")
        subprocess.check_call([str(pip_exe), "install", "-r", str(req_file)])
        marker_file.touch()
    else:
        print("   Backend .venv is ready.")
        if not marker_file.exists(): marker_file.touch()
    
    return str(python_exe)

def setup_frontend():
    """Ensure frontend node_modules are ready."""
    print("🎨 [2/2] Checking Frontend environment...")
    
    pkg_manager = "npm"
    if shutil.which("pnpm"): pkg_manager = "pnpm"
    elif shutil.which("yarn"): pkg_manager = "yarn"

    node_modules = FRONTEND_DIR / "node_modules"
    pkg_json = FRONTEND_DIR / "package.json"
    
    needs_install = not node_modules.exists()
    if not needs_install and pkg_json.exists():
        needs_install = pkg_json.stat().st_mtime > node_modules.stat().st_mtime

    if needs_install:
        print(f"   Installing frontend dependencies via {pkg_manager}...")
        run_command([pkg_manager, "install"], cwd=FRONTEND_DIR, shell=(sys.platform == "win32"))
    else:
        print("   Frontend dependencies are up to date.")
    
    return pkg_manager

def start_backend(python_exe):
    print("🚀 Starting Backend (Uvicorn)...")
    cmd = [python_exe, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
    return subprocess.Popen(
        cmd, cwd=BACKEND_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    )

def start_frontend(pkg_manager):
    print("🚀 Starting Frontend (Vite)...")
    cmd = [pkg_manager, "run", "dev"]
    return subprocess.Popen(
        cmd, cwd=FRONTEND_DIR, shell=(sys.platform == "win32"),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    )

def main():
    os.chdir(PROJECT_ROOT)
    
    print("\n" + "="*50)
    print("🌌 VocabNet Resilience Launcher")
    print("="*50 + "\n")

    try:
        python_exe = setup_backend()
        pkg_manager = setup_frontend()
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)

    print("\n✅ Setup verified. Monitoring services for real-time updates...")
    print("   Press Ctrl+C to stop the entire session.\n")

    backend_proc = start_backend(python_exe)
    frontend_proc = start_frontend(pkg_manager)

    try:
        while True:
            time.sleep(2)
            
            # Check Backend
            if backend_proc.poll() is not None:
                print("\n⚠️  Backend service stopped. Auto-restarting in 2s...")
                time.sleep(2)
                backend_proc = start_backend(python_exe)

            # Check Frontend
            if frontend_proc.poll() is not None:
                print("\n⚠️  Frontend service stopped. Auto-restarting in 2s...")
                time.sleep(2)
                frontend_proc = start_frontend(pkg_manager)

    except KeyboardInterrupt:
        print("\n🛑 Shutting down VocabNet...")
        for proc in [backend_proc, frontend_proc]:
            if sys.platform == "win32":
                subprocess.call(['taskkill', '/F', '/T', '/PID', str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
