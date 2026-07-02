# AutoFlow — Product Presentation & Pitch Deck

## 🚀 The Vision: Next-Gen Self-Hosted Automation
AutoFlow is a **100% free, self-hosted automation platform** built for developers, data engineers, and DevOps teams. It provides a clean, modern UI combined with an isolated runtime engine to orchestrate local scripts, SQL jobs, analytical reporting, and messaging integrations—giving you the convenience of **GitHub Actions** but optimized for local, private infrastructure.

---

## 💡 The Problem We Solve

| The Status Quo | The AutoFlow Solution |
| :--- | :--- |
| **Untracked Cron Jobs**: Hard to debug, lack centralized logging, no visual status history. | **Visual Execution Dashboard**: Live-streamed logs, per-step execution status, absolute line numbers, and historical timeline trend charts. |
| **Cloud Schedulers (SaaS Lock-in)**: High pricing, data privacy concerns, secrets stored on third-party servers. | **100% Self-Hosted & Secure**: Runs inside your local Docker stack. Workspace secrets are encrypted at rest via Fernet keys stored locally. |
| **Monolithic Infrastructure**: High CPU overhead, complex setups, hard to scale. | **Decoupled Architecture**: Fast Uvicorn + FastAPI web server, async task dispatching via Celery Workers, and Redis caching broker. |

---

## 🛠️ Core Platform Capabilities

1. **Workspace Isolation**: Virtual projects with dedicated file systems, Git repositories, variables, and role-based access controls (RBAC).
2. **Workflow YAML Engine**: Orchestrate complex multi-step pipelines with top-level environments, step execution flags, and `continue_on_error` controls.
3. **Built-in Schedulers & Webhooks**: Triggers workflow runs on cron-based intervals (evaluated every minute) or via unguessable secure webhook URLs.
4. **Git Integration**: Full version control system directly integrated into each workspace directory, letting you track code alterations dynamically.

---

## 🔥 Recent Product Innovations

### 🔌 1. Flexible SMTP Server Customisation
*   **Enterprise Server Support**: Support for Gmail App Passwords, custom relays, and enterprise networks (such as Office365 `smtp.office365.com` on port `587`).
*   **STARTTLS Support**: Secure handshakes initialized dynamically over TLS (STARTTLS protocol on port `587` or non-SSL connections), alongside traditional SSL on port `465`.
*   **Reports & Attachments Delivery**: Generate documents (CSV, PDF, stamp texts) inside workspace steps, and deliver them directly via integrated mail dispatches.

### 🐍 2. File-Based Python Execution (Local CI/CD)
*   **Upload & Orchestrate**: Upload, write, or pull `.py` files into the workspace directory.
*   **Direct Execution**: Orchestrate runs using standard shell execution steps: `run: python hello_report.py`.
*   **CLI Parameter Passing**: Pass dynamic arguments (`sys.argv`) and capture raw outputs and errors directly in the step console logs.

### 📊 3. Interactive Zoomable Trend Graph
*   **Real-time Scroll-to-Zoom**: Dynamic pixel-based width scaling. Simply **hover over the graph and scroll the mouse wheel** to zoom in and out horizontally in real-time, just like financial stock-market applications.
*   **Status Filters**: Toggle between views to show all executions or isolate Success (Delivered), Failed, or Executing timelines.
*   **Vertex Data Dots**: Visible coordinates plotted directly on paths to denote execution ticks.
*   **Expanded white tooltip card**: High-contrast, floating tooltip displaying clear, larger stats.
*   **Click-to-Inspect Overlay (Stock-style)**: Clicking any coordinate dot or vertical gridline anchors a solid indigo guide line, overlays a larger coordinate marker, and expands a dedicated datapoint card underneath the chart showing the exact timestamp and run counts.

### 🔔 4. Dynamic Notifications Dropdown
*   **Recent 5 Timeline**: The header bell icon now opens a rich floating dropdown menu showing the 5 most recent read/unread system notifications.
*   **Direct Navigation**: Clicking any notification item automatically marks it as read, updates the global unread count in real-time, and routes directly to the relevant resource or run.
*   **Clean Status Color-Coding**: Displays clear color indicators (Success vs. Failures) and human-friendly time tags.
*   **"See all" shortcut**: Quick redirect button at the footer to navigate to the full notifications inbox list.

### 📂 5. SPA Route & Tab State Persistence
*   **URL Parameter Binding**: Workspace details sub-tabs (Files, Workflows, Contacts, Secrets, Members, Settings) are now bound to the `?tab=` URL query parameter.
*   **Flawless Back-Navigation**: Going back from a workflow's run details or editor correctly remembers and returns the user to the `Workflows` tab rather than defaulting to the first `Files` tab.
*   **Refresh Proof**: Reloading the page maintains the currently active view tab.

### ✉️ 6. Optional Failure Email Notification with Logs
*   **Toggle Switch**: Easily enable or disable emails on failed executions with a toggle switch on the Workflow Details page.
*   **Direct-to-Inbox Alert**: Automatically delivers notifications to the email used during registration.
*   **Comprehensive Log Logs**: Embeds the full step-by-step stdout/stderr execution logs and error details directly in the email body, saving time troubleshooting.

---

## 🏗️ Technical Architecture & Scale

*   **FastAPI & Uvicorn**: High-throughput REST API layer.
*   **Celery & Redis**: Background job queue processing heavy shell workloads asynchronously.
*   **PostgreSQL 16**: Relational storage for metadata, deliveries, users, and audit logs.
*   **Vite React SPA**: Modern single page application built on React 18, TypeScript, and TailwindCSS.
