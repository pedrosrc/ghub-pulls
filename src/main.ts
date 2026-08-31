import { CATEGORIES, categorize } from './core/categorize';
import type { CategoryId, PullsResult } from './core/types';
import { fetchPulls } from './lib/github';
import { AppError, toAppError } from './lib/errors';
import { getCache, getToken, setCache } from './lib/storage';
import { el, icon } from './ui/dom';
import { gearIcon, logoIcon, refreshIcon } from './ui/icons';
import { pullRequestCard } from './ui/card';
import { emptyState, errorState, loadingState } from './ui/states';
import { settingsView } from './ui/settings';

interface State {
  view: 'list' | 'settings';
  token: string | null;
  category: CategoryId;
  result: PullsResult | null;
  loading: boolean;
  error: AppError | null;
}

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing');

const state: State = {
  view: 'list',
  token: null,
  category: 'needs-review',
  result: null,
  loading: true,
  error: null,
};

function update(patch: Partial<State>): void {
  Object.assign(state, patch);
  render();
}

/* ---------- Data ---------- */

async function load(force = false): Promise<void> {
  const token = await getToken();

  if (!token) {
    update({ token: null, view: 'settings', loading: false, result: null, error: null });
    return;
  }

  if (!force) {
    const cached = await getCache();
    if (cached) {
      update({ token, result: cached, loading: true, error: null });
    } else {
      update({ token, loading: true, error: null });
    }
  } else {
    update({ token, loading: true, error: null });
  }

  try {
    const result = categorize(await fetchPulls(token));
    await setCache(result);
    update({ result, loading: false, error: null });
  } catch (error) {
    update({ loading: false, error: toAppError(error) });
  }
}

/* ---------- Views ---------- */

function header(): HTMLElement {
  const refresh = el(
    'button',
    {
      class: `icon-button${state.loading ? ' icon-button--spinning' : ''}`,
      title: 'Refresh',
      'aria-label': 'Refresh',
      disabled: state.loading,
      onclick: () => void load(true),
    },
    [icon(refreshIcon)],
  );

  const settingsButton = el(
    'button',
    {
      class: 'icon-button',
      title: 'Settings',
      'aria-label': 'Settings',
      onclick: () => update({ view: state.view === 'settings' ? 'list' : 'settings' }),
    },
    [icon(gearIcon)],
  );

  return el('header', { class: 'header' }, [
    icon(logoIcon, 'header__logo'),
    el('h1', { class: 'header__title' }, ['Ghub Pulls']),
    el('div', { class: 'header__spacer' }),
    state.view === 'list' && state.token ? refresh : null,
    settingsButton,
  ]);
}

function tabs(): HTMLElement {
  return el(
    'nav',
    { class: 'tabs', role: 'tablist' },
    CATEGORIES.map((category) => {
      const count = state.result?.byCategory[category.id].length;
      return el(
        'button',
        {
          class: 'tab',
          role: 'tab',
          type: 'button',
          title: category.label,
          'aria-selected': String(state.category === category.id),
          onclick: () => update({ category: category.id }),
        },
        [
          el('span', {}, [category.short]),
          count === undefined ? null : el('span', { class: 'tab__count' }, [String(count)]),
        ],
      );
    }),
  );
}

function list(): HTMLElement {
  if (state.error && !state.result) {
    return errorState(
      state.error,
      () => void load(true),
      () => update({ view: 'settings' }),
    );
  }

  if (!state.result) return loadingState();

  const pulls = state.result.byCategory[state.category];
  if (pulls.length === 0) return emptyState(state.category);

  return el('div', { class: 'list' }, pulls.map(pullRequestCard));
}

function footer(): HTMLElement | null {
  // With no data at all the list itself already explains what is going on.
  if (!state.result) return null;

  const label = state.loading
    ? 'Refreshing…'
    : state.error
      ? `Showing cached list · ${state.error.message}`
      : state.result.checksHidden
        ? 'Check status hidden — token needs Contents: Read'
        : `Updated ${relativeTime(state.result.fetchedAt)}`;

  return el('footer', { class: 'footer' }, [
    el('span', {}, [label]),
    el('div', { class: 'footer__spacer' }),
    state.result ? el('span', {}, [`@${state.result.viewer}`]) : null,
  ]);
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function render(): void {
  const children: Array<Node | null> = [header()];

  if (state.view === 'settings') {
    children.push(
      settingsView({
        currentToken: state.token,
        currentLogin: state.result?.viewer ?? null,
        onConnected: () => {
          void (async () => {
            update({ view: 'list', result: null, error: null, loading: true });
            await load(true);
          })();
        },
        onCancel: state.token ? () => update({ view: 'list' }) : null,
      }),
    );
  } else {
    children.push(tabs(), list(), footer());
  }

  root!.replaceChildren(...children.filter((child): child is Node => child !== null));
}

render();
void load();
