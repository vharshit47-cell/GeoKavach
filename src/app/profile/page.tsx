import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/backend/supabase/server";
import { ProfilePage } from "@/components/ProfilePage";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login?next=/profile");
  return <ProfilePage />;
}
