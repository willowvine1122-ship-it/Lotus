import { Sidebar } from "@/components/sidebar";

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
