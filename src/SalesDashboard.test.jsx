// @ts-nocheck
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import SalesDashboard, { SalesDashboardView } from "./SalesDashboard";
import { getSalesDashboard } from "./firebase";
vi.mock("./Header", () => ({ default: () => <header>Admin</header> }));
vi.mock("./firebase", () => ({ auth: {}, getSalesDashboard: vi.fn() }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, fn) => {
    queueMicrotask(() => fn({ uid: "admin" }));
    return () => {};
  },
}));
const data = {
  generatedAt: Date.parse("2026-09-19"),
  summary: {
    active: 2,
    expired: 1,
    expiring30: 1,
    expiring90: 1,
    manualAccess: 1,
    repeatBuyers: 1,
    recordedBuyers: 2,
  },
  coverage: {
    paid: 3,
    transactions: 2,
    favoriteAccounts: 2,
    archiveEvents: 0,
    snapshots: 0,
  },
  quality: {
    duplicates: 1,
    conflicts: 0,
    excludedManual: 1,
    excludedNonLive: 0,
    missingAmounts: 0,
    missingDates: 0,
    missingOrderIds: 0,
  },
  revenue: [
    {
      month: "2025-01",
      currency: "USD",
      basis: "Recorded gross receipts",
      amount: 10,
      orders: 1,
    },
    {
      month: "2026-02",
      currency: "USD",
      basis: "Recorded gross receipts",
      amount: 20,
      orders: 1,
    },
    {
      month: "2026-02",
      currency: "EUR",
      basis: "Recorded gross receipts",
      amount: 15,
      orders: 1,
    },
  ],
  purchases: [],
  members: [
    {
      uid: "member-a",
      status: "Active",
      plan: "1 year",
      favorites: 4,
      expiresOn: Date.parse("2026-10-01"),
      recordedPurchases: 1,
    },
    {
      uid: "member-b",
      status: "Expired",
      plan: "Manual grant",
      favorites: 0,
      expiresOn: Date.parse("2026-01-01"),
      recordedPurchases: 0,
    },
  ],
  mix: [{ status: "Active", plan: "1 year", count: 2 }],
  engagement: [
    {
      status: "Active",
      accounts: 2,
      meanFavorites: 4,
      medianFavorites: 4,
      withFavorites: 2,
      buckets: [],
    },
    {
      status: "Expired",
      accounts: 1,
      meanFavorites: 0,
      medianFavorites: 0,
      withFavorites: 0,
      buckets: [],
    },
  ],
  expirations: [],
  countries: [],
  retention: [],
  lapseObservations: [],
};
beforeEach(() => vi.clearAllMocks());
it("currency and year controls scope totals without adding currencies", () => {
  render(<SalesDashboardView data={data} />);
  expect(screen.getByTestId("revenue-total")).toHaveTextContent("$30.00");
  fireEvent.change(screen.getByLabelText("Currency"), {
    target: { value: "EUR" },
  });
  expect(screen.getByTestId("revenue-total")).toHaveTextContent("€15.00");
  fireEvent.change(screen.getByLabelText("Revenue year"), {
    target: { value: "2025" },
  });
  expect(screen.getByTestId("revenue-total")).toHaveTextContent("No records");
  fireEvent.change(screen.getByLabelText("Revenue year"), {
    target: { value: "all" },
  });
  expect(screen.getByTestId("revenue-total")).toHaveTextContent("€15.00");
});
it("member filters actually narrow records", () => {
  render(<SalesDashboardView data={data} />);
  fireEvent.click(screen.getByRole("tab", { name: "Membership" }));
  fireEvent.change(screen.getByLabelText("Membership status"), {
    target: { value: "Expired" },
  });
  expect(screen.getByText("member-b")).toBeInTheDocument();
  expect(screen.queryByText("member-a")).not.toBeInTheDocument();
});
it("never presents current favorites as historical churn evidence", () => {
  render(<SalesDashboardView data={data} />);
  fireEvent.click(screen.getByRole("tab", { name: "Retention & engagement" }));
  expect(
    screen.getByText(/Current favorites are not favorites at churn/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Monthly retention is not yet available/),
  ).toBeInTheDocument();
});
it("denied backend response shows an error without any dashboard data", async () => {
  getSalesDashboard.mockRejectedValue({ code: "functions/permission-denied" });
  render(<SalesDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin access");
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
});
it("loads protected data and supports refresh", async () => {
  getSalesDashboard.mockResolvedValue({ data });
  render(<SalesDashboard />);
  await screen.findByRole("tab", { name: "Revenue" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  await waitFor(() => expect(getSalesDashboard).toHaveBeenCalledTimes(2));
});
