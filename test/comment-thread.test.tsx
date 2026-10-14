// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMENT_MAX_LENGTH } from '@/lib/limits';

/**
 * コメントのやりとりのカード（src/components/comment-thread.tsx）。書く先（form）が無ければ書く欄を出さない。
 * 書く欄は字数の上限を持ち、消すボタンは自分のコメントにだけ付く
 */

vi.mock('@/app/actions/comments', () => ({
  addCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Oct 14, 9:00' }),
}));

const { CommentThread } = await import('@/components/comment-thread');

afterEach(cleanup);

const comments = [
  {
    id: 'c1',
    authorName: 'Coach',
    role: 'coach' as const,
    body: 'Nice',
    createdAt: '2026-10-14T00:00:00Z',
  },
  {
    id: 'c2',
    authorName: 'Hana',
    role: 'you' as const,
    body: 'Thanks',
    createdAt: '2026-10-14T01:00:00Z',
  },
];

describe('CommentThread', () => {
  it('書く先が無ければ、書く欄と送るボタンを出さない', () => {
    render(
      createElement(CommentThread, { title: 'Comments', comments, timeZone: 'UTC', form: null }),
    );
    expect([screen.queryByRole('textbox'), screen.queryByRole('button', { name: 'send' })]).toEqual(
      [null, null],
    );
  });

  it('書く先があれば、字数の上限のある欄と、チームと日（コーチは選手）を送る隠し欄を出す', () => {
    const { container } = render(
      createElement(CommentThread, {
        title: 'Comments',
        comments: [],
        timeZone: 'UTC',
        form: { teamId: 't1', day: '2026-10-14', athleteId: 'a1' },
      }),
    );
    const hidden = Object.fromEntries(
      [...container.querySelectorAll<HTMLInputElement>('input[type=hidden]')].map((input) => [
        input.name,
        input.value,
      ]),
    );
    expect({
      maxLength: screen.getByRole('textbox', { name: 'write' }).getAttribute('maxlength'),
      hidden,
      empty: screen.queryByText('empty') !== null,
    }).toEqual({
      maxLength: String(COMMENT_MAX_LENGTH),
      hidden: { teamId: 't1', day: '2026-10-14', athleteId: 'a1' },
      empty: true,
    });
  });

  it('消すボタンは自分のコメントにだけ付き、コーチの札は相手のコメントに付く', () => {
    render(
      createElement(CommentThread, { title: 'Comments', comments, timeZone: 'UTC', form: null }),
    );
    expect({
      deletes: screen.queryAllByRole('button', { name: 'delete' }).length,
      badges: ['coach', 'you'].map((label) => screen.queryByText(label) !== null),
    }).toEqual({ deletes: 1, badges: [true, true] });
  });

  it('collapsed のとき、コメントの無い日は書く欄を畳み、ボタンを押すと出す。コメントのある日は畳まない', () => {
    const form = { teamId: 't1', day: '2026-10-14', athleteId: 'a1' };
    const empty = render(
      createElement(CommentThread, {
        title: 'Comments',
        comments: [],
        timeZone: 'UTC',
        form,
        collapsed: true,
      }),
    );
    const before = empty.queryByRole('textbox');
    fireEvent.click(empty.getByRole('button', { name: 'write' }));
    const after = empty.queryByRole('textbox', { name: 'write' });
    empty.unmount();
    render(
      createElement(CommentThread, {
        title: 'Comments',
        comments,
        timeZone: 'UTC',
        form,
        collapsed: true,
      }),
    );
    expect({
      before,
      opened: after !== null,
      withComments: screen.queryByRole('textbox', { name: 'write' }) !== null,
    }).toEqual({ before: null, opened: true, withComments: true });
  });
});
