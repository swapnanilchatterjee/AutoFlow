# Integrations — deliver reports via Gmail, Telegram & WhatsApp

AutoFlow can deliver a report to the people you want, in the format you want, as a step in
any workflow. This works in two parts:

1. **Connections** — per-workspace, encrypted credentials for a channel. Configure them
   once under a workspace's **Integrations** tab (Maintainer or Owner role).
2. **Action steps** — a workflow step that uses a channel: `uses: gmail | telegram |
   whatsapp` with a uniform `with:` block (`to`, `subject`, `body`, `format`,
   `attachments`).

Credentials never appear in the workflow YAML, and message bodies are never written to run
logs (only delivery metadata is), so substituted secrets can't leak.

```yaml
steps:
  - name: Email the report
    uses: gmail
    with:
      to: [alice@example.com, bob@example.com]
      subject: "Daily report — ${TODAY}"
      body: "Attached is today's report."
      format: text                 # text | html | markdown
      attachments: [reports/daily.pdf]
```

The `with:` fields:

| field         | required | notes                                                                 |
|---------------|----------|-----------------------------------------------------------------------|
| `to`          | yes      | one recipient or a list; `${VAR}` substituted from the run env         |
| `body`        | no       | message text (aliases: `text`, `message`); `${VAR}` substituted        |
| `subject`     | no       | email subject; folded into the first line for Telegram/WhatsApp        |
| `format`      | no       | `text` (default), `html` (Gmail), or `markdown` (Telegram)             |
| `attachments` | no       | workspace-relative file paths, 25 MB total                             |
| `connection`  | no       | name of a specific connection when several of the same type exist      |

If no `connection` is named, the first **enabled** connection of that type is used. A step
fails (non-zero exit, like a shell step) if no enabled connection exists or the provider
rejects the send.

---

## Gmail (SMTP + App Password)

Gmail sends over SMTP (`smtp.gmail.com:465`) using a Google **App Password** — not your
normal login password.

1. Turn on **2-Step Verification** for the Google account
   (Google Account → Security).
2. Create an App Password (Google Account → Security → **App passwords**). Google shows a
   16-character password once.
3. In AutoFlow → workspace → **Integrations** → **Add connection** → **Gmail**:
   - **Gmail address** — the sending account, e.g. `reports@yourco.com`
   - **App password** — the 16-character value
   - **Sender name** *(optional)* — a display name, e.g. `AutoFlow Reports`

Supports: `subject`, `format: html`, and multiple `attachments`.

## Telegram (Bot API)

1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the **bot
   token** (looks like `123456:ABC-DEF...`).
2. Start a chat with your bot (or add it to a group/channel and make it an admin so it can
   post).
3. **Add connection** → **Telegram** → paste the **Bot token**.

Recipients (`to`) are a numeric **chat id** or an **@channel** username the bot can post to.
Documents are sent with `sendDocument`; `format: markdown` / `html` set the parse mode.

> Finding a chat id: message the bot, then open
> `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id`.

## WhatsApp (Cloud API)

Uses Meta's **WhatsApp Cloud API** (Facebook Graph).

1. Create a Meta app at **developers.facebook.com** and add the **WhatsApp** product.
2. From the WhatsApp → API setup page, note the **Phone number ID** and generate an
   **access token** (use a permanent token for production).
3. **Add connection** → **WhatsApp**:
   - **Phone number ID**
   - **Access token**

Recipients (`to`) are phone numbers in international format, e.g. `919876543210`. Text is
sent directly; `attachments` are uploaded to the Media endpoint and delivered as documents.

> Meta only allows free-form messages inside a 24-hour customer-service window; outside it,
> pre-approved template messages are required. For internal report delivery to opted-in
> recipients this is usually fine.

---

## Testing a connection

Each connection has a **Send test** action (⋯ menu on the connection card) that delivers a
not-stored test message to a recipient you enter — a quick way to confirm credentials before
wiring the channel into a workflow.

## Scheduled Diagnostic/Heartbeat Checks

You can configure connections to run automated diagnostic/heartbeat checks on a schedule:
- **Cron expression**: Standard 5-field cron format (e.g., `0 * * * *` for hourly, `0 9 * * 1-5` for weekday mornings).
- **Timezone**: Evaluates the schedule in the selected timezone (e.g., `Asia/Kolkata`, `America/New_York`, `UTC`).
- **Recipient**: The destination address (email, chat ID, phone number) for the scheduled check.

When active, the Celery scheduler will periodically trigger a diagnostic dispatch test, verifying that the credentials are still valid, and record it in the **Delivery log**.


## Delivery log (execution history)

Every action-step send is recorded, so you get a full audit trail of what went out. Open
**Deliveries** in the sidebar for a chronological log across all your workspaces, showing:

- **When** — the day and time the send ran
- **Report** — the workflow and run number (links to the run)
- **Channel** — Gmail / Telegram / WhatsApp
- **To** — the recipients (with an attachment count when files were sent)
- **Format** — text / html / markdown
- **Status** — `executing` while sending, then `delivered` or `failed`

Expand any row for the connection used, subject, provider message ids, timings, and (on a
failure) the error. Filter by status or channel. The list live-refreshes while any delivery
is still `executing`. A workspace-scoped feed is also available at
`GET /workspaces/{id}/deliveries`; the global feed is `GET /deliveries`.

Rows are written by the executor: a delivery is inserted as `executing` right before the
send and flipped to `delivered`/`failed` when it completes — the same `${VAR}`-safe path,
so message bodies are never stored, only delivery metadata.

## How it works internally

- Channels live in `backend/app/integrations/` — one module per channel plus a `registry`
  and a `compose` helper. Each channel takes an **injectable transport** (SMTP factory or
  HTTP-post callable), which is what makes them unit-testable without a network.
- Connections are stored in the `connections` table: `type`, `name`, `enabled`, and a
  Fernet-encrypted JSON `config_encrypted`. Reads redact secret fields (`••••••`).
- At run time the executor (`app/workers/executor.py`) resolves the connection, composes
  the message (substituting `${VAR}` and reading attachments through `safe_join`), calls
  `channel.send(...)`, and records the delivery metadata.

To add a **new channel**: implement a `Channel` subclass (define `type`, `label`,
`config_fields`, and `send`), register it in `app/integrations/registry.py`, and it
automatically appears in the Integrations UI, the `uses:` validator, and the executor.
