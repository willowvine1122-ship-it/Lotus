"use client";

import { Bell, CircleCheck, CircleDashed, CircleSlash, CircleX, Clock3, ListTodo, Mail, MessageSquare, MoveRight, Split, Tag, TagX, UserCheck, Zap, type LucideIcon } from "lucide-react";
import type { AccountMode, Pipeline, RunStatus, RunStepStatus, StepType, WorkflowStatus, WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MergeText } from "@/components/email/ui";
import { runStatusLabel, stepLabel, stepSummary, workflowStatusLabel } from "./model";

/* Small pieces shared by the automation screens. */

export const stepIcon: Record<StepType | "trigger", LucideIcon> = {
  trigger: Zap,
  send_sms: MessageSquare,
  send_email: Mail,
  add_tag: Tag,
  remove_tag: TagX,
  move_stage: MoveRight,
  assign_owner: UserCheck,
  create_task: ListTodo,
  notify: Bell,
  wait: Clock3,
  branch: Split,
};

/** Active is the normal state, so it stays quiet; Paused is amber, like a paused client; Draft is a dashed outline. */
export function WorkflowStatusTag({ status }: { status: WorkflowStatus }) {
  const cls = {
    active: "bg-surface-2 text-fg-2",
    paused: "bg-amber-soft text-amber",
    draft: "border border-dashed border-line-strong text-fg-3",
  }[status];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-[4px] px-1.5 text-2xs font-medium whitespace-nowrap", cls)}>
      {status === "active" && <span aria-hidden className="size-1.5 rounded-full bg-green" />}
      {workflowStatusLabel[status]}
    </span>
  );
}

/** Waiting borrows Scheduled's violet wash (something queued); Failed is the one red. */
export function RunStatusTag({ status, test }: { status: RunStatus; test?: boolean }) {
  const cls = {
    waiting: "bg-brand-soft text-brand",
    completed: "bg-surface-2 text-fg-2",
    failed: "bg-red-soft text-red",
    stopped: "border border-dashed border-line-strong text-fg-3",
  }[status];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex h-5 items-center rounded-[4px] px-1.5 text-2xs font-medium whitespace-nowrap", cls)}>{runStatusLabel[status]}</span>
      {test && <span className="inline-flex h-5 items-center rounded-[4px] px-1 text-2xs text-fg-3 ring-1 ring-line ring-inset">Test</span>}
    </span>
  );
}

const runStepIcon: Record<RunStepStatus, { icon: LucideIcon; cls: string; label: string }> = {
  done: { icon: CircleCheck, cls: "text-green", label: "Done" },
  skipped: { icon: CircleSlash, cls: "text-fg-3", label: "Skipped" },
  failed: { icon: CircleX, cls: "text-red", label: "Failed" },
  waiting: { icon: CircleDashed, cls: "text-brand", label: "Waiting" },
};

export function RunStepMark({ status }: { status: RunStepStatus }) {
  const { icon: Icon, cls, label } = runStepIcon[status];
  return (
    <span className={cn("grid size-5 shrink-0 place-items-center", cls)}>
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function StepGlyph({ type, className }: { type: StepType | "trigger"; className?: string }) {
  const Icon = stepIcon[type];
  return (
    <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded bg-surface-2 text-fg-2 ring-1 ring-line ring-inset", className)}>
      <Icon className="size-3.5" strokeWidth={1.75} />
    </span>
  );
}

/**
 * The whole workflow as a compact read-only outline, for the board panel:
 * one line per step, waits as quiet time markers, branches as two short lanes.
 */
export function FlowOutline({ steps, pipeline, mode }: { steps: WorkflowStep[]; pipeline?: Pipeline; mode: AccountMode }) {
  if (!steps.length) return <p className="text-xs text-fg-3">No steps yet.</p>;
  return (
    <ol className="flex flex-col">
      {steps.map((s) => (
        <OutlineItem key={s.id} step={s} pipeline={pipeline} mode={mode} />
      ))}
    </ol>
  );
}

function OutlineItem({ step, pipeline, mode }: { step: WorkflowStep; pipeline?: Pipeline; mode: AccountMode }) {
  const Icon = stepIcon[step.type];
  if (step.type === "wait") {
    return (
      <li className="flex items-center gap-2 py-1 pl-[9px] text-xs text-fg-3">
        <span aria-hidden className="h-3 w-px bg-line-strong" />
        <Clock3 className="ml-1 size-3" strokeWidth={1.75} aria-hidden />
        {stepSummary(step, pipeline, mode)}
      </li>
    );
  }
  return (
    <li className="flex flex-col">
      <div className="flex min-w-0 items-start gap-2 py-1">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-fg-3" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 text-sm leading-5">
          <span className="font-medium">{stepLabel[step.type]}</span>
          <span className="text-fg-2">
            {" · "}
            <MergeText text={stepSummary(step, pipeline, mode)} />
          </span>
        </span>
      </div>
      {step.type === "branch" && (
        <div className="ml-[7px] flex flex-col gap-1 border-l border-line-strong pl-3">
          {(["yes", "no"] as const).map((side) => (
            <div key={side}>
              <div className="pt-1 text-2xs font-medium text-fg-3">{side === "yes" ? "Yes" : "No"}</div>
              {step[side].length ? (
                <ol>
                  {step[side].map((x) => (
                    <OutlineItem key={x.id} step={x} pipeline={pipeline} mode={mode} />
                  ))}
                </ol>
              ) : (
                <p className="py-1 text-xs text-fg-3">Nothing, carry on</p>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
