#!/usr/bin/env python3
import requests
import uuid

BASE_URL = "http://localhost:8000"

def test_rbac_flows():
    print("====================================================")
    print("      AutoFlow RBAC & User vs Admin Test Suite      ")
    print("====================================================")

    # 1. Register a standard user
    username = f"user_{uuid.uuid4().hex[:6]}"
    email = f"{username}@example.com"
    password = "SecureQA123Password"

    print("\n[1] Registering Standard User...")
    reg_payload = {
        "email": email,
        "username": username,
        "password": password,
        "full_name": "Standard Test User"
    }
    resp = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_payload)
    if resp.status_code not in {200, 201}:
        print(f"  [FAIL] Standard user registration failed: {resp.status_code} - {resp.text}")
        return
    print(f"  [OK] Standard user registered: {username}")

    # Login as standard user
    login_payload = {
        "username": username,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/api/v1/auth/login", data=login_payload)
    if resp.status_code not in {200, 201}:
        print(f"  [FAIL] Standard user login failed: {resp.status_code} - {resp.text}")
        return
    user_token = resp.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print("  [OK] Standard user login successful (token retrieved)")

    # 2. Test standard user access constraints
    print("\n[2] Testing Access Constraints for Standard User (Expecting 403 Forbidden)...")
    
    # Check global deliveries
    resp = requests.get(f"{BASE_URL}/api/v1/deliveries", headers=user_headers)
    assert resp.status_code == 403, f"Unexpected deliveries status: {resp.status_code}"
    print("  [OK] GET /deliveries restricted (403 Forbidden)")

    # Check user management
    resp = requests.get(f"{BASE_URL}/api/v1/users", headers=user_headers)
    assert resp.status_code == 403, f"Unexpected list users status: {resp.status_code}"
    print("  [OK] GET /users restricted (403 Forbidden)")

    # Check admin stats
    resp = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=user_headers)
    assert resp.status_code == 403, f"Unexpected admin stats status: {resp.status_code}"
    print("  [OK] GET /admin/stats restricted (403 Forbidden)")

    # Check worker restart
    resp = requests.post(f"{BASE_URL}/api/v1/admin/workers/celery@autoflow-worker/restart", headers=user_headers)
    assert resp.status_code == 403, f"Unexpected restart status: {resp.status_code}"
    print("  [OK] POST /admin/workers/.../restart restricted (403 Forbidden)")

    # 3. Log in as Superadmin
    print("\n[3] Authenticating as Superadmin...")
    admin_payload = {
        "username": "tester_26bbaf",
        "password": "SecureQA123Password"
    }
    resp = requests.post(f"{BASE_URL}/api/v1/auth/login", data=admin_payload)
    if resp.status_code not in {200, 201}:
        print(f"  [FAIL] Superadmin login failed. Check credentials: {resp.status_code} - {resp.text}")
        return
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  [OK] Superadmin login successful (token retrieved)")

    # 4. Test superadmin access permissions
    print("\n[4] Testing Access Permissions for Superadmin (Expecting 200 OK)...")
    
    # Check global deliveries
    resp = requests.get(f"{BASE_URL}/api/v1/deliveries", headers=admin_headers)
    assert resp.status_code == 200, f"Failed GET /deliveries: {resp.status_code} - {resp.text}"
    print(f"  [OK] GET /deliveries successful (Returned: {len(resp.json())} entries)")

    # Check user management
    resp = requests.get(f"{BASE_URL}/api/v1/users", headers=admin_headers)
    assert resp.status_code == 200, f"Failed GET /users: {resp.status_code} - {resp.text}"
    print(f"  [OK] GET /users successful (Returned: {len(resp.json())} users)")

    # Check admin stats
    resp = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=admin_headers)
    assert resp.status_code == 200, f"Failed GET /admin/stats: {resp.status_code} - {resp.text}"
    print(f"  [OK] GET /admin/stats successful: {resp.json()}")

    # Check workers list
    resp = requests.get(f"{BASE_URL}/api/v1/admin/workers", headers=admin_headers)
    assert resp.status_code == 200, f"Failed GET /admin/workers: {resp.status_code} - {resp.text}"
    print(f"  [OK] GET /admin/workers successful: {resp.json()}")

    # 5. Provision a user as Admin
    print("\n[5] Provisioning a User via Superadmin Account...")
    provision_payload = {
        "email": f"provisioned_{uuid.uuid4().hex[:6]}@example.com",
        "username": f"prov_{uuid.uuid4().hex[:6]}",
        "password": "SecureQA123Password",
        "full_name": "Provisioned User Account"
    }
    resp = requests.post(f"{BASE_URL}/api/v1/users", json=provision_payload, headers=admin_headers)
    assert resp.status_code == 201, f"Failed user provisioning: {resp.status_code} - {resp.text}"
    print(f"  [OK] Superadmin user provisioning successful: {resp.json()['username']}")

    print("\n====================================================")
    print("  RBAC Flow Verification Successful: 100% Passed!   ")
    print("====================================================")

if __name__ == "__main__":
    test_rbac_flows()
