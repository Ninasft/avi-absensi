import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Trash2, Edit3, Wallet, Cloud, Download, AlertTriangle, Check } from 'lucide-react';

/* ================= FIREBASE SETUP (SMART INITIALIZATION) ================= */
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

// Memastikan Firebase hanya jalan di browser dan config tersedia
if (typeof window !== 'undefined') {
  try {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

const App = () => {
  const [user, setUser] = useState(null); // Auth State (Firebase)
  const [appUser, setAppUser] = useState(null); // App State (Pegawai/Admin)
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Filter States
  const [activeHistoryTab, setActiveHistoryTab] = useState('Umum');
  const [filterName, setFilterName] = useState('Semua');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());

  // Edit States
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ aksi: '', waktu: '' });

  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const pegawaiAkses = {
    "Abub": ["Umum"], "Rendy": ["Umum"], "Dedi": ["Umum"],
    "Vebi": ["Live"], "Silvi": ["Umum", "Live"], "Aisyah": ["Umum", "Live"]
  };

  const daftarPegawai = {
    Umum: ["Abub", "Dedi", "Silvi", "Aisyah", "Rendy"],
    Live: ["Silvi", "Aisyah", "Vebi"]
  };

  /* ================= 1. AUTH LOGIC (FOLLOWING YOUR WORKING PATTERN) ================= */
  useEffect(() => {
    if (typeof window === 'undefined' || !auth) {
      setIsInitializing(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  /* ================= 2. DATA SYNC (RULE 1 & 2) ================= */
  useEffect(() => {
    if (!user || !db) return;

    const qLogs = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirements
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }, (err) => {
      console.error("Firestore error:", err);
      showStatus("Database offline", "error");
    });

    return () => unsubLogs();
  }, [user]);

  /* ================= 3. UTILS & HANDLERS ================= */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginInput;
    
    if (username === 'admin' && password === 'admin123') {
      setAppUser({ nama: 'Administrator', role: 'admin' });
      showStatus("Admin Login Sukses", "success");
      return;
    }

    const found = Object.keys(pegawaiAkses).find(p => p.toLowerCase() === username.toLowerCase());
    if (found && password.toLowerCase() === found.toLowerCase()) {
      setAppUser({ nama: found, role: 'pegawai' });
      showStatus(`Selamat bekerja, ${found}!`, "success");
    } else {
      showStatus("Username/Password Salah", "error");
    }
  };

  const handleAbsen = async (action) => {
    if (!user || isLoading || !db) return;
    setIsLoading(true);

    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');

    // Cek duplikasi hari ini
    const sudahAda = logs.find(l => 
      l.nama === appUser.nama && 
      l.tipe === absensiType && 
      l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (sudahAda) {
      showStatus(`Sudah ${action} hari ini`, "error");
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), {
        nama: appUser.nama,
        tipe: absensiType,
        aksi: action,
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggalDisplay: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulanIndex: now.getMonth(),
        timestamp: Date.now(),
        isEdited: false
      });
      showStatus(`Absen ${action} Berhasil`, "success");
    } catch (e) {
      showStatus("Gagal simpan ke cloud", "error");
    } finally {
      setIsLoading(false);
    }
  };

  /* ================= 4. CALCULATIONS ================= */
  const rekapData = useMemo(() => {
    const dailyMap = {};
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));

    filtered.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleDateString('id-ID');
      const key = `${log.nama}-${dateStr}-${log.tipe}`;
      if (!dailyMap[key]) dailyMap[key] = { masuk: null, pulang: null, nama: log.nama, tipe: log.tipe };
      if (log.aksi === 'Masuk') dailyMap[key].masuk = log;
      if (log.aksi === 'Pulang') dailyMap[key].pulang = log;
    });

    const summary = {};
    Object.values(dailyMap).forEach(item => {
      if (!summary[item.nama]) summary[item.nama] = { jam: 0, gaji: 0, lupaOut: 0 };
      if (item.masuk && item.pulang) {
        const start = new Date(item.masuk.timestamp);
        const end = new Date(item.pulang.timestamp);
        const diff = Math.max(0, (end - start) / (1000 * 60 * 60));
        summary[item.nama].jam += diff;
        if (item.tipe === 'Live') summary[item.nama].gaji += diff * UPAH_PER_JAM;
      } else if (item.masuk && !item.pulang) {
        summary[item.nama].lupaOut += 1;
      }
    });
    return summary;
  }, [logs, filterMonth]);

  const filteredLogs = logs.filter(log => {
    const matchTab = log.tipe === activeHistoryTab;
    const matchName = filterName === 'Semua' || log.nama === filterName;
    const matchMonth = log.bulanIndex === parseInt(filterMonth);
    return matchTab && matchName && matchMonth;
  });

  /* ================= 5. RENDERER ================= */
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">AVI-ABSENSI</h2>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2 animate-pulse">Menghubungkan ke Cloud...</p>
      </div>
    );
  }

  if (!appUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
          <div className="text-center mb-10">
            <div className="mx-auto w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-xl">
              <Cloud size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">AVI-ABSENSI</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Attendance Management System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginInput.username}
              onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginInput.password}
              onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
            <button type="submit" className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">AVI-ABSENSI</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{appUser.nama} • {appUser.role}</p>
          </div>
          <button onClick={() => setAppUser(null)} className="p-3 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {currentPage === 'absen' ? (
          <>
            <div className="bg-white rounded-[2.5rem] shadow-xl p-10 text-center border border-slate-100">
              <div className="text-6xl font-black text-slate-900 tracking-tighter mb-2">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="flex bg-slate-200/50 p-1.5 rounded-full border border-slate-200">
              {['Umum', 'Live'].map(type => (
                <button
                  key={type}
                  onClick={() => setAbsensiType(type)}
                  className={`flex-1 py-3 rounded-full font-black text-[10px] uppercase transition-all ${
                    absensiType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {type === 'Live' ? 'Live Session' : 'Sesi Umum'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAbsen('Masuk')}
                disabled={isLoading}
                className="bg-emerald-600 text-white p-8 rounded-[2.5rem] font-black uppercase text-[11px] shadow-lg flex flex-col items-center gap-4 active:scale-95 disabled:opacity-50 transition-all"
              >
                <div className="bg-white/20 p-4 rounded-2xl"><CheckCircle2 size={32} /></div>
                Clock In
              </button>
              <button
                onClick={() => handleAbsen('Pulang')}
                disabled={isLoading}
                className="bg-rose-600 text-white p-8 rounded-[2.5rem] font-black uppercase text-[11px] shadow-lg flex flex-col items-center gap-4 active:scale-95 disabled:opacity-50 transition-all"
              >
                <div className="bg-white/20 p-4 rounded-2xl"><Clock size={32} /></div>
                Clock Out
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {appUser.role === 'admin' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-lg">
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">Total Jam Kerja</p>
                  <p className="text-3xl font-black">{Object.values(rekapData).reduce((a, b) => a + b.jam, 0).toFixed(1)}h</p>
                </div>
                <div className="bg-rose-600 text-white p-6 rounded-[2rem] shadow-lg">
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">Isu Lupa Keluar</p>
                  <p className="text-3xl font-black">{Object.values(rekapData).reduce((a, b) => a + b.lupaOut, 0)}</p>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-4">
              <div className="flex gap-2">
                <div className="flex bg-slate-100 p-1 rounded-full flex-1 border border-slate-200">
                  {['Umum', 'Live'].map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveHistoryTab(t)}
                      className={`flex-1 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${activeHistoryTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {appUser.role === 'admin' && (
                  <button onClick={() => {
                    const data = filteredLogs.map(l => `${l.nama}\t${l.waktu}\t${l.aksi}\t${l.tanggalDisplay}`).join('\n');
                    navigator.clipboard.writeText(data);
                    showStatus("Data disalin!", "success");
                  }} className="p-3 bg-slate-900 text-white rounded-2xl active:scale-90 transition-all">
                    <Download size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {filteredLogs.map(log => (
                <div key={log.id} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[10px] ${log.aksi === 'Masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800">{log.nama}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{log.tanggalDisplay}</p>
                      <p className="text-lg font-black text-slate-900 mt-1">{log.waktu}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {appUser.role === 'admin' && activeHistoryTab === 'Live' && (
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="text-blue-400" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Estimasi Gaji Live</h3>
                </div>
                {Object.entries(rekapData).map(([nama, data]) => (
                  <div key={nama} className="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                      <p className="font-black text-sm">{nama}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{data.jam.toFixed(1)} Jam</p>
                    </div>
                    <p className="text-xl font-black text-blue-400">Rp {Math.round(data.gaji).toLocaleString('id-ID')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-6 py-4 flex gap-4 z-40 shadow-2xl">
        <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'absen' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <Clock size={20} />
          <span className="text-[9px] font-black uppercase tracking-widest">Absen</span>
        </button>
        <button onClick={() => setCurrentPage('history')} className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <History size={20} />
          <span className="text-[9px] font-black uppercase tracking-widest">Audit</span>
        </button>
      </nav>

      {statusMessage && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white font-black text-[10px] uppercase shadow-2xl animate-bounce z-[100] ${statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {statusMessage.msg}
        </div>
      )}
    </div>
  );
};

export default App;