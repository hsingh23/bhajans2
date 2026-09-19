// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Admin from "./Admin";
import { getUserByEmail, updateUserAccess } from "./firebase";
import { get } from "firebase/database";

vi.mock("./Header", () => ({ default: () => <header>Admin</header> }));
vi.mock("./firebase", () => ({
  auth: {},
  db: {},
  getUserByEmail: vi.fn(),
  updateUserAccess: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, callback) => {
    queueMicrotask(() => callback({ uid: "admin" }));
    return () => {};
  },
}));
vi.mock("firebase/database", () => ({
  ref: (_db, path) => path,
  get: vi.fn(),
}));
const user = {
  uid: "example-customer-uid",
  email: "customer@example.com",
  displayName: "Test Customer",
  expiresOn: Date.parse("2030-01-01T00:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ val: () => "1" });
  getUserByEmail.mockResolvedValue({ data: user });
  updateUserAccess.mockResolvedValue({
    data: { ...user, expiresOn: Date.parse("2040-01-01T00:00:00Z") },
  });
});
async function search(value = user.email) {
  render(<Admin />);
  fireEvent.change(await screen.findByLabelText("Find user by email or UID"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find user" }));
}
describe("admin access management", () => {
  it("finds the existing account and adds ten years through the protected callable", async () => {
    await search(" MAILTO:CUSTOMER@EXAMPLE.COM ");
    expect(await screen.findByText("Test Customer")).toBeInTheDocument();
    expect(getUserByEmail).toHaveBeenCalledWith({ email: user.email });
    fireEvent.click(screen.getByRole("button", { name: "Add 10 years" }));
    await waitFor(() =>
      expect(updateUserAccess).toHaveBeenCalledWith({
        uid: user.uid,
        mode: "years",
        years: 10,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Access saved");
  });
  it("supports UID search and setting an explicit expiration", async () => {
    await search(user.uid);
    await screen.findByText("Test Customer");
    expect(getUserByEmail).toHaveBeenCalledWith({ uid: user.uid });
    fireEvent.change(screen.getByLabelText("Set expiration date"), {
      target: { value: "2035-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set expiration" }));
    await waitFor(() =>
      expect(updateUserAccess).toHaveBeenCalledWith({
        uid: user.uid,
        mode: "date",
        date: "2035-12-31",
      }),
    );
  });
  it("supports custom whole years", async () => {
    await search();
    await screen.findByText("Test Customer");
    fireEvent.change(screen.getByLabelText("Extra years (1–100)"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add years" }));
    await waitFor(() =>
      expect(updateUserAccess).toHaveBeenCalledWith({
        uid: user.uid,
        mode: "years",
        years: 7,
      }),
    );
  });
  it("distinguishes a network/backend failure from an absent account", async () => {
    getUserByEmail.mockRejectedValue({
      code: "functions/unavailable",
      message: "Service unavailable",
    });
    await search();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lookup failed: Service unavailable",
    );
    expect(screen.queryByText(/No account matches/)).not.toBeInTheDocument();
  });
  it("shows a genuine not-found response", async () => {
    getUserByEmail.mockRejectedValue({ code: "functions/not-found" });
    await search();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No account matches",
    );
  });
  it("does not expose search to a non-admin", async () => {
    get.mockResolvedValue({ val: () => null });
    render(<Admin />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "does not have admin access",
    );
    expect(
      screen.queryByRole("button", { name: "Find user" }),
    ).not.toBeInTheDocument();
  });
  it("clears selected account when query changes so access cannot be granted to the previous result", async () => {
    await search();
    await screen.findByText("Test Customer");
    fireEvent.change(screen.getByLabelText("Find user by email or UID"), {
      target: { value: "another@example.com" },
    });
    expect(
      screen.queryByRole("button", { name: "Add 1 year" }),
    ).not.toBeInTheDocument();
  });
  it("shows save failure without claiming success", async () => {
    updateUserAccess.mockRejectedValue(new Error("Permission denied"));
    await search();
    await screen.findByText("Test Customer");
    fireEvent.click(screen.getByRole("button", { name: "Add 1 year" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Access was not saved",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
