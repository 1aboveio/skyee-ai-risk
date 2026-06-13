export type ReviewContextType =
  | "PRESCREENING"
  | "WORKFLOW_HUMAN_REVIEW"
  | "SECOND_ROUND"
  | "AD_HOC";

export interface ReviewContext {
  type: ReviewContextType;
  canAccept: boolean;
  canReject: boolean;
  canSaveSnapshot: boolean;
}

const CONTEXT_MAP: Record<ReviewContextType, ReviewContext> = {
  PRESCREENING: {
    type: "PRESCREENING",
    canAccept: false,
    canReject: false,
    canSaveSnapshot: true,
  },
  WORKFLOW_HUMAN_REVIEW: {
    type: "WORKFLOW_HUMAN_REVIEW",
    canAccept: true,
    canReject: true,
    canSaveSnapshot: true,
  },
  SECOND_ROUND: {
    type: "SECOND_ROUND",
    canAccept: true,
    canReject: true,
    canSaveSnapshot: true,
  },
  AD_HOC: {
    type: "AD_HOC",
    canAccept: false,
    canReject: false,
    canSaveSnapshot: true,
  },
};

export function getReviewContext(type: string): ReviewContext {
  const upper = type.toUpperCase() as ReviewContextType;
  return CONTEXT_MAP[upper] ?? CONTEXT_MAP.AD_HOC;
}
