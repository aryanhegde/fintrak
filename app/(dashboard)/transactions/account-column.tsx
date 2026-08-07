import { Landmark } from "lucide-react";

import { useOpenAccount } from "@/features/accounts/hooks/use-open-account";

type Props = {
  account: string;
  accountId: string;
};

export const AccountColumn = ({ account, accountId }: Props) => {
  const { onOpen: onOpenAccount } = useOpenAccount();

  const onClick = () => {
    onOpenAccount(accountId);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-x-1.5 text-sm text-slate-500 transition-colors hover:text-blue-600"
    >
      <Landmark className="size-3.5 shrink-0" />
      <span className="truncate">{account}</span>
    </button>
  );
};
