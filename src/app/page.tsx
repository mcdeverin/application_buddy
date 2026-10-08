import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { Tracker } from "./tracker";
import type { Application, ApplicationEvent, Task } from "@/lib/tracker";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const userId = data.user.id;
  const [applications, tasks, events] = await Promise.all([
    supabase.from("applications").select("id, company, role, status, location, salary, job_url, source, applied_at, last_update_at").eq("user_id", userId).order("last_update_at", { ascending: false, nullsFirst: false }),
    supabase.from("actions").select("id, application_id, title, action_type, due_at, completed").eq("user_id", userId).order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("application_events").select("id, application_id, event_type, description, source, occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false, nullsFirst: false }),
  ]);
  return <Tracker email={data.user.email ?? ""} applications={(applications.data ?? []) as Application[]} tasks={(tasks.data ?? []) as Task[]} events={(events.data ?? []) as ApplicationEvent[]} loadError={!!(applications.error || tasks.error || events.error)} now={new Date().toISOString()} />;
}
