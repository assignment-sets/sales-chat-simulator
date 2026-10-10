"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=" + encodeURIComponent("Please enter email and password"));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    let msg = "Invalid email or password";
    if (error.message.toLowerCase().includes("email not confirmed")) {
      msg = "Please verify your email address";
    }
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/", "layout");
  redirect("/chats");
}

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/register?error=" + encodeURIComponent("Please enter email and password"));
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    let msg = error.message;
    if (msg.toLowerCase().includes("already registered")) {
      msg = "Account already exists for this email";
    } else if (msg.toLowerCase().includes("at least 6 characters")) {
      msg = "Password must be at least 6 characters";
    }
    redirect(`/register?error=${encodeURIComponent(msg)}`);
  }

  // If user session is created immediately (e.g. autoconfirm enabled)
  if (data?.session) {
    revalidatePath("/", "layout");
    redirect("/chats");
  }

  // If email confirmation is required
  redirect("/login?message=" + encodeURIComponent("Account created! You can now sign in."));
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
