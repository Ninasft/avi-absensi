import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, query } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Trash2, Edit3, Wallet, Cloud, Download, AlertTriangle, ChevronRight, Check, Calendar } from 'lucide-react';

/* ================= STYLE (WCAG COMPLIANT) ================= */
const styleTag = (
  <style>{`
    :root {
      /* Palette Modern & High Contrast */
      --primary-600: #1e40af;    /* Deep Blue (Contrast 7.1:1) */
      --primary-700: #1e3a8a;
      
      --success-600: #166534;    /* Deep Emerald (Contrast 6.2:1) */
      --danger-600: #991b1b;     /* Deep Rose/Red (Contrast 6.0:1) */
      --warning-800: #92400e;    /* Deep Amber */
      --purple-600: #7e22ce;     /* Vivid Purple */
      
      /* Neutrals */
      --bg-main: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #0f172a;   /* Slate 900 */
      --text-secondary: #475569; /* Slate 600 */
      --text-muted: #64748b;     /* Slate 500 */
      --border-soft: #cbd5e1;    /* Slate 300 */
    }

    body {
      background-color: var(--bg-main);
      color: var(--text-primary);
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* Override focus for accessibility */
    input:focus {
      outline: 2px solid var(--primary-600);
      outline-offset: 2px;
    }

    .shadow-modern {
      shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    }
  `}</style>
);

