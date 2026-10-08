"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function authenticate(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = form.get("mode");
  if (!email || !password) return { error: "Enter your email and password." };
  if (mode !== "login" && mode !== "signup") return { error: "Choose sign in or create account." };
  if (mode === "signup" && password.length < 8) return { error: "Use a password with at least 8 characters." };
  const supabase = await createClient();
  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) return { message: "Check your email to confirm your account, then sign in here." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Unable to sign in. Check your credentials and confirm your email." };
  }
  redirect("/");
}
