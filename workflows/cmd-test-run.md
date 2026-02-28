# /gsd-test-run

Parse test output and apply pass/fail gating. Detects test framework (ExUnit, Go test, pytest, Node.js test runner) and reports structured results.

<process>

<step name="run">
Run the test-run command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs test-run 2>/dev/null)
```

Parse the JSON output which includes:
- `framework`: Detected test framework name
- `passed`: Number of tests passed
- `failed`: Number of tests failed
- `skipped`: Number of tests skipped
- `total`: Total tests run
- `gate`: "pass" | "fail"
- `failures[]`: Details of failed tests (name, message)
- `duration`: Test run duration

**Display format:**

```
## Test Results

**Framework:** {framework}
**Gate:** {gate === "pass" ? "✓ PASSED" : "✗ FAILED"}
**Duration:** {duration}

| Status | Count |
|--------|-------|
| Passed | {passed} |
| Failed | {failed} |
| Skipped | {skipped} |
| **Total** | **{total}** |

{If failures:}
### Failures

{For each failure:}
- **{name}**: {message}
```

If gate is "fail": highlight that execution should not proceed until tests pass.
</step>

</process>
