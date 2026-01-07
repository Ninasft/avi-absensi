import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, limit, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save, RefreshCw, Trash2, Eye } from 'lucide-react';

/* AVI-ABSENSI ULTIMATE VERSION
  - Admin: Dashboard Full, Pengumuman, Reset Password User, Log Aktivitas.
  - User: Absen (Masuk 08:00, Pulang 16:00), Izin/Sakit, Riwayat Pribadi, Ganti Pass.
  - Fully Responsive & Dark/Light Mode.
*/

let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

if (typeof window !== 'undefined') {
  try {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Config Error:", e);
  }
}

const App = () => {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
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
  const [resetPassTarget, setResetPassTarget] = useState({ username: '', password: '' });

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

  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%23f97316%22/><text y=%22.9em%22 font-size=%2270%22 font-weight=%22bold%22 font-family=%22Arial%22 fill=%22white%22 x=%2250%%22 text-anchor=%22middle%22>A</text></svg>`;
    document.getElementsByTagName('head')[0].appendChild(link);
    document.title = "AVI-ABSENSI | Ultimate Control";
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    // User Configs & Password
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'user_configs'), (snap) => {
      const configs = {};
      snap.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    });

    // Absensi Logs
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    // Announcement
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), (doc) => {
      if (doc.exists()) setAnnouncement(doc.data().text);
    });

    // Admin Activity Logs
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'admin_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      const userData = { 
        nama: username.charAt(0).toUpperCase() + username.slice(1), 
        role: defaultCredentials[username].role || 'pegawai',
        username: username
      };
      setAppUser(userData);
      setCurrentPage(userData.role === 'admin' ? 'history' : 'absen');
    } else {
      showStatus("Akses Ditolak: Periksa Username/Password", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (!user || isLoading) return;
    
    const now = new Date();
    const currentHour = now.getHours();

    // Logic: Masuk > 08:00, Pulang > 16:00
    if (absensiType === 'Umum') {
      if (action === 'Masuk' && currentHour < 8) {
        showAlert("Waktu Belum Dibuka", `Halo ${appUser.nama}, absensi masuk dibuka mulai pukul 08:00 WIB.`, 'warning');
        return;
      }
      if (action === 'Pulang' && currentHour < 16) {
        showAlert("Belum Waktunya Pulang", `Semangat ${appUser.nama}! Absen pulang baru tersedia pukul 16:00 WIB.`, 'info');
        return;
      }
    }

    setIsLoading(true);
    const todayStr = now.toLocaleDateString('id-ID');
    const duplicate = logs.find(l => 
      l.nama === appUser.nama && l.tipe === absensiType && l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (duplicate) {
      showAlert("Sudah Terdaftar", `Sistem mencatat Anda sudah melakukan ${action} hari ini.`, 'success');
      setIsLoading(false);
      return;
    }

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
      showStatus(`${action} Berhasil Terkirim`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showStatus("Gagal tersambung", "error");
    } finally { setIsLoading(false); }
  };

  const updatePassword = async (targetUsername = null, targetPass = null) => {
    const isSelf = !targetUsername;
    const finalUsername = isSelf ? appUser.username : targetUsername;
    const finalPass = isSelf ? newPass : targetPass;

    if (!finalPass || finalPass.length < 4) {
      showStatus("Password minimal 4 karakter", "error");
      return;
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_configs', finalUsername), {
        password: finalPass
      }, { merge: true });

      if (!isSelf) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'admin_logs'), {
          admin: appUser.nama,
          aksi: `Reset password user: ${finalUsername}`,
          waktu: new Date().toLocaleString('id-ID'),
          timestamp: Date.now()
        });
      }

      showStatus(`Password ${finalUsername} berhasil diperbarui`, "success");
      if (isSelf) setNewPass("");
      else setResetPassTarget({ username: '', password: '' });
    } catch (e) {
      showStatus("Gagal memperbarui password", "error");
    }
  };

  const saveAnnouncement = async () => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), {
        text: announcement,
        updatedBy: appUser.nama,
        timestamp: Date.now()
      });
      showStatus("Pengumuman diperbarui", "success");
    } catch (e) {
      showStatus("Gagal menyimpan pengumuman", "error");
    }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    
    const userSummary = {};
    const pegawais = appUser?.role === 'admin' ? daftarPegawai : daftarPegawai.filter(p => p.nama === appUser?.nama);

    pegawais.forEach(p => {
      userSummary[p.nama] = { 
        hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0, 
        statusHariIni: 'Belum Absen', clockIn: '--:--', clockOut: '--:--', 
        keteranganHariIni: '-', logs: []
      };
    });

    filtered.forEach(log => {
      if (!userSummary[log.nama]) return;
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');
      
      userSummary[log.nama].logs.push(log);

      if (log.tipe === 'Umum') {
        if (log.aksi === 'Izin') userSummary[log.nama].izin++;
        if (log.aksi === 'Sakit') userSummary[log.nama].sakit++;
        if (log.aksi === 'Masuk') userSummary[log.nama].hadir++;

        if (logDateStr === todayStr) {
          if (log.aksi === 'Masuk') { userSummary[log.nama].statusHariIni = 'Hadir'; userSummary[log.nama].clockIn = log.waktu; }
          if (log.aksi === 'Pulang') { userSummary[log.nama].clockOut = log.waktu; }
          if (log.aksi === 'Izin' || log.aksi === 'Sakit') {
            userSummary[log.nama].statusHariIni = log.aksi;
            userSummary[log.nama].keteranganHariIni = log.keterangan;
          }
        }
      }

      if (log.tipe === 'Live' && log.aksi === 'Masuk') {
        const pair = logs.find(l => l.nama === log.nama && l.tipe === 'Live' && l.aksi === 'Pulang' && new Date(l.timestamp).toLocaleDateString('id-ID') === logDateStr && l.timestamp > log.timestamp);
        if (pair) {
          const diff = (pair.timestamp - log.timestamp) / (1000 * 60 * 60);
          userSummary[log.nama].jamLive += diff;
          userSummary[log.nama].gajiLive += diff * UPAH_PER_JAM;
        }
      }
    });

    return userSummary;
  }, [logs, filterMonth, appUser]);

  const totalGajiLiveSemua = Object.values(stats).reduce((a, b) => a + b.gajiLive, 0);

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-24 md:pb-0`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-40 w-full px-4 md:px-8 py-4 shadow-lg flex items-center justify-between border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-950 text-white border-transparent'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 transform hover:scale-110 transition-transform">
             <div className="text-white font-black text-xl w-6 h-6 flex items-center justify-center">A</div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-black uppercase tracking-tight leading-none">AVI-ABSENSI <span className="text-[10px] text-orange-400 font-bold ml-1">PRO</span></h1>
            <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1 hidden md:block">Avicenna Ultimate Management</p>
          </div>
        </div>
        {appUser && (
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setCurrentPage('profile')} className={`p-2.5 rounded-xl transition-all ${currentPage === 'profile' ? 'bg-orange-500' : 'bg-white/10 hover:bg-white/20'}`}>
              <Settings size={20} />
            </button>
            <button onClick={() => setAppUser(null)} className="p-2.5 bg-rose-500 rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
              <LogOut size={20} className="text-white" />
            </button>
          </div>
        )}
      </header>

      {/* LOGIN MODAL */}
      {!appUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className={`w-full max-w-md ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-[3rem] shadow-2xl p-8 md:p-12 border relative overflow-hidden`}>
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl"></div>
             <div className="text-center mb-10">
                <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-xl shadow-orange-500/20">A</div>
                <h1 className={`text-4xl font-black tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>MASUK</h1>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-2">Avicenna Agency System</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Username</label>
                   <input type="text" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className={`w-full p-4 rounded-2xl border-2 font-bold outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} placeholder="Username anda" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Sandi Akses</label>
                   <input type="password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className={`w-full p-4 rounded-2xl border-2 font-bold outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} placeholder="Password anda" />
                </div>
                <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all">Konfirmasi Login</button>
             </form>
          </div>
        </div>
      )}

      {appUser && (
        <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
          
          {/* ANNOUNCEMENT BANNER */}
          {announcement && currentPage === 'absen' && (
             <div className="bg-orange-500 text-white p-6 rounded-[2rem] shadow-xl shadow-orange-500/20 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                <div className="p-3 bg-white/20 rounded-xl"><Megaphone size={24} /></div>
                <div className="flex-1">
                   <p className="text-[10px] font-black uppercase opacity-60">Pesan Admin</p>
                   <p className="font-bold text-sm md:text-base">{announcement}</p>
                </div>
             </div>
          )}

          {/* PAGE: ABSENSI (PEGWAI ONLY) */}
          {currentPage === 'absen' && appUser.role !== 'admin' && (
            <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700">
              <div className={`p-8 md:p-16 rounded-[4rem] text-center border-2 shadow-2xl relative overflow-hidden ${darkMode ? 'bg-slate-900 border-orange-500/20' : 'bg-white border-orange-100'}`}>
                <div className="absolute -bottom-10 -left-10 text-[12rem] font-black text-orange-500/5 select-none pointer-events-none">A</div>
                <h2 className={`text-7xl md:text-9xl font-black tracking-tighter mb-4 tabular-nums ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </h2>
                <p className="text-sm md:text-base font-black uppercase text-slate-400 tracking-[0.2em]">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              <div className="space-y-6">
                <div className={`flex p-2 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  {['Umum', 'Live'].map(t => (
                    <button key={t} onClick={() => setAbsensiType(t)} className={`flex-1 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${absensiType === t ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500'}`}>Sesi {t}</button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleAbsen('Masuk')} className="h-40 bg-emerald-600 text-white rounded-[3rem] font-black uppercase text-[10px] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
                    <CheckCircle2 size={32} /> Clock In
                  </button>
                  <button onClick={() => handleAbsen('Pulang')} className="h-40 bg-rose-600 text-white rounded-[3rem] font-black uppercase text-[10px] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
                    <Clock size={32} /> Clock Out
                  </button>
                </div>
                
                {absensiType === 'Umum' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowReasonModal('Izin')} className="py-6 bg-amber-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                      <FileText size={18} /> Izin
                    </button>
                    <button onClick={() => setShowReasonModal('Sakit')} className="py-6 bg-blue-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                      <Thermometer size={18} /> Sakit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAGE: LOG SAYA (PEGWAI ONLY) */}
          {currentPage === 'riwayat_saya' && appUser.role !== 'admin' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Riwayat Saya</h2>
                  <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Aktivitas Personal</p>
                </div>
                <div className={`p-4 rounded-2xl border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-transparent font-black uppercase text-orange-500 outline-none pr-4">
                    {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Hadir', val: stats[appUser.nama]?.hadir || 0, color: 'bg-emerald-500' },
                  { label: 'Izin', val: stats[appUser.nama]?.izin || 0, color: 'bg-amber-500' },
                  { label: 'Sakit', val: stats[appUser.nama]?.sakit || 0, color: 'bg-blue-500' },
                  { label: 'Gaji Live', val: `Rp ${(stats[appUser.nama]?.gajiLive || 0).toLocaleString('id-ID')}`, color: 'bg-indigo-600' }
                ].map((st, i) => (
                  <div key={i} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-2 p-5 rounded-3xl shadow-sm`}>
                    <p className="text-[9px] font-black uppercase opacity-40 mb-1">{st.label}</p>
                    <p className={`text-xl font-black ${st.label === 'Gaji Live' ? 'text-indigo-500' : ''}`}>{st.val}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {stats[appUser.nama]?.logs.map((log, i) => (
                  <div key={i} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-2 p-6 rounded-[2rem] flex items-center justify-between group`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.aksi === 'Masuk' ? 'bg-emerald-500/10 text-emerald-600' : log.aksi === 'Pulang' ? 'bg-rose-500/10 text-rose-600' : 'bg-orange-500/10 text-orange-600'}`}>
                        {log.aksi === 'Masuk' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black opacity-40 uppercase">{log.tanggalDisplay}</p>
                        <h4 className="font-black text-sm uppercase">{log.tipe} - {log.aksi}</h4>
                        {log.keterangan !== "-" && <p className="text-[10px] italic font-bold opacity-60">"{log.keterangan}"</p>}
                      </div>
                    </div>
                    <p className="text-xl font-black tabular-nums">{log.waktu}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGE: PROFILE & SECURITY (ALL USERS) */}
          {currentPage === 'profile' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">
              <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-orange-500"><ShieldCheck size={28} /> Profil & Keamanan</h2>
                
                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase opacity-40 mb-1">Identitas Saat Ini</p>
                    <div className="flex justify-between items-center">
                       <p className="font-black text-lg">{appUser.nama} <span className="text-xs opacity-50 font-normal">({appUser.role})</span></p>
                       <div className="px-3 py-1 bg-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{appUser.username}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-4">Ganti Password Mandiri</p>
                    <div className="flex gap-2">
                       <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className={`flex-1 p-4 rounded-2xl border-2 outline-none transition-all font-bold ${darkMode ? 'bg-slate-800 border-slate-700 focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} placeholder="Password baru..." />
                       <button onClick={() => updatePassword()} className="px-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-700"><Save size={18} /></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ADMIN ONLY CONTROLS */}
              {appUser.role === 'admin' && (
                <div className="space-y-8">
                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-orange-500"><Megaphone size={28} /> Pengumuman Admin</h2>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} className={`w-full h-32 p-4 rounded-2xl border-2 outline-none font-bold resize-none mb-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder="Tulis pengumuman hari ini..." />
                    <button onClick={saveAnnouncement} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-600">Simpan Pengumuman</button>
                  </div>

                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-orange-500"><Lock size={28} /> Super User Reset</h2>
                    <div className="space-y-4">
                       <select value={resetPassTarget.username} onChange={e => setResetPassTarget({...resetPassTarget, username: e.target.value})} className={`w-full p-4 rounded-2xl border-2 outline-none font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <option value="">Pilih Pegawai...</option>
                          {daftarPegawai.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                       </select>
                       <input type="text" value={resetPassTarget.password} onChange={e => setResetPassTarget({...resetPassTarget, password: e.target.value})} className={`w-full p-4 rounded-2xl border-2 outline-none font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder="Password Baru Pegawai..." />
                       <button onClick={() => updatePassword(resetPassTarget.username, resetPassTarget.password)} className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600">Reset Password User</button>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-slate-400"><History size={28} /> Log Aktivitas Admin</h2>
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                       {adminLogs.map((al, i) => (
                         <div key={i} className="p-4 border-l-4 border-orange-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-xl">
                            <p className="text-[10px] font-black uppercase opacity-40">{al.waktu}</p>
                            <p className="font-bold text-xs">{al.aksi}</p>
                            <p className="text-[10px] font-bold text-indigo-500">Oleh: {al.admin}</p>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAGE: ADMIN DASHBOARD (ADMIN ONLY) */}
          {currentPage === 'history' && appUser.role === 'admin' && (
            <div className="space-y-12 animate-in fade-in">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div>
                   <h2 className="text-3xl font-black uppercase tracking-tighter">Admin Control Center</h2>
                   <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Pengawasan Absensi & Live Sessions</p>
                </div>
                <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-sm'}`}>
                  <Calendar size={20} className="text-orange-500" />
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-transparent font-black uppercase text-orange-500 outline-none">
                    {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* SECTION: ABSENSI UMUM */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-500 rounded-lg text-white"><Users size={20} /></div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Status Absensi Umum</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {daftarPegawai.filter(p => p.akses.includes('Umum')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 rounded-[2.5rem] border-2 shadow-sm relative group overflow-hidden`}>
                         <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-black text-xl">{p.nama[0]}</div>
                           <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${
                             s.statusHariIni === 'Hadir' ? 'bg-emerald-100 text-emerald-600' : 
                             s.statusHariIni === 'Izin' ? 'bg-amber-100 text-amber-600' : 
                             s.statusHariIni === 'Sakit' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                           }`}>{s.statusHariIni}</div>
                         </div>
                         <h4 className="font-black text-lg mb-2">{p.nama}</h4>
                         {s.keteranganHariIni !== '-' && <p className="text-[10px] italic font-bold opacity-60 mb-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">"{s.keteranganHariIni}"</p>}
                         <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                           <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center"><span className="opacity-40 block mb-1">Clock In</span> {s.clockIn}</div>
                           <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center"><span className="opacity-40 block mb-1">Clock Out</span> {s.clockOut}</div>
                           <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg text-center">Hadir: {s.hadir}</div>
                           <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg text-center">Izin: {s.izin}</div>
                           <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg text-center col-span-2">Sakit: {s.sakit}</div>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SECTION: ABSENSI LIVE */}
              <div className="space-y-6 pt-10 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-rose-500 rounded-lg text-white"><Video size={20} /></div>
                     <h3 className="text-xl font-black uppercase tracking-tight">Performa Sesi Live</h3>
                  </div>
                  <div className="bg-rose-500 px-6 py-3 rounded-2xl text-white shadow-xl shadow-rose-500/20">
                     <p className="text-[9px] font-black uppercase opacity-60">Total Pengeluaran Live</p>
                     <p className="text-xl font-black">Rp {totalGajiLiveSemua.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {daftarPegawai.filter(p => p.akses.includes('Live')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-8 rounded-[3rem] border-2 shadow-sm relative overflow-hidden group`}>
                         <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Video size={100} /></div>
                         <p className="text-[10px] font-black uppercase opacity-40 mb-1">Host Live</p>
                         <h4 className="text-2xl font-black mb-6 uppercase tracking-tight">{p.nama}</h4>
                         <div className="space-y-3">
                            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                               <span className="text-xs font-bold opacity-50">Total Jam</span>
                               <span className="font-black text-lg">{s.jamLive?.toFixed(1)} Jam</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                               <span className="text-xs font-bold opacity-70">Pendapatan</span>
                               <span className="font-black text-lg">Rp {s.gajiLive?.toLocaleString('id-ID')}</span>
                            </div>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* MODAL: INPUT KETERANGAN IZIN/SAKIT */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
           <div className={`w-full max-w-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} border-4 rounded-[3rem] p-8 md:p-10 shadow-2xl`}>
              <div className="text-center mb-6">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-[1.5rem] flex items-center justify-center ${showReasonModal === 'Izin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                   {showReasonModal === 'Izin' ? <FileText size={40} /> : <Thermometer size={40} />}
                </div>
                <h3 className="text-2xl font-black mb-1">Alasan {showReasonModal}</h3>
                <p className="text-xs opacity-50">Berikan keterangan singkat untuk admin.</p>
              </div>
              <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} className={`w-full h-32 p-4 rounded-2xl border-2 outline-none font-bold resize-none mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder={`Misal: Pergi ke dokter atau urusan keluarga...`} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setShowReasonModal(null); setReasonText(""); }} className="py-4 rounded-2xl font-black uppercase text-[10px] border-2 border-slate-200 dark:border-slate-700">Batal</button>
                <button onClick={() => handleAbsen(showReasonModal, reasonText)} disabled={!reasonText.trim()} className={`py-4 rounded-2xl font-black uppercase text-[10px] text-white ${showReasonModal === 'Izin' ? 'bg-amber-500' : 'bg-blue-500'} disabled:opacity-50`}>Kirim Data</button>
              </div>
           </div>
        </div>
      )}

      {/* GLOBAL MODAL ALERT */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
           <div className={`w-full max-w-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} border-4 rounded-[3rem] p-10 shadow-2xl text-center`}>
              <div className={`w-20 h-20 mx-auto mb-6 rounded-[1.5rem] flex items-center justify-center ${alertModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'}`}>
                 <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">{alertModal.title}</h3>
              <p className="text-sm opacity-60 mb-8 leading-relaxed">{alertModal.message}</p>
              <button onClick={() => setAlertModal({ ...alertModal, show: false })} className="w-full py-5 bg-orange-500 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Tutup</button>
           </div>
        </div>
      )}

      {/* NAVIGATION: MOBILE ONLY */}
      {appUser && (
        <nav className={`fixed bottom-0 left-0 right-0 p-3 flex gap-2 z-50 md:hidden border-t-2 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]' : 'bg-white border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
           {appUser.role !== 'admin' && (
             <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'absen' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <Clock size={18} /> <span className="text-[7px] font-black uppercase">Absen</span>
             </button>
           )}
           {appUser.role !== 'admin' && (
             <button onClick={() => setCurrentPage('riwayat_saya')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'riwayat_saya' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <History size={18} /> <span className="text-[7px] font-black uppercase">Riwayat</span>
             </button>
           )}
           {appUser.role === 'admin' && (
             <button onClick={() => setCurrentPage('history')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'history' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <LayoutDashboard size={18} /> <span className="text-[7px] font-black uppercase">Dashboard</span>
             </button>
           )}
           <button onClick={() => setCurrentPage('profile')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${currentPage === 'profile' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
              <Settings size={18} /> <span className="text-[7px] font-black uppercase">Profil</span>
           </button>
        </nav>
      )}

      {/* TOAST NOTIFICATION */}
      {statusMessage && (
        <div className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 px-10 py-5 rounded-[1.5rem] text-white font-black text-[10px] uppercase shadow-2xl z-[150] animate-in slide-in-from-bottom-10 border-2 ${statusMessage.type === 'success' ? 'bg-emerald-600 border-emerald-400' : 'bg-rose-600 border-rose-400'}`}>
          {statusMessage.msg}
        </div>
      )}

    </div>
  );
};

export default App;