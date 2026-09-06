import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return <p>سلام، {name}</p>;
}

describe("jsdom project smoke", () => {
  it("renders a component with RTL", () => {
    render(<Greeting name="مثال" />);
    expect(screen.getByText("سلام، مثال")).toBeInTheDocument();
  });
});
