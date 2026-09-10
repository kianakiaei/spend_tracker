import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ForgotForm } from "@/components/auth/forgot-form";

const requestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset },
}));

describe("ForgotForm", () => {
  it("normalizes the email before requesting the reset", async () => {
    requestPasswordReset.mockResolvedValueOnce({ data: {}, error: null });
    const { container } = render(<ForgotForm />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "  USER@Example.COM  " },
    });
    fireEvent.click(container.querySelector('button[type="submit"]')!);
    await screen.findByText("اگر این ایمیل ثبت شده باشد، لینک ریست فرستاده شد");
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "/reset-password",
    });
  });
});
