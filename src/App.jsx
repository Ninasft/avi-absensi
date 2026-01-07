import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query
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
  Calendar
} from 'lucide-react';

// Konfigurasi Firebase diambil dari environment variables atau global config
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
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

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setDbUser(u));
    return () => unsubscribe();
  }, []);

  // Sync Data Real-time
  useEffect(() => {
    if (!dbUser) return;
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
      showStatus("Admin Login Sukses", "success");
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
    
    // Proteksi: Cek apakah sudah absen untuk aksi yang sama hari ini
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
    } catch (e) { showStatus("Gagal hapus", "error"); }
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-3xl mb-4"><Cloud size={32} /></div>
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">AVI-ABSENSI</h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Smart Cloud Protection</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="Username" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={loginInput.username} onChange={(e) => setLoginInput({...loginInput, username: e.target.value})} />
            <input type="password" placeholder="Password" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={loginInput.password} onChange={(e) => setLoginInput({...loginInput, password: e.target.value})} />
            <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Masuk</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 pb-32">
      <header className="max-w-md mx-auto flex items-center justify-between py-6">
        <div>
          <h1 className="text-xl font-black text-blue-600 tracking-tighter">AVI-ABSENSI</h1>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{user.role}: {user.nama}</p>
        </div>
        <button onClick={() => setUser(null)} className="p-3 bg-white text-rose-500 rounded-2xl border border-gray-100"><LogOut size={20} /></button>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {currentPage === 'absen' && (
          <>
            <div className="bg-white rounded-3xl p-8 shadow-xl text-center border border-gray-100 relative overflow-hidden">
               <div className="absolute -top-4 -right-4 opacity-5 text-blue-600 rotate-12"><Clock size={120}/></div>
               <h2 className="text-5xl font-black text-gray-800 mb-1 tracking-tighter">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</h2>
               <p className="text-blue-600 font-bold uppercase text-[10px] tracking-widest">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-6">
              <div className="bg-amber-50 p-4 rounded-2xl flex items-center gap-3 border border-amber-100">
                <Calendar className="text-amber-500" size={18}/>
                <p className="text-[10px] font-bold text-amber-700 leading-tight">Sistem Terkunci. Hanya bisa absen hari ini.</p>
              </div>

              <div className="flex p-1 bg-gray-50 rounded-2xl">
                <button onClick={() => setAbsensiType('Umum')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${absensiType === 'Umum' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Umum</button>
                <button onClick={() => setAbsensiType('Live')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${absensiType === 'Live' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'}`}>Live Session</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isLoading}
                  onClick={() => handleAbsen('Masuk')} 
                  className="bg-emerald-500 text-white p-6 rounded-3xl font-black uppercase text-[10px] shadow-lg flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 size={28}/> Clock In
                </button>
                <button 
                  disabled={isLoading}
                  onClick={() => handleAbsen('Pulang')} 
                  className="bg-rose-500 text-white p-6 rounded-3xl font-black uppercase text-[10px] shadow-lg flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <LogOut size={28}/> Clock Out
                </button>
              </div>
            </div>
          </>
        )}

        {currentPage === 'history' && (
          <div className="space-y-4">
             {user.role === 'admin' && (
               <div className="grid grid-cols-2 gap-3 mb-2">
                 <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Jam</p>
                   <p className="text-xl font-black text-gray-800">{Object.values(rekapData).reduce((a, b) => a + b.jam, 0).toFixed(1)} <span className="text-xs font-normal">h</span></p>
                 </div>
                 <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
                   <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Isu Out</p>
                   <p className="text-xl font-black text-rose-500">{Object.values(rekapData).reduce((a, b) => a + b.lupaOut, 0)}</p>
                 </div>
               </div>
             )}

             <div className="flex items-center justify-between px-2">
               <div className="flex gap-2">
                 <button onClick={() => setActiveHistoryTab('Umum')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${activeHistoryTab === 'Umum' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>Umum</button>
                 <button onClick={() => setActiveHistoryTab('Live')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${activeHistoryTab === 'Live' ? 'bg-purple-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>Live</button>
               </div>
               {user.role === 'admin' && (
                 <button onClick={copyToClipboard} className="p-2 bg-gray-800 text-white rounded-xl shadow-md"><Download size={14}/></button>
               )}
             </div>

            {user.role === 'admin' && (
              <div className="bg-white rounded-3xl p-3 shadow-sm border border-gray-100 grid grid-cols-2 gap-2">
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 bg-gray-50 rounded-xl text-[10px] font-black border-none outline-none uppercase tracking-wider">
                  {daftarBulan.map((b, i) => <option key={b} value={i}>{b}</option>)}
                </select>
                <select value={filterName} onChange={(e) => setFilterName(e.target.value)} className="p-2 bg-gray-50 rounded-xl text-[10px] font-black border-none outline-none uppercase tracking-wider">
                  <option value="Semua">Semua Pegawai</option>
                  {(activeHistoryTab === 'Umum' ? daftarPegawai.Umum : daftarPegawai.Live).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${log.aksi === 'Masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                      </div>
                      <div>
                        <p className="font-black text-xs text-gray-800 flex items-center gap-1">
                          {log.nama}
                          {log.isEdited && <Edit3 size={10} className="text-amber-500"/>}
                        </p>
                        <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">{log.tanggalDisplay}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-800">{log.waktu}</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase">{log.tipe}</p>
                      </div>
                      {user.role === 'admin' && (
                        <div className="flex gap-1 border-l pl-3 ml-1">
                          {editingId === log.id ? (
                             <button onClick={() => saveEdit(log.id)} className="p-2 bg-emerald-500 text-white rounded-lg"><Check size={12}/></button>
                          ) : (
                             <button onClick={() => { setEditingId(log.id); setEditForm({aksi: log.aksi, waktu: log.waktu}); }} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit3 size={12}/></button>
                          )}
                          <button onClick={() => deleteLog(log.id)} className="p-2 text-rose-300 hover:bg-rose-50 rounded-lg"><Trash2 size={12}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {user.role === 'admin' && activeHistoryTab === 'Live' && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Detail Gaji Live</h3>
                {Object.entries(rekapData).filter(([nama]) => filterName === 'Semua' || nama === filterName).map(([nama, data]) => (
                  <div key={nama} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 text-purple-600 p-3 rounded-2xl"><Wallet size={16}/></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-800 uppercase">{nama}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{data.jam.toFixed(1)} Jam Kerja</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-gray-800">Rp {Math.round(data.gaji).toLocaleString('id-ID')}</p>
                       {data.lupaOut > 0 && <p className="text-[8px] font-black text-rose-500 uppercase">{data.lupaOut} Isu Out</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {statusMessage && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${statusMessage.type === 'success' ? 'bg-gray-900 text-emerald-400' : 'bg-rose-600 text-white'}`}>
          <div className={`w-2 h-2 rounded-full ${statusMessage.type === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-white'}`}></div>
          <span className="font-black text-[10px] uppercase tracking-widest">{statusMessage.msg}</span>
        </div>
      )}

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border border-gray-100 shadow-2xl rounded-[2.5rem] p-2 flex justify-around items-center z-40">
        <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-3 rounded-[2rem] flex flex-col items-center transition-all ${currentPage === 'absen' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
          <Clock size={18}/><span className="text-[8px] font-black uppercase mt-1">Absen</span>
        </button>
        <button onClick={() => setCurrentPage('history')} className={`flex-1 py-3 rounded-[2rem] flex flex-col items-center transition-all ${currentPage === 'history' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
          <History size={18}/><span className="text-[8px] font-black uppercase mt-1">Audit</span>
        </button>
      </nav>
    </div>
  );
};

export default App;