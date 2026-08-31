import { el, icon } from './dom';
import { alertIcon, checkCircleIcon, inboxIcon, keyIcon, rocketIcon } from './icons';
import type { AppError } from '../lib/errors';
import type { CategoryId } from '../core/types';

function state(
  iconMarkup: string,
  title: string,
  text: string,
  tone: 'neutral' | 'success' | 'danger' = 'neutral',
  action?: HTMLElement,
): HTMLElement {
  return el('div', { class: 'state' }, [
    icon(iconMarkup, `state__icon${tone === 'neutral' ? '' : ` state__icon--${tone}`}`),
    el('p', { class: 'state__title' }, [title]),
    el('p', { class: 'state__text' }, [text]),
    action,
  ]);
}

export function loadingState(): HTMLElement {
  const card = (): HTMLElement =>
    el('div', { class: 'card skeleton-card' }, [
      el('div', { class: 'skeleton-line', style: 'width: 45%' }),
      el('div', { class: 'skeleton-line', style: 'width: 85%' }),
      el('div', { class: 'skeleton-line', style: 'width: 30%' }),
    ]);

  return el('div', { class: 'list', 'aria-busy': 'true' }, [card(), card(), card()]);
}

const EMPTY: Record<CategoryId, { icon: string; title: string; text: string; tone: 'neutral' | 'success' }> = {
  'needs-review': {
    icon: checkCircleIcon,
    title: 'Inbox zero',
    text: 'No pull requests are waiting on your review right now.',
    tone: 'success',
  },
  'needs-action': {
    icon: inboxIcon,
    title: 'Nothing blocked',
    text: 'None of your pull requests need a fix from you.',
    tone: 'neutral',
  },
  'ready-to-merge': {
    icon: rocketIcon,
    title: 'Nothing to merge yet',
    text: 'Approved pull requests with green checks will show up here.',
    tone: 'neutral',
  },
};

export function emptyState(category: CategoryId): HTMLElement {
  const config = EMPTY[category];
  return state(config.icon, config.title, config.text, config.tone);
}

export function errorState(error: AppError, onRetry: () => void, onSettings: () => void): HTMLElement {
  if (error.kind === 'unauthorized') {
    return state(
      keyIcon,
      'Reconnect your GitHub account',
      error.hint ?? 'The saved token is no longer valid.',
      'danger',
      el('button', { class: 'button button--ghost', onclick: onSettings }, ['Open settings']),
    );
  }

  return state(
    alertIcon,
    error.message,
    error.hint ?? 'Try again in a moment.',
    'danger',
    el('button', { class: 'button button--ghost', onclick: onRetry }, ['Try again']),
  );
}
