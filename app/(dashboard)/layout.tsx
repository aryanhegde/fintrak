import Header from "@/components/header";

// Every dashboard page renders per-user data behind auth and reads
// useSearchParams in client components; static prerendering is never valid.
export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: Props) => {
  return (
    <>
      <Header />
      <main className="px-3 lg:px-14">{children}</main>
    </>
  );
};

export default DashboardLayout;
