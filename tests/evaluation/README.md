# Planning quality evaluation

This directory contains stable planning requests and deterministic checks used
to compare models and prompt versions.

## Validate the dataset

This command checks the case schema without calling OpenAI:

```powershell
npm run evaluate:planning:check
```

## Run an evaluation

Start the API, then run:

```powershell
npm run evaluate:planning -- --model gpt-5-mini
```

The command calls `/planning/generate` once per case, so it consumes provider
credits. Use `--base-url` to target another API or `--cases` to select a
different case file.

To compare a new prompt against a committed or retained JSON baseline generated
from the same cases:

```powershell
npm run evaluate:planning -- --model gpt-5-mini --baseline path/to/v1-report.json
```

The comparison records average and per-case score deltas. Generate the v1
baseline with this same evaluator and dataset against an API instance running
v1; incompatible evaluation schemas are rejected. Cases absent from the
baseline are marked as new.

The API prompt is selected at startup with `PLANNING_PROMPT_VERSION`. Generate
the baseline with `planning-prompt-v1`, then restart with
`planning-prompt-v2` before running the comparison command.

Generated JSON and Markdown reports are written to
`tests/evaluation/reports/`. Reports are ignored by Git by default; commit only
an intentionally selected baseline report.

Each case checks minimum graph sizes, reference consistency, graph and roadmap
cycles, distinct node responsibilities, contiguous and dependency-safe roadmap
ordering, node coverage, executable step descriptions, required terms, and
forbidden terms. These checks are regression signals, not a complete measure of
subjective plan quality. Human review should accompany baseline changes.
