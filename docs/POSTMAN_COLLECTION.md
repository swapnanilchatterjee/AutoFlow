# AutoFlow Postman API Collection & Reference

This document serves as the complete REST API specification for AutoFlow. Use the request body patterns and curl commands below to configure your Postman workspace collection and perform automated health check runs.

---

## 1. Authentication (OAuth2 Bearer)

### Register User
*   **Method**: `POST`
*   **Path**: `/api/v1/auth/register`
*   **Body (JSON)**:
```json
{
  "email": "tester@example.com",
  "username": "tester",
  "password": "SecurePassword123",
  "full_name": "QA Tester"
}
```

### Obtain OAuth2 Bearer Token
*   **Method**: `POST`
*   **Path**: `/api/v1/auth/token`
*   **Body (Form URL-Encoded)**:
    *   `username`: `tester`
    *   `password`: `SecurePassword123`
*   **Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

## 2. Workspaces Management

### Create Workspace
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (JSON)**:
```json
{
  "name": "Production Workspace",
  "slug": "prod-ws",
  "description": "Primary workflow environment"
}
```

### List Workspaces
*   **Method**: `GET`
*   **Path**: `/api/v1/workspaces`
*   **Headers**: `Authorization: Bearer <token>`

---

## 3. File Manager APIs

### Get Files Tree
*   **Method**: `GET`
*   **Path**: `/api/v1/workspaces/{workspace_id}/files/tree`
*   **Headers**: `Authorization: Bearer <token>`

### Upload File (e.g. CSV or Document)
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/files/upload`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (Multipart Form Data)**:
    *   `file`: `[Select Local File]`
    *   `path`: `reports/data.csv` (Target destination in workspace folder)

### Read File Content
*   **Method**: `GET`
*   **Path**: `/api/v1/workspaces/{workspace_id}/files/read?path=contacts.json`
*   **Headers**: `Authorization: Bearer <token>`

### Write / Update File Text
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/files/write?path=contacts.json`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (JSON)**:
```json
{
  "content": "{\n  \"contacts\": [\n    { \"name\": \"QA Tester\", \"email\": \"tester@example.com\", \"phone\": \"919876543210\", \"groups\": [\"alerts\"] }\n  ]\n}"
}
```

---

## 4. Connections & Integrations

### Create Connection (Gmail / Telegram / WhatsApp)
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/connections`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (JSON - e.g. Telegram Bot)**:
```json
{
  "type": "telegram",
  "name": "Telegram Bot Alerts",
  "config": {
    "token": "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    "default_chat_id": "987654321"
  },
  "enabled": true
}
```

### Test Connection with Optional CSV Attachment
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/connections/{connection_id}/test`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (JSON)**:
```json
{
  "to": "919876543210",
  "include_attachment": true
}
```

---

## 5. Workflow Definitions & Triggers

### Create Workflow
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/workflows`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (JSON)**:
```json
{
  "name": "Weekly Alert Despatch",
  "slug": "weekly-alert",
  "description": "Pushes metrics reports to admin contacts",
  "trigger_type": "schedule",
  "schedule_cron": "0 9 * * 1",
  "schedule_tz": "Asia/Kolkata",
  "definition": "name: Weekly Dispatch\ntrigger:\n  type: schedule\n  cron: \"0 9 * * 1\"\n\nsteps:\n  - name: send_report\n    uses: telegram\n    with:\n      connection: Telegram Bot Alerts\n      to: alerts\n      body: \"System status reports delivered.\"\n",
  "enabled": true
}
```

### Get Workflow Detail (with Next 5 Cron Runs)
*   **Method**: `GET`
*   **Path**: `/api/v1/workspaces/{workspace_id}/workflows/{workflow_id}`
*   **Headers**: `Authorization: Bearer <token>`

### Trigger Manual Execution
*   **Method**: `POST`
*   **Path**: `/api/v1/workspaces/{workspace_id}/workflows/{workflow_id}/trigger`
*   **Headers**: `Authorization: Bearer <token>`

---

## 6. Logs & Statistics

### Get Global Dashboard Stats
*   **Method**: `GET`
*   **Path**: `/api/v1/dashboard/stats`
*   **Headers**: `Authorization: Bearer <token>`

### List Delivery logs
*   **Method**: `GET`
*   **Path**: `/api/v1/deliveries?limit=100&status=delivered&channel=telegram`
*   **Headers**: `Authorization: Bearer <token>`
