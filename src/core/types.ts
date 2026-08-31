export type CategoryId = 'needs-review' | 'needs-action' | 'ready-to-merge';

export type ChecksState =
  | 'SUCCESS'
  | 'FAILURE'
  | 'ERROR'
  | 'PENDING'
  | 'EXPECTED'
  | null;

export type Mergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

/** A Pull Request, normalized from the GraphQL payload. */
export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  author: string;
  isDraft: boolean;
  mergeable: Mergeable;
  reviewDecision: ReviewDecision;
  checks: ChecksState;
  pendingReviewers: number;
  updatedAt: string;
}

/** Why a PR landed in its category — drives the badges on each card. */
export interface Signal {
  label: string;
  tone: 'success' | 'attention' | 'danger' | 'neutral' | 'draft' | 'merge';
}

export interface CategorizedPullRequest extends PullRequest {
  signals: Signal[];
}

export interface PullsResult {
  viewer: string;
  byCategory: Record<CategoryId, CategorizedPullRequest[]>;
  fetchedAt: number;
  /** Check state was not readable — the token lacks `Contents: Read`. */
  checksHidden: boolean;
}
