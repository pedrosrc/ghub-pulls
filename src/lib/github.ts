import { AppError } from './errors';
import type { PullRequest } from '../core/types';

const ENDPOINT = 'https://api.github.com/graphql';

const PR_FIELDS = `
  id
  number
  title
  url
  isDraft
  updatedAt
  mergeable
  reviewDecision
  author { login }
  repository { nameWithOwner }
  reviewRequests(first: 1) { totalCount }
  commits(last: 1) {
    nodes { commit { statusCheckRollup { state } } }
  }
`;


const QUERY = `
query GhubPulls($reviewQuery: String!, $mineQuery: String!) {
  viewer { login }
  rateLimit { remaining resetAt }
  needsReview: search(query: $reviewQuery, type: ISSUE, first: 50) {
    nodes { ... on PullRequest { ${PR_FIELDS} } }
  }
  mine: search(query: $mineQuery, type: ISSUE, first: 50) {
    nodes { ... on PullRequest { ${PR_FIELDS} } }
  }
}
`;

interface RawPullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  mergeable: PullRequest['mergeable'];
  reviewDecision: PullRequest['reviewDecision'];
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  reviewRequests: { totalCount: number } | null;
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } } | null> };
}

interface GraphQLResponse {
  data?: {
    viewer: { login: string };
    rateLimit: { remaining: number; resetAt: string } | null;
    needsReview: { nodes: Array<RawPullRequest | null> };
    mine: { nodes: Array<RawPullRequest | null> };
  };
  errors?: Array<{ message: string; type?: string; path?: Array<string | number> }>;
}

export interface GitHubPulls {
  viewer: string;
  needsReview: PullRequest[];
  mine: PullRequest[];
  checksHidden: boolean;
}

export async function fetchPulls(token: string): Promise<GitHubPulls> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        reviewQuery: 'is:open is:pr review-requested:@me archived:false',
        mineQuery: 'is:open is:pr author:@me archived:false',
      },
    }),
  });

  assertOk(response);

  const payload = (await response.json()) as GraphQLResponse;

  if (!payload.data) {
    const [first] = payload.errors ?? [];
    const message = first?.message ?? 'GitHub returned an empty response';
    if (/rate limit/i.test(message)) {
      throw new AppError('rate-limit', 'GitHub API rate limit reached', message);
    }
    if (/insufficient|not authorized|permission/i.test(message)) {
      throw new AppError('forbidden', 'GitHub denied access', message);
    }
    throw new AppError('unknown', message);
  }

  if (payload.errors?.length) {
    console.warn(
      '[ghub-pulls] partial GitHub response:',
      payload.errors.map((error) => error.message).join(' | '),
    );
  }

  return {
    viewer: payload.data.viewer.login,
    needsReview: payload.data.needsReview.nodes.flatMap(normalize),
    mine: payload.data.mine.nodes.flatMap(normalize),
    checksHidden: (payload.errors ?? []).some(
      (error) => error.type === 'FORBIDDEN' && error.path?.includes('commits'),
    ),
  };
}

export async function verifyToken(token: string): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '{ viewer { login } }' }),
  });

  assertOk(response);

  const payload = (await response.json()) as GraphQLResponse;
  if (payload.errors?.length || !payload.data) {
    throw new AppError(
      'unauthorized',
      'This token could not be used',
      payload.errors?.[0]?.message ?? 'Make sure it has read access to pull requests.',
    );
  }
  return payload.data.viewer.login;
}

function assertOk(response: Response): void {
  if (response.ok) return;

  if (response.status === 401) {
    throw new AppError(
      'unauthorized',
      'Your GitHub token is invalid or expired',
      'Open settings and paste a new token.',
    );
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0' || response.status === 429) {
      const reset = response.headers.get('x-ratelimit-reset');
      throw new AppError(
        'rate-limit',
        'GitHub API rate limit reached',
        reset ? `Try again after ${formatReset(reset)}.` : 'Try again in a few minutes.',
      );
    }
    throw new AppError(
      'forbidden',
      'GitHub denied access',
      'The token may be missing "Pull requests: Read" on the repositories you need.',
    );
  }
  throw new AppError('unknown', `GitHub responded with ${response.status}`);
}

function formatReset(resetSeconds: string): string {
  const reset = new Date(Number(resetSeconds) * 1000);
  return reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalize(raw: RawPullRequest | null): PullRequest[] {
  if (!raw || typeof raw.number !== 'number') return [];

  const rollup = raw.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null;

  return [
    {
      id: raw.id,
      number: raw.number,
      title: raw.title,
      url: raw.url,
      repo: raw.repository.nameWithOwner,
      author: raw.author?.login ?? 'ghost',
      isDraft: raw.isDraft,
      mergeable: raw.mergeable,
      reviewDecision: raw.reviewDecision,
      checks: (rollup as PullRequest['checks']) ?? null,
      pendingReviewers: raw.reviewRequests?.totalCount ?? 0,
      updatedAt: raw.updatedAt,
    },
  ];
}
