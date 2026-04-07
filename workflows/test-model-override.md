<purpose>
Test if model overrides are correctly passed to subagents. Spawns a diagnostic agent with explicit lmstudio model.
</purpose>

<process>

## 1. Check config

Read `.planning/config.json` if it exists and report what model overrides are set.

## 2. Spawn diagnostic agent with explicit model

```bash
echo "Testing model override flow..."
```

Spawn diagnostic agent with hardcoded lmstudio model to verify it works:

```
Task(
  subagent_type="bgsd-model-diagnostic",
  model="lmstudio/qwen3.5-9b",
  description="Test lmstudio model",
  prompt="Report what model you received."
)
```

## 3. Also spawn with mapper_model from context (if available)

If `mapper_model` is available in bgsd-context, also spawn:

```
Task(
  subagent_type="bgsd-model-diagnostic",
  model="{mapper_model}",
  description="Test mapper_model",
  prompt="Report what model you received from mapper_model."
)
```

## 4. Report results

Compare the two:
- Explicit lmstudio model: did it work?
- mapper_model from context: what was the value?

</process>

<success_criteria>
- [ ] Diagnostic agent spawned with explicit lmstudio model
- [ ] Results reported
</success_criteria>