import { el } from './dom';
import type { CategorizedPullRequest } from '../core/types';

export function pullRequestCard(pr: CategorizedPullRequest): HTMLAnchorElement {
  return el(
    'a',
    {
      class: 'card',
      href: pr.url,
      target: '_blank',
      rel: 'noreferrer noopener',
      title: `${pr.repo} #${pr.number} — ${pr.title}`,
    },
    [
      el('div', { class: 'card__meta' }, [
        el('span', { class: 'card__repo' }, [pr.repo]),
        el('span', { class: 'card__number' }, [`#${pr.number}`]),
        el('span', {}, ['·']),
        el('span', {}, [pr.author]),
      ]),
      el('p', { class: 'card__title' }, [pr.title]),
      pr.signals.length > 0 &&
        el(
          'div',
          { class: 'card__signals' },
          pr.signals.map((signal) =>
            el('span', { class: `badge badge--${signal.tone}` }, [signal.label]),
          ),
        ),
    ],
  );
}
