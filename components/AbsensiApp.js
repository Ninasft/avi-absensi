import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save, RefreshCw, Trash2, Eye } from 'lucide-react';

// --- INITIALIZATION GUARD ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

const App = () => {
  // --- CORE STATES ---
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // --- DATA STATES ---
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

  // --- BOOTSTRAP SYSTEM (Anti-Stuck Loading) ---
  useEffect(() => {
    let isMounted = true;
    const emergencyTimeout = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 3500);

    const initConnection = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Auth failed, offline mode");
      }
    };

    initConnection();
    
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (isMounted) {
        setUser(u);
        setIsInitializing(false);
        clearTimeout(emergencyTimeout);
      }
    });

    return () => {
      isMounted = false;
      unsubAuth();
      clearTimeout(emergencyTimeout);
    };
  }, []);

  // --- REALTIME DATA SYNC ---
  useEffect(() => {
    if (!user) return;

    const unsubConfigs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'user_configs'), (snap) => {
      const configs = {};
      snap.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    });

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    const unsubAnn = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), (doc) => {
      if (doc.exists()) setAnnouncement(doc.data().text);
    });

    const unsubAdmin = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'admin_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    return () => {
      unsubConfigs(); unsubLogs(); unsubAnn(); unsubAdmin();
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- ACTIONS ---
  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertModal({ show: true, title, message, type });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = loginInput.username.toLowerCase().trim();
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
      showStatus("Login Berhasil", "success");
    } else {
      showStatus("Username atau Password Salah", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (!user || isLoading) return;
    
    const now = new Date();
    const currentHour = now.getHours();

    if (absensiType === 'Umum') {
      if (action === 'Masuk' && currentHour < 8) {
        showAlert("Waktu Belum Dibuka", `Absensi masuk dibuka pukul 08:00 WIB.`, 'warning');
        return;
      }
      if (action === 'Pulang' && currentHour < 16) {
        showAlert("Belum Waktunya Pulang", `Absen pulang baru tersedia pukul 16:00 WIB.`, 'info');
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
      showAlert("Sudah Absen", `Anda sudah melakukan ${action} ${absensiType} hari ini.`, 'success');
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), {
        nama: appUser.nama,
        username: appUser.username,
        tipe: absensiType,
        aksi: action,
        keterangan: note || "-",
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggalDisplay: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulanIndex: now.getMonth(),
        timestamp: Date.now()
      });
      showStatus(`${action} Berhasil Teratat`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showStatus("Gagal menyimpan ke cloud", "error");
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

      showStatus(`Password ${finalUsername} diperbarui`, "success");
      if (isSelf) setNewPass("");
      else setResetPassTarget({ username: '', password: '' });
    } catch (e) {
      showStatus("Gagal memperbarui", "error");
    }
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    const userSummary = {};

    daftarPegawai.forEach(p => {
      userSummary[p.nama] = { 
        hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0, 
        statusHariIni: 'Off', clockIn: '--:--', clockOut: '--:--', 
        logs: []
      };
    });

    [...filtered].sort((a,b) => a.timestamp - b.timestamp).forEach(log => {
      if (!userSummary[log.nama]) return;
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');
      userSummary[log.nama].logs.push(log);

      if (log.tipe === 'Umum') {
        if (log.aksi === 'Masuk') userSummary[log.nama].hadir++;
        if (log.aksi === 'Izin') userSummary[log.nama].izin++;
        if (log.aksi === 'Sakit') userSummary[log.nama].sakit++;

        if (logDateStr === todayStr) {
          if (log.aksi === 'Masuk') { userSummary[log.nama].statusHariIni = 'Hadir'; userSummary[log.nama].clockIn = log.waktu; }
          if (log.aksi === 'Pulang') { userSummary[log.nama].clockOut = log.waktu; }
          if (['Izin', 'Sakit'].includes(log.aksi)) userSummary[log.nama].statusHariIni = log.aksi;
        }
      }

      if (log.tipe === 'Live' && log.aksi === 'Masuk') {
        const pair = filtered.find(l => l.nama === log.nama && l.tipe === 'Live' && l.aksi === 'Pulang' && l.timestamp > log.timestamp);
        if (pair) {
          const hours = (pair.timestamp - log.timestamp) / 3600000;
          userSummary[log.nama].jamLive += hours;
          userSummary[log.nama].gajiLive += hours * UPAH_PER_JAM;
        }
      }
    });

    return userSummary;
  }, [logs, filterMonth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-6"></div>
        <p className="text-white font-black text-[10px] uppercase tracking-widest opacity-40">Sinkronisasi Cloud...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans`}>
      
      {/* GLOBAL STATUS */}
      {statusMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full text-white font-black text-[10px] uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-top-4 ${statusMessage.type === 'error' ? 'bg-rose-600' : 'bg-indigo-600'}`}>
          {statusMessage.msg}
        </div>
      )}

      {/* LOGIN VIEW */}
      {!appUser ? (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-2xl shadow-indigo-100'}`}>
            <div className="text-center mb-10">
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-orange-500/20 font-black text-2xl">A</div>
              <h2 className="text-2xl font-black italic tracking-tight">AVI-ABSENSI</h2>
              <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.3em] mt-1">Ultimate Agency System</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">ID Pegawai</label>
                <input type="text" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 outline-none font-bold uppercase transition-all" placeholder="ID ANDA" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Sandi Akses</label>
                <input type="password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 outline-none font-bold transition-all" placeholder="••••••••" required />
              </div>
              <button className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all uppercase tracking-widest text-[10px] mt-4">Masuk Sistem</button>
            </form>
          </div>
        </div>
      ) : (
        /* APP VIEW */
        <div className="max-w-4xl mx-auto pb-24">
          <header className={`sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b backdrop-blur-md ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black">A</div>
              <h1 className="text-sm font-black italic tracking-tighter uppercase">AVI-ABSENSI <span className="text-orange-500">PRO</span></h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800">{darkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
              <button onClick={() => setAppUser(null)} className="p-2.5 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 ml-2"><LogOut size={18} /></button>
            </div>
          </header>

          <main className="p-6 space-y-8 mt-4">
             {/* NAVIGATION */}
            <nav className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 gap-1 shadow-sm">
              <button onClick={() => setCurrentPage(appUser.role === 'admin' ? 'history' : 'absen')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${currentPage === (appUser.role === 'admin' ? 'history' : 'absen') ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'opacity-40'}`}>
                {appUser.role === 'admin' ? 'Monitoring' : 'Absensi'}
              </button>
              <button onClick={() => setCurrentPage('profile')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${currentPage === 'profile' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'opacity-40'}`}>
                Pengaturan
              </button>
            </nav>

            {currentPage === 'absen' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
                {announcement && (
                  <div className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-[2rem] text-white flex items-center gap-4 shadow-xl">
                    <Megaphone size={20} className="shrink-0" />
                    <p className="text-sm font-bold italic">"{announcement}"</p>
                  </div>
                )}

                <div className={`p-10 rounded-[3rem] text-center border-2 ${darkMode ? 'bg-slate-900 border-orange-500/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}>
                  <h2 className="text-7xl font-black tracking-tighter text-orange-500 tabular-nums">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mt-4">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>

                <div className="max-w-md mx-auto space-y-6">
                  <div className="flex p-1.5 bg-slate-200 dark:bg-slate-800 rounded-2xl gap-1">
                    {['Umum', 'Live'].map(t => (
                      <button key={t} onClick={() => setAbsensiType(t)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${absensiType === t ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-md' : 'opacity-40'}`}>Sesi {t}</button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleAbsen('Masuk')} className="aspect-square bg-emerald-600 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-xl active:scale-95 transition-all">
                      <CheckCircle2 size={36} />
                      <span className="font-black text-xs uppercase tracking-widest">Clock In</span>
                    </button>
                    <button onClick={() => handleAbsen('Pulang')} className="aspect-square bg-rose-600 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-xl active:scale-95 transition-all">
                      <Clock size={36} />
                      <span className="font-black text-xs uppercase tracking-widest">Clock Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'history' && appUser.role === 'admin' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-6">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Monitoring</h2>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-3 bg-white dark:bg-slate-900 border-2 rounded-xl font-bold text-[10px] uppercase outline-none text-orange-500">
                    {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {daftarPegawai.map(p => {
                    const s = stats[p.nama] || {};
                    const gaji = Math.floor(s.gajiLive || 0);
                    return (
                      <div key={p.id} className={`p-6 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-black text-sm italic">{p.nama}</h4>
                            <p className="text-[9px] font-bold opacity-30 uppercase">H: {s.hadir} | I: {s.izin} | S: {s.sakit}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.statusHariIni === 'Hadir' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 opacity-40'}`}>{s.statusHariIni}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center">
                          <p className="text-[9px] font-black opacity-30 uppercase">Upah Live</p>
                          <p className="text-sm font-black text-orange-500">Rp {gaji.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {currentPage === 'profile' && (
              <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-right-5">
                <div className={`p-8 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                  <h3 className="text-lg font-black italic mb-6 uppercase flex items-center gap-3"><Lock size={20}/> Ganti Password</h3>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 mb-4 outline-none font-bold" placeholder="Password Baru..." />
                  <button onClick={() => updatePassword()} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px]">Simpan Password</button>
                </div>

                {appUser.role === 'admin' && (
                  <div className={`p-8 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                    <h3 className="text-lg font-black italic mb-6 uppercase flex items-center gap-3"><Megaphone size={20}/> Pengumuman</h3>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} className="w-full h-32 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 mb-4 outline-none font-bold text-sm" placeholder="Tulis pesan..." />
                    <button onClick={async () => {
                      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), { text: announcement }, { merge: true });
                      showStatus("Pesan Terkirim", "success");
                    }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Update Pengumuman</button>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ALERT MODAL */}
          {alertModal.show && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
              <div className={`w-full max-w-sm p-8 rounded-[2.5rem] border-2 shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-3 mb-4 text-orange-500"><AlertCircle size={24}/> <h3 className="font-black uppercase text-sm tracking-widest">{alertModal.title}</h3></div>
                <p className="text-sm opacity-60 font-medium mb-6 leading-relaxed">{alertModal.message}</p>
                <button onClick={() => setAlertModal({...alertModal, show: false})} className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest">Tutup</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;