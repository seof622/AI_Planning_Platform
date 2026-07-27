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

Generated JSON and Markdown reports are written to
`tests/evaluation/reports/`. Reports are ignored by Git by default; commit only
an intentionally selected baseline report.

Each case checks minimum graph sizes, reference consistency, required terms,
and forbidden terms. These checks are regression signals, not a complete
measure of subjective plan quality. Human review should accompany baseline
changes.
