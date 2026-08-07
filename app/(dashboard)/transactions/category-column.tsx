import { TriangleAlert } from "lucide-react";

import { useOpenCategory } from "@/features/categories/hooks/use-open-category";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  category: string | null;
  categoryId: string | null;
};

export const CategoryColumn = ({ id, category, categoryId }: Props) => {
  const { onOpen: onOpenCategory } = useOpenCategory();
  const { onOpen: onOpenTransaction } = useOpenTransaction();

  const onClick = () => {
    if (categoryId) {
      onOpenCategory(categoryId);
    } else {
      onOpenTransaction(id);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-x-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200",
        !category &&
          "border border-dashed border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
      )}
    >
      {!category && <TriangleAlert className="size-3 shrink-0" />}
      <span className="max-w-32 truncate">{category ?? "Uncategorized"}</span>
    </button>
  );
};
