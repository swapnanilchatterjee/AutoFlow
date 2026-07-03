export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  definition: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "daily-backup",
    name: "Daily Database Backup",
    description: "Runs a daily database dump, compresses it, and stores it in the workspace.",
    category: "Backup",
    icon: "HardDrive",
    definition: `name: Daily Database Backup
trigger:
  type: schedule
  cron: "0 2 * * *"

env:
  DB_NAME: my_database
  BACKUP_DIR: backups

steps:
  - name: Dump database
    run: pg_dump $DB_NAME > $BACKUP_DIR/db_$(date +%Y%m%d).sql

  - name: Compress backup
    uses: compress
    with:
      source: $BACKUP_DIR/db_$(date +%Y%m%d).sql
      output: $BACKUP_DIR/db_$(date +%Y%m%d).tar.gz

  - name: Cleanup old backups
    run: find $BACKUP_DIR -name "*.sql" -type f -delete
`
  },
  {
    id: "csv-report",
    name: "CSV Report Generator",
    description: "Generates a CSV report from a SQL query and emails it via Gmail.",
    category: "Reporting",
    icon: "FileSpreadsheet",
    definition: `name: Weekly CSV Report
trigger:
  type: schedule
  cron: "0 9 * * 1"

steps:
  - name: Run query
    uses: sql
    with:
      query: "SELECT * FROM orders WHERE created_at >= NOW() - INTERVAL '7 days'"
      output_file: reports/weekly_orders.csv

  - name: Email report
    uses: gmail
    with:
      to: [admin@example.com]
      subject: "Weekly Orders Report"
      body: "Please find attached the weekly orders report."
      attachments: [reports/weekly_orders.csv]
`
  },
  {
    id: "health-check",
    name: "System Health Check",
    description: "Pings multiple endpoints and sends an alert if any are down.",
    category: "Monitoring",
    icon: "Activity",
    definition: `name: System Health Check
trigger:
  type: schedule
  cron: "*/5 * * * *"

env:
  ENDPOINTS: https://example.com/health https://api.example.com/health

steps:
  - name: Check endpoints
    run: |
      for url in $ENDPOINTS; do
        if ! curl -sf "$url" > /dev/null 2>&1; then
          echo "DOWN: $url"
          exit 1
        fi
        echo "OK: $url"
      done

  - name: Send alert
    uses: telegram
    with:
      to: alerts
      body: "⚠ All systems are healthy."
`
  },
  {
    id: "etl-pipeline",
    name: "ETL Pipeline",
    description: "Extracts data, transforms it with a Python script, and loads results.",
    category: "Data",
    icon: "GitMerge",
    definition: `name: ETL Pipeline
trigger:
  type: schedule
  cron: "0 0 * * *"

steps:
  - name: Extract data
    run: python extract.py

  - name: Transform data
    run: python transform.py --input data/raw.csv --output data/transformed.csv

  - name: Load to database
    uses: sql
    with:
      query: "COPY transformed_table FROM 'data/transformed.csv' DELIMITER ',' CSV HEADER"
      output_file: "data/load_complete.txt"
`
  },
  {
    id: "data-cleanup",
    name: "Data Cleanup & Archive",
    description: "Archives old records and cleans up temporary files weekly.",
    category: "Maintenance",
    icon: "Trash2",
    definition: `name: Weekly Cleanup
trigger:
  type: schedule
  cron: "0 3 * * 0"

steps:
  - name: Archive old logs
    run: |
      find /var/log -name "*.log" -mtime +30 -exec gzip {} \\;
      echo "Archived logs older than 30 days"

  - name: Clean temp files
    run: |
      rm -rf /tmp/workspace-*
      echo "Temporary workspace files cleaned"

  - name: Report status
    run: echo "Cleanup completed at $(date)"
`
  },
  {
    id: "webhook-trigger",
    name: "Webhook Receiver",
    description: "Listens for a webhook call, processes the payload, and logs it.",
    category: "Integration",
    icon: "Webhook",
    definition: `name: Webhook Processor
trigger:
  type: webhook

steps:
  - name: Process payload
    run: |
      echo "Received webhook payload"
      echo "Timestamp: $(date)"
      cat $WEBHOOK_PAYLOAD || echo "No payload file"

  - name: Log event
    run: |
      echo "Webhook processed at $(date)" >> webhook_log.txt
      cat webhook_log.txt
`
  },
];
