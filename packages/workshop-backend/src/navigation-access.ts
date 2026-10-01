// Copyright (c) 2026 Green Hat Security.
// SPDX-License-Identifier: MIT
import { verifyCfAccessJwt, type CfAccessEnv } from "./access.js";

/** The Access-authenticated OS session can assert only its own OS entitlement. */
export async function handleNavigationAccess(
  request: Request, env: CfAccessEnv,
  verifyAccess: typeof verifyCfAccessJwt = verifyCfAccessJwt,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = { "cache-control": "private, no-store", vary: "Cookie", allow: "GET" };
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
  const identity = await verifyAccess(request, env);
  if (!identity?.sub || typeof identity.email !== "string") {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers });
  }
  const native: NavigationAccess = {
    restricted: true, modules: [], nativeModules: ["os"],
    user: { id: identity.sub, email: identity.email },
  };
  const central = await readNavigationAccess(request.headers.get("cookie"), fetcher);
  // A central login for a different person cannot label this native session.
  const access = central?.user.email?.toLowerCase() === identity.email.toLowerCase() ? central : native;
  return Response.json({ ...access, nativeModules: ["os"] }, { headers });
}

export type NavigationAccess = {
  restricted: boolean;
  modules: string[];
  user: { id: string; email?: string };
  nativeModules?: string[];
};

/** Read only the caller's central grants; never forward native or service credentials. */
export async function readNavigationAccess(
  cookieHeader: string | null,
  fetcher: typeof fetch = fetch,
): Promise<NavigationAccess | null> {
  const name = '__Secure-greenhat_tools.session_token';
  const matches = (cookieHeader ?? '').split(';').map(part => part.trimStart())
    .filter(part => part.slice(0, part.indexOf('=')) === name);
  if (matches.length !== 1) return null;
  const token = matches[0].slice(name.length + 1);
  if (!token || token.length > 512 || !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(token)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetcher('https://api.greenhatsec.com/api/me/module-access', {
      headers: { accept: 'application/json', cookie: name + '=' + token },
      redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
    if (response.status !== 200 ||
        response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) return null;
    let bytes = 0;
    let body = '';
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16_384) { await reader.cancel(); return null; }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    const value = JSON.parse(body) as Partial<NavigationAccess>;
    if (typeof value.restricted !== 'boolean' || !Array.isArray(value.modules) ||
        value.modules.length > 100 || !value.modules.every(key => typeof key === 'string' && key.length <= 100) ||
        typeof value.user?.id !== 'string' || !value.user.id ||
        (value.user.email !== undefined && typeof value.user.email !== 'string')) return null;
    // Do not accept host-native hints from the upstream authority.
    return { restricted: value.restricted, modules: value.modules, user: value.user };
  } catch { return null; }
  finally { clearTimeout(timer); }
}
