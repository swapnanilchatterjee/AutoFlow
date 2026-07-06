#!/usr/bin/env python3
"""AutoFlow Live API Integration Health Check & Verification Script."""
import time
import requests
import uuid

BASE_URL = "http://localhost:8000"

def main():
    print("====================================================")
    print("      AutoFlow Live API Verification Check          ")
    print("====================================================")
    
    # 1. Health Liveness & Readiness Checks
    print("\n[1] Verifying System Health...")
    try:
        resp = requests.get(f"{BASE_URL}/api/v1/health")
        assert resp.status_code in {200, 201}, f"Liveness failed: {resp.status_code}"
        print(f"  [OK] Liveness probe: ({resp.json()['status']})")
        
        resp = requests.get(f"{BASE_URL}/api/v1/health/ready")
        assert resp.status_code in {200, 201}, f"Readiness failed: {resp.status_code}"
        checks = resp.json()["checks"]
        print(f"  [OK] Database readiness check: {checks['database'].upper()}")
        print(f"  [OK] Redis cache queue readiness check: {checks['redis'].upper()}")
    except Exception as exc:
        print(f"  [FAIL] Health Check Failed: {exc}")
        return

    # 2. Authentication Flow Check
    print("\n[2] Verifying Authentication APIs...")
    username = f"tester_{uuid.uuid4().hex[:6]}"
    email = f"{username}@example.com"
    password = "SecureQA123Password"
    
    try:
        # Register user
        reg_payload = {
            "email": email,
            "username": username,
            "password": password,
            "full_name": "QA Verification Bot",
            "admin_token": "super-secret-admin-token-123"
        }
        resp = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_payload)
        assert resp.status_code in {200, 201}, f"Registration failed: {resp.status_code} - {resp.text}"
        print(f"  [OK] Register dummy user: ({username})")
        
        # Token Authentication login
        token_payload = {
            "username": username,
            "password": password
        }
        resp = requests.post(f"{BASE_URL}/api/v1/auth/login", data=token_payload)
        assert resp.status_code in {200, 201}, f"Auth token retrieval failed: {resp.status_code} - {resp.text}"
        token = resp.json()["access_token"]
        print("  [OK] Login bearer token exchange")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Auth info profile retrieval
        resp = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
        assert resp.status_code in {200, 201}, f"Profile info failed: {resp.status_code} - {resp.text}"
        print(f"  [OK] Get authenticated user info: ({resp.json()['email']})")
    except Exception as exc:
        print(f"  [FAIL] Auth Verification Failed: {exc}")
        return

    # 3. Workspaces CRUD Flow
    print("\n[3] Verifying Workspaces CRUD APIs...")
    ws_slug = f"ws-{uuid.uuid4().hex[:6]}"
    try:
        # Create
        ws_payload = {
            "name": f"Verification Workspace {ws_slug}",
            "slug": ws_slug,
            "description": "AutoFlow API testing sandboxed environment"
        }
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces", json=ws_payload, headers=headers)
        assert resp.status_code in {200, 201}, f"Workspace creation failed: {resp.status_code} - {resp.text}"
        ws_id = resp.json()["id"]
        print(f"  [OK] Create workspace: (ID: {ws_id}, Slug: {ws_slug})")
        
        # List
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces", headers=headers)
        assert resp.status_code in {200, 201}, f"List workspaces failed: {resp.status_code} - {resp.text}"
        assert any(w["id"] == ws_id for w in resp.json()), "Workspace missing from list"
        print("  [OK] List workspaces")
        
        # Get details
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}", headers=headers)
        assert resp.status_code in {200, 201}, f"Workspace get details failed: {resp.status_code} - {resp.text}"
        print("  [OK] Get workspace details")
    except Exception as exc:
        print(f"  [FAIL] Workspace Verification Failed: {exc}")
        return

    # 4. Secrets & Variables APIs
    print("\n[4] Verifying Secrets & Variables APIs...")
    try:
        # Create variable
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/variables", json={"key": "TEST_VAR", "value": "val123"}, headers=headers)
        assert resp.status_code in {200, 201}, f"Set variable failed: {resp.status_code} - {resp.text}"
        print("  [OK] Set config variable")
        
        # Read variables
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/variables", headers=headers)
        assert resp.status_code in {200, 201}, f"Get variables failed: {resp.status_code} - {resp.text}"
        assert any(v["key"] == "TEST_VAR" for v in resp.json()), "Variable not found"
        print("  [OK] Get variables list")
        
        # Set Secret (Fernet encrypted)
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/secrets", json={"key": "TEST_SECRET", "value": "secret456"}, headers=headers)
        assert resp.status_code in {200, 201}, f"Set secret failed: {resp.status_code} - {resp.text}"
        print("  [OK] Set write-only encrypted secret")
        
        # Read Secrets (Verify values are redacted)
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/secrets", headers=headers)
        assert resp.status_code in {200, 201}, f"Get secrets failed: {resp.status_code} - {resp.text}"
        matching = [s for s in resp.json() if s["key"] == "TEST_SECRET"]
        assert len(matching) > 0, "Secret not found in list"
        assert "value" not in matching[0], "Secret value was returned! Security leak!"
        print("  [OK] Redacted secrets retrieval: (Verified write-only security)")
    except Exception as exc:
        print(f"  [FAIL] Secrets & Variables Failed: {exc}")
        return

    # 5. File Manager & Contacts System Verification
    print("\n[5] Verifying File Manager & Contacts APIs...")
    try:
        # Write contacts.json
        contacts_payload = {
            "content": "{\n  \"contacts\": [\n    { \"name\": \"John QA\", \"email\": \"john@example.com\", \"phone\": \"919876543210\", \"groups\": [\"alerts\"] }\n  ]\n}"
        }
        resp = requests.put(f"{BASE_URL}/api/v1/workspaces/{ws_id}/files/content?path=contacts.json", json=contacts_payload, headers=headers)
        assert resp.status_code in {200, 201}, f"Write contacts.json failed: {resp.status_code} - {resp.text}"
        print("  [OK] Write contacts.json configuration")
        
        # Read file tree
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/files/tree", headers=headers)
        assert resp.status_code in {200, 201}, f"Read files tree failed: {resp.status_code} - {resp.text}"
        assert any(item["name"] == "contacts.json" for item in resp.json()["entries"]), "contacts.json missing from file tree"
        print("  [OK] Get workspace files tree")
        
        # Read file contents
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/files/content?path=contacts.json", headers=headers)
        assert resp.status_code in {200, 201}, f"Read file failed: {resp.status_code} - {resp.text}"
        assert "John QA" in resp.json()["content"], "File content mismatch"
        print("  [OK] Read file content verification")
    except Exception as exc:
        print(f"  [FAIL] File Manager Verification Failed: {exc}")
        return

    # 6. Connections & Tests
    print("\n[6] Verifying Connection Integrations APIs...")
    try:
        # Create connection
        conn_payload = {
            "type": "telegram",
            "name": "QA Chat integration",
            "config": {
                "bot_token": "000000000:FakeTokenExampleMock",
                "default_chat_id": "1111111"
            },
            "enabled": True
        }
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/connections", json=conn_payload, headers=headers)
        assert resp.status_code in {200, 201}, f"Create connection failed: {resp.status_code} - {resp.text}"
        conn_id = resp.json()["id"]
        print(f"  [OK] Create connection: (ID: {conn_id})")
        
        # List connections
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/connections", headers=headers)
        assert resp.status_code in {200, 201}, f"List connections failed: {resp.status_code} - {resp.text}"
        assert any(c["id"] == conn_id for c in resp.json()), "Connection not found in list"
        print("  [OK] List connections")
        
        # Test connection endpoint
        test_payload = {
            "to": "1111111",
            "include_attachment": True
        }
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/connections/{conn_id}/test", json=test_payload, headers=headers)
        assert resp.status_code in {200, 201}, f"Test endpoint failed with error status: {resp.status_code} - {resp.text}"
        print(f"  [OK] Test connection endpoint: (Result: {resp.json()['detail']})")
    except Exception as exc:
        print(f"  [FAIL] Connections Verification Failed: {exc}")
        return

    # 7. Workflow YAML Engine Verification
    print("\n[7] Verifying Workflow Engine CRUD & Executions...")
    try:
        workflow_def = """name: QA Workflow
trigger:
  type: manual

steps:
  - name: build_data
    run: echo "Date,Sales,Status\\n2026-07-01,1200,Verified" > report.csv

  - name: alert_admin
    uses: telegram
    with:
      connection: QA Chat integration
      to: alerts
      body: "Alert dispatch: testing execution logs."
"""
        wf_payload = {
            "name": "QA Pipeline Check",
            "slug": "qa-pipeline",
            "description": "Integration test run engine",
            "trigger_type": "manual",
            "definition": workflow_def,
            "enabled": True
        }
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/workflows", json=wf_payload, headers=headers)
        assert resp.status_code in {200, 201}, f"Create workflow failed: {resp.status_code} - {resp.text}"
        wf_id = resp.json()["id"]
        print(f"  [OK] Create workflow template: (ID: {wf_id})")
        
        # Trigger execution
        resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/workflows/{wf_id}/trigger", headers=headers)
        assert resp.status_code in {200, 201, 202}, f"Manual trigger failed: {resp.status_code} - {resp.text}"
        run_id = resp.json()["id"]
        print(f"  [OK] Trigger workflow run: (Run ID: {run_id})")
        
        # Read run logs
        print("  Waiting 3s for worker execution...")
        time.sleep(3)
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/workflows/{wf_id}/runs/{run_id}", headers=headers)
        assert resp.status_code in {200, 201}, f"Get run details failed: {resp.status_code} - {resp.text}"
        run_data = resp.json()
        print(f"  [OK] Retrieve execution run status: {run_data['status'].upper()}")
    except Exception as exc:
        print(f"  [FAIL] Workflow Engine Verification Failed: {exc}")
        return

    # 8. Logs, Dashboard & Date-Range Filtering
    print("\n[8] Verifying Logs, Dashboard & Date Range APIs...")
    try:
        # Global Dashboard
        resp = requests.get(f"{BASE_URL}/api/v1/dashboard/stats", headers=headers)
        assert resp.status_code in {200, 201}, f"Dashboard stats failed: {resp.status_code} - {resp.text}"
        print("  [OK] Retrieve Dashboard Stats data")
        
        # List delivery logs
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/deliveries", headers=headers)
        assert resp.status_code in {200, 201}, f"List delivery logs failed: {resp.status_code} - {resp.text}"
        print(f"  [OK] Get Logs list: (Records returned: {len(resp.json())})")
    except Exception as exc:

        print(f"  [FAIL] Logs / Dashboard Verification Failed: {exc}")
        return

    # 9. Clean up test workspace
    print("\n[9] Skipping workspace cleanup so dummy logs are retained for dashboard inspection...")
    print("      To check out the populated dashboard and export logs:")
    print(f"      - Username: {username}")
    print(f"      - Password: {password}")
    print(f"      - Workspace: {ws_slug}")

    print("\n====================================================")
    print("      Verification Successful: 100% APIs Green!     ")
    print("====================================================")

if __name__ == "__main__":
    main()
