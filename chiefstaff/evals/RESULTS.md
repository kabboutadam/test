# Triage eval log

One row per scored run. Add a row every time the prompt, schema, model or
corpus changes — the point is to be able to see what a change did.

| Date | Corpus | Model / effort | Runs | Precision | Recall | Cost / run | Notes |
|---|---|---|---|---|---|---|---|
| 2026-09-04 | v1, 32 cases (12+) | claude-opus-5 / medium | 2 of 3 | 100% | 100% | $0.16 | Run 3 crashed: model returned an off-enum `category`. Root cause was the SDK dropping `enum` from the schema it sent, so the server never constrained the field. Two perfect runs also mean the corpus is not yet hard enough to discriminate. |
