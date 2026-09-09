import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/login-form";

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const authClient = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
}));
vi.mock("@/lib/auth-client", () => ({ authClient }));

function submit(container: HTMLElement) {
  const button = container.querySelector('button[type="submit"]')!;
  fireEvent.click(button);
}

describe("LoginForm (ticket 29)", () => {
  it("toggles between ورود and ثبت‌نام", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", { name: "ورود به دفتر هزینه" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ثبت‌نام" }));
    expect(
      screen.getByRole("heading", { name: "ساخت حساب در دفتر هزینه" }),
    ).toBeInTheDocument();
  });

  it("shows the reset success voice after coming back from /reset-password", () => {
    render(<LoginForm resetDone />);
    expect(
      screen.getByRole("status", { name: "" }),
    ).toHaveTextContent("رمز تازه ثبت شد؛ حالا وارد شو.");
  });

  it("shows the generic error when credentials are wrong", async () => {
    authClient.signIn.email.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid email or password" },
    });
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("رمز"), {
      target: { value: "wrong-password" },
    });
    submit(container);
    expect(
      await screen.findByText("ایمیل یا رمز اشتباه است"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the network voice when the request throws", async () => {
    authClient.signIn.email.mockRejectedValueOnce(new Error("fetch failed"));
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("رمز"), {
      target: { value: "whatever-123" },
    });
    submit(container);
    expect(
      await screen.findByText("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید"),
    ).toBeInTheDocument();
  });

  it("navigates to / after a successful sign-in", async () => {
    authClient.signIn.email.mockResolvedValueOnce({
      data: { user: { email: "a@example.com" } },
      error: null,
    });
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ایمیل"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("رمز"), {
      target: { value: "correct-password-123" },
    });
    submit(container);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(refresh).toHaveBeenCalled();
  });
});
