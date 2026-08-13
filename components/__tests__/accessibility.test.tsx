import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("react-use", () => ({
  useMedia: () => true,
}));

vi.mock("@/features/accounts/api/use-delete-account", () => ({
  useDeleteAccount: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@/features/accounts/hooks/use-open-account", () => ({
  useOpenAccount: () => ({ onOpen: vi.fn() }),
}));

vi.mock("@/features/categories/api/use-delete-category", () => ({
  useDeleteCategory: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@/features/categories/hooks/use-open-category", () => ({
  useOpenCategory: () => ({ onOpen: vi.fn() }),
}));

vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => [() => null, vi.fn(async () => false)],
}));

import AccountActions from "@/app/(dashboard)/accounts/actions";
import CategoryActions from "@/app/(dashboard)/categories/actions";
import { AmountInput } from "@/components/amount-input";
import { DatePicker } from "@/components/date-picker";
import { Navigation } from "@/components/navigation";
import { Select } from "@/components/select";
import { TransactionForm } from "@/features/transactions/components/transaction-form";

describe("accessible controls", () => {
  it("renders one named mobile navigation trigger", () => {
    const mobileNavigationMarkup = renderToStaticMarkup(<Navigation />);

    expect(mobileNavigationMarkup).toContain(
      'aria-label="Open navigation menu"'
    );
    expect(mobileNavigationMarkup).not.toMatch(/<button[^>]*>\s*<button/);
  });

  it("names the amount sign toggle and forwards form ARIA attributes", () => {
    const amountMarkup = renderToStaticMarkup(
      <AmountInput
        value="12.50"
        onChange={() => undefined}
        id="transaction-amount"
        aria-describedby="transaction-amount-message"
        aria-invalid="true"
      />
    );

    expect(amountMarkup).toContain(
      'aria-label="Toggle income or expense"'
    );
    expect(amountMarkup).toContain('id="transaction-amount"');
    expect(amountMarkup).toContain(
      'aria-describedby="transaction-amount-message"'
    );
    expect(amountMarkup).toContain('aria-invalid="true"');
  });

  it("names account and category row menus", () => {
    const accountActionsMarkup = renderToStaticMarkup(
      <AccountActions id="account-1" />
    );
    const categoryActionsMarkup = renderToStaticMarkup(
      <CategoryActions id="category-1" />
    );

    expect(accountActionsMarkup).toContain('aria-label="Open account menu"');
    expect(categoryActionsMarkup).toContain(
      'aria-label="Open category menu"'
    );
  });

  it("forwards the form ID and ARIA attributes to the select input", () => {
    const selectMarkup = renderToStaticMarkup(
      <Select
        value={null}
        onChange={() => undefined}
        options={[]}
        id="transaction-category"
        aria-label="Transaction category"
        aria-describedby="transaction-category-message"
        aria-invalid="true"
      />
    );

    expect(selectMarkup).toContain('id="transaction-category"');
    expect(selectMarkup).toContain('aria-label="Transaction category"');
    expect(selectMarkup).toContain(
      'aria-describedby="transaction-category-message"'
    );
    expect(selectMarkup).toContain('aria-invalid="true"');
  });

  it("forwards form ARIA attributes to the date trigger", () => {
    const dateMarkup = renderToStaticMarkup(
      <DatePicker
        value={new Date(2024, 0, 15)}
        id="transaction-date"
        aria-describedby="transaction-date-message"
        aria-invalid="true"
      />
    );

    expect(dateMarkup).toContain('id="transaction-date"');
    expect(dateMarkup).toContain(
      'aria-describedby="transaction-date-message"'
    );
    expect(dateMarkup).toContain('aria-invalid="true"');
  });

  it("renders a visible label for the transaction date", () => {
    const transactionFormMarkup = renderToStaticMarkup(
      <TransactionForm
        defaultValues={{
          date: new Date(2024, 0, 15),
          accountId: "account-1",
          categoryId: null,
          payee: "",
          amount: "12.50",
          notes: "",
        }}
        onSubmit={() => undefined}
        categoryOptions={[]}
        onCreateCategory={() => undefined}
      />
    );

    expect(transactionFormMarkup).toMatch(
      /<label[^>]*for="[^"]+"[^>]*>Date<\/label>/
    );
  });
});
