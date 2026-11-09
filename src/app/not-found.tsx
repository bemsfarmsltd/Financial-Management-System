import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mb-4 text-[#EA580C] font-black text-2xl">
        404
      </div>
      <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        The requested resource or workstation does not exist or has been relocated within the BEMS enterprise portal.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#EA580C] hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-md shadow-orange-500/20 transition-all"
      >
        Return to Portal
      </Link>
    </div>
  );
}
