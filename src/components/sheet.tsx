'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

const DESKTOP = '(min-width: 1024px)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * 入力の窓。スマホは下から出る窓（Drawer）、幅 1024px 以上は画面の中央の窓（Dialog）。
 * PC で下から出るのは不自然と言われて分けた（本人、2026-10-11）。どちらも外を押すか Esc で閉じる。
 * 題は窓の種類ごとの部品で出す（読み上げで窓の名前になる）。中身は p-5 の余白を自分で持つ
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex flex-col gap-4 p-5">
            <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <div className="flex flex-col gap-4 overflow-y-auto p-5 pb-sheet-end">
          <DrawerTitle className="flex items-center gap-2 text-lg font-extrabold">
            {title}
          </DrawerTitle>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
