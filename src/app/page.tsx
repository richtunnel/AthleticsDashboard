import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Athletic Director Dashboard</h1>
        <p className="text-xl text-gray-600 mb-8">Manage your athletic schedules with ease</p>
        <Link href="/api/auth/signin" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
          Get Started
        </Link>
      </div>
    </div>
  );
}
