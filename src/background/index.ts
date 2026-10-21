/**
 * Service worker entry point: message router, context menu, install hooks.
 *
 * All LLM traffic happens here (TASK §4.3). With MV3 host_permissions the
 * worker is not subject to page CORS rules, so the provider SDKs can call their
 * APIs directly.
 */

import { toAppError } from '../lib/errors';
import { getProvider } from '../providers';
import { resolveModel } from '../config/providers';
import {
  getGenerationState,
  setPendingVacancy,
  type GenerationState,
} from '../storage/generation';
import { resetGeneration, startGeneration, updateLetter } from './generation';
import type { Request, Response } from './messages';

const CONTEXT_MENU_ID = 'generate-cover-letter';

const ok = <T>(data: T): Response<T> => ({ ok: true, data });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Сгенерировать сопроводительное по выделенному тексту',
      contexts: ['selection'],
    });
  });
});

/**
 * Opening the popup programmatically is only allowed in response to a user
 * gesture and is not available everywhere, so the editor window is the fallback
 * rather than an error (TASK §6.9).
 */
const openUiWithSelection = async (selectionText: string): Promise<void> => {
  await setPendingVacancy(selectionText);

  try {
    await chrome.action.openPopup();
    return;
  } catch {
    // Expected on many pages -- fall through to a real window.
  }

  await chrome.windows.create({
    url: chrome.runtime.getURL('editor.html'),
    type: 'popup',
    width: 1100,
    height: 820,
  });
};

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) return;
  void openUiWithSelection(text);
});

const handle = async (request: Request): Promise<Response<unknown>> => {
  switch (request.type) {
    case 'generate':
      return ok<GenerationState>(await startGeneration(request.input));

    case 'getGenerationState':
      return ok<GenerationState>(await getGenerationState());

    case 'resetGeneration':
      return ok<GenerationState>(await resetGeneration());

    case 'updateLetter':
      await updateLetter(request.letter);
      return ok(null);

    case 'validateKey': {
      const provider = getProvider(request.provider);
      await provider.validateKey(request.apiKey, resolveModel(request.provider, request.model));
      return ok(null);
    }

    case 'listModels': {
      const provider = getProvider(request.provider);
      return ok(await provider.listModels(request.apiKey));
    }
  }
};

chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
  handle(request)
    .then(sendResponse)
    .catch((error: unknown) => {
      // Never let a raw provider payload reach the UI (TASK §11).
      sendResponse({ ok: false, error: toAppError(error).toShape() });
    });

  // Keeps the message channel open for the async response above.
  return true;
});
