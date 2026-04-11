#!/usr/bin/env python3
import sys
import os
import time
import subprocess
import urllib.request
import urllib.parse
import json
from pathlib import Path
import sqlite3

PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DB_PATH = BACKEND_DIR / "data" / "audiobook.db"

def print_header(title):
    print(f"\n{'='*50}\n{title}\n{'='*50}")

def check_database_schema():
    print("Checking database schema integrity...")
    if not DB_PATH.exists():
        print("Database not found. It will be created on first run.")
        return True
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("PRAGMA table_info(dict_cache)")
    columns = [row[1] for row in c.fetchall()]
    
    if "inflections" not in columns:
        print("❌ Database schema error: 'inflections' column missing in 'dict_cache'.")
        print("Please run: python backend/scripts/migrate_v5_dict.py")
        return False
        
    print("✅ Database schema verified.")
    conn.close()
    return True

def run_backend_imports_check():
    print("Running backend import dry-run...")
    if sys.platform == "win32":
        python_exe = str(BACKEND_DIR / ".venv" / "Scripts" / "python.exe")
    else:
        python_exe = str(BACKEND_DIR / ".venv" / "bin" / "python")

    # Script to import everything to ensure no NameErrors or ImportErrors exist
    test_script = """
try:
    import main
    print("Imports successful.")
except Exception as e:
    import traceback
    traceback.print_exc()
    exit(1)
"""
    try:
        subprocess.check_call([python_exe, "-c", test_script], cwd=BACKEND_DIR)
        print("✅ Backend imports verified.")
        return True
    except subprocess.CalledProcessError:
        print("❌ Backend import check failed.")
        return False

def post_multipart(url, filename, file_content, data):
    import uuid
    boundary = uuid.uuid4().hex
    
    body = bytearray()
    for key, value in data.items():
        body.extend(f'--{boundary}\r\n'.encode('utf-8'))
        body.extend(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode('utf-8'))
        body.extend(f'{value}\r\n'.encode('utf-8'))
        
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
    body.extend(b'Content-Type: text/plain\r\n\r\n')
    body.extend(file_content)
    body.extend(b'\r\n')
    body.extend(f'--{boundary}--\r\n'.encode('utf-8'))
    
    req = urllib.request.Request(url, data=body)
    req.add_header('Content-type', f'multipart/form-data; boundary={boundary}')
    
    try:
        response = urllib.request.urlopen(req)
        return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

def run_integration_test():
    print("Starting integration smoke test...")
    if sys.platform == "win32":
        python_exe = str(BACKEND_DIR / ".venv" / "Scripts" / "python.exe")
    else:
        python_exe = str(BACKEND_DIR / ".venv" / "bin" / "python")

    # Start the server on a different port to avoid conflicts
    cmd = [python_exe, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"]
    proc = subprocess.Popen(
        cmd, cwd=BACKEND_DIR,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    )

    try:
        # Wait for server to start
        time.sleep(5)
        
        # 1. Health Check
        print("   - Pinging /health...")
        try:
            health = urllib.request.urlopen("http://127.0.0.1:8001/health", timeout=5)
            if health.status != 200:
                print("❌ API Health check failed.")
                return False
        except Exception as e:
            print(f"❌ API Health check failed: {e}")
            return False
            
        # 2. Upload Dummy Book
        print("   - Simulating upload...")
        file_content = b'This is a diagnostic smoke test. He said hello. She says goodbye.'
        data = {'level': 'B1', 'native_language': 'English', 'llm_provider': 'none', 'api_key': ''}
        
        status, upload_res = post_multipart("http://127.0.0.1:8001/api/upload", 'test.txt', file_content, data)
        if status != 200:
            print(f"❌ Upload failed: {upload_res}")
            return False
            
        job_id = upload_res.get('job_id')
        
        # 3. Wait for Job
        print(f"   - Waiting for job {job_id} to complete...")
        max_retries = 30
        result_book_id = None
        for i in range(max_retries):
            try:
                job_res = urllib.request.urlopen(f"http://127.0.0.1:8001/api/job/{job_id}")
                if job_res.status == 200:
                    jdata = json.loads(job_res.read().decode('utf-8'))
                    if jdata['status'] == 'done':
                        result_book_id = jdata['result']['id']
                        break
                    elif jdata['status'] == 'error':
                        print(f"❌ Background job failed: {jdata['error']}")
                        return False
            except Exception as e:
                pass
            time.sleep(1)
            
        if not result_book_id:
            print("❌ Job timed out.")
            return False
            
        # 4. Contexts Verification
        print("   - Verifying /contexts endpoint...")
        try:
            ctx_res = urllib.request.urlopen("http://127.0.0.1:8001/api/contexts/say")
            if ctx_res.status != 200:
                print(f"❌ Contexts fetch failed.")
                return False
        except Exception as e:
            print(f"❌ Contexts fetch failed: {e}")
            return False
            
        # Optional: cleanup the test book from db
        try:
            req = urllib.request.Request(f"http://127.0.0.1:8001/api/library/{result_book_id}", method='DELETE')
            urllib.request.urlopen(req)
        except Exception:
            pass

        print("✅ Integration test passed.")
        return True
    except Exception as e:
        print(f"❌ Integration test encountered an error: {e}")
        return False
    finally:
        print("Shutting down test server...")
        if sys.platform == "win32":
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            proc.terminate()

def main():
    print_header("VocabNet Quality Gate (Sentinel)")
    
    success = True
    
    if not check_database_schema():
        success = False
        
    if not run_backend_imports_check():
        success = False
        
    if not run_integration_test():
        success = False
        
    print_header("Final Audit Report")
    if success:
        print("✅ ALL CHECKS PASSED. Ready for deployment.")
        sys.exit(0)
    else:
        print("❌ CHECKS FAILED. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
