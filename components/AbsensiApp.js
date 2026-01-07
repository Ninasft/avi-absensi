import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, limit, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle, FileText, Lock, MessageSquare, Save, RefreshCw, Trash2, Eye, Sparkles, BrainCircuit } from 'lucide-react';

/* AVI-ABSENSI ULTIMATE VERSION WITH ACCESS FILTER & GEMINI AI */

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

const apiKey = ""; // API Key otomatis disediakan oleh environment

const App = () => {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum'); // Default, akan di-override di useEffect
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
  const [resetPassTarget, setResetPassTarget] = useState({ username: '', password: '' });

  // AI State
  const [aiInsight, setAiInsight] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [dailyQuote, setDailyQuote] = useState("");

  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // KONFIGURASI AKSES PEGAWAI (SESUAI PERMINTAAN)
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

  // --- GEMINI API INTEGRATION ---
  
  const callGemini = async (prompt, systemPrompt = "Kamu adalah asisten HRD pintar untuk Avicenna Agency.") => {
    let retries = 0;
    const maxRetries = 5;
    while (retries < maxRetries) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          })
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        retries++;
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
      }
    }
    throw new Error("Gagal menghubungi AI");
  };

  const generateAiInsight = async () => {
    setIsAiLoading(true);
    try {
      const statsContext = JSON.stringify(stats);
      const prompt = `Analisis data absensi ini: ${statsContext}. Berikan insight siapa yang paling produktif dan siapa yang butuh dorongan. Gunakan Bahasa Indonesia.`;
      const insight = await callGemini(prompt, "Kamu adalah analis data HR profesional.");
      setAiInsight(insight);
    } catch (err) {
      showStatus("Gagal memuat AI Insight", "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchDailyQuote = async (nama) => {
    try {
      const prompt = `Berikan satu kalimat motivasi kerja singkat untuk ${nama} yang baru absen masuk.`;
      const quote = await callGemini(prompt);
      setDailyQuote(quote);
    } catch (err) {
      setDailyQuote("Semangat bekerja hari ini!");
    }
  };

  // --- DATA SYNC ---

  useEffect(() => {
    document.title = "AVI-ABSENSI | AI Managed";
  }, []);

  useEffect(() => {
    if (!auth) return;
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
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), (doc) => {
      if (doc.exists()) setAnnouncement(doc.data().text);
    });
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // SET DEFAULT CATEGORY BASED ON ACCESS
  useEffect(() => {
    if (appUser && appUser.role !== 'admin') {
      const pegawaiData = daftarPegawai.find(p => p.id === appUser.username);
      if (pegawaiData && !pegawaiData.akses.includes('Umum')) {
        setAbsensiType('Live');
      } else {
        setAbsensiType('Umum');
      }
    }
  }, [appUser]);

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
      showStatus("Username atau Password Salah", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (!user || isLoading) return;
    setIsLoading(true);
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');

    // Cek duplikasi independen per kategori
    const duplicate = logs.find(l => 
      l.nama === appUser.nama && l.tipe === absensiType && l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (duplicate) {
      showAlert("Sudah Absen", `Anda sudah melakukan ${action} di kategori ${absensiType} hari ini.`, 'success');
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
      showStatus(`${action} ${absensiType} Berhasil`, "success");
      if (action === 'Masuk') fetchDailyQuote(appUser.nama);
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showStatus("Gagal mengirim data", "error");
    } finally { setIsLoading(false); }
  };

  const saveAnnouncement = async () => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement'), { text: announcement });
      showStatus("Pengumuman diperbarui", "success");
    } catch (e) { showStatus("Gagal menyimpan", "error"); }
  };

  const updatePassword = async (targetUsername = appUser.username, password = newPass) => {
    if (!password) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_configs', targetUsername), { password: password });
      showStatus(`Password ${targetUsername} berhasil diganti`, "success");
      setNewPass("");
      setResetPassTarget({ username: '', password: '' });
    } catch (e) { showStatus("Gagal mengganti password", "error"); }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    const userSummary = {};
    
    daftarPegawai.forEach(p => {
      userSummary[p.nama] = { 
        hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0, 
        statusHariIni: 'Belum Absen', clockIn: '--:--', clockOut: '--:--', 
        keteranganHariIni: '-', logs: []
      };
    });

    filtered.forEach(log => {
      if (!userSummary[log.nama]) return;
      userSummary[log.nama].logs.push(log);
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');

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
  }, [logs, filterMonth]);

  const userAkses = useMemo(() => {
    if (!appUser) return [];
    if (appUser.role === 'admin') return ['Umum', 'Live'];
    const p = daftarPegawai.find(x => x.id === appUser.username);
    return p ? p.akses : [];
  }, [appUser]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-8`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-40 px-4 md:px-8 py-4 flex items-center justify-between border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-950 text-white'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-xl"><div className="text-white font-black text-xl">A</div></div>
          <h1 className="text-lg font-black uppercase">AVI-ABSENSI <span className="text-orange-400">AI</span></h1>
        </div>
        {appUser && (
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setAppUser(null)} className="p-2.5 bg-rose-500 rounded-xl text-white"><LogOut size={20} /></button>
          </div>
        )}
      </header>

      {!appUser ? (
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <div className={`w-full max-w-md p-8 rounded-[2rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
             <h2 className="text-3xl font-black text-center mb-8 uppercase tracking-tighter">Login System</h2>
             <form onSubmit={handleLogin} className="space-y-4">
                <input type="text" placeholder="Username" className="w-full p-4 rounded-xl border-2 outline-none font-bold" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} />
                <input type="password" placeholder="Password" className="w-full p-4 rounded-xl border-2 outline-none font-bold" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} />
                <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest">Masuk</button>
             </form>
          </div>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
          
          {/* DAILY MOTIVATION */}
          {dailyQuote && currentPage === 'absen' && (
            <div className="bg-indigo-600 text-white p-6 rounded-3xl flex items-center gap-4 animate-in zoom-in">
               <Sparkles className="text-yellow-300" />
               <p className="font-bold text-sm italic">"{dailyQuote}"</p>
            </div>
          )}

          {/* PAGE: ABSENSI */}
          {currentPage === 'absen' && appUser.role !== 'admin' && (
            <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
              <div className={`p-10 rounded-[3rem] text-center border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className="text-6xl font-black mb-2">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</h2>
                <p className="text-xs font-black uppercase opacity-40">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>

              {/* CATEGORY SELECTOR - FILTERED BY ACCESS */}
              <div className="flex p-2 rounded-2xl bg-slate-200 dark:bg-slate-800">
                {userAkses.map(t => (
                  <button key={t} onClick={() => setAbsensiType(t)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${absensiType === t ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>Sesi {t}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleAbsen('Masuk')} className="h-32 bg-emerald-600 text-white rounded-3xl font-black uppercase text-[10px] flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 size={24} /> Clock In {absensiType}
                </button>
                <button onClick={() => handleAbsen('Pulang')} className="h-32 bg-rose-600 text-white rounded-3xl font-black uppercase text-[10px] flex flex-col items-center justify-center gap-2">
                  <Clock size={24} /> Clock Out {absensiType}
                </button>
              </div>
              
              {absensiType === 'Umum' && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setShowReasonModal('Izin')} className="py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">Izin</button>
                  <button onClick={() => setShowReasonModal('Sakit')} className="py-4 bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">Sakit</button>
                </div>
              )}
            </div>
          )}

          {/* PAGE: ADMIN DASHBOARD */}
          {currentPage === 'history' && appUser.role === 'admin' && (
            <div className="space-y-10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase">Dashboard Pengawasan</h2>
                <button onClick={generateAiInsight} disabled={isAiLoading} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] flex items-center gap-2">
                  {isAiLoading ? <RefreshCw className="animate-spin" /> : <BrainCircuit />} ✨ AI Insight
                </button>
              </div>

              {aiInsight && (
                <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 rounded-3xl text-sm font-bold leading-relaxed">
                  <p className="mb-2 text-indigo-600 uppercase text-[10px] font-black">✨ Analisis Gemini</p>
                  {aiInsight}
                </div>
              )}

              {/* UMUM TABLE - FILTERED ABUB, DEDI, RENDY, SILVI, AISYAH */}
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase opacity-40">Pegawai Kategori Umum</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daftarPegawai.filter(p => p.akses.includes('Umum')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`p-6 rounded-3xl border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                         <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-lg">{p.nama}</span>
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.statusHariIni === 'Hadir' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{s.statusHariIni}</span>
                         </div>
                         <div className="grid grid-cols-2 gap-2 text-[9px] font-black">
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">Masuk: {s.clockIn}</div>
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">Pulang: {s.clockOut}</div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* LIVE TABLE - FILTERED VEBI, SILVI, AISYAH */}
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase opacity-40">Pegawai Kategori Live</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {daftarPegawai.filter(p => p.akses.includes('Live')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`p-6 rounded-3xl border-2 ${darkMode ? 'bg-slate-900 border-indigo-900/30' : 'bg-white border-indigo-100'}`}>
                         <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-lg">{p.nama}</span>
                            <Video className="text-indigo-500" size={18} />
                         </div>
                         <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black">
                               <span className="opacity-40 uppercase tracking-widest">Total Sesi</span>
                               <span>{s.jamLive?.toFixed(1)} Jam</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                               <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (s.jamLive || 0) * 10)}%` }}></div>
                            </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* PAGE: PROFILE & SETTINGS */}
          {currentPage === 'profile' && (
            <div className="max-w-xl mx-auto space-y-6">
               <div className={`p-8 rounded-[2rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                  <h3 className="font-black uppercase mb-6 flex items-center gap-2 text-orange-500"><Settings /> Pengaturan Profil</h3>
                  <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase opacity-40 ml-1">Username: {appUser.username}</p>
                     <input type="password" placeholder="Password Baru" className="w-full p-4 rounded-xl border-2 outline-none font-bold" value={newPass} onChange={e => setNewPass(e.target.value)} />
                     <button onClick={() => updatePassword()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Simpan Perubahan</button>
                  </div>
               </div>
               
               {appUser.role === 'admin' && (
                  <div className={`p-8 rounded-[2rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                     <h3 className="font-black uppercase mb-6 text-orange-500">Pesan Pengumuman</h3>
                     <textarea className="w-full h-24 p-4 rounded-xl border-2 outline-none font-bold mb-4" value={announcement} onChange={e => setAnnouncement(e.target.value)} />
                     <button onClick={saveAnnouncement} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px]">Update Pengumuman</button>
                  </div>
               )}
            </div>
          )}
        </main>
      )}

      {/* MOBILE NAV */}
      {appUser && (
        <nav className={`fixed bottom-0 left-0 right-0 p-2 flex gap-2 md:hidden border-t-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
           {appUser.role !== 'admin' && (
             <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 ${currentPage === 'absen' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <Clock size={16} /><span className="text-[6px] font-black uppercase">Absen</span>
             </button>
           )}
           {appUser.role === 'admin' && (
             <button onClick={() => setCurrentPage('history')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 ${currentPage === 'history' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                <LayoutDashboard size={16} /><span className="text-[6px] font-black uppercase">Admin</span>
             </button>
           )}
           <button onClick={() => setCurrentPage('profile')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 ${currentPage === 'profile' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
              <Settings size={16} /><span className="text-[6px] font-black uppercase">Settings</span>
           </button>
        </nav>
      )}

      {/* MODALS & NOTIFICATIONS */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className={`w-full max-w-sm p-8 rounded-[2rem] ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <h3 className="text-xl font-black mb-4 uppercase">Keterangan {showReasonModal}</h3>
              <textarea className="w-full h-32 p-4 rounded-xl border-2 mb-4 font-bold" value={reasonText} onChange={e => setReasonText(e.target.value)} placeholder="Tulis alasan..." />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowReasonModal(null)} className="py-3 border-2 rounded-xl font-black uppercase text-[10px]">Batal</button>
                <button onClick={() => handleAbsen(showReasonModal, reasonText)} className="py-3 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px]">Kirim</button>
              </div>
           </div>
        </div>
      )}

      {alertModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
           <div className={`w-full max-w-sm p-8 rounded-[2rem] text-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <AlertCircle size={48} className="mx-auto mb-4 text-orange-500" />
              <h3 className="text-xl font-black mb-2">{alertModal.title}</h3>
              <p className="text-sm opacity-60 mb-6">{alertModal.message}</p>
              <button onClick={() => setAlertModal({...alertModal, show: false})} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Oke</button>
           </div>
        </div>
      )}

      {statusMessage && (
        <div className={`fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl text-white font-black text-[8px] uppercase z-[300] shadow-xl ${statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {statusMessage.msg}
        </div>
      )}

    </div>
  );
};

export default App;