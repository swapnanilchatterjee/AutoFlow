"""Tests for messaging integrations: channels, composer, connection API, and
action-step execution end to end."""
import uuid

import pytest

from app.core.storage import ensure_workspace_dir
from app.integrations.base import Attachment, ChannelError, HttpResponse, OutboundMessage
from app.integrations.compose import compose_message
from app.integrations.gmail import GmailChannel
from app.integrations.telegram import TelegramChannel
from app.integrations.whatsapp import WhatsAppChannel

# --------------------------------------------------------------------------- #
# Composer (pure, synchronous)
# --------------------------------------------------------------------------- #


def test_compose_parses_recipients_and_substitutes_vars():
    wid = uuid.uuid4()
    msg = compose_message(
        {"to": "a@x.com, b@x.com", "subject": "Hi ${NAME}", "body": "Value=${V}"},
        {"NAME": "Bob", "V": "42"},
        wid,
    )
    assert msg.recipients == ["a@x.com", "b@x.com"]
    assert msg.subject == "Hi Bob"
    assert msg.body == "Value=42"


def test_compose_reads_attachments_and_blocks_traversal():
    wid = uuid.uuid4()
    d = ensure_workspace_dir(wid)
    (d / "report.csv").write_text("a,b\n1,2\n")
    msg = compose_message({"to": "x", "attachments": ["report.csv"]}, {}, wid)
    assert msg.attachments[0].filename == "report.csv" and msg.attachments[0].size > 0

    with pytest.raises(ChannelError):
        compose_message({"to": "x", "attachments": ["../escape"]}, {}, wid)
    with pytest.raises(ChannelError):
        compose_message({"to": "x", "attachments": ["missing.txt"]}, {}, wid)
    with pytest.raises(ChannelError):
        compose_message({"body": "no recipient"}, {}, wid)


# --------------------------------------------------------------------------- #
# Channels (injected fake transports — no network)
# --------------------------------------------------------------------------- #


def test_telegram_message_then_document_and_error():
    calls = []

    def ok_post(url, **kw):
        calls.append(url)
        return HttpResponse(200, "", {"ok": True, "result": {"message_id": 7}})

    ch = TelegramChannel({"bot_token": "T"}, http_post=ok_post)
    r = ch.send(OutboundMessage(recipients=["@c"], body="hi", body_format="markdown"))
    assert r.ok and calls[-1].endswith("/sendMessage") and r.provider_refs == ["7"]

    ch.send(OutboundMessage(recipients=["@c"], body="cap",
                            attachments=[Attachment("f.txt", b"x", "text/plain")]))
    assert calls[-1].endswith("/sendDocument")

    def bad_post(url, **kw):
        return HttpResponse(400, "bad", {"ok": False, "description": "chat not found"})

    with pytest.raises(ChannelError):
        TelegramChannel({"bot_token": "T"}, http_post=bad_post).send(
            OutboundMessage(recipients=["@c"], body="hi")
        )


def test_whatsapp_uploads_media_then_sends_document():
    def post(url, **kw):
        if url.endswith("/media"):
            return HttpResponse(200, "", {"id": "MEDIA1"})
        return HttpResponse(200, "", {"messages": [{"id": "WAMID"}]})

    ch = WhatsAppChannel({"phone_number_id": "P", "access_token": "T"}, http_post=post)
    r = ch.send(OutboundMessage(recipients=["919999999999"], body="hi",
                                attachments=[Attachment("r.pdf", b"x", "application/pdf")]))
    assert r.ok and "WAMID" in r.provider_refs


def test_gmail_builds_mime_and_authenticates():
    captured = {}

    class FakeSMTP:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def login(self, u, p):
            captured["auth"] = (u, p)

        def send_message(self, m):
            captured["msg"] = m

    ch = GmailChannel(
        {"email": "me@gmail.com", "app_password": "pw", "from_name": "Bot"},
        smtp_factory=lambda h, p: FakeSMTP(),
    )
    r = ch.send(OutboundMessage(recipients=["a@x.com"], subject="S", body="<b>h</b>",
                                body_format="html",
                                attachments=[Attachment("r.csv", b"a,b\n", "text/csv")]))
    assert r.ok
    assert captured["auth"] == ("me@gmail.com", "pw")
    assert captured["msg"]["To"] == "a@x.com" and captured["msg"]["Subject"] == "S"