/* ================= FIREBASE INIT ================= */
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initError, setInitError] = useState(null);
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
    "Abub": ["Umum"],
    "Rendy": ["Umum"],
    "Dedi": ["Umum"],
    "Vebi": ["Live"],
    "Silvi": ["Umum", "Live"],
    "Aisyah": ["Umum", "Live"]
  };

  const daftarPegawai = {
    Umum: ["Abub", "Dedi", "Silvi", "Aisyah", "Rendy"],
    Live: ["Silvi", "Aisyah", "Vebi"]
  };

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setInitError(`Authentication error: ${err.message}`);
      } finally {
        setIsInitializing(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setDbUser(u));
    return () => unsubscribe();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!dbUser) return;
    const qLogs = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => {
      showStatus("Koneksi gagal", "error");
    });
    return () => unsubLogs();
  }, [dbUser]);

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
      setUser({ nama: 'Administrator', role: 'admin' });
      showStatus("Admin Login Success", "success");
      return;
    }
    const found = Object.keys(pegawaiAkses).find(p => p.toLowerCase() === username.toLowerCase());
    if (found && password.toLowerCase() === found.toLowerCase()) {
      setUser({ nama: found, role: 'pegawai' });
      showStatus(`Halo ${found}!`, "success");
    } else {
      showStatus("Login Gagal", "error");
    }
  };

  const handleAbsen = async (action) => {
    if (!dbUser || isLoading) return;
    setIsLoading(true);
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');

    const sudahAda = logs.find(l => 
      l.nama === user.nama && 
      l.tipe === absensiType && 
      l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (sudahAda) {
      showStatus(`Gagal: Sudah ${action} hari ini`, "error");
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), {
        nama: user.nama,
        tipe: absensiType,
        aksi: action,
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggalDisplay: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulanIndex: now.getMonth(),
        timestamp: Date.now(),
        isEdited: false,
        deviceTime: now.toISOString()
      });
      showStatus(`Absen ${action} Berhasil`, "success");
    } catch (e) {
      showStatus("Gagal menyimpan ke Cloud", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLog = async (id) => {
    if (user.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'absensi_logs', id));
      showStatus("Data dihapus", "success");
    } catch (e) {
      showStatus("Gagal hapus", "error");
    }
  };

  const saveEdit = async (id) => {
    if (user.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'absensi_logs', id), {
        ...editForm,
        isEdited: true
      });
      setEditingId(null);
      showStatus("Data diperbarui", "success");
    } catch (e) {
      showStatus("Gagal update", "error");
    }
  };

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

  const copyToClipboard = () => {
    const header = "Nama\tTanggal\tTipe\tAksi\tWaktu\n";
    const content = filteredLogs.map(l => `${l.nama}\t${l.tanggalDisplay}\t${l.tipe}\t${l.aksi}\t${l.waktu}`).join('\n');
    const el = document.createElement('textarea');
    el.value = header + content;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showStatus("Salin Berhasil", "success");
  };

  const filteredLogs = logs.filter(log => {
    const matchTab = log.tipe === activeHistoryTab;
    const matchName = filterName === 'Semua' || log.nama === filterName;
    const matchMonth = log.bulanIndex === parseInt(filterMonth);
    return matchTab && matchName && matchMonth;
  });

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-200 max-w-sm">
          <AlertTriangle className="text-red-600 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-black text-slate-900 mb-2">System Error</h1>
          <p className="text-sm text-slate-600 mb-4">{initError}</p>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6">
        {styleTag}
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-10 border border-slate-100">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[var(--primary-600)] text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Cloud size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">AVI-ABSENSI</h1>
            <p className="text-sm font-bold text-[var(--text-secondary)] mt-1 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Secure Cloud Attendance
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginInput.username}
              onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-slate-900 font-semibold"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginInput.password}
              onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-slate-900 font-semibold"
              required
            />
            <button
              type="submit"
              className="w-full p-4 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-md active:scale-95"
            >
              Masuk Sekarang
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      {styleTag}
      <header className="bg-white border-b border-[var(--border-soft)] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">AVI-ABSENSI</h1>
            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">
              {user.role}: {user.nama}
            </p>
          </div>
          <button
            onClick={() => setUser(null)}
            className="p-3 text-[var(--danger-600)] hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {currentPage === 'absen' && (
          <>
            <div className="bg-white rounded-[2.5rem] shadow-lg p-10 text-center border border-slate-100">
              <div className="text-6xl font-black text-slate-900 tracking-tighter mb-2">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-widest">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-[var(--warning-800)] flex-shrink-0" size={20} />
              <p className="text-xs text-[var(--warning-800)] font-bold leading-relaxed">
                Sistem Terkunci: Hanya dapat melakukan absensi sesuai tanggal perangkat hari ini.
              </p>
            </div>

            <div className="flex gap-2 bg-slate-100 p-2 rounded-[2rem]">
              <button
                onClick={() => setAbsensiType('Umum')}
                className={`flex-1 py-3 rounded-full font-black text-[10px] uppercase transition-all ${
                  absensiType === 'Umum' ? 'bg-white text-[var(--primary-600)] shadow-sm' : 'text-slate-500'
                }`}
              >
                Umum
              </button>
              <button
                onClick={() => setAbsensiType('Live')}
                className={`flex-1 py-3 rounded-full font-black text-[10px] uppercase transition-all ${
                  absensiType === 'Live' ? 'bg-white text-[var(--purple-600)] shadow-sm' : 'text-slate-500'
                }`}
              >
                Live Session
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAbsen('Masuk')}
                disabled={isLoading}
                className="bg-[var(--success-600)] text-white p-8 rounded-[2.5rem] font-black uppercase text-[11px] shadow-lg flex flex-col items-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={32} />
                Clock In
              </button>
              <button
                onClick={() => handleAbsen('Pulang')}
                disabled={isLoading}
                className="bg-[var(--danger-600)] text-white p-8 rounded-[2.5rem] font-black uppercase text-[11px] shadow-lg flex flex-col items-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Clock size={32} />
                Clock Out
              </button>
            </div>
          </>
        )}

        {currentPage === 'history' && (
          <div className="space-y-4">
            {user.role === 'admin' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--primary-600)] text-white p-6 rounded-[2rem] shadow-md">
                  <div className="text-[10px] font-black uppercase opacity-80 mb-1">Total Jam</div>
                  <div className="text-3xl font-black">
                    {Object.values(rekapData).reduce((a, b) => a + b.jam, 0).toFixed(1)} <span className="text-sm">Jam</span>
                  </div>
                </div>
                <div className="bg-[var(--danger-600)] text-white p-6 rounded-[2rem] shadow-md">
                  <div className="text-[10px] font-black uppercase opacity-80 mb-1">Isu Out</div>
                  <div className="text-3xl font-black">
                    {Object.values(rekapData).reduce((a, b) => a + b.lupaOut, 0)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <div className="flex bg-slate-100 p-1.5 rounded-full">
                <button
                  onClick={() => setActiveHistoryTab('Umum')}
                  className={`px-6 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
                    activeHistoryTab === 'Umum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Umum
                </button>
                <button
                  onClick={() => setActiveHistoryTab('Live')}
                  className={`px-6 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
                    activeHistoryTab === 'Live' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Live
                </button>
              </div>
              
              {user.role === 'admin' && (
                <button
                  onClick={copyToClipboard}
                  className="ml-auto p-3 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 transition-all active:scale-90"
                  title="Export Data"
                >
                  <Download size={18} />
                </button>
              )}
            </div>

            {user.role === 'admin' && (
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {daftarBulan.map((b, i) => (
                    <option key={i} value={i}>{b}</option>
                  ))}
                </select>
                <select
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Semua">Semua Pegawai</option>
                  {(activeHistoryTab === 'Umum' ? daftarPegawai.Umum : daftarPegawai.Live).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div key={log.id} className="bg-white rounded-3xl shadow-sm p-5 border border-slate-100 relative">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner ${
                      log.aksi === 'Masuk' ? 'bg-emerald-50 text-[var(--success-600)]' : 'bg-red-50 text-[var(--danger-600)]'
                    }`}>
                      {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-black text-slate-900">{log.nama}</h3>
                        {log.isEdited && <Edit3 size={12} className="text-amber-600" />}
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">{log.tanggalDisplay}</p>
                      
                      {editingId === log.id ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <select
                            value={editForm.aksi}
                            onChange={(e) => setEditForm({...editForm, aksi: e.target.value})}
                            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                          >
                            <option value="Masuk">Masuk</option>
                            <option value="Pulang">Pulang</option>
                          </select>
                          <input
                            type="time"
                            value={editForm.waktu}
                            onChange={(e) => setEditForm({...editForm, waktu: e.target.value})}
                            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                          />
                        </div>
                      ) : (
                        <p className="text-lg font-black text-slate-900 mt-1">{log.waktu}</p>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                      log.tipe === 'Umum' ? 'bg-blue-50 text-[var(--primary-600)] border-blue-100' : 'bg-purple-50 text-[var(--purple-600)] border-purple-100'
                    }`}>
                      {log.tipe}
                    </div>
                  </div>
                  
                  {user.role === 'admin' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50 justify-end">
                      {editingId === log.id ? (
                        <>
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-500 font-bold text-xs">Batal</button>
                          <button onClick={() => saveEdit(log.id)} className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl font-bold text-xs shadow-md"><Check size={16}/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(log.id); setEditForm({aksi: log.aksi, waktu: log.waktu}); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => deleteLog(log.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {user.role === 'admin' && activeHistoryTab === 'Live' && (
              <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 space-y-5 shadow-2xl">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <Wallet className="text-emerald-400" />
                  Rekap Gaji Live
                </h3>
                <div className="space-y-4">
                  {Object.entries(rekapData)
                    .filter(([nama]) => filterName === 'Semua' || nama === filterName)
                    .map(([nama, data]) => (
                      <div key={nama} className="bg-white/5 border border-white/10 rounded-3xl p-5">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-black text-lg text-emerald-400">{nama}</h4>
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">{data.jam.toFixed(1)} Jam</span>
                        </div>
                        <div className="text-3xl font-black tracking-tighter">
                          Rp {Math.round(data.gaji).toLocaleString('id-ID')}
                        </div>
                        {data.lupaOut > 0 && (
                          <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full w-fit uppercase">
                            <AlertTriangle size={12} />
                            {data.lupaOut} Isu Tanpa Out
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl font-black text-xs shadow-2xl z-[100] transition-all transform animate-bounce ${
          statusMessage.type === 'success' ? 'bg-[var(--success-600)] text-white' : 'bg-[var(--danger-600)] text-white'
        }`}>
          {statusMessage.msg}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-2xl mx-auto px-6 py-4 flex gap-3">
          <button
            onClick={() => setCurrentPage('absen')}
            className={`flex-1 py-3 rounded-[1.5rem] flex flex-col items-center gap-1 transition-all ${
              currentPage === 'absen' ? 'bg-[var(--primary-600)] text-white shadow-lg' : 'text-slate-400'
            }`}
          >
            <Clock size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Absen</span>
          </button>
          <button
            onClick={() => setCurrentPage('history')}
            className={`flex-1 py-3 rounded-[1.5rem] flex flex-col items-center gap-1 transition-all ${
              currentPage === 'history' ? 'bg-[var(--primary-600)] text-white shadow-lg' : 'text-slate-400'
            }`}
          >
            <History size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Audit</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;