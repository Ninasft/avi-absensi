import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import komponen secara dinamis untuk menghindari SSR issues dengan Firebase
const AbsensiApp = dynamic(() => import('../components/AbsensiApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-semibold">Loading AVI-ABSENSI...</p>
      </div>
    </div>
  )
});

export default function Home() {
  return (
    <>
      <Head>
        <title>AVI-ABSENSI - Smart Attendance System</title>
        <meta name="description" content="Sistem absensi cerdas dengan cloud protection" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <AbsensiApp />
    </>
  );
}