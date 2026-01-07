import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, limit, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save, RefreshCw, Trash2, Eye, MapPin, Tablet } from 'lucide-react';

/* AVI-ABSENSI ULTIMATE v2.3 - FULL EDITION
  --------------------------------------------------
  FITUR UTAMA:
  1. Hak Akses Kustom:
     - Abub, Rendy, Dedi: Hanya Sesi Umum.
     - Vebi: Hanya Sesi Live.
     - Silvi, Aisyah: Sesi Umum & Live.
  2. Multi-Sesi Absensi:
     - Sesi Umum (08:00 - 16:00) & Sesi Live.
     - Semua sesi mendukung: Masuk, Pulang, Izin, Sakit.
  3. Dashboard Admin Real-Time:
     - Monitoring status pegawai, jam kerja live, & estimasi gaji.
     - Manajemen Pengumuman & Password.
  4. UI/UX Premium:
     - Dark Mode support, Responsive design, Animasi transisi.
*/

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

const App = () => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [userConfigs, setUserConfigs] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'error' });
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [showReasonModal, setShowReasonModal] = useState(null); 
  const [reasonText, setReasonText] = useState("");
  const [newPass, setNewPass] = useState("");

  // --- KONFIGURASI BISNIS ---
  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const daftarPegawai = [
    { id: "abub", nama: "Abub", akses: ["Umum"] },
    { id: "rendy", nama: "Rendy", akses: ["Umum"] },
    { id: "dedi", nama: "Dedi", akses: ["Umum"] },
    { id: "vebi", nama: "Vebi", akses: ["Live"] },
    { id: "silvi", nama: "Silvi", akses: ["Umum", "Live"] },
    { id: "aisyah", nama: "Aisyah", akses: ["Umum", "Live"] }
  ];

  const defaultCredentials = {
    ...daftarPegawai.reduce((acc, p) => ({ ...acc, [p.id]: { pass: p.id } }), {}),
    "admin": { pass: "admin123", role: 'admin' }
  };

  // --- FIREBASE AUTH & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Sinkronisasi Config User (Password)
    const unsubConfigs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'user_configs'), (snap) => {
      const configs = {};
      snap.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    });

    // Sinkronisasi Log Absensi
    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }, (err) => console.error("Firestore Logs Error:", err));

    // Sinkronisasi Pengumuman
    const unsubAnnounce = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement_msg'), (d) => {
      if (d.exists()) setAnnouncement(d.data().text);
    });

    return () => {
      unsubConfigs();
      unsubLogs();
      unsubAnnounce();
    };
  }, [user]);

  // Jam Digital
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- HELPER FUNCTIONS ---
  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertModal({ show: true, title, message, type });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = loginInput.username.toLowerCase();
    const password = loginInput.password;
    const savedConfig = userConfigs[username];
    const correctPass = savedConfig ? savedConfig.password : defaultCredentials[username]?.pass;

    if (defaultCredentials[username] && password === correctPass) {
      const infoPegawai = daftarPegawai.find(p => p.id === username);
      const userData = { 
        nama: infoPegawai ? infoPegawai.nama : "Admin", 
        role: defaultCredentials[username].role || 'pegawai',
        username: username,
        akses: infoPegawai ? infoPegawai.akses : ["Umum", "Live"]
      };
      setAppUser(userData);
      
      // Auto-set tab pertama sesuai hak akses
      if (userData.role !== 'admin') {
        setAbsensiType(userData.akses[0]);
      }
      
      setCurrentPage(userData.role === 'admin' ? 'history' : 'absen');
      showStatus(`Selamat datang, ${userData.nama}`, "success");
    } else {
      showStatus("Username/Password salah", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (!user || isLoading) return;
    
    const now = new Date();
    const currentHour = now.getHours();

    // Validasi Jam Kerja Khusus Sesi Umum
    if (absensiType === 'Umum') {
      if (action === 'Masuk' && currentHour < 8) {
        showAlert("Belum Jam Masuk", "Absensi masuk hanya bisa dilakukan mulai pukul 08:00 WIB.", 'warning');
        return;
      }
      if (action === 'Pulang' && currentHour < 16) {
        showAlert("Belum Jam Pulang", "Maaf, jam pulang belum tiba. Baru bisa absen setelah pukul 16:00 WIB.", 'info');
        return;
      }
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), {
        nama: appUser.nama,
        tipe: absensiType,
        aksi: action,
        keterangan: note || "-",
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggalDisplay: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulanIndex: now.getMonth(),
        timestamp: Date.now()
      });
      showStatus(`${action} ${absensiType} Berhasil!`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showStatus("Gagal mengirim absensi. Cek koneksi.", "error");
    } finally { setIsLoading(false); }
  };

  const updatePassword = async () => {
    if (!user || !newPass || newPass.length < 4) {
      showStatus("Password minimal 4 karakter", "error");
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_configs', appUser.username), {
        password: newPass
      }, { merge: true });
      showStatus("Password berhasil diperbarui", "success");
      setNewPass("");
    } catch (e) {
      showStatus("Gagal memperbarui password", "error");
    }
  };

  const saveAnnouncement = async () => {
    if (!user || appUser.role !== 'admin') return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement_msg'), {
        text: announcement,
        updatedBy: appUser.nama,
        timestamp: Date.now()
      }, { merge: true });
      showStatus("Pengumuman berhasil diterbitkan", "success");
    } catch (e) {
      showStatus("Gagal menyimpan pengumuman", "error");
    }
  };

  // --- ANALYTICS & STATS ---
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    const userSummary = {};
    const pegawais = appUser?.role === 'admin' ? daftarPegawai : daftarPegawai.filter(p => p.nama === appUser?.nama);

    pegawais.forEach(p => {
      userSummary[p.nama] = { 
        hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0, 
        statusHariIni: 'Belum Absen', clockIn: '--:--', clockOut: '--:--', 
        liveStatus: 'Offline',
        logs: []
      };
    });

    filtered.forEach(log => {
      if (!userSummary[log.nama]) return;
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');
      userSummary[log.nama].logs.push(log);

      // Logika Umum
      if (log.tipe === 'Umum') {
        if (log.aksi === 'Izin') userSummary[log.nama].izin++;
        if (log.aksi === 'Sakit') userSummary[log.nama].sakit++;
        if (log.aksi === 'Masuk') userSummary[log.nama].hadir++;
        
        if (logDateStr === todayStr) {
          if (['Masuk', 'Izin', 'Sakit'].includes(log.aksi)) userSummary[log.nama].statusHariIni = log.aksi;
          if (log.aksi === 'Masuk') userSummary[log.nama].clockIn = log.waktu;
          if (log.aksi === 'Pulang') userSummary[log.nama].clockOut = log.waktu;
        }
      }

      // Logika Live
      if (log.tipe === 'Live') {
        if (logDateStr === todayStr) {
           if (['Izin', 'Sakit'].includes(log.aksi)) userSummary[log.nama].liveStatus = log.aksi;
           if (log.aksi === 'Masuk') userSummary[log.nama].liveStatus = 'Streaming';
           if (log.aksi === 'Pulang') userSummary[log.nama].liveStatus = 'Selesai';
        }
        
        if (log.aksi === 'Masuk') {
          const pair = logs.find(l => 
            l.nama === log.nama && 
            l.tipe === 'Live' && 
            l.aksi === 'Pulang' && 
            new Date(l.timestamp).toLocaleDateString('id-ID') === logDateStr && 
            l.timestamp > log.timestamp
          );
          if (pair) {
            const diff = (pair.timestamp - log.timestamp) / (1000 * 60 * 60);
            userSummary[log.nama].jamLive += diff;
            userSummary[log.nama].gajiLive += diff * UPAH_PER_JAM;
          }
        }
      }
    });
    return userSummary;
  }, [logs, filterMonth, appUser]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-all font-sans`}>
      
      {/* HEADER BAR */}
      <header className={`sticky top-0 z-40 px-4 md:px-8 py-4 shadow-xl flex items-center justify-between border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-950 text-white'}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none">AVI-ABSENSI</h1>
            <span className="text-[10px] font-bold opacity-50 tracking-widest uppercase">Ultimate Edition</span>
          </div>
        </div>
        {appUser && (
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setCurrentPage('profile')} className={`p-3 rounded-2xl transition-all ${currentPage === 'profile' ? 'bg-orange-500 shadow-lg shadow-orange-500/40' : 'bg-white/10 hover:bg-white/20'}`}>
              <Settings size={20} />
            </button>
            <button onClick={() => setAppUser(null)} className="p-3 bg-rose-500 rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-500/30">
              <LogOut size={20} />
            </button>
          </div>
        )}
      </header>

      {/* LOGIN VIEW */}
      {!appUser ? (
        <div className="flex items-center justify-center min-h-[85vh] p-4">
          <div className={`w-full max-w-md p-10 rounded-[3.5rem] border-2 shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                <Lock className="text-white" size={32} />
              </div>
              <h2 className="text-4xl font-black tracking-tight">Login Portal</h2>
              <p className="text-sm opacity-50 mt-2 font-medium">Silakan masuk untuk akses absensi</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-4 opacity-40 text-left">Pegawai ID</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                  <input type="text" placeholder="Username" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 transition-all font-bold" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-4 opacity-40">Security Token</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                  <input type="password" placeholder="Password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 transition-all font-bold" required />
                </div>
              </div>
              <button className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all mt-4">
                AUTHENTICATE
              </button>
            </form>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 pb-32">
          
          {/* ANNOUNCEMENT */}
          {announcement && currentPage === 'absen' && (
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-8 rounded-[2.5rem] shadow-xl shadow-orange-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                <Megaphone size={120} />
              </div>
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Info size={28} />
                </div>
                <div>
                  <h4 className="font-black text-lg uppercase tracking-tight">Pengumuman Terbaru</h4>
                  <p className="font-bold text-sm md:text-base opacity-90 mt-1">{announcement}</p>
                </div>
              </div>
            </div>
          )}

          {/* PAGE: ABSEN PEGAWAI */}
          {currentPage === 'absen' && appUser.role !== 'admin' && (
            <div className="max-w-2xl mx-auto space-y-8">
              
              {/* CLOCK CARD */}
              <div className={`p-12 rounded-[4rem] text-center border-2 relative overflow-hidden ${darkMode ? 'bg-slate-900 border-indigo-500/20' : 'bg-white border-slate-100 shadow-2xl shadow-indigo-500/5'}`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
                <h2 className="text-8xl font-black mb-4 tabular-nums tracking-tighter text-indigo-500">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </h2>
                <div className="inline-flex items-center gap-2 py-2 px-6 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Calendar size={14} className="opacity-50" />
                  <span className="text-xs font-black uppercase tracking-widest opacity-60">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* TAB SESSION PICKER */}
              {appUser.akses.length > 1 ? (
                <div className="flex p-3 bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] gap-2">
                  {appUser.akses.map(t => (
                    <button key={t} onClick={() => setAbsensiType(t)} 
                      className={`flex-1 py-5 rounded-[2rem] font-black text-sm transition-all flex items-center justify-center gap-3 ${absensiType === t ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-slate-500 hover:bg-white/10'}`}>
                      {t === 'Umum' ? <Users size={18} /> : <Video size={18} />}
                      Sesi {t}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center">
                   <div className="inline-flex items-center gap-3 py-3 px-8 bg-indigo-600/10 text-indigo-500 rounded-full font-black text-xs uppercase tracking-[0.2em]">
                      <Activity size={14} /> Sesi Aktif: {appUser.akses[0]}
                   </div>
                </div>
              )}

              {/* MAIN ACTIONS */}
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => handleAbsen('Masuk')} className="group h-56 bg-emerald-600 text-white rounded-[3.5rem] font-black flex flex-col items-center justify-center gap-4 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                  <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <CheckCircle2 size={36} />
                  </div>
                  <span className="text-xl">CLOCK IN</span>
                </button>
                <button onClick={() => handleAbsen('Pulang')} className="group h-56 bg-rose-600 text-white rounded-[3.5rem] font-black flex flex-col items-center justify-center gap-4 shadow-xl shadow-rose-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                  <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center group-hover:-rotate-12 transition-transform">
                    <Clock size={36} />
                  </div>
                  <span className="text-xl">CLOCK OUT</span>
                </button>
                
                {/* SEMUA SESI SEKARANG BISA IZIN & SAKIT */}
                <button onClick={() => setShowReasonModal('Izin')} className="py-6 bg-amber-500 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors">
                  <Tablet size={20} /> Izin
                </button>
                <button onClick={() => setShowReasonModal('Sakit')} className="py-6 bg-sky-500 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-colors">
                  <Thermometer size={20} /> Sakit
                </button>
              </div>

              {/* LOG HARI INI */}
              <div className={`p-8 rounded-[3rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 opacity-40">
                  <History size={16} /> Riwayat Hari Ini
                </h3>
                <div className="space-y-3">
                  {logs.filter(l => l.nama === appUser.nama && l.tanggalDisplay === currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })).slice(0, 3).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${l.aksi === 'Masuk' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="font-bold text-sm">{l.aksi} {l.tipe}</span>
                      </div>
                      <span className="text-xs font-black opacity-40">{l.waktu}</span>
                    </div>
                  ))}
                  {logs.filter(l => l.nama === appUser.nama && l.tanggalDisplay === currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })).length === 0 && (
                    <p className="text-center py-4 text-xs font-bold opacity-30 italic">Belum ada aktivitas hari ini</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAGE: ADMIN DASHBOARD */}
          {currentPage === 'history' && appUser.role === 'admin' && (
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">Control Panel</h2>
                  <p className="text-sm font-bold opacity-40 uppercase tracking-widest mt-1">Monitoring & Analytics</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="flex-1 md:flex-none">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-2">Filter Periode</label>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 font-black outline-none focus:border-indigo-500 transition-all mt-1">
                      {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* REKAP UMUM */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Sesi Umum (Lantai Dasar)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {daftarPegawai.filter(p => p.akses.includes('Umum')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`p-8 rounded-[3rem] border-2 transition-all hover:shadow-2xl hover:shadow-indigo-500/5 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">Pegawai</span>
                            <p className="font-black text-xl leading-none mt-1">{p.nama}</p>
                          </div>
                          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${s.statusHariIni === 'Masuk' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {s.statusHariIni}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                            <span className="text-[9px] font-black opacity-30 block mb-1">JAM IN</span>
                            <span className="font-black text-sm tabular-nums">{s.clockIn}</span>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                            <span className="text-[9px] font-black opacity-30 block mb-1">JAM OUT</span>
                            <span className="font-black text-sm tabular-nums">{s.clockOut}</span>
                          </div>
                        </div>
                        <div className="flex justify-around pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                           <div className="text-center">
                             <span className="block text-[9px] font-black opacity-30 uppercase">Izin</span>
                             <span className="font-black text-amber-500">{s.izin}</span>
                           </div>
                           <div className="text-center">
                             <span className="block text-[9px] font-black opacity-30 uppercase">Sakit</span>
                             <span className="font-black text-blue-500">{s.sakit}</span>
                           </div>
                           <div className="text-center">
                             <span className="block text-[9px] font-black opacity-30 uppercase">Hadir</span>
                             <span className="font-black text-emerald-500">{s.hadir}</span>
                           </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* REKAP LIVE */}
              <section className="space-y-6 pt-10 border-t-4 border-slate-100 dark:border-slate-900 border-double">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                    <Video size={20} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Sesi Live (Streaming)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {daftarPegawai.filter(p => p.akses.includes('Live')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`p-8 rounded-[3rem] border-2 transition-all hover:shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
                         <div className="flex justify-between items-start mb-8">
                            <p className="font-black text-2xl tracking-tighter">{p.nama}</p>
                            <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase flex items-center gap-2 ${s.liveStatus === 'Streaming' ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                              {s.liveStatus === 'Streaming' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              {s.liveStatus}
                            </span>
                        </div>
                        <div className="space-y-4">
                          <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[2rem] shadow-lg shadow-indigo-500/20">
                            <div className="flex justify-between items-end mb-2">
                              <div>
                                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Durasi Bulan Ini</span>
                                <h5 className="text-3xl font-black tabular-nums">{s.jamLive?.toFixed(1)} <span className="text-sm font-bold opacity-60">Jam</span></h5>
                              </div>
                              <TrendingUp size={32} className="opacity-20 mb-1" />
                            </div>
                            <div className="pt-4 border-t border-white/10 mt-2 flex justify-between items-center">
                               <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Estimasi Gaji</span>
                               <span className="text-lg font-black tabular-nums">Rp {s.gajiLive?.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {/* PAGE: PROFILE & SETTINGS */}
          {currentPage === 'profile' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`p-10 rounded-[3.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-2xl shadow-slate-200/50'}`}>
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                     <Lock size={24} />
                   </div>
                   <h3 className="text-2xl font-black uppercase tracking-tight">Privasi & Keamanan</h3>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest ml-4 opacity-40">Ganti Password Akun</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                        <input type="password" placeholder="Min. 4 Karakter" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-3xl border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 transition-all font-bold" />
                      </div>
                      <button onClick={updatePassword} className="px-10 bg-indigo-600 text-white rounded-3xl font-black shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                        UPDATE
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {appUser.role === 'admin' && (
                <div className={`p-10 rounded-[3.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-2xl shadow-slate-200/50'}`}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                      <Megaphone size={24} />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Manajemen Broadcast</h3>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest ml-4 opacity-40">Pesan Pengumuman</label>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} className="w-full h-40 p-6 rounded-[2.5rem] border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-orange-500 transition-all font-bold text-sm leading-relaxed" placeholder="Tulis pengumuman penting di sini..." />
                    <button onClick={saveAnnouncement} className="w-full py-5 bg-orange-500 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-orange-500/30 hover:scale-[1.01] transition-all">
                      TERBITKAN SEKARANG
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      )}

      {/* FLOATING NAVIGATION (MOBILE ONLY) */}
      {appUser && (
        <nav className={`fixed bottom-0 inset-x-0 p-6 flex gap-4 md:hidden z-50 transition-all ${darkMode ? 'bg-slate-950/80 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl'} border-t border-slate-200 dark:border-slate-800`}>
          <button onClick={() => setCurrentPage(appUser.role === 'admin' ? 'history' : 'absen')} className={`flex-1 py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-1 transition-all ${currentPage === 'absen' || currentPage === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105' : 'text-slate-400'}`}>
            <LayoutDashboard size={20} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{appUser.role === 'admin' ? 'Recap' : 'Absen'}</span>
          </button>
          <button onClick={() => setCurrentPage('profile')} className={`flex-1 py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-1 transition-all ${currentPage === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105' : 'text-slate-400'}`}>
            <Settings size={20} />
            <span className="text-[9px] font-black uppercase tracking-tighter">Settings</span>
          </button>
        </nav>
      )}

      {/* MODAL: REASON (IZIN/SAKIT) */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className={`w-full max-w-lg p-10 rounded-[3.5rem] shadow-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                 <MessageSquare size={24} />
               </div>
               <div>
                 <h3 className="text-2xl font-black uppercase tracking-tight">Formulir {showReasonModal}</h3>
                 <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mt-1">Sesi Aktif: {absensiType}</p>
               </div>
            </div>
            <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} className="w-full h-44 p-6 border-2 rounded-[2rem] mb-6 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 font-bold text-sm" placeholder="Tulis alasan atau keterangan di sini..." />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowReasonModal(null)} className="py-5 font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Cancel</button>
              <button onClick={() => handleAbsen(showReasonModal, reasonText)} className="py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-lg shadow-indigo-500/20">SEND DATA</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALERT DIALOG */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] text-center max-w-sm text-slate-950 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-2">{alertModal.title}</h3>
            <p className="text-sm font-bold opacity-60 mb-8 leading-relaxed">{alertModal.message}</p>
            <button onClick={() => setAlertModal({...alertModal, show: false})} className="w-full py-5 bg-slate-950 text-white rounded-3xl font-black hover:bg-indigo-600 transition-colors shadow-xl">
              MENGERTI
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {statusMessage && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 px-10 py-4 rounded-full text-white font-black text-[11px] uppercase tracking-widest z-[300] shadow-2xl animate-in slide-in-from-top-10 duration-300 flex items-center gap-3 ${statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          {statusMessage.msg}
        </div>
      )}

    </div>
  );
};

export default App;