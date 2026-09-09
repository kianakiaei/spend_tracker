import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotForm } from "@/components/auth/forgot-form";

export default async function ForgotPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  return <ForgotForm />;
}
