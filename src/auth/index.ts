/** Auth modülü — Botrix tarzı platform girişi → bot */
export { default as AuthCard } from "./AuthCard";
export { default as Callback } from "./Callback";
export { default as LoginPage } from "./LoginPage";
export { useOAuthCallback } from "./useOAuthCallback";
export { startPlatformBotLogin } from "./startPlatformLogin";
export { buildAuthorizeUrl, OAUTH_CLIENTS, oauthRedirectUri } from "./oauthConfig";
export type { OAuthPlatform } from "./oauthConfig";
