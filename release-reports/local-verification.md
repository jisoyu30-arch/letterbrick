# LetterBrick Release Report
Generated: 2026-06-24T11:11:49.115Z
Status: WARN
## Summary
- Pass: 2
- Warn: 5
- Fail: 0
- Gates: 7
## Gates
| Gate | Status | Detail |
| --- | --- | --- |
| Firebase read | WARN | No Firestore record sample was loaded. |
| Data quality | PASS | errors 0, warnings 0 |
| Monthly archive | WARN | No archive metadata. |
| Archive job | WARN | No scheduled archive run. |
| Restore run | WARN | No restore run history. |
| Duplicate cleanup | WARN | No duplicate cleanup run. |
| Content audit | PASS | errors 0, warnings 0 |

## Operational Notes

- Review warn/fail gates before release.
- Missing operational history is treated as WARN.
- FAIL gates should block release until remediated.
