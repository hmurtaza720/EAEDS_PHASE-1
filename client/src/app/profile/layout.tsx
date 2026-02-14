import type { Metadata } from "next";
import Sidebar from "../../components/live/Sidebar";

export const metadata: Metadata = {
    title: "Profile - EAEDS Control",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-[100dvh] max-h-[100dvh] min-w-[100dvw] max-w-[100dvw] overflow-hidden border-2 border-slate-800 bg-slate-950 p-1">
            <Sidebar />
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
