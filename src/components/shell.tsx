import { Suspense } from "react";
import { ShellAccount } from "./shell-account";
import { ShellFrame, type NavHref } from "./shell-frame";

export function Shell({ current, children }: { current: NavHref; children: React.ReactNode }) {
  return (
    <ShellFrame
      current={current}
      account={
        <Suspense fallback={<div className="h-[61px]" />}>
          <ShellAccount />
        </Suspense>
      }
    >
      {children}
    </ShellFrame>
  );
}
