import Link from "next/link";

type Props = {
  searchParams?: Record<string, string | string[]>;
};

export default function PaymentFailPage({ searchParams }: Props) {
  const rawReason = searchParams?.reason;
  const reason = Array.isArray(rawReason) ? rawReason[0] : rawReason;

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 dark:bg-gray-900 px-4 py-20">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Payment failed
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            We couldn't process your payment. {reason ? `Reason: ${reason}.` : "Please try again or contact support."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/paywall"
              className="inline-block px-5 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Retry payment
            </Link>

            <Link
              href="/dashboard"
              className="inline-block px-5 py-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to dashboard
            </Link>

            <a
              href="mailto:support@example.com"
              className="inline-block px-5 py-2 text-sm text-blue-600 hover:underline"
            >
              Contact support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}