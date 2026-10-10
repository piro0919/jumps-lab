'use client';

import { createAuthClient } from 'better-auth/react';

/** ログインの窓口（ブラウザの側）。受け口は /api/auth（src/lib/auth.ts） */
export const authClient = createAuthClient();
