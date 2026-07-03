export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  role: string;
  theme_preference?: string | null;
  created_at: string;
  updated_at: string;
  last_password_changed?: string | null;
}

export interface ThemePreference {
  theme_preference: "light" | "dark" | "system";
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  role: string | null;
}

export interface Member {
  id: string;
  user_id: string;
  role: string;
  user: User;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number | null;
}
export interface DirListing { path: string; entries: FileNode[]; }
export interface FileContent { path: string; content: string; size: number; encoding: string; }

export interface GitFileStatus { path: string; status: string; }
export interface GitStatus {
  initialized: boolean;
  branch: string | null;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  clean: boolean;
}
export interface CommitInfo { sha: string; short_sha: string; message: string; author: string; date: string; }
export interface BranchInfo { name: string; is_current: boolean; }

export interface Secret { id: string; key: string; description: string | null; created_at: string; updated_at: string; }
export interface Variable { id: string; key: string; value: string; description: string | null; created_at: string; }

export type TriggerType = "manual" | "schedule" | "webhook";
export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  definition: string;
  trigger_type: TriggerType;
  schedule_cron: string | null;
  schedule_tz: string | null;
  next_runs?: string[] | null;
  enabled: boolean;
  email_on_failure: boolean;
  webhook_token: string | null;
  priority: string;
  blackout_start: string | null;
  blackout_end: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}


export interface StepRun {
  id: string;
  name: string;
  step_index: number;
  status: StepStatus;
  command: string;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  logs: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workspace_id: string;
  run_number: number;
  status: RunStatus;
  trigger: string;
  commit_sha: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  created_at: string;
  steps?: StepRun[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  workspace_id: string | null;
  created_at: string;
}

export interface RecentRun {
  id: string;
  workflow_id: string;
  workspace_id: string;
  workflow_name: string;
  workspace_slug: string;
  status: string;
  run_number: number;
  created_at: string;
}

export interface DashboardStats {
  workspaces: number;
  workflows: number;
  total_runs: number;
  runs_by_status: { status: string; count: number }[];
  success_rate: number;
  recent_runs: RecentRun[];
}


export interface ChannelField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  help: string;
  placeholder: string;
}

export interface ChannelCatalogItem {
  type: string;
  label: string;
  send_hint: string;
  supports_attachments: boolean;
  supports_subject: boolean;
  supports_html: boolean;
  config_fields: ChannelField[];
}

export interface Connection {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  config_summary: Record<string, string>;
  schedule_cron: string | null;
  schedule_tz: string | null;
  schedule_to: string | null;
  next_runs?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  detail: string;
}

export interface Delivery {
  id: string;
  workspace_id: string;
  workspace_slug: string | null;
  workflow_id: string | null;
  workflow_name: string;
  run_id: string | null;
  run_number: number | null;
  step_name: string;
  channel: string;
  connection_name: string;
  recipients: string[];
  recipient_count: number;
  body_format: string;
  subject: string | null;
  attachment_count: number;
  status: string;
  detail: string | null;
  provider_refs: string[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkflowComment {
  id: string;
  workflow_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowShare {
  id: string;
  workflow_id: string;
  user_id: string | null;
  team_name: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_workspaces: number;
  total_workflows: number;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
}

export interface WorkerInfo {
  name: string;
  status: string;
  pid: number | null;
  uptime: number;
  active_tasks: number;
  last_heartbeat?: string | null;
  total_tasks?: number | null;
  memory_usage?: number | null;
  error?: string;
}

export interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ApiTokenCreated {
  id: string;
  name: string;
  token: string;
  created_at: string;
  expires_at: string | null;
}

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_sender_email: string;
  smtp_sender_name: string;
  smtp_use_tls: boolean;
}

export interface AdminActivityLog {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string | null;
  } | null;
}

export interface RetentionConfig {
  auto_delete_enabled: boolean;
  runs_value: number;
  runs_unit: string;
  logs_value: number;
  logs_unit: string;
}

export interface CleanupResult {
  detail: string;
  deleted_runs: number;
  deleted_steps: number;
  deleted_deliveries: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}


