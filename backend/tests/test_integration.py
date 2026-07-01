"""End-to-end integration tests across all phases (SQLite-backed)."""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def _register(client, email, username, pw="password123"):
    return await client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": pw},
    )


async def _login(client, login, pw="password123"):
    resp = await client.post(
        "/api/v1/auth/login", data={"username": login, "password": pw}
    )
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def test_auth_first_user_is_admin_and_rbac(client):
    r1 = await _register(client, "admin@x.com", "admin")
    assert r1.status_code == 201, r1.text
    assert r1.json()["is_superuser"] is True and r1.json()["role"] == "admin"

    r2 = await _register(client, "bob@x.com", "bob")
    assert r2.status_code == 201
    assert r2.json()["is_superuser"] is False and r2.json()["role"] == "member"

    # duplicate email rejected
    dup = await _register(client, "admin@x.com", "other")
    assert dup.status_code == 409

    # unauthenticated access blocked
    assert (await client.get("/api/v1/auth/me")).status_code == 401

    # login + me
    token = await _login(client, "admin@x.com")
    me = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200 and me.json()["username"] == "admin"

    # non-admin cannot list users
    btok = await _login(client, "bob")
    assert (await client.get("/api/v1/users", headers=_auth(btok))).status_code == 403
    assert (await client.get("/api/v1/users", headers=_auth(token))).status_code == 200


async def test_workspace_files_secrets_and_members(client):
    token = await _login(client, "admin@x.com")
    h = _auth(token)

    ws = await client.post("/api/v1/workspaces", json={"name": "Proj Alpha"}, headers=h)
    assert ws.status_code == 201
    wsid = ws.json()["id"]
    assert ws.json()["role"] == "owner" and ws.json()["slug"] == "proj-alpha"

    # file write + read round-trip
    w = await client.put(
        f"/api/v1/workspaces/{wsid}/files/content",
        params={"path": "src/app.py"},
        json={"content": "print('hi')"},
        headers=h,
    )
    assert w.status_code == 200
    rd = await client.get(
        f"/api/v1/workspaces/{wsid}/files/content",
        params={"path": "src/app.py"}, headers=h,
    )
    assert rd.status_code == 200 and rd.json()["content"] == "print('hi')"

    tree = await client.get(f"/api/v1/workspaces/{wsid}/files/tree", headers=h)
    assert "src" in [e["name"] for e in tree.json()["entries"]]

    # secret value is write-only (never returned)
    sc = await client.post(
        f"/api/v1/workspaces/{wsid}/secrets",
        json={"key": "API_KEY", "value": "topsecret"}, headers=h,
    )
    assert sc.status_code == 201 and "value" not in sc.json()
    lst = await client.get(f"/api/v1/workspaces/{wsid}/secrets", headers=h)
    assert lst.json()[0]["key"] == "API_KEY" and "value" not in lst.json()[0]

    # variable is readable
    vc = await client.post(
        f"/api/v1/workspaces/{wsid}/variables",
        json={"key": "REGION", "value": "ap-south-1"}, headers=h,
    )
    assert vc.status_code == 201 and vc.json()["value"] == "ap-south-1"

    # add bob as member; bob can read but not delete the workspace
    add = await client.post(
        f"/api/v1/workspaces/{wsid}/members",
        json={"username": "bob", "role": "member"}, headers=h,
    )
    assert add.status_code == 201
    btok = await _login(client, "bob")
    bh = _auth(btok)
    assert (await client.get(f"/api/v1/workspaces/{wsid}", headers=bh)).status_code == 200
    assert (
        await client.delete(f"/api/v1/workspaces/{wsid}", headers=bh)
    ).status_code == 403  # member cannot delete

    # non-member sees 404 (existence hidden)
    await _register(client, "eve@x.com", "eve")
    etok = await _login(client, "eve")
    assert (
        await client.get(f"/api/v1/workspaces/{wsid}", headers=_auth(etok))
    ).status_code == 404


async def test_git_init_and_commit(client):
    token = await _login(client, "admin@x.com")
    h = _auth(token)
    ws = await client.post("/api/v1/workspaces", json={"name": "Git WS"}, headers=h)
    wsid = ws.json()["id"]
    await client.put(
        f"/api/v1/workspaces/{wsid}/files/content",
        params={"path": "README.md"}, json={"content": "# hi"}, headers=h,
    )
    init = await client.post(f"/api/v1/workspaces/{wsid}/git/init", headers=h)
    assert init.status_code == 201 and init.json()["initialized"] is True
    commit = await client.post(
        f"/api/v1/workspaces/{wsid}/git/commit",
        json={"message": "initial", "add_all": True}, headers=h,
    )
    assert commit.status_code == 200 and commit.json()["message"] == "initial"
    log = await client.get(f"/api/v1/workspaces/{wsid}/git/log", headers=h)
    assert len(log.json()) == 1


async def test_workflow_creation_validation_and_execution(client, db_sync):
    token = await _login(client, "admin@x.com")
    h = _auth(token)
    ws = await client.post("/api/v1/workspaces", json={"name": "CI WS"}, headers=h)
    wsid = ws.json()["id"]
    await client.post(
        f"/api/v1/workspaces/{wsid}/variables",
        json={"key": "REGION", "value": "ap-south-1"}, headers=h,
    )
    await client.post(
        f"/api/v1/workspaces/{wsid}/secrets",
        json={"key": "API_KEY", "value": "abcdef123456"}, headers=h,
    )

    definition = (
        "name: CI\n"
        "steps:\n"
        "  - name: Greet\n"
        "    run: echo \"hi from $REGION\"\n"
        "  - name: Secret len\n"
        "    run: echo \"len=${#API_KEY}\"\n"
        "  - name: Fail\n"
        "    run: exit 3\n"
        "  - name: Skipped\n"
        "    run: echo nope\n"
    )
    wf = await client.post(
        f"/api/v1/workspaces/{wsid}/workflows",
        json={"name": "CI", "definition": definition}, headers=h,
    )
    assert wf.status_code == 201, wf.text
    wfid = wf.json()["id"]

    # invalid YAML rejected (422)
    bad = await client.post(
        f"/api/v1/workspaces/{wsid}/workflows",
        json={"name": "Bad", "definition": "steps: []"}, headers=h,
    )
    assert bad.status_code == 422

    # trigger via HTTP creates a queued run (dispatch stubbed)
    trig = await client.post(
        f"/api/v1/workspaces/{wsid}/workflows/{wfid}/trigger", headers=h
    )
    assert trig.status_code == 202
    run_id = trig.json()["id"]
    assert trig.json()["status"] == "queued" and trig.json()["run_number"] == 1

    # drive execution exactly as the worker would (sync executor)
    from app.workers.executor import execute_run

    status = execute_run(db_sync, uuid.UUID(run_id))
    assert status == "failed"  # 'exit 3' fails the pipeline

    # fetch run detail via HTTP and assert step outcomes + logs
    detail = await client.get(
        f"/api/v1/workspaces/{wsid}/workflows/{wfid}/runs/{run_id}", headers=h
    )
    steps = detail.json()["steps"]
    assert [s["status"] for s in steps] == ["success", "success", "failed", "skipped"]
    assert "hi from ap-south-1" in steps[0]["logs"]
    assert "len=12" in steps[1]["logs"]
    assert steps[2]["exit_code"] == 3

    # dashboard reflects the run
    stats = await client.get("/api/v1/dashboard/stats", headers=h)
    assert stats.json()["total_runs"] >= 1

    # a failure notification was created for the triggerer
    notifs = await client.get("/api/v1/notifications", headers=h)
    assert any(n["type"] == "error" for n in notifs.json())
