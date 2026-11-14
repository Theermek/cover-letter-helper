/**
 * Server address and token (TASK2 §1.5).
 *
 * "Check connection" runs two requests on purpose: /health without a token and
 * GET /profile with it. That is the only way to tell "server unreachable" from
 * "token rejected", and those two faults need different fixes from the user.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS } from '../../config/strings';
import { checkHealth } from '../../api/client';
import { fetchProfile } from '../../api/profile';
import { isAppErrorShape } from '../../lib/errors';
import { setServer, type Settings } from '../../storage/settings';

interface Props {
  settings: Settings;
}

type Status = { kind: 'ok' | 'error'; message: string } | null;

export const ServerForm = ({ settings }: Props) => {
  const [url, setUrl] = useState(settings.server.url);
  const [token, setToken] = useState(settings.server.token);
  const [revealed, setRevealed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // Settings are reloaded on every change from any page; without the ref a
  // half-typed token would be overwritten by an unrelated autosave.
  const latest = useRef(settings);
  latest.current = settings;

  useEffect(() => {
    setUrl(latest.current.server.url);
    setToken(latest.current.server.token);
  }, []);

  const save = useCallback(async () => {
    await setServer({ url: url.trim(), token: token.trim() });
    setStatus(null);
  }, [url, token]);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus(null);
    try {
      await setServer({ url: url.trim(), token: token.trim() });
      await checkHealth();
      await fetchProfile();
      setStatus({ kind: 'ok', message: STRINGS.server.ok });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: isAppErrorShape(error) ? error.message : STRINGS.server.failed,
      });
    } finally {
      setChecking(false);
    }
  }, [url, token]);

  return (
    <div className="stack-sm">
      <label htmlFor="server-url">{STRINGS.server.urlLabel}</label>
      <input
        id="server-url"
        type="text"
        placeholder="http://localhost:3000"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => void save()}
      />

      <label htmlFor="server-token">{STRINGS.server.tokenLabel}</label>
      <div className="row">
        <input
          id="server-token"
          type={revealed ? 'text' : 'password'}
          autoComplete="off"
          placeholder={STRINGS.server.tokenPlaceholder}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={() => void save()}
        />
        <button type="button" className="ghost icon" onClick={() => setRevealed((v) => !v)}>
          {revealed ? STRINGS.common.hide : STRINGS.common.show}
        </button>
      </div>

      <div className="row">
        <button type="button" disabled={checking} onClick={() => void check()}>
          {checking ? STRINGS.server.checking : STRINGS.server.check}
        </button>
      </div>

      {status && <p className={status.kind === 'ok' ? 'success' : 'error'}>{status.message}</p>}
      <p className="hint">{STRINGS.server.hint}</p>
    </div>
  );
};
