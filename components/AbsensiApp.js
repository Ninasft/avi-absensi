import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Trash2, Edit3, Wallet, Cloud, Download, AlertTriangle, ChevronRight, Check, Calendar } from 'lucide-react';

// Inisialisasi Firebase
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
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (typeof window === 'undefined' || !auth) return;
    
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setDbUser(u));
    return () => unsubscribe();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!dbUser || !db) return;
    
    const qLogs = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => {
      console.error("Firestore error:", err);
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
    if (!dbUser || isLoading || !db) return;
    
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
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLog = async (id) => {
    if (user.role !== 'admin' || !db) return;
    
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'absensi_logs', id));
      showStatus("Data dihapus", "success");
    } catch (e) {
      showStatus("Gagal hapus", "error");
    }
  };

  const saveEdit = async (id) => {
    if (user.role !== 'admin' || !db) return;
    
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
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(header + content);
      showStatus("Salin Berhasil", "success");
    } else {
      // Fallback untuk browser lama
      const el = document.createElement('textarea');
      el.value = header + content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showStatus("Salin Berhasil", "success");
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchTab = log.tipe === activeHistoryTab;
    const matchName = filterName === 'Semua' || log.nama === filterName;
    const matchMonth = log.bulanIndex === parseInt(filterMonth);
    return matchTab && matchName && matchMonth;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl mb-4">
                <Cloud size={32} />
              </div>
              <h1 className="text-3xl font-black text-gray-800">AVI-ABSENSI</h1>
              <p className="text-xs text-gray-500 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Smart Cloud Protection
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={loginInput.username}
                  onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={loginInput.password}
                  onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
              >
                Masuk
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-800">AVI-ABSENSI</h1>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
              {user.role}: {user.nama}
            </p>
          </div>
          <button
            onClick={() => setUser(null)}
            className="p-3 bg-white text-rose-500 rounded-2xl border border-gray-100 hover:bg-rose-50 active:scale-95 transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {currentPage === 'absen' && (
          <>
            {/* Clock Display */}
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center space-y-2">
              <div className="text-5xl font-black text-gray-800">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-gray-500 font-semibold">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {/* Warning Box */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                Sistem terkunci. Anda hanya bisa melakukan absensi untuk tanggal hari ini.
              </p>
            </div>

            {/* Type Selector */}
            <div className="flex gap-3 bg-gray-100 p-2 rounded-2xl">
              <button
                onClick={() => setAbsensiType('Umum')}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${
                  absensiType === 'Umum' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                }`}
              >
                Umum
              </button>
              <button
                onClick={() => setAbsensiType('Live')}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${
                  absensiType === 'Live' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'
                }`}
              >
                Live Session
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAbsen('Masuk')}
                disabled={isLoading}
                className="bg-emerald-500 text-white p-6 rounded-3xl font-black uppercase text-[10px] shadow-lg flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={28} />
                Clock In
              </button>
              <button
                onClick={() => handleAbsen('Pulang')}
                disabled={isLoading}
                className="bg-rose-500 text-white p-6 rounded-3xl font-black uppercase text-[10px] shadow-lg flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Clock size={28} />
                Clock Out
              </button>
            </div>
          </>
        )}

        {currentPage === 'history' && (
          <div className="space-y-4">
            {/* Summary Cards (Admin Only) */}
            {user.role === 'admin' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-lg">
                  <div className="text-[10px] font-black uppercase mb-2 opacity-80">Total Jam</div>
                  <div className="text-3xl font-black">
                    {Object.values(rekapData).reduce((a, b) => a + b.jam, 0).toFixed(1)} h
                  </div>
                </div>
                <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-6 rounded-3xl shadow-lg">
                  <div className="text-[10px] font-black uppercase mb-2 opacity-80">Isu Keluar</div>
                  <div className="text-3xl font-black">
                    {Object.values(rekapData).reduce((a, b) => a + b.lupaOut, 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Selector */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveHistoryTab('Umum')}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
                  activeHistoryTab === 'Umum' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-100'
                }`}
              >
                Umum
              </button>
              <button
                onClick={() => setActiveHistoryTab('Live')}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
                  activeHistoryTab === 'Live' ? 'bg-purple-600 text-white' : 'bg-white text-gray-400 border border-gray-100'
                }`}
              >
                Live
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={copyToClipboard}
                  className="ml-auto px-4 py-2 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <Download size={14} /> Export
                </button>
              )}
            </div>

            {/* Filters (Admin Only) */}
            {user.role === 'admin' && (
              <div className="flex gap-3">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="p-2 bg-gray-50 rounded-xl text-[10px] font-black border-none outline-none uppercase tracking-wider flex-1"
                >
                  {daftarBulan.map((b, i) => (
                    <option key={i} value={i}>{b}</option>
                  ))}
                </select>
                <select
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="p-2 bg-gray-50 rounded-xl text-[10px] font-black border-none outline-none uppercase tracking-wider flex-1"
                >
                  <option value="Semua">Semua Pegawai</option>
                  {(activeHistoryTab === 'Umum' ? daftarPegawai.Umum : daftarPegawai.Live).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Log List */}
            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div key={log.id} className="bg-white rounded-2xl shadow-sm p-4 relative">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs ${
                      log.aksi === 'Masuk' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-gray-800">{log.nama}</h3>
                        {log.isEdited && <Edit3 size={12} className="text-amber-500" />}
                      </div>
                      <p className="text-xs text-gray-500 font-semibold">{log.tanggalDisplay}</p>
                      {editingId === log.id ? (
                        <div className="mt-2 space-y-2">
                          <select
                            value={editForm.aksi}
                            onChange={(e) => setEditForm({...editForm, aksi: e.target.value})}
                            className="w-full p-2 bg-gray-50 rounded-lg text-xs font-semibold"
                          >
                            <option value="Masuk">Masuk</option>
                            <option value="Pulang">Pulang</option>
                          </select>
                          <input
                            type="time"
                            value={editForm.waktu}
                            onChange={(e) => setEditForm({...editForm, waktu: e.target.value})}
                            className="w-full p-2 bg-gray-50 rounded-lg text-xs font-semibold"
                          />
                        </div>
                      ) : (
                        <p className="text-sm font-black text-gray-800 mt-1">{log.waktu}</p>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      log.tipe === 'Umum' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {log.tipe}
                    </div>
                  </div>
                  {user.role === 'admin' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      {editingId === log.id ? (
                        <button
                          onClick={() => saveEdit(log.id)}
                          className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-95 transition-all"
                        >
                          <Check size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(log.id);
                            setEditForm({aksi: log.aksi, waktu: log.waktu});
                          }}
                          className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="p-2 text-rose-300 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Salary Summary (Admin Only for Live) */}
            {user.role === 'admin' && activeHistoryTab === 'Live' && (
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Wallet size={20} />
                  Detail Gaji Live
                </h3>
                <div className="space-y-3">
                  {Object.entries(rekapData)
                    .filter(([nama]) => filterName === 'Semua' || nama === filterName)
                    .map(([nama, data]) => (
                      <div key={nama} className="bg-white/10 backdrop-blur rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-lg">{nama}</h4>
                          <span className="text-xs font-semibold opacity-80">{data.jam.toFixed(1)} Jam Kerja</span>
                        </div>
                        <div className="text-2xl font-black">
                          Rp {Math.round(data.gaji).toLocaleString('id-ID')}
                        </div>
                        {data.lupaOut > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold bg-amber-500/20 px-3 py-1 rounded-full w-fit">
                            <AlertTriangle size={12} />
                            {data.lupaOut} Isu Out
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

      {/* Status Message */}
      {statusMessage && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black text-xs shadow-2xl ${
          statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {statusMessage.msg}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl">
        <div className="max-w-2xl mx-auto px-6 py-3 flex gap-2">
          <button
            onClick={() => setCurrentPage('absen')}
            className={`flex-1 py-3 rounded-[2rem] flex flex-col items-center transition-all ${
              currentPage === 'absen' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            <Clock size={20} />
            <span className="text-[10px] font-black uppercase mt-1">Absen</span>
          </button>
          <button
            onClick={() => setCurrentPage('history')}
            className={`flex-1 py-3 rounded-[2rem] flex flex-col items-center transition-all ${
              currentPage === 'history' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            <History size={20} />
            <span className="text-[10px] font-black uppercase mt-1">Audit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;