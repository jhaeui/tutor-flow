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
        className="rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[9px] font-semibold text-[#9ca3af] hover:bg-[#f5f5f5]"
      >
        로그아웃
      </button>
    </form>
  );
}
