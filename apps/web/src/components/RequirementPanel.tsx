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
      <h2 className="panel__title">요구사항</h2>
      <form
        className="requirement-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onLoadMock();
        }}
      >
        <textarea
          aria-label="계획 요구사항"
          value={requirementText}
          onChange={(event) => setRequirementText(event.target.value)}
          placeholder="무엇을 만들고 싶나요?"
        />
        <button className="button button--primary" type="submit" disabled={isLoading}>
          {isLoading ? "생성 중" : "계획 생성"}
        </button>
      </form>
      <div className="button-row" aria-label="MVP 상태 제어">
        <button className="button" type="button" onClick={onReset}>
          초기화
        </button>
        <button className="button" type="button" onClick={onShowError}>
          오류
        </button>
      </div>
    </aside>
  );
}
