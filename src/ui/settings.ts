import { el, icon } from './dom';
import { plugIcon } from './icons';
import { clearToken, maskToken, setToken } from '../lib/storage';
import { verifyToken } from '../lib/github';
import { toAppError } from '../lib/errors';

// Pre-selects the single scope the extension needs, so there is nothing to
// hunt for in the (long) classic scope list.
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Ghub+Pulls';
const FINE_GRAINED_URL = 'https://github.com/settings/personal-access-tokens/new';

interface SettingsProps {
  /** Token currently saved, if the user is already connected. */
  currentToken: string | null;
  currentLogin: string | null;
  onConnected: () => void;
  onCancel: (() => void) | null;
}

export function settingsView(props: SettingsProps): HTMLElement {
  const container = el('div', { class: 'settings' });
  const errorSlot = el('div');

  const input = el('input', {
    class: 'input',
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'ghp_...',
  });

  const submit = el('button', { class: 'button button--primary', type: 'submit' }, [
    'Connect GitHub',
  ]);

  const showError = (message: string): void => {
    errorSlot.replaceChildren(el('p', { class: 'form-error' }, [message]));
  };

  const form = el(
    'form',
    {
      onsubmit: async (event: Event) => {
        event.preventDefault();
        const token = input.value.trim();
        if (!token) {
          showError('Paste a token to continue.');
          return;
        }

        errorSlot.replaceChildren();
        submit.disabled = true;
        submit.textContent = 'Verifying…';

        try {
          await verifyToken(token);
          await setToken(token);
          input.value = '';
          props.onConnected();
        } catch (error) {
          const appError = toAppError(error);
          showError(appError.hint ? `${appError.message}. ${appError.hint}` : appError.message);
          submit.disabled = false;
          submit.textContent = 'Connect GitHub';
        }
      },
    },
    [
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label' }, ['GitHub personal access token']),
        input,
      ]),
      submit,
    ],
  );

  const help = el('div', { class: 'help' }, [
    el('span', {}, ['How to create the token:']),
    el('ol', {}, [
      el('li', {}, [
        el('a', { href: TOKEN_URL, target: '_blank', rel: 'noreferrer noopener' }, [
          'Generate a classic token',
        ]),
        ' — the ',
        el('code', {}, ['repo']),
        ' scope comes pre-selected.',
      ]),
      el('li', {}, ['Leave every other scope unchecked. Only ', el('code', {}, ['repo']), ' is used.']),
      el('li', {}, ['Set an expiration of 30–90 days. The popup asks you to reconnect when it lapses.']),
      el('li', {}, [
        'If your organization uses SSO, click ',
        el('code', {}, ['Authorize']),
        ' next to it in the token list.',
      ]),
      el('li', {}, ['Paste it above. It is stored only in this browser profile.']),
    ]),
    el('p', { class: 'help__note' }, [
      'Heads up: ',
      el('code', {}, ['repo']),
      ' grants read and write on every repository you can access — classic tokens have no'
        + ' read-only option. Keep the expiration short, and revoke it any time from ',
      el('a', {
        href: 'https://github.com/settings/tokens',
        target: '_blank',
        rel: 'noreferrer noopener',
      }, ['your token list']),
      '.',
    ]),
    el('p', { class: 'help__note' }, [
      'Prefer least privilege? A ',
      el('a', { href: FINE_GRAINED_URL, target: '_blank', rel: 'noreferrer noopener' }, [
        'fine-grained token',
      ]),
      ' works too — read-only ',
      el('code', {}, ['Pull requests']),
      ', ',
      el('code', {}, ['Metadata']),
      ', ',
      el('code', {}, ['Contents']),
      ', ',
      el('code', {}, ['Commit statuses']),
      ' and ',
      el('code', {}, ['Checks']),
      '. Organization repositories stay invisible to it until an owner approves the token.',
    ]),
  ]);

  if (props.currentToken) {
    container.append(
      el('div', { class: 'connected' }, [
        icon(plugIcon),
        el('div', {}, [
          el('div', { class: 'connected__login' }, [props.currentLogin ?? 'Connected']),
          el('div', { class: 'connected__token' }, [maskToken(props.currentToken)]),
        ]),
      ]),
      el(
        'p',
        { class: 'settings__intro' },
        ['Paste a new token to replace the current one.'],
      ),
    );
  } else {
    container.append(
      el('p', { class: 'settings__intro' }, [
        'Connect your GitHub account to see the pull requests waiting on you.',
      ]),
    );
  }

  container.append(errorSlot, form);

  if (props.currentToken) {
    container.append(
      el(
        'button',
        {
          class: 'button button--ghost button--danger',
          onclick: async () => {
            await clearToken();
            props.onConnected();
          },
        },
        ['Disconnect'],
      ),
    );
  }

  if (props.onCancel) {
    container.append(
      el('button', { class: 'button button--ghost', onclick: props.onCancel }, ['Back']),
    );
  }

  container.append(help);
  return container;
}
