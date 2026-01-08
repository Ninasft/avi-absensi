import Head from 'next/head';
import App from '../components/App';

export default function Home() {
  return (
    <>
      <Head>
        <title>AVI-ABSENSI | Ultimate Control</title>
        <meta name="description" content="Avicenna Agency Attendance Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1e1b4b" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%23f97316%22/><text y=%22.9em%22 font-size=%2270%22 font-weight=%22bold%22 font-family=%22Arial%22 fill=%22white%22 x=%2250%%22 text-anchor=%22middle%22>A</text></svg>" />
      </Head>
      <App />
    </>
  );
}