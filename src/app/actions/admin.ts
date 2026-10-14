'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '@/lib/admin';
import { setPlan, setTeamPlan } from '@/lib/data';
import type { ActionResult } from '@/lib/form';
import { PLANS, TEAM_PLANS } from '@/lib/profile-options';
import { requireViewer } from '@/lib/viewer';

const schema = z.object({
  userId: z.string().min(1),
  plan: z.enum(PLANS),
});

const teamSchema = z.object({
  teamId: z.uuid(),
  plan: z.enum(TEAM_PLANS),
});

/**
 * 管理の画面で、1人のプランを切り替える。画面を開けた人でも、ここでもう一度管理者かを確かめる
 * （Server Action はブラウザから直に呼べるため）
 */
export async function setPlanAction(input: {
  userId: string;
  plan: string;
}): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.email)) return { ok: false, error: 'generic' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'generic' };
  try {
    if (!(await setPlan(parsed.data.userId, parsed.data.plan))) {
      return { ok: false, error: 'generic' };
    }
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

/** 管理の画面で、1チームのプランを切り替える（2026-10-15）。人のプランと同じく、ここでも管理者かを確かめる */
export async function setTeamPlanAction(input: {
  teamId: string;
  plan: string;
}): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.email)) return { ok: false, error: 'generic' };
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'generic' };
  try {
    if (!(await setTeamPlan(parsed.data.teamId, parsed.data.plan))) {
      return { ok: false, error: 'generic' };
    }
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}
