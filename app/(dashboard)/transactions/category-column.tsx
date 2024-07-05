import { useOpenCategory } from "@/fearures/categories/hooks/use-open-category";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

type Props = {
  id: string | null;
  category: string | null;
  categoryId: string | null;
};

export const CategoryColumn = ({ category, categoryId }: Props) => {
  const { onOpen: onOpenCategory } = useOpenCategory();

  const onClick = () => {
    if (categoryId) {
      onOpenCategory(categoryId);
    }
  };

  return (
    <div
      className="flex items-center cursor-pointer hover:underline"
      onClick={onClick}
    >
      {!category && (
        <TriangleAlert
          className={cn("mr-2 size-4 shrink-0", !category && "text-rose-500")}
        />
      )}
      {category || "Uncategorized"}
    </div>
  );
};
