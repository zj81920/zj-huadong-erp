import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Sidebar />
      <main className="ml-[260px] min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}
