---
description: Show recent bGSD notifications
---

Show the last 20 bGSD plugin notifications from the current session.

This command accesses the notification history maintained by the bGSD plugin's notification system.
Notifications include phase completions, state sync events, stuck/loop detection alerts, and auto-fix reports.

**Output format:** Table with timestamp, type, severity, and message for each notification.

If no notifications exist yet in this session, report "No notifications yet."

Note: Notification history is stored in the plugin's in-memory state and is only available during active sessions. There is no CLI command for this — the plugin exposes notifications via its hook system.
