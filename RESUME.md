# AutoFlow — Resume Bullet Points & Interview Guide

This guide helps you feature AutoFlow on your resume, providing technical bullet points, tech stack keywords, and talking points to showcase your engineering decisions during interviews.

---

## 1. Resume Section: Projects

### **AutoFlow — Self-Hosted Distributed Automation Platform**
*Developer & Architect* | *GitHub: [github.com/swapnanilchatterjee/AutoFlow](https://github.com/swapnanilchatterjee/AutoFlow.git)*

#### **Core Tech Stack**
* **Backend:** Python, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL, Celery, Redis, GitPython, `croniter`, `zoneinfo`.
* **Frontend:** TypeScript, React, Vite, React Router, TailwindCSS.
* **Infra/DevOps:** Docker, Docker Compose, Linux Shell Scripting, SMTP/TLS protocols.

#### **Impact & Technical Achievements (Resume Bullet Points)**

* **Architected a Distributed Asynchronous Task Engine:** Designed a decoupled, high-performance architecture using **FastAPI** for stateless HTTP REST operations, **Redis** as a message broker, and **Celery** for running heavy, background workflow tasks.
* **Engineered a Timezone-Aware Cron Scheduler:** Built a custom Celery Beat scheduling engine that evaluates complex cron expressions against user-defined local timezones (e.g., `Asia/Kolkata`) using Python's native `zoneinfo` and `croniter` libraries.
* **Designed a Secure Cryptographic Secrets Vault:** Implemented symmetric encryption at rest using AES-256 Fernet (`cryptography`) to store sensitive credentials. Secured JWT authentication with automatic access/refresh token rotation and global 401 interception.
* **Created a Workspace Sandbox File Manager:** Developed an isolated file explorer supporting workspace-level path traversal protection, multi-part file uploads (via `FormData`), and automatic markdown rendering of workspace `README.md` files.
* **Integrated Git-based Version Control:** Integrated `GitPython` directly into the backend, allowing users to initialize repositories, stage files, commit changes, and switch branches straight from the web browser.
* **Built a High-Performance Real-Time Frontend:** Authored a React single-page application (SPA) featuring live execution log streaming, dashboard metrics, and **optimistic state updates** for toggle switches to minimize UI latency.

---

## 2. Technical Interview Talking Points

### A. Asynchronous Database Serialization Issues
* **The Problem:** We encountered `MissingGreenlet` errors (500 Internal Server Error) when serializing database objects to Pydantic models. This happened because SQLAlchemy lazy-loaded relationship and timestamp attributes outside of the active database transaction context.
* **The Solution:** We implemented eager relationship fetching using SQLAlchemy’s `selectinload` and explicitly added `await db.refresh(instance)` after flushing updates. This ensured all database columns were loaded in memory before response serialization.

### B. Evaluating Schedules Across Dynamic Timezones
* **The Problem:** The background worker evaluating cron schedules was locked to UTC, causing cron triggers to execute at incorrect local times when users set schedules relative to their regional zones.
* **The Solution:** We updated the Celery Beat scheduler dispatcher to read each workflow's target timezone, convert the current UTC timestamp to that target timezone, and run `croniter` evaluation locally on the adjusted datetime before calculating next run execution windows.

### C. Preventing UI Freezes on Token Expiry
* **The Problem:** When user tokens expired in the background, active background data polling calls received `401 Unauthorized` responses, causing the browser UI buttons to freeze.
* **The Solution:** We built a custom global HTTP interceptor using a React EventEmitter. If a token refresh fails, it instantly triggers a logout broadcast, wipes the context state, and safely redirects the user to `/login` without page disruption.
