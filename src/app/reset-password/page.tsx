import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ResetForm } from "@/components/auth/reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  const { token, error } = await searchParams;
  return (
    <ResetForm
      token={typeof token === "string" ? token : undefined}
      invalidLink={typeof error === "string" && error.length > 0}
    />
  );
}
