/**
 * @vitest-environment happy-dom
 *
 * Render smoke tests. The failure these catch -- a component that throws on
 * mount -- shows up in the real extension only as a blank popup with the error
 * buried in a devtools console you have to go looking for.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { installChromeStub } from './testing/chromeStub';
import type { Settings } from '../storage/settings';
import type { GenerationState } from '../storage/generation';

const configured: Settings = {
  provider: 'openai',
  apiKeys: { openai: 'sk-test' },
  models: { openai: 'gpt-4.1-mini' },
  fetchedModels: {},
  cvText: 'Три года React и TypeScript, админка для логистики.',
  defaults: { language: 'ru', length: 'medium' },
};

const doneState: GenerationState = {
  status: 'done',
  input: { vacancyText: 'Ищем фронтендера', language: 'ru', length: 'medium', userPrompt: '' },
  result: {
    letter: 'Здравствуйте! Делал похожие админки на React.',
    companyRequirements: {
      found: true,
      mode: 'include_phrase',
      phrase: 'Банан',
      description: 'начните письмо со слова Банан',
    },
    company: 'Acme',
    title: 'Frontend',
    grade: 'middle',
    workFormat: 'remote',
    vacancyId: 'v1',
    createdNew: true,
    finishedAt: Date.now(),
  },
  error: null,
  startedAt: Date.now(),
};

let container: HTMLDivElement;
let root: Root;

/** Sets a controlled input's value the way React's synthetic events expect. */
const setInputValue = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const render = async (node: React.ReactNode): Promise<string> => {
  await act(async () => {
    root.render(node);
  });
  // Let the mount effects (storage reads) settle.
  await act(async () => {
    await Promise.resolve();
  });
  return container.textContent ?? '';
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('Onboarding', () => {
  it('renders the provider step for a fresh install', async () => {
    installChromeStub();
    const { Onboarding } = await import('./Onboarding');
    const { DEFAULT_SETTINGS } = await import('../storage/settings');

    const text = await render(<Onboarding settings={DEFAULT_SETTINGS} onDone={() => undefined} />);

    expect(text).toContain('Начальная настройка');
    expect(text).toContain('Провайдер');
    expect(text).toContain('Проверить и сохранить');
    // The key field must never render as plain text.
    expect(container.querySelector('#api-key')?.getAttribute('type')).toBe('password');
  });

  it('reports completion only after the CV step, not after the key is saved', async () => {
    const stub = installChromeStub();
    stub.replies['validateKey'] = null;

    const onDone = vi.fn();
    const { Onboarding } = await import('./Onboarding');
    const { DEFAULT_SETTINGS } = await import('../storage/settings');

    await render(<Onboarding settings={DEFAULT_SETTINGS} onDone={onDone} />);

    // Fill the key and save it -- that ends step 1, not the whole flow.
    const keyField = container.querySelector<HTMLInputElement>('#api-key')!;
    await act(async () => {
      setInputValue(keyField, 'sk-test');
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button.primary')!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onDone).not.toHaveBeenCalled();
    // Step 2 is now on screen, so the CV step cannot be skipped.
    expect(container.textContent).toContain('Ваше CV');
  });
});

describe('GenerationView', () => {
  it('prompts for setup when no provider is configured', async () => {
    installChromeStub();
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);

    expect(text).toContain('Нужна настройка');
    expect(container.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(true);
  });

  it('asks for a CV when the provider is set but the CV is empty', async () => {
    installChromeStub({ settings: { ...configured, cvText: '' } });
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);

    expect(text).toContain('Добавьте CV');
    expect(container.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(true);
  });

  it('enables generation once provider and CV are both present', async () => {
    installChromeStub({ settings: configured });
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);

    expect(text).toContain('Текст вакансии');
    expect(text).toContain('Сгенерировать');
    expect(container.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(false);
  });

  it('restores a finished letter and shows the company requirement block', async () => {
    installChromeStub({ settings: configured, generation: doneState });
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);

    expect(text).toContain('Компания просит:');
    expect(text).toContain('начните письмо со слова Банан');
    expect(container.querySelector<HTMLTextAreaElement>('#letter')?.value).toBe(
      doneState.result?.letter,
    );
    // The vacancy field is restored too, so "regenerate" has something to work on.
    expect(container.querySelector<HTMLTextAreaElement>('#vacancy')?.value).toBe(
      'Ищем фронтендера',
    );
  });

  it('shows a spinner and blocks the button while a generation is running', async () => {
    installChromeStub({
      settings: configured,
      generation: { ...doneState, status: 'running', result: null },
    });
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);

    expect(text).toContain('Генерирую письмо');
    expect(container.querySelector<HTMLButtonElement>('button.primary')?.disabled).toBe(true);
  });

  it('surfaces a normalised error message', async () => {
    installChromeStub({
      settings: configured,
      generation: {
        ...doneState,
        status: 'error',
        result: null,
        error: { kind: 'invalid_key', message: 'Ключ не принят провайдером.' },
      },
    });
    const { GenerationView } = await import('./GenerationView');

    const text = await render(<GenerationView variant="popup" />);
    expect(text).toContain('Ключ не принят провайдером.');
  });

  it('offers the expand button only in the popup', async () => {
    installChromeStub({ settings: configured });
    const { GenerationView } = await import('./GenerationView');

    expect(await render(<GenerationView variant="popup" />)).toContain('Открыть в окне');
    expect(await render(<GenerationView variant="editor" />)).not.toContain('Открыть в окне');
  });
});
