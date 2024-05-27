"use client";

import { getUserAccounts } from "@/fearures/accounts/api/use-get-acounts";

export default function Home() {
  const { data: accounts, isLoading } = getUserAccounts();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {accounts?.map((account) => (
        <div key={account.id}>{account.name}</div>
      ))}
    </div>
  );
}
