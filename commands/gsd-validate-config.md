---
description: Validate .planning/config.json against schema with typo detection
tools:
  read: true
  bash: true
  grep: true
  glob: true
---
<objective>
Validate the .planning/config.json file against the schema. Checks for missing fields, invalid values, and typos in field names.
</objective>

<execution_context>
@/home/cam/.config/opencode/get-shit-done/workflows/cmd-validate-config.md
</execution_context>

<process>
Execute the workflow from the execution_context end-to-end.
</process>
