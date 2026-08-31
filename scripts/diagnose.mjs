import { existsSync, readFileSync } from 'node:fs';

const source = existsSync('.token') ? '.token file' : '$GITHUB_TOKEN';
const token = (
  existsSync('.token') ? readFileSync('.token', 'utf8') : (process.env.GITHUB_TOKEN ?? '')
).trim();
if (!token) throw new Error('No token found in ./.token or $GITHUB_TOKEN');
if (existsSync('.token') && process.env.GITHUB_TOKEN) {
  console.log('Note: $GITHUB_TOKEN is set but ignored — using ./.token\n');
}

const repoArg = process.argv[2] ?? null;

const kind = token.startsWith('github_pat_')
  ? 'fine-grained PAT'
  : token.startsWith('ghp_')
    ? 'classic PAT'
    : token.startsWith('gho_')
      ? 'OAuth token'
      : 'unknown format';

console.log(`Token: ${kind} from ${source}, ${token.length} chars, ends in …${token.slice(-4)}\n`);

async function graphql(query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, headers: response.headers, body };
}

async function rest(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, headers: response.headers, body };
}

/* 1. Who am I, and does GraphQL work at all? */
const viewer = await graphql('{ viewer { login } rateLimit { remaining } }');
if (viewer.body.errors) {
  console.log('GraphQL errors on viewer:', JSON.stringify(viewer.body.errors, null, 2));
}
const login = viewer.body.data?.viewer?.login;
console.log(`1. viewer.login        → ${login ?? '(failed, status ' + viewer.status + ')'}`);
console.log(`   graphql rate limit  → ${viewer.body.data?.rateLimit?.remaining ?? '?'} left`);
if (!login) process.exit(1);

const SEARCH = `
query ($q: String!) {
  search(query: $q, type: ISSUE, first: 20) {
    issueCount
    nodes { ... on PullRequest { number title repository { nameWithOwner isPrivate } author { login } } }
  }
}`;

const variants = [
  ['extension query      ', `is:open is:pr review-requested:@me archived:false`],
  ['without archived     ', `is:open is:pr review-requested:@me`],
  ['explicit login       ', `is:open is:pr review-requested:${login}`],
  ['review-requested any ', `type:pr review-requested:${login}`],
  ['user-review-requested', `is:open is:pr user-review-requested:@me`],
  ['involves me          ', `is:open is:pr involves:${login}`],
  ['my own PRs           ', `is:open is:pr author:${login}`],
];

console.log('\n2. GraphQL search variants (issueCount / nodes returned):');
for (const [label, q] of variants) {
  const result = await graphql(SEARCH, { q });
  const count = result.body.data?.search?.issueCount;
  const nodes = result.body.data?.search?.nodes?.filter((n) => n && n.number) ?? [];
  const errors = result.body.errors ?? result.body.data?.errors;
  console.log(
    `   ${label} → ${count ?? 'ERR'} / ${nodes.length}` +
      (errors ? `  errors: ${errors.map((e) => e.message).join('; ')}` : ''),
  );
  for (const node of nodes.slice(0, 5)) {
    console.log(
      `        ${node.repository.nameWithOwner}${node.repository.isPrivate ? ' (private)' : ''}` +
        ` #${node.number} by ${node.author?.login} — ${node.title.slice(0, 50)}`,
    );
  }
}


const restSearch = await rest(
  `/search/issues?q=${encodeURIComponent(`is:open is:pr review-requested:${login}`)}&per_page=5`,
);
console.log(
  `\n3. REST /search/issues     → status ${restSearch.status}, total_count ${restSearch.body.total_count ?? 'n/a'}` +
    (restSearch.body.message ? `, message: ${restSearch.body.message}` : ''),
);

const repos = await rest('/user/repos?per_page=100&affiliation=owner,collaborator,organization_member');
console.log(
  `4. REST /user/repos        → status ${repos.status}, ${Array.isArray(repos.body) ? repos.body.length : 0} repos visible` +
    (repos.body.message ? `, message: ${repos.body.message}` : ''),
);
if (Array.isArray(repos.body)) {
  for (const repo of repos.body.slice(0, 15)) {
    console.log(`        ${repo.full_name}${repo.private ? ' (private)' : ''}`);
  }
  if (repos.body.length > 15) console.log(`        … +${repos.body.length - 15} more`);
}

if (repoArg) {
  const [owner, name] = repoArg.split('/');
  const direct = await graphql(
    `query ($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        nameWithOwner
        pullRequests(states: OPEN, first: 20) {
          nodes {
            number title isDraft
            author { login }
            reviewDecision
            reviewRequests(first: 10) {
              nodes { requestedReviewer { __typename ... on User { login } ... on Team { name } } }
            }
            assignees(first: 10) { nodes { login } }
          }
        }
      }
    }`,
    { owner, name },
  );

  console.log(`\n5. Direct read of ${repoArg} (no search index):`);
  if (direct.body.errors) {
    console.log('   errors:', JSON.stringify(direct.body.errors, null, 2));
  }
  for (const pr of direct.body.data?.repository?.pullRequests?.nodes ?? []) {
    const reviewers = pr.reviewRequests.nodes
      .map((r) => r.requestedReviewer?.login ?? r.requestedReviewer?.name ?? '?')
      .join(', ');
    const assignees = pr.assignees.nodes.map((a) => a.login).join(', ');
    console.log(
      `   #${pr.number} by ${pr.author?.login}${pr.isDraft ? ' [draft]' : ''}` +
        ` — reviewers requested: [${reviewers || 'none'}] · assignees: [${assignees || 'none'}]` +
        ` · decision: ${pr.reviewDecision ?? 'null'}`,
    );
  }
} else {
  console.log('\n5. (skipped — pass a repo to read review requests directly:');
  console.log('      node scripts/diagnose.mjs owner/repo )');
}
