"use server";

import { revalidatePath } from "next/cache";
import { addTask, setTaskStatus } from "@/lib/data/store";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

export async function toggleTaskAction(clientId: string, taskId: string, done: boolean) {
  setTaskStatus(new Date(), clientId, taskId, done ? "done" : "todo");
  revalidatePath("/agency");
  revalidatePath("/agency/tasks");
  revalidatePath(`/agency/clients/${clientId}`);
}

export async function addTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const errors: Record<string, string> = {};
  if (!clientId) errors.clientId = "Pick a client";
  if (title.length < 2) errors.title = "Name the task";
  if (Object.keys(errors).length) return { ok: false, errors };
  const assignee = String(formData.get("assignee") ?? "") || undefined;
  const dueOn = String(formData.get("dueOn") ?? "") || undefined;
  const t = addTask(new Date(), clientId, title, assignee, dueOn);
  if (!t) return { ok: false, message: "Client not found." };
  revalidatePath("/agency");
  revalidatePath("/agency/tasks");
  revalidatePath(`/agency/clients/${clientId}`);
  return { ok: true, message: "Task added" };
}
