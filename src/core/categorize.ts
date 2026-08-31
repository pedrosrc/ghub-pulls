import type {
  CategorizedPullRequest,
  CategoryId,
  PullRequest,
  PullsResult,
  Signal,
} from './types';
import type { GitHubPulls } from '../lib/github';

export const CATEGORIES: Array<{ id: CategoryId; label: string; short: string }> = [
  { id: 'needs-review', label: 'Needs your review', short: 'Review' },
  { id: 'needs-action', label: 'Needs action', short: 'Action' },
  { id: 'ready-to-merge', label: 'Ready to merge', short: 'Merge' },
];


export function needsActionSignals(pr: PullRequest, checksHidden = false): Signal[] {
  const signals: Signal[] = [];

  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    signals.push({ label: 'Changes requested', tone: 'danger' });
  }
  if (pr.mergeable === 'CONFLICTING') {
    signals.push({ label: 'Merge conflicts', tone: 'danger' });
  }
  if (!checksHidden && (pr.checks === 'FAILURE' || pr.checks === 'ERROR')) {
    signals.push({ label: 'Checks failing', tone: 'danger' });
  }
  if (pr.isDraft) {
    signals.push({ label: 'Draft', tone: 'draft' });
  }

  return signals;
}


export function isReadyToMerge(pr: PullRequest, checksHidden = false): boolean {
  if (pr.isDraft) return false;
  if (pr.mergeable !== 'MERGEABLE') return false;
  // When the token cannot read checks at all, requiring green checks would empty
  // this list for every least-privilege token. The card says so instead.
  if (!checksHidden && pr.checks && pr.checks !== 'SUCCESS') return false;

  if (pr.reviewDecision === 'APPROVED') return true;
  return pr.reviewDecision === null && pr.pendingReviewers === 0;
}

function reviewSignals(pr: PullRequest, checksHidden: boolean): Signal[] {
  const signals: Signal[] = [];

  if (pr.isDraft) signals.push({ label: 'Draft', tone: 'draft' });
  if (pr.mergeable === 'CONFLICTING') {
    signals.push({ label: 'Conflicts', tone: 'attention' });
  }
  if (checksHidden) {
    // No check badge at all rather than a misleading one.
  } else if (pr.checks === 'FAILURE' || pr.checks === 'ERROR') {
    signals.push({ label: 'Checks failing', tone: 'danger' });
  } else if (pr.checks === 'PENDING' || pr.checks === 'EXPECTED') {
    signals.push({ label: 'Checks running', tone: 'attention' });
  } else if (pr.checks === 'SUCCESS') {
    signals.push({ label: 'Checks passing', tone: 'success' });
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    signals.push({ label: 'Changes requested', tone: 'attention' });
  }

  return signals;
}

function readySignals(pr: PullRequest, checksHidden: boolean): Signal[] {
  const signals: Signal[] = [
    {
      label: pr.reviewDecision === 'APPROVED' ? 'Approved' : 'No review required',
      tone: 'success',
    },
  ];
  if (checksHidden) {
    signals.push({ label: 'Checks not visible', tone: 'neutral' });
  } else if (pr.checks === 'SUCCESS') {
    signals.push({ label: 'Checks passing', tone: 'success' });
  }
  signals.push({ label: 'Mergeable', tone: 'merge' });
  return signals;
}

const byRecency = (a: PullRequest, b: PullRequest): number =>
  b.updatedAt.localeCompare(a.updatedAt);

export function categorize(pulls: GitHubPulls): PullsResult {
  const { checksHidden } = pulls;

  const needsReview: CategorizedPullRequest[] = pulls.needsReview
    .slice()
    .sort(byRecency)
    .map((pr) => ({ ...pr, signals: reviewSignals(pr, checksHidden) }));

  const needsAction: CategorizedPullRequest[] = [];
  const readyToMerge: CategorizedPullRequest[] = [];

  for (const pr of pulls.mine.slice().sort(byRecency)) {
    const blocking = needsActionSignals(pr, checksHidden);
    if (blocking.length > 0) {
      needsAction.push({ ...pr, signals: blocking });
    } else if (isReadyToMerge(pr, checksHidden)) {
      readyToMerge.push({ ...pr, signals: readySignals(pr, checksHidden) });
    }
  }

  return {
    viewer: pulls.viewer,
    byCategory: {
      'needs-review': needsReview,
      'needs-action': needsAction,
      'ready-to-merge': readyToMerge,
    },
    fetchedAt: Date.now(),
    checksHidden,
  };
}
