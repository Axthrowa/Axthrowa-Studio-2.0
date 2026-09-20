import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { OAuthPlatform } from "./oauthConfig";

export type OAuthCallbackResult = {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
  platform: OAuthPlatform | null;
  ready: boolean;
};

function platformFromState(state: string | null): OAuthPlatform | null {
  if (!state) return null;
  const p = state.split(":")[0];
  if (p === "twitch" || p === "kick" || p === "youtube") return p;
  return null;
}

/**
 * `/auth/callback?code=...&state=...` parametrelerini yakalar.
 * Authorization Code flow için kullanılır.
 */
export function useOAuthCallback(): OAuthCallbackResult {
  const [params] = useSearchParams();

  return useMemo(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    let storedOk = true;
    try {
      const expected = sessionStorage.getItem("yya.oauth.state");
      if (state && expected && state !== expected) storedOk = false;
    } catch {
      /* */
    }

    return {
      code,
      state,
      error: error || (!storedOk ? "invalid_state" : null),
      errorDescription:
        errorDescription ||
        (!storedOk ? "OAuth state eşleşmedi — oturumu yeniden başlatın." : null),
      platform: platformFromState(state),
      ready: !!(code || error),
    };
  }, [params]);
}
