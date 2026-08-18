# Planning quality evaluation

This directory contains stable planning requests and deterministic checks used
to compare models and prompt versions.

## Validate the dataset

This command checks the case schema without calling OpenAI:

```powershell
npm run evaluate:planning:check
```

## Test the evaluator

Run deterministic tests for graph cycles, roadmap cycles, duplicate labels,
ordering, node coverage, executable steps, dataset validation, and baseline
comparison without calling OpenAI:

```powershell
npm run evaluate:planning:test
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

The evaluator writes `checkpoint.json` after every completed case. If a
transient API error interrupts the run, repeat the same command with `--resume`
to skip completed cases:

```powershell
npm run evaluate:planning -- --model gpt-5-mini --output-dir tests/evaluation/reports/v2 --resume
```

Transient HTTP 408, 429, 502, 503, and 504 responses are attempted twice by
default with exponential backoff. Use `--max-attempts 1` to disable the extra
attempt. A checkpoint is accepted only when its evaluation schema, ordered case
ids, and requested model match the current run.

Each case checks minimum graph sizes, reference consistency, graph and roadmap
cycles, distinct node responsibilities, contiguous and dependency-safe roadmap
ordering, node coverage, executable step descriptions, required terms, and
forbidden terms. These checks are regression signals, not a complete measure of
subjective plan quality. Human review should accompany baseline changes.
