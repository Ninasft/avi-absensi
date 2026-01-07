import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp, Sun, Moon, Megaphone, Activity, Users, Video, Calendar, Thermometer, Info, ChevronRight, LayoutDashboard, XCircle, AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save, RefreshCw, Trash2, Eye, MapPin, Tablet } from 'lucide-react';

// --- CONFIGURATION ---
let firebaseConfig = {};
try {
  firebaseConfig = JSON.parse(__firebase_config);
} catch (e) {
  console.error("Firebase config error:", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'avi-absensi-v1';

const App = () => {
  // --- STATE ---
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
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '' });
  const [isSyncing, setIsSyncing] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [showReasonModal, setShowReasonModal] = useState(null); 
  const [reasonText, setReasonText] = useState("");
  const [newPass, setNewPass] = useState("");

  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // Mapping Akses Pegawai
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

  // --- FIREBASE LOGIC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        setIsSyncing(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsSyncing(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Sync User Specific Configs (Passwords)
    const unsubConfigs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'user_configs'), (snap) => {
      const configs = {};
      snap.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    });

    // Sync Absensi Logs
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs'), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Sync Global Announcement
    const unsubAnnounce = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement_msg'), (d) => {
      if (d.exists()) setAnnouncement(d.data().text);
    });

    return () => { unsubConfigs(); unsubLogs(); unsubAnnounce(); };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- HANDLERS ---
  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = loginInput.username.toLowerCase().trim();
    const password = loginInput.password;
    const savedConfig = userConfigs[username];
    const correctPass = savedConfig ? savedConfig.password : defaultCredentials[username]?.pass;

    if (defaultCredentials[username] && password === correctPass) {
      const infoPegawai = daftarPegawai.find(p => p.id === username);
      const userData = { 
        nama: infoPegawai ? infoPegawai.nama : "Administrator", 
        role: defaultCredentials[username].role || 'pegawai',
        username: username,
        akses: infoPegawai ? infoPegawai.akses : ["Umum", "Live"]
      };
      setAppUser(userData);
      setAbsensiType(userData.akses[0]);
      setCurrentPage(userData.role === 'admin' ? 'history' : 'absen');
      showStatus(`Halo, ${userData.nama}`, "success");
    } else {
      showStatus("Username atau Password Salah", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (!user) return;
    const now = new Date();
    
    // Validasi Jam Kerja Sesi Umum
    if (absensiType === 'Umum' && action === 'Masuk' && now.getHours() < 8) {
      setAlertModal({ show: true, title: 'Terlalu Pagi', message: 'Sesi Umum hanya bisa dimulai setelah pukul 08:00 WIB.' });
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
      showStatus(`${action} ${absensiType} Berhasil`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showStatus("Gagal Koneksi ke Server", "error");
    }
  };

  // --- ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulanIndex === parseInt(filterMonth));
    const summary = {};

    daftarPegawai.forEach(p => {
      summary[p.nama] = { hadir: 0, izin: 0, sakit: 0, jamLive: 0, gajiLive: 0, statusHariIni: 'Off', clockIn: '--:--', clockOut: '--:--', liveStatus: 'Offline' };
    });

    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    sorted.forEach(log => {
      if (!summary[log.nama]) return;
      const logDateStr = new Date(log.timestamp).toLocaleDateString('id-ID');

      if (log.tipe === 'Umum') {
        if (log.aksi === 'Izin') summary[log.nama].izin++;
        if (log.aksi === 'Sakit') summary[log.nama].sakit++;
        if (log.aksi === 'Masuk') summary[log.nama].hadir++;
        if (logDateStr === todayStr) {
          summary[log.nama].statusHariIni = log.aksi;
          if (log.aksi === 'Masuk') summary[log.nama].clockIn = log.waktu;
          if (log.aksi === 'Pulang') summary[log.nama].clockOut = log.waktu;
        }
      }

      if (log.tipe === 'Live') {
        if (logDateStr === todayStr) summary[log.nama].liveStatus = log.aksi === 'Masuk' ? 'Streaming' : 'Selesai';
        if (log.aksi === 'Masuk') {
          const pair = filtered.find(l => l.nama === log.nama && l.tipe === 'Live' && l.aksi === 'Pulang' && l.timestamp > log.timestamp);
          if (pair) {
            const diff = (pair.timestamp - log.timestamp) / (1000 * 60 * 60);
            summary[log.nama].jamLive += diff;
            summary[log.nama].gajiLive += diff * UPAH_PER_JAM;
          }
        }
      }
    });
    return summary;
  }, [logs, filterMonth]);

  if (isSyncing) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-white/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Menyiapkan Workspace...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-all font-sans`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-indigo-950/95 text-white border-white/10'}`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg"><ShieldCheck size={24} /></div>
          <div><h1 className="text-lg font-black tracking-tight leading-none uppercase">AVI-ABSENSI</h1><p className="text-[8px] font-bold opacity-40 tracking-[0.2em] uppercase mt-1">Employee Management</p></div>
        </div>
        {appUser && (
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all">{darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}</button>
            <button onClick={() => setAppUser(null)} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><LogOut size={18} /></button>
          </div>
        )}
      </header>

      {!appUser ? (
        /* LOGIN */
        <div className="flex items-center justify-center min-h-[80vh] p-6">
          <div className={`w-full max-w-sm p-10 rounded-[3rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-2xl'}`}>
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/20"><Lock className="text-white" size={28} /></div>
              <h2 className="text-3xl font-black tracking-tighter italic uppercase">Identity</h2>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className="w-full px-8 py-4 rounded-2xl border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 font-bold transition-all" required />
              <input type="password" placeholder="Password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className="w-full px-8 py-4 rounded-2xl border-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 font-bold transition-all" required />
              <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all mt-4 uppercase tracking-widest text-sm">Authorize</button>
            </form>
          </div>
        </div>
      ) : (
        /* MAIN */
        <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 pb-32">
          {/* NAV BAR */}
          <div className="flex p-1.5 bg-slate-200/50 dark:bg-slate-900 rounded-2xl gap-1 sticky top-24 z-30 backdrop-blur-lg border border-white/5">
             <button onClick={() => setCurrentPage(appUser.role === 'admin' ? 'history' : 'absen')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${currentPage === (appUser.role === 'admin' ? 'history' : 'absen') ? 'bg-indigo-600 text-white shadow-lg' : 'opacity-40'}`}>
                {appUser.role === 'admin' ? <LayoutDashboard size={16} /> : <CheckCircle2 size={16} />} Dashboard
             </button>
             <button onClick={() => setCurrentPage('profile')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${currentPage === 'profile' ? 'bg-indigo-600 text-white shadow-lg' : 'opacity-40'}`}>
                <Settings size={16} /> Profil & Akses
             </button>
          </div>

          {currentPage === 'absen' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              {announcement && (
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-[2rem] text-white flex items-center gap-4 shadow-xl">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0"><Megaphone size={20} /></div>
                  <p className="text-sm font-bold leading-relaxed">{announcement}</p>
                </div>
              )}

              <div className={`p-10 md:p-16 rounded-[3rem] text-center border-2 ${darkMode ? 'bg-slate-900 border-indigo-500/20' : 'bg-white border-slate-100 shadow-xl'}`}>
                <h2 className="text-6xl md:text-8xl font-black text-indigo-500 tabular-nums tracking-tighter mb-4">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </h2>
                <div className="px-5 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest inline-block opacity-60">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-6">
                {appUser.akses.length > 1 && (
                  <div className="flex p-1.5 bg-slate-200 dark:bg-slate-800 rounded-2xl gap-1">
                    {appUser.akses.map(t => (
                      <button key={t} onClick={() => setAbsensiType(t)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${absensiType === t ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600' : 'opacity-40'}`}>{t}</button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleAbsen('Masuk')} className="h-40 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"><CheckCircle2 size={32} /><span className="font-black text-xs uppercase tracking-widest">Absen Masuk</span></button>
                  <button onClick={() => handleAbsen('Pulang')} className="h-40 bg-rose-600 hover:bg-rose-500 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"><Clock size={32} /><span className="font-black text-xs uppercase tracking-widest">Absen Pulang</span></button>
                  <button onClick={() => setShowReasonModal('Izin')} className="py-5 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"><Tablet size={16} /> Izin</button>
                  <button onClick={() => setShowReasonModal('Sakit')} className="py-5 bg-sky-500 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"><Thermometer size={16} /> Sakit</button>
                </div>
              </div>
            </div>
          )}

          {currentPage === 'history' && (
            <div className="space-y-12 animate-in slide-in-from-bottom-5">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">Monitoring</h2>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full md:w-48 p-3 bg-white dark:bg-slate-900 border-2 rounded-xl font-black text-xs outline-none">
                  {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                </select>
              </div>

              {/* SESI UMUM */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-xs tracking-[0.2em]"><Users size={18}/> Sesi Umum</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daftarPegawai.filter(p => p.akses.includes('Umum')).map(p => {
                    const s = stats[p.nama] || {};
                    return (
                      <div key={p.id} className={`p-6 rounded-[2rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}>
                        <div className="flex justify-between items-start mb-4">
                           <h4 className="text-xl font-black italic tracking-tight">{p.nama}</h4>
                           <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.statusHariIni === 'Masuk' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 opacity-40'}`}>{s.statusHariIni}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] font-bold opacity-60">
                           <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">Masuk: {s.clockIn}</div>
                           <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">Pulang: {s.clockOut}</div>
                        </div>
                        <div className="flex justify-between text-[10px] font-black border-t border-dashed pt-4 border-slate-200 dark:border-slate-800">
                           <span className="text-emerald-500">{s.hadir} Hadir</span>
                           <span className="text-amber-500">{s.izin} Izin</span>
                           <span className="text-sky-500">{s.sakit} Sakit</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SESI LIVE */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-500 font-black uppercase text-xs tracking-[0.2em]"><Video size={18}/> Sesi Live</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {daftarPegawai.filter(p => p.akses.includes('Live')).map(p => {
                     const s = stats[p.nama] || {};
                     return (
                       <div key={p.id} className={`p-8 rounded-[2.5rem] border-2 relative overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                         <div className="flex justify-between items-start mb-6">
                           <h4 className="text-2xl font-black italic">{p.nama}</h4>
                           <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${s.liveStatus === 'Streaming' ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 opacity-40'}`}>{s.liveStatus}</span>
                         </div>
                         <div className="p-6 bg-indigo-950 text-white rounded-[2rem] flex justify-between items-center">
                            <div><p className="text-[8px] font-black opacity-40 uppercase mb-1">Total Streaming</p><h5 className="text-2xl font-black">{s.jamLive?.toFixed(1)} <span className="text-xs opacity-30">Hrs</span></h5></div>
                            <div className="text-right"><p className="text-[8px] font-black opacity-40 uppercase mb-1">Gaji Live</p><h5 className="text-xl font-black text-emerald-400 tabular-nums">Rp {s.gajiLive?.toLocaleString('id-ID')}</h5></div>
                         </div>
                       </div>
                     )
                   })}
                </div>
              </div>
            </div>
          )}

          {currentPage === 'profile' && (
            <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-5">
               <div className={`p-8 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                  <h3 className="text-xl font-black italic mb-6 uppercase">Update Token Keamanan</h3>
                  <div className="flex gap-3">
                     <input type="password" placeholder="Min. 4 Karakter" value={newPass} onChange={e => setNewPass(e.target.value)} className="flex-1 p-4 rounded-xl border-2 dark:bg-slate-800 dark:border-slate-700 font-bold" />
                     <button onClick={async () => {
                        if(newPass.length < 4) return showStatus("Min. 4 Karakter", "error");
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_configs', appUser.username), { password: newPass }, { merge: true });
                        showStatus("Password Diperbarui", "success");
                        setNewPass("");
                     }} className="px-6 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">Save</button>
                  </div>
               </div>

               {appUser.role === 'admin' && (
                 <div className={`p-8 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                    <h3 className="text-xl font-black italic mb-6 uppercase">Pesan Pengumuman</h3>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} className="w-full h-32 p-4 rounded-xl border-2 dark:bg-slate-800 dark:border-slate-700 font-bold mb-4 text-sm" placeholder="Isi pesan..." />
                    <button onClick={async () => {
                       await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcement_msg'), { text: announcement }, { merge: true });
                       showStatus("Berhasil Dipublish", "success");
                    }} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-xs shadow-lg">Publish Sekarang</button>
                 </div>
               )}
            </div>
          )}
        </main>
      )}

      {/* MODAL REASON */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
           <div className={`w-full max-w-sm p-8 rounded-[2.5rem] ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'}`}>
              <h3 className="text-xl font-black italic mb-2 uppercase">Input {showReasonModal}</h3>
              <p className="text-[9px] font-black opacity-30 uppercase mb-6">Sesi: {absensiType}</p>
              <textarea autoFocus value={reasonText} onChange={e => setReasonText(e.target.value)} className="w-full h-32 p-4 rounded-xl border-2 dark:bg-slate-800 dark:border-slate-700 font-bold mb-6" placeholder="Mengapa?" />
              <div className="flex gap-4">
                 <button onClick={() => setShowReasonModal(null)} className="flex-1 py-3 font-black opacity-30 uppercase text-[10px]">Batal</button>
                 <button onClick={() => handleAbsen(showReasonModal, reasonText)} className="flex-2 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg px-8">Kirim</button>
              </div>
           </div>
        </div>
      )}

      {/* ALERT BOX */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] max-w-sm text-center">
             <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
             <h3 className="text-xl font-black mb-2 text-slate-900">{alertModal.title}</h3>
             <p className="text-xs font-bold opacity-50 mb-6 text-slate-800">{alertModal.message}</p>
             <button onClick={() => setAlertModal({...alertModal, show: false})} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs">MENGERTI</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {statusMessage && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[300] px-8 py-3 rounded-full text-white font-black text-[9px] uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-8 duration-300 ${statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {statusMessage.msg}
        </div>
      )}

    </div>
  );
};

export default App;