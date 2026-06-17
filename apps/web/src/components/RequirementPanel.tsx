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
      <p className="panel__description">
        계획 목표를 작성하고 현재 목업 그래프 계약을 생성합니다.
      </p>
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
          placeholder="계획하려는 제품 목표, 사용자 흐름, 아키텍처를 설명해 주세요."
        />
        <button className="button button--primary" type="submit" disabled={isLoading}>
          {isLoading ? "불러오는 중" : "목업 계획 생성"}
        </button>
      </form>
      <div className="button-row" aria-label="MVP 상태 제어">
        <button className="button" type="button" onClick={onReset}>
          비우기
        </button>
        <button className="button" type="button" onClick={onShowError}>
          오류
        </button>
      </div>
    </aside>
  );
}
