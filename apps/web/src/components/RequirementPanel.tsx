"use client";

interface RequirementPanelProps {
  isLoading: boolean;
  onLoadMock: () => Promise<void>;
  onReset: () => void;
  onShowError: () => void;
  requirementText: string;
  setRequirementText: (value: string) => void;
}

export function RequirementPanel({
  isLoading,
  onLoadMock,
  onReset,
  onShowError,
  requirementText,
  setRequirementText,
}: RequirementPanelProps) {
  return (
    <aside className="panel">
      <h2 className="panel__title">Requirement</h2>
      <p className="panel__description">
        Draft the planning goal and generate the current mock graph contract.
      </p>
      <form
        className="requirement-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onLoadMock();
        }}
      >
        <textarea
          aria-label="Planning requirement"
          value={requirementText}
          onChange={(event) => setRequirementText(event.target.value)}
          placeholder="Describe the product goal, user workflow, or architecture you want to plan."
        />
        <button className="button button--primary" type="submit" disabled={isLoading}>
          {isLoading ? "Loading" : "Generate mock plan"}
        </button>
      </form>
      <div className="button-row" aria-label="MVP state controls">
        <button className="button" type="button" onClick={onReset}>
          Empty
        </button>
        <button className="button" type="button" onClick={onShowError}>
          Error
        </button>
      </div>
    </aside>
  );
}
