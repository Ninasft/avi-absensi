import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import {
  Clock, CheckCircle2, LogOut, History, Trash2, Edit3,
  Wallet, Cloud, Download, AlertTriangle, Check
} from 'lucide-react';

/* ================= FIREBASE INIT ================= */
let app, auth, db;

if (typeof window !== 'undefined') {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const appId = 'avi-absensi-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const UPAH_PER_JAM = 25000;

  /* ================= AUTH ================= */
  useEffect(() => {
    signInAnonymously(auth);
    const unsub = onAuthStateChanged(auth, u => setDbUser(u));
    return () => unsub();
  }, []);

  /* ================= DATA ================= */
  useEffect(() => {
    if (!dbUser) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
    });
  }, [dbUser]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  /* ================= LOGIN ================= */
  const handleLogin = e => {
    e.preventDefault();
    if (loginInput.username === 'admin' && loginInput.password === 'admin123') {
      setUser({ nama: 'Administrator', role: 'admin' });
      showStatus('Admin Login Success', 'success');
    } else {
      showStatus('Login Gagal', 'error');
    }
  };

  /* ================= ABSEN ================= */
  const handleAbsen = async aksi => {
    if (isLoading) return;
    setIsLoading(true);
    const now = new Date();

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), {
      nama: user.nama,
      tipe: absensiType,
      aksi,
      waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      tanggalDisplay: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
      bulanIndex: now.getMonth(),
      timestamp: Date.now()
    });

    showStatus(`Absen ${aksi} Berhasil`, 'success');
    setIsLoading(false);
  };

  /* ================= UI ================= */
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[var(--bg-card)] rounded-3xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 bg-[var(--primary-600)] text-white rounded-2xl flex items-center justify-center">
              <Cloud />
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mt-4">AVI-ABSENSI</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              className="w-full p-4 rounded-xl bg-gray-50 text-[var(--text-primary)]"
              placeholder="Username"
              onChange={e => setLoginInput({ ...loginInput, username: e.target.value })}
            />
            <input
              type="password"
              className="w-full p-4 rounded-xl bg-gray-50 text-[var(--text-primary)]"
              placeholder="Password"
              onChange={e => setLoginInput({ ...loginInput, password: e.target.value })}
            />
            <button className="w-full p-4 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white rounded-xl font-black">
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-50 border-b border-[var(--border-soft)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex justify-between">
          <div>
            <h1 className="font-black text-[var(--text-primary)]">AVI-ABSENSI</h1>
            <p className="text-xs text-[var(--text-secondary)]">{user.nama}</p>
          </div>
          <button onClick={() => setUser(null)} className="text-[var(--danger-600)]">
            <LogOut />
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6 mt-6">
        <div className="bg-white rounded-3xl shadow p-8 text-center">
          <div className="text-5xl font-black text-[var(--text-primary)]">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {currentTime.toLocaleDateString('id-ID')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleAbsen('Masuk')}
            className="bg-[var(--success-600)] text-white rounded-3xl p-6 font-black"
          >
            Clock In
          </button>
          <button
            onClick={() => handleAbsen('Pulang')}
            className="bg-[var(--danger-600)] text-white rounded-3xl p-6 font-black"
          >
            Clock Out
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
