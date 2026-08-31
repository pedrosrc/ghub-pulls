# Ghub Pulls

Browser extension (Chrome / Edge / Brave, Manifest V3) that shows the GitHub Pull
Requests waiting on you, in one click.

**Needs your review** · **Needs action** · **Ready to merge**

## Install (development)

```bash
npm install
npm run build        # outputs dist/
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `dist/`.

`npm run dev` rebuilds on save; press the reload icon on the extension card to pick up changes.

## Connect your GitHub account

The popup asks for a GitHub **personal access token (classic)** on first run:

1. [Generate one](https://github.com/settings/tokens/new?scopes=repo&description=Ghub+Pulls) — the `repo` scope arrives pre-selected
2. Leave every other scope unchecked; `repo` is the only one used
3. Set an expiration of 30–90 days
4. If your organization uses SSO, click **Authorize** next to it in the token list
5. Paste it into the popup

### Why classic, and when to prefer fine-grained

A fine-grained token is the better credential on paper — read-only, scoped to chosen
repositories, expiring — and the extension accepts it (`Pull requests`, `Metadata`,
`Contents`, `Commit statuses`, `Checks`, all read-only).

The catch is organizations: a fine-grained token cannot see an organization's
repositories until an owner enables fine-grained access **and** approves that specific
token. Until then those pull requests are invisible to it — no error, no warning, just
an empty list. For most people the organization PRs are the whole point of the tool, so
the setup screen recommends classic and mentions fine-grained as the least-privilege
alternative for personal repositories (or once an owner has approved the token).

Be aware of what classic costs: `repo` grants **read and write** on every repository you
can access, because classic tokens have no read-only equivalent. A short expiration and
the "last used" column on [your token list](https://github.com/settings/tokens) are the
practical mitigations.

### Where the token lives

`chrome.storage.local` — readable only by this extension, never bundled, never logged,
and only ever displayed masked. It is **not** encrypted at rest: any process running as
your user can read the browser profile, exactly like a token in `~/.gitconfig` or
`~/.npmrc`. That is why a short expiration matters more than where it is stored.

An OAuth web flow was ruled out because an extension is public code and cannot hold a
`client_secret`. Device Flow avoids the secret but needs a registered OAuth App, and
classic OAuth scopes are just as coarse as a classic PAT.

## How the three categories are decided

One GraphQL request runs two searches; the classification happens locally in
[`src/core/categorize.ts`](src/core/categorize.ts).

| Category | Rule |
| --- | --- |
| **Needs your review** | `is:open is:pr review-requested:@me archived:false` — GitHub drops you from the requested reviewers once you submit a review, so this list is exactly what is still pending |
| **Needs action** | Your open PRs with at least one blocker: changes requested, merge conflicts, failing/errored checks, or still a draft |
| **Ready to merge** | Your open PRs that are not drafts, `mergeable: MERGEABLE`, approved (or in a repo that requires no review and has nobody pending), with a green or absent check rollup |

Your open PRs that are simply waiting on reviewers appear in neither list — nothing is
blocking them and they are not mergeable yet.

### API limitations

- **Required checks are not visible.** Branch protection rules need admin access on the
  repository, so the extension uses the aggregate check rollup instead. A PR can be
  green here and still be blocked by a required check that never ran.
- **`mergeStateStatus` (BLOCKED / BEHIND) needs write access** to the repository, so it
  is not requested. Only `mergeable` (MERGEABLE / CONFLICTING / UNKNOWN) is used.
- **`mergeable` is computed asynchronously** by GitHub. While it is `UNKNOWN` the PR is
  deliberately left out of *Ready to merge* rather than shown as mergeable.

## Why GraphQL

REST would need one search plus a `GET /pulls/{n}` per PR (mergeability is absent from
list responses) plus a check-runs call per PR — roughly 30 requests per popup open.
GraphQL returns all three categories, with `mergeable`, `reviewDecision` and the check
rollup, in **a single request**.

## Structure

```
public/manifest.json     MV3 manifest + icons
src/
  main.ts                popup state machine and rendering
  popup.html, styles.css shell and design tokens
  lib/
    storage.ts           token (storage.local) + session cache
    github.ts            GraphQL client, single query, HTTP error mapping
    errors.ts            AppError kinds: unauthorized / forbidden / rate-limit / network
  core/
    types.ts             normalized PullRequest model
    categorize.ts        the three category rules
  ui/
    dom.ts               tiny element builder (textContent only — no HTML injection)
    card.ts              PR list item
    states.ts            loading / empty / error states
    settings.ts          token setup screen
    icons.ts             inline SVG (MV3 CSP blocks remote assets)
```

Handled failure modes: invalid or expired token, missing repository permission, rate
limit (with reset time), network errors, loading, and per-category empty states. When a
refresh fails but a cached list exists, the cached list stays on screen with the error
in the footer.
