# /gsd-velocity

Show execution velocity metrics: plans completed per day, average duration, and completion forecast for the current milestone.

<process>

<step name="run">
Run the velocity command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs velocity 2>/dev/null)
```

Parse the JSON output which includes:
- `plans_completed`: Total plans completed
- `total_duration_hours`: Total execution time in hours
- `avg_duration_minutes`: Average plan duration in minutes
- `plans_per_day`: Plans completed per day
- `remaining_plans`: Estimated plans remaining
- `forecast_days`: Estimated days to completion
- `by_phase[]`: Per-phase velocity breakdown

**Display format:**

```
## Velocity Report

**Plans completed:** {plans_completed}
**Average duration:** {avg_duration_minutes} min/plan
**Velocity:** {plans_per_day} plans/day
**Total time:** {total_duration_hours} hours

### Forecast

**Remaining:** ~{remaining_plans} plans
**Estimated completion:** ~{forecast_days} days at current velocity

### By Phase

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| {phase} | {count} | {total} | {avg} |
```
</step>

</process>