# --------------------------------------------------------------------------- #
# Connection API + action-step execution (async, SQLite-backed)
# --------------------------------------------------------------------------- #

pytestmark_async = pytest.mark.asyncio


async def _owner(client, username):
    await client.post("/api/v1/auth/register",
                      json={"email": f"{username}@x.com", "username": username, "password": "password123"})
    tok = (await client.post("/api/v1/auth/login",
                             data={"username": username, "password": "password123"})).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    wsid = (await client.post("/api/v1/workspaces", json={"name": f"{username} WS"}, headers=h)).json()["id"]
    return h, wsid


async def test_connection_crud_and_secret_masking(client):
    h, wsid = await _owner(client, "connowner")

    cat = (await client.get(f"/api/v1/workspaces/{wsid}/connections/catalog", headers=h)).json()
    assert {c["type"] for c in cat} == {"gmail", "telegram", "whatsapp"}

    created = await client.post(
        f"/api/v1/workspaces/{wsid}/connections",
        json={"type": "gmail", "name": "Reports",
              "config": {"email": "me@gmail.com", "app_password": "secretpw"}},
        headers=h,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["config_summary"]["email"] == "me@gmail.com"
    assert body["config_summary"]["app_password"] == "••••••"  # masked, never returned raw
    cid = body["id"]

    # validation: missing required field, unknown type, duplicate name
    assert (await client.post(f"/api/v1/workspaces/{wsid}/connections",
            json={"type": "telegram", "name": "tg", "config": {}}, headers=h)).status_code == 422
    assert (await client.post(f"/api/v1/workspaces/{wsid}/connections",
            json={"type": "slack", "name": "s", "config": {"x": "y"}}, headers=h)).status_code == 422
    assert (await client.post(f"/api/v1/workspaces/{wsid}/connections",
            json={"type": "gmail", "name": "Reports",
                  "config": {"email": "a@b.com", "app_password": "z"}}, headers=h)).status_code == 409

    # update: blank secret keeps the old value, non-secret updates
    up = await client.patch(f"/api/v1/workspaces/{wsid}/connections/{cid}",
                            json={"config": {"from_name": "Nightly", "app_password": ""}}, headers=h)
    assert up.status_code == 200
    assert up.json()["config_summary"]["from_name"] == "Nightly"
    assert up.json()["config_summary"]["app_password"] == "••••••"

    assert len((await client.get(f"/api/v1/workspaces/{wsid}/connections", headers=h)).json()) == 1
    assert (await client.delete(f"/api/v1/workspaces/{wsid}/connections/{cid}", headers=h)).status_code == 200


async def test_action_step_delivers_via_connection(client, db_sync, monkeypatch):
    h, wsid = await _owner(client, "actor")
    await client.post(f"/api/v1/workspaces/{wsid}/connections",
                      json={"type": "telegram", "name": "tg-main", "config": {"bot_token": "T"}}, headers=h)

    definition = (
        "steps:\n"
        "  - name: Notify team\n"
        "    uses: telegram\n"
        "    with:\n"
        "      to: '@team'\n"
        "      body: 'Report ready'\n"
    )
    wf = (await client.post(f"/api/v1/workspaces/{wsid}/workflows",
                            json={"name": "Notifier", "definition": definition}, headers=h)).json()
    run = (await client.post(
        f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/trigger", headers=h)).json()

    # no network: stub httpx.post used by the default transport
    import httpx

    class FakeResp:
        status_code = 200
        text = ""

        def json(self):
            return {"ok": True, "result": {"message_id": 99}}

    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResp())

    from app.workers.executor import execute_run

    assert execute_run(db_sync, uuid.UUID(run["id"])) == "success"

    detail = (await client.get(
        f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/runs/{run['id']}", headers=h)).json()
    step = detail["steps"][0]
    assert step["status"] == "success"
    assert "telegram via connection 'tg-main'" in step["logs"]
    assert "Sent to 1 chat(s)" in step["logs"]


async def test_action_step_without_connection_fails(client, db_sync):
    h, wsid = await _owner(client, "noconn")
    definition = (
        "steps:\n"
        "  - name: Email\n"
        "    uses: gmail\n"
        "    with:\n"
        "      to: someone@x.com\n"
        "      body: hello\n"
    )
    wf = (await client.post(f"/api/v1/workspaces/{wsid}/workflows",
                            json={"name": "NoConn", "definition": definition}, headers=h)).json()
    run = (await client.post(
        f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/trigger", headers=h)).json()

    from app.workers.executor import execute_run

    assert execute_run(db_sync, uuid.UUID(run["id"])) == "failed"
    detail = (await client.get(
        f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/runs/{run['id']}", headers=h)).json()
    assert "No enabled gmail connection" in detail["steps"][0]["logs"]


async def test_delivery_log_records_successful_send(client, db_sync, monkeypatch):
    h, wsid = await _owner(client, "deliverer")
    await client.post(f"/api/v1/workspaces/{wsid}/connections",
                      json={"type": "telegram", "name": "tg-log", "config": {"bot_token": "T"}}, headers=h)
    definition = (
        "steps:\n"
        "  - name: Send nightly\n"
        "    uses: telegram\n"
        "    with:\n"
        "      to: '@log'\n"
        "      subject: Nightly\n"
        "      format: markdown\n"
        "      body: 'Report ready'\n"
    )
    wf = (await client.post(f"/api/v1/workspaces/{wsid}/workflows",
                            json={"name": "Logger", "definition": definition}, headers=h)).json()
    run = (await client.post(f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/trigger", headers=h)).json()

    import httpx

    class FakeResp:
        status_code = 200
        text = ""

        def json(self):
            return {"ok": True, "result": {"message_id": 5}}

    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResp())
    from app.workers.executor import execute_run

    assert execute_run(db_sync, uuid.UUID(run["id"])) == "success"

    # global delivery feed
    feed = (await client.get("/api/v1/deliveries", headers=h)).json()
    assert len(feed) >= 1
    d = feed[0]
    assert d["status"] == "delivered"
    assert d["channel"] == "telegram"
    assert d["connection_name"] == "tg-log"
    assert "@log" in d["recipients"]
    assert d["body_format"] == "markdown"
    assert d["run_number"] >= 1
    assert d["workflow_name"] == "Logger"

    # workspace-scoped feed + status filter
    wsd = (await client.get(f"/api/v1/workspaces/{wsid}/deliveries?status=delivered", headers=h)).json()
    assert len(wsd) >= 1 and all(x["status"] == "delivered" for x in wsd)


async def test_delivery_log_records_failure(client, db_sync):
    h, wsid = await _owner(client, "deliverfail")
    definition = (
        "steps:\n"
        "  - name: Email\n"
        "    uses: gmail\n"
        "    with:\n"
        "      to: nobody@x.com\n"
        "      body: hi\n"
    )
    wf = (await client.post(f"/api/v1/workspaces/{wsid}/workflows",
                            json={"name": "FailLogger", "definition": definition}, headers=h)).json()
    run = (await client.post(f"/api/v1/workspaces/{wsid}/workflows/{wf['id']}/trigger", headers=h)).json()

    from app.workers.executor import execute_run

    assert execute_run(db_sync, uuid.UUID(run["id"])) == "failed"

    feed = (await client.get(f"/api/v1/workspaces/{wsid}/deliveries?status=failed", headers=h)).json()
    assert len(feed) >= 1
    assert feed[0]["status"] == "failed"
    assert feed[0]["channel"] == "gmail"
    assert "nobody@x.com" in feed[0]["recipients"]
