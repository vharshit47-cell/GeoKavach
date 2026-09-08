import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/backend/supabase/server";
import { AuthForm } from "@/components/AuthForm";
export const dynamic = "force-dynamic";
export default async function UpdatePasswordPage() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login?next=/auth/update-password");
  return <AuthForm mode="update" />;
}
