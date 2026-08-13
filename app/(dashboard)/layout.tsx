import Header from "@/components/header";
import { QuickAddButton } from "@/components/quick-add-button";
import { SheetProvider } from "@/providers/sheet-provider";

// Every dashboard page renders per-user data behind auth and reads
// useSearchParams in client components; static prerendering is never valid.
export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="px-3 lg:px-14">{children}</main>
      <SheetProvider />
      <QuickAddButton />
    </div>
  );
};

export default DashboardLayout;
