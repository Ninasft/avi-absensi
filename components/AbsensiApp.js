import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  Clock, 
  CheckCircle2, 
  LogOut, 
  History, 
  Trash2, 
  Edit3, 
  Wallet, 
  Cloud, 
  Download, 
  AlertTriangle, 
  ChevronRight, 
  Check, 
  Calendar,
  Sun,
  Moon,
  User,
  Shield
} from 'lucide-react';

// Konfigurasi Firebase dari Environment Variables
const firebaseConfig = {
  apiKey: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).apiKey : "",
  authDomain: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).authDomain : "",
  projectId: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).projectId : "",
  storageBucket: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).storageBucket : "",
  messagingSenderId: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).messagingSenderId : "",
  appId: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).appId : ""
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

const App = () => {
  // State Utama
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter & Edit State
  const [activeHistoryTab, setActiveHistoryTab] = useState('Umum');
  const [filterName, setFilterName] = useState('Semua');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ aksi: '', waktu: '' });

  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const daftarPegawai = {
    Umum: ["Abub", "Dedi", "Silvi", "Aisyah", "Rendy"],
    Live: ["Silvi", "Aisyah", "Vebi"]
  };

  const pegawaiAkses = {
    "Abub": ["Umum"], "Rendy": ["Umum"], "Dedi": ["Umum"],
    "Vebi": ["Live"], "Silvi": ["Umum", "Live"], "Aisyah": ["Umum", "Live"]
  };

  // Efek Samping
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error(err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setDbUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!dbUser) return;
    const qLogs = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    return onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
    }, () => showStatus("Koneksi Cloud Terputus", "error"));
  }, [dbUser]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper Functions
  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginInput;
    if (username === 'admin' && password === 'admin123') {
      setUser({ nama: 'Administrator', role: 'admin' });
      return;
    }
    const found = Object.keys(pegawaiAkses).find(p => p.toLowerCase() === username.toLowerCase());
    if (found && password.toLowerCase() === found.toLowerCase()) {
      setUser({ nama: found, role: 'pegawai' });
    } else {
      showStatus("Kredensial Tidak Valid", "error");
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
        isEdited: false
      });
      showStatus(`Berhasil ${action}!`, "success");
    } catch (e) {
      showStatus("Gagal kirim data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLog = async (id) => {
    if (user.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'absensi_logs', id));
      showStatus("Data dihapus", "success");
    } catch (e) { showStatus("Gagal hapus", "error"); }
  };

  const saveEdit = async (id) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'absensi_logs', id), {
        ...editForm,
        isEdited: true
      });
      setEditingId(null);
      showStatus("Data diperbarui", "success");
    } catch (e) { showStatus("Gagal update", "error"); }
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
        const diff = Math.max(0, (item.pulang.timestamp - item.masuk.timestamp) / (1000 * 60 * 60));
        summary[item.nama].jam += diff;
        if (item.tipe === 'Live') summary[item.nama].gaji += diff * UPAH_PER_JAM;
      } else if (item.masuk && !item.pulang) { summary[item.nama].lupaOut += 1; }
    });
    return summary;
  }, [logs, filterMonth]);

  const filteredLogs = logs.filter(log => {
    const matchTab = log.tipe === activeHistoryTab;
    const matchName = filterName === 'Semua' || log.nama === filterName;
    const matchMonth = log.bulanIndex === parseInt(filterMonth);
    return matchTab && matchName && matchMonth;
  });

  // Komponen Login (Contrast High)
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${isDarkMode ? 'bg-zinc-950 text-white' : 'bg-blue-50 text-zinc-900'}`}>
        <div className={`w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-blue-100'}`}>
          <div className="text-center space-y-4 mb-8">
            <div className={`inline-flex p-4 rounded-2xl ${isDarkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}>
              <Shield size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">AVI-ABSENSI</h1>
            <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-blue-600'}`}>Cloud Attendance Node</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-sm transition-all ${isDarkMode ? 'bg-zinc-800 border-zinc-700 focus:border-blue-500' : 'bg-zinc-50 border-transparent focus:border-blue-600'}`} 
              value={loginInput.username}
              onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-sm transition-all ${isDarkMode ? 'bg-zinc-800 border-zinc-700 focus:border-blue-500' : 'bg-zinc-50 border-transparent focus:border-blue-600'}`} 
              value={loginInput.password}
              onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
              required
            />
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">
              Akses Sistem
            </button>
          </form>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full mt-6 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}
          >
            {isDarkMode ? <Sun size={14}/> : <Moon size={14}/>} {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 pb-32 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-zinc-900'}`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Navbar */}
        <header className="flex items-center justify-between py-6">
          <div>
            <h1 className={`text-xl font-black italic tracking-tighter ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>AVI-ABSENSI</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1">
              <User size={10}/> {user.nama} • {user.role}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-xl border transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'}`}>
              {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
            </button>
            <button onClick={() => setUser(null)} className="p-3 bg-rose-600 text-white rounded-xl shadow-lg active:scale-90 transition-all">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="space-y-6">
          {currentPage === 'absen' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Card Jam */}
              <div className={`rounded-[2.5rem] p-10 text-center shadow-2xl border transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-blue-50'}`}>
                <h2 className="text-6xl sm:text-7xl font-black tracking-tighter italic mb-2 tabular-nums">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </h2>
                <div className="flex items-center justify-center gap-2 opacity-60 font-bold uppercase text-[10px] tracking-widest">
                  <Calendar size={14}/> {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>

              {/* Kontrol Absen */}
              <div className={`mt-6 rounded-[2.5rem] p-6 shadow-xl border ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100'}`}>
                <div className={`flex p-1.5 rounded-2xl mb-8 ${isDarkMode ? 'bg-zinc-950' : 'bg-slate-100'}`}>
                  {['Umum', 'Live'].map(t => (
                    <button key={t} onClick={() => setAbsensiType(t)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${absensiType === t ? (isDarkMode ? 'bg-zinc-800 text-blue-400 shadow-md' : 'bg-white text-blue-700 shadow-sm') : 'text-zinc-500'}`}>
                      {t} Session
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => handleAbsen('Masuk')} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white p-8 rounded-[2rem] font-black uppercase text-xs shadow-lg flex flex-col items-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                    <CheckCircle2 size={32} /> Clock In
                  </button>
                  <button onClick={() => handleAbsen('Pulang')} disabled={isLoading} className="bg-rose-600 hover:bg-rose-700 text-white p-8 rounded-[2rem] font-black uppercase text-xs shadow-lg flex flex-col items-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                    <Clock size={32} /> Clock Out
                  </button>
                </div>

                <div className={`mt-6 p-4 rounded-2xl border-l-4 flex items-start gap-3 ${isDarkMode ? 'bg-zinc-800 border-amber-500' : 'bg-amber-50 border-amber-500'}`}>
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold leading-relaxed opacity-80 uppercase tracking-tight">Sistem Terkunci: Absensi hanya berlaku untuk hari ini. Pastikan GPS aktif.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Admin Dashboard */}
              {user.role === 'admin' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-600 text-white border-transparent shadow-lg'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Jam</p>
                    <p className="text-3xl font-black">{Object.values(rekapData).reduce((a, b) => a + b.jam, 0).toFixed(1)}h</p>
                  </div>
                  <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-rose-900/20 border-rose-800' : 'bg-rose-600 text-white border-transparent shadow-lg'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Issue Out</p>
                    <p className="text-3xl font-black">{Object.values(rekapData).reduce((a, b) => a + b.lupaOut, 0)}</p>
                  </div>
                </div>
              )}

              {/* Log List Header */}
              <div className={`p-6 rounded-[2rem] border space-y-4 ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                <div className="flex items-center justify-between">
                   <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-zinc-950' : 'bg-slate-100'}`}>
                    {['Umum', 'Live'].map(t => (
                      <button key={t} onClick={() => setActiveHistoryTab(t)} className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase transition-all ${activeHistoryTab === t ? (isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white shadow-sm text-blue-700') : 'text-zinc-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {user.role === 'admin' && (
                    <button className="p-2 bg-emerald-600 text-white rounded-lg active:scale-90 transition-all">
                      <Download size={16}/>
                    </button>
                  )}
                </div>

                {user.role === 'admin' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={`p-3 rounded-xl font-bold text-[10px] uppercase border-none outline-none ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-50'}`}>
                      {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                    </select>
                    <select value={filterName} onChange={(e) => setFilterName(e.target.value)} className={`p-3 rounded-xl font-bold text-[10px] uppercase border-none outline-none ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-50'}`}>
                      <option value="Semua">Semua</option>
                      {(activeHistoryTab === 'Umum' ? daftarPegawai.Umum : daftarPegawai.Live).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                <div className="divide-y divide-zinc-800/10">
                  {filteredLogs.map(log => (
                    <div key={log.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${log.aksi === 'Masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                        </div>
                        <div>
                          <p className="font-black text-sm">{log.nama} {log.isEdited && <Edit3 size={10} className="inline text-amber-500 ml-1"/>}</p>
                          <p className="text-[9px] font-bold opacity-50 uppercase">{log.tanggalDisplay} • {log.waktu}</p>
                        </div>
                      </div>
                      {user.role === 'admin' && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => deleteLog(log.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Salary Section */}
              {user.role === 'admin' && activeHistoryTab === 'Live' && (
                <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-600 text-white shadow-xl border-transparent'}`}>
                  <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Wallet size={18}/> Detail Gaji Live
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(rekapData)
                      .filter(([n]) => filterName === 'Semua' || n === filterName)
                      .map(([nama, data]) => (
                      <div key={nama} className={`p-4 rounded-2xl flex justify-between items-center ${isDarkMode ? 'bg-zinc-900' : 'bg-white/10 backdrop-blur'}`}>
                        <div>
                          <p className="font-black text-sm">{nama}</p>
                          <p className="text-[10px] opacity-70 font-bold">{data.jam.toFixed(1)} Jam</p>
                        </div>
                        <p className="font-black text-lg">Rp {Math.round(data.gaji).toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Status */}
      {statusMessage && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-10 ${statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {statusMessage.msg}
        </div>
      )}

      {/* Bottom Nav */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm rounded-[3rem] p-2 flex gap-2 shadow-2xl z-40 border ${isDarkMode ? 'bg-zinc-900/90 border-zinc-800 backdrop-blur-xl' : 'bg-white/90 border-slate-100 backdrop-blur-xl'}`}>
        <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-4 rounded-[2.5rem] flex flex-col items-center transition-all ${currentPage === 'absen' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-zinc-400'}`}>
          <Clock size={22}/><span className="text-[9px] font-black uppercase mt-1">Presensi</span>
        </button>
        <button onClick={() => setCurrentPage('history')} className={`flex-1 py-4 rounded-[2.5rem] flex flex-col items-center transition-all ${currentPage === 'history' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-zinc-400'}`}>
          <History size={22}/><span className="text-[9px] font-black uppercase mt-1">Audit Log</span>
        </button>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-in { animation: fade-in 0.4s ease-out, slide-up 0.4s ease-out; }
        ::-webkit-scrollbar { width: 0px; }
      `}} />
    </div>
  );
};

export default App;