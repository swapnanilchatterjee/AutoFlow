"""Outbound messaging channels (Gmail / Telegram / WhatsApp).

Channels let a workflow deliver a report to people in the format they want.
They are used two ways:
  * as workflow *action steps* (``uses: gmail`` etc.) run by the executor, and
  * configured per workspace as encrypted *connections* (credentials at rest).
"""
