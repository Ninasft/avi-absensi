import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle } from 'lucide-react';

/* AVI-ABSENSI PRO - SMART VALIDATION SYSTEM
  - Logika Pembatasan Jam (08:00 & 16:00)
  - Copywriting Humanis & Informatif
  - Branding: Avicenna Agency (Oranye)
  - Custom Dynamic Favicon & Logo Enhancement
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
  const [userConfigs, setUserConfigs] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'error' });
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());

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

  // Logic untuk Favicon Dinamis
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    // Menggunakan SVG logo Avicenna (Huruf A Oranye)
    link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%23f97316%22/><text y=%22.9em%22 font-size=%2270%22 font-weight=%22bold%22 font-family=%22Arial%22 fill=%22white%22 x=%2250%%22 text-anchor=%22middle%22>A</text></svg>`;
    document.getElementsByTagName('head')[0].appendChild(link);
    document.title = "AVI-ABSENSI | Avicenna Agency";
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
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'user_configs'), (snap) => {
      const configs = {};
      snap.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    });
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
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

  const handleAbsen = async (action) => {
    if (!user || isLoading) return;
    
    const now = new Date();
    const currentHour = now.getHours();

    if (absensiType === 'Umum') {
      if (action === 'Masuk' && currentHour < 8) {
        showAlert(
          "Waktu Absensi Belum Dibuka", 
          `Halo ${appUser.nama}, mohon maaf absensi masuk baru dapat dilakukan mulai pukul 08:00 WIB. Silakan bersantai sejenak atau siapkan kebutuhan kerja Anda.`,
          'warning'
        );
        return;
      }

      if (action === 'Pulang' && currentHour < 16) {
        showAlert(
          "Masih Dalam Jam Operasional", 
          `Semangat, ${appUser.nama}! Saat ini masih dalam jam kerja produktif. Pastikan Anda menyelesaikan tugas hari ini, absen pulang baru bisa diakses tepat pada pukul 16:00 WIB.`,
          'info'
        );
        return;
      }
    }

    setIsLoading(true);
    const todayStr = now.toLocaleDateString('id-ID');

    const duplicate = logs.find(l => 
      l.nama === appUser.nama && 
      l.tipe === absensiType && 
      l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (duplicate) {
      showAlert("Sudah Terdaftar", `Sistem mencatat Anda sudah melakukan absen ${action} untuk sesi ${absensiType} hari ini. Terimakasih!`, 'success');
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
        timestamp: Date.now()
      });
      showStatus(`Absen ${action} Berhasil Terkirim`, "success");
    } catch (e) {
      showStatus("Gagal menghubungkan ke server", "error");
    } finally { setIsLoading(false); }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    
    const userSummary = {};
    daftarPegawai.forEach(p => {
      userSummary[p.nama] = { 
        hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0,
        statusHariIni: 'Belum Absen',
        clockInHariIni: '--:--',
        clockOutHariIni: '--:--'
      };
    });

    filtered.forEach(log => {
      if (!userSummary[log.nama]) return;
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');
      
      if (log.tipe === 'Umum') {
        if (log.aksi === 'Izin') userSummary[log.nama].izin++;
        if (log.aksi === 'Sakit') userSummary[log.nama].sakit++;
        if (log.aksi === 'Masuk') userSummary[log.nama].hadir++;

        if (logDateStr === todayStr) {
          if (log.aksi === 'Masuk') {
            userSummary[log.nama].statusHariIni = 'Hadir';
            userSummary[log.nama].clockInHariIni = log.waktu;
          }
          if (log.aksi === 'Pulang') userSummary[log.nama].clockOutHariIni = log.waktu;
          if (log.aksi === 'Izin' || log.aksi === 'Sakit') userSummary[log.nama].statusHariIni = log.aksi;
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
  }, [logs, filterMonth]);

  const totalGajiLiveSemua = Object.values(stats).reduce((a, b) => a + b.gajiLive, 0);

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-24 md:pb-0`}>
      
      {/* HEADER SECTION DENGAN LOGO AVICENNA AGENCY */}
      <header className={`sticky top-0 z-40 w-full px-4 md:px-8 py-4 shadow-lg flex items-center justify-between border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-950 text-white border-transparent'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 transform hover:scale-110 transition-transform cursor-pointer">
             <div className="text-white font-black text-xl w-6 h-6 flex items-center justify-center">A</div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-xl font-black uppercase tracking-tight leading-none">AVI-ABSENSI</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-500 text-white rounded-md">
                 <ShieldCheck size={10} />
                 <span className="text-[9px] md:text-[10px] font-black tracking-tighter uppercase">AVICENNA AGENCY</span>
              </div>
            </div>
            <p className="text-[9px] md:text-[10px] font-bold text-indigo-300 mt-1 uppercase tracking-widest leading-none">
              {appUser ? `${appUser.role} • ${appUser.nama}` : 'Professional Gate'}
            </p>
          </div>
        </div>
        {appUser && (
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setAppUser(null)} className="p-2.5 bg-rose-500 rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
              <LogOut size={20} className="text-white" />
            </button>
          </div>
        )}
      </header>

      {/* LOGIN MODAL OVERLAY */}
      {!appUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-[2.5rem] shadow-2xl p-8 md:p-12 border overflow-hidden relative`}>
             {/* Lingkaran Dekoratif Oranye */}
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
             
             <div className="text-center mb-10 relative z-10">
                <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-xl shadow-orange-500/20">A</div>
                <div className="inline-block mb-2 px-4 py-1.5 bg-orange-500 text-white text-[10px] font-black rounded-full tracking-widest uppercase">AVICENNA AGENCY</div>
                <h1 className={`text-4xl font-black tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>LOGIN</h1>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-2">Presence Management System</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-4 relative z-10">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Identifier</label>
                   <input type="text" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className={`w-full p-4 rounded-2xl border-2 font-bold outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} placeholder="Username" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Access Key</label>
                   <input type="password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className={`w-full p-4 rounded-2xl border-2 font-bold outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} placeholder="Password" />
                </div>
                <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">Masuk Sistem</button>
             </form>
          </div>
        </div>
      )}

      {/* MAIN CONTENT WINDOW */}
      {appUser && (
        <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
          
          {/* PEGAWAI VIEW: CLOCK SECTION */}
          {appUser.role !== 'admin' && currentPage === 'absen' && (
            <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700">
              <div className={`p-8 md:p-16 rounded-[4rem] text-center border-2 transition-all shadow-2xl relative overflow-hidden ${darkMode ? 'bg-slate-900 border-orange-500/20' : 'bg-white border-orange-100'}`}>
                {/* Dekoratif Logo Airmark */}
                <div className="absolute -bottom-10 -left-10 text-[12rem] font-black text-orange-500/5 select-none pointer-events-none">A</div>
                
                <div className="mb-4 inline-flex items-center gap-2 bg-orange-500/10 text-orange-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest relative z-10">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div> Avicenna Monitoring Active
                </div>
                <h2 className={`text-7xl md:text-9xl font-black tracking-tighter mb-4 tabular-nums relative z-10 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </h2>
                <p className="text-sm md:text-base font-black uppercase text-slate-400 tracking-[0.2em] relative z-10">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              <div className="space-y-6">
                <div className={`flex p-2 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  {['Umum', 'Live'].map(t => (
                    <button 
                      key={t} 
                      onClick={() => setAbsensiType(t)} 
                      className={`flex-1 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${absensiType === t ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500'}`}
                    >
                      Sesi {t}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => handleAbsen('Masuk')} className="h-48 bg-emerald-600 text-white rounded-[3rem] font-black uppercase text-xs shadow-2xl shadow-emerald-600/30 flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="p-4 bg-white/20 rounded-2xl"><CheckCircle2 size={40} /></div> Clock In
                  </button>
                  <button onClick={() => handleAbsen('Pulang')} className="h-48 bg-rose-600 text-white rounded-[3rem] font-black uppercase text-xs shadow-2xl shadow-rose-600/30 flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all">
                    <div className="p-4 bg-white/20 rounded-2xl"><Clock size={40} /></div> Clock Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN DASHBOARD VIEW */}
          {appUser.role === 'admin' && currentPage === 'history' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="bg-orange-500 p-8 rounded-[3rem] text-white shadow-2xl shadow-orange-500/20">
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-2">Total Pengeluaran Live</p>
                    <h3 className="text-3xl md:text-4xl font-black">Rp {totalGajiLiveSemua.toLocaleString('id-ID')}</h3>
                 </div>
                 <div className={`${darkMode ? 'bg-slate-900' : 'bg-white'} p-8 rounded-[3rem] border-2 shadow-sm`}>
                    <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-2">Periode Data</p>
                    <h3 className="text-2xl font-black uppercase text-orange-500">{daftarBulan[filterMonth]}</h3>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                   <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                      <Users className="text-orange-500" /> Kehadiran Pegawai
                   </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {daftarPegawai.filter(p => p.akses.includes('Umum')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 rounded-[2.5rem] border-2 shadow-sm relative overflow-hidden`}>
                         <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-black text-xl">{p.nama[0]}</div>
                           <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${s.statusHariIni === 'Hadir' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{s.statusHariIni}</div>
                         </div>
                         <h4 className="font-black text-lg mb-4">{p.nama}</h4>
                         <div className="grid grid-cols-2 gap-2 mb-4">
                           <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                             <p className="text-[8px] font-black uppercase opacity-40">In</p>
                             <p className="text-xs font-black">{s.clockInHariIni}</p>
                           </div>
                           <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                             <p className="text-[8px] font-black uppercase opacity-40">Out</p>
                             <p className="text-xs font-black">{s.clockOutHariIni}</p>
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

      {/* GLOBAL MODAL ALERT (SMART VALIDATION) */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className={`w-full max-w-sm ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-4 rounded-[3rem] p-8 md:p-10 shadow-2xl text-center animate-in zoom-in-95 duration-300`}>
              <div className={`w-24 h-24 mx-auto mb-8 rounded-[2rem] flex items-center justify-center shadow-lg ${
                alertModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                alertModal.type === 'info' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                 {alertModal.type === 'warning' ? <AlertCircle size={48} /> : 
                  alertModal.type === 'info' ? <Clock size={48} /> : <CheckCircle2 size={48} />}
              </div>
              <h3 className={`text-2xl font-black tracking-tight mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{alertModal.title}</h3>
              <p className={`text-sm font-bold leading-relaxed mb-8 opacity-70 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{alertModal.message}</p>
              <button 
                onClick={() => setAlertModal({ ...alertModal, show: false })}
                className="w-full py-5 bg-orange-500 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest hover:bg-orange-600 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
              >
                Konfirmasi
              </button>
           </div>
        </div>
      )}

      {/* MOBILE NAVIGATION */}
      {appUser && (
        <nav className={`fixed bottom-0 left-0 right-0 p-3 flex gap-3 z-50 md:hidden ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t'}`}>
           <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 ${currentPage === 'absen' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400'}`}>
              <Clock size={20} /> <span className="text-[9px] font-black uppercase">Presence</span>
           </button>
           <button onClick={() => setCurrentPage('history')} className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 ${currentPage === 'history' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400'}`}>
              <LayoutDashboard size={20} /> <span className="text-[9px] font-black uppercase">History</span>
           </button>
        </nav>
      )}

      {/* NOTIFICATION TOAST */}
      {statusMessage && (
        <div className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 px-10 py-5 rounded-[1.5rem] text-white font-black text-xs uppercase shadow-2xl z-[150] border-2 animate-in slide-in-from-bottom-10 ${statusMessage.type === 'success' ? 'bg-emerald-600 border-emerald-400' : 'bg-rose-600 border-rose-400'}`}>
          {statusMessage.msg}
        </div>
      )}

    </div>
  );
};

export default App;