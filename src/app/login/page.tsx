import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  const { reset } = await searchParams;
  return <LoginForm resetDone={reset === "done"} />;
}
