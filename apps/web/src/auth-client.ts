import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

const apiBase = import.meta.env.VITE_API_BASE ?? '';

export const authClient = createAuthClient({
  ...(apiBase ? { baseURL: apiBase } : {}),
  basePath: '/v1/auth',
  plugins: [magicLinkClient()],
  fetchOptions: {
    credentials: 'include',
  },
});
