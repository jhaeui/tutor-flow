import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default function LogoutButton() {
  async function logout() {
    "use server";

    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    redirect("/login");
  }

  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-2 text-sm text-[#5f4b3f] hover:bg-[#fff7f1]"
      >
        로그아웃
      </button>
    </form>
  );
}