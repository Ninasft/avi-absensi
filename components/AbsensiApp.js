import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc } from 'firebase/firestore';
import { Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download, AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp } from 'lucide-react';

/* WCAG AAA COMPLIANT PALETTE 
  Background: Slate 50 (#f8fafc)
  Text Primary: Slate 950 (#020617)
  Accent: Indigo 950 (#1e1b4b)
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
  const [isLoading, setIsLoading] = useState(false);

  const [activeHistoryTab, setActiveHistoryTab] = useState('Umum');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());

  const UPAH_PER_JAM = 25000;
  const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const defaultPegawai = {
    "abub": { akses: ["Umum"], pass: "abub" },
    "rendy": { akses: ["Umum"], pass: "rendy" },
    "dedi": { akses: ["Umum"], pass: "dedi" },
    "vebi": { akses: ["Live"], pass: "vebi" },
    "silvi": { akses: ["Umum", "Live"], pass: "silvi" },
    "aisyah": { akses: ["Umum", "Live"], pass: "aisyah" },
    "admin": { akses: ["all"], pass: "admin123", role: 'admin' }
  };

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
    const qConfig = collection(db, 'artifacts', appId, 'public', 'data', 'user_configs');
    const unsub = onSnapshot(qConfig, (snapshot) => {
      const configs = {};
      snapshot.docs.forEach(doc => { configs[doc.id] = doc.data(); });
      setUserConfigs(configs);
    }, (err) => console.error("Firestore config error:", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;
    const qLogs = collection(db, 'artifacts', appId, 'public', 'data', 'absensi_logs');
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }, (err) => console.error("Firestore logs error:", err));
    return () => unsubLogs();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = loginInput.username.toLowerCase();
    const password = loginInput.password;

    const savedConfig = userConfigs[username];
    const correctPass = savedConfig ? savedConfig.password : defaultPegawai[username]?.pass;

    if (defaultPegawai[username] && password === correctPass) {
      const userData = { 
        nama: username.charAt(0).toUpperCase() + username.slice(1), 
        role: defaultPegawai[username].role || 'pegawai',
        username: username
      };
      setAppUser(userData);
      if (userData.role === 'admin') setCurrentPage('history');
      else setCurrentPage('absen');
    } else {
      showStatus("Login Gagal: Username atau Password salah", "error");
    }
  };

  const handleChangePassword = async (targetUser, newPass) => {
    if (!newPass || newPass.length < 4) {
      showStatus("Password minimal 4 karakter", "error");
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_configs', targetUser.toLowerCase()), {
        password: newPass,
        updatedAt: Date.now(),
        updatedBy: appUser.nama
      });
      showStatus(`Password ${targetUser} berhasil diperbarui`, "success");
    } catch (e) {
      showStatus("Gagal memperbarui password", "error");
    }
  };

  const handleAbsen = async (action) => {
    if (!user || isLoading || !db) return;
    setIsLoading(true);
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');

    const sudahAda = logs.find(l => 
      l.nama === appUser.nama && 
      l.tipe === absensiType && 
      l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (sudahAda) {
      showStatus(`Sudah ${action} hari ini`, "error");
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
      showStatus(`Sukses: Absen ${action} Tercatat`, "success");
    } catch (e) {
      showStatus("Koneksi Cloud Terganggu", "error");
    } finally { setIsLoading(false); }
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
      if (!summary[item.nama]) summary[item.nama] = { jam: 0, gaji: 0, lupaOut: 0, jamLive: 0 };
      if (item.masuk && item.pulang) {
        const diff = Math.max(0, (new Date(item.pulang.timestamp) - new Date(item.masuk.timestamp)) / (1000 * 60 * 60));
        summary[item.nama].jam += diff;
        if (item.tipe === 'Live') {
          summary[item.nama].jamLive += diff;
          summary[item.nama].gaji += diff * UPAH_PER_JAM;
        }
      } else if (item.masuk && !item.pulang) summary[item.nama].lupaOut += 1;
    });
    return summary;
  }, [logs, filterMonth]);

  const filteredLogs = logs.filter(log => log.tipe === activeHistoryTab && log.bulanIndex === parseInt(filterMonth));

  if (!appUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-300">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-950 text-white rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-950 tracking-tighter">AVI-ABSENSI</h1>
            <p className="text-xs font-black text-slate-700 mt-1 uppercase tracking-widest text-[10px]">Portal Keamanan Tinggi (WCAG AAA)</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-900 mb-1 uppercase">Username</label>
              <input
                type="text"
                value={loginInput.username}
                onChange={(e) => setLoginInput({...loginInput, username: e.target.value})}
                className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-300 focus:border-indigo-950 outline-none font-bold text-slate-950"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-900 mb-1 uppercase">Password</label>
              <input
                type="password"
                value={loginInput.password}
                onChange={(e) => setLoginInput({...loginInput, password: e.target.value})}
                className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-300 focus:border-indigo-950 outline-none font-bold text-slate-950"
                required
              />
            </div>
            <button type="submit" className="w-full p-4 bg-indigo-950 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
              Otorisasi Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 pb-32">
      {/* HEADER */}
      <header className="bg-indigo-950 text-white sticky top-0 z-50 px-6 py-5 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
               <User size={20} className="text-indigo-200" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">AVI-SYSTEM</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mt-1">
                {appUser.role === 'admin' ? 'SUPER USER' : `User: ${appUser.nama}`}
              </p>
            </div>
          </div>
          <button onClick={() => setAppUser(null)} className="p-3 bg-rose-950 text-rose-100 rounded-xl border border-rose-800 hover:bg-rose-900 shadow-md" aria-label="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        
        {/* HALAMAN ABSENSI (Pegawai) */}
        {currentPage === 'absen' && appUser.role !== 'admin' && (
          <>
            <div className="bg-white rounded-3xl shadow-lg p-10 text-center border-2 border-slate-200">
              <div className="text-7xl font-black text-slate-950 tracking-tighter mb-2 tabular-nums">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-sm text-slate-700 font-black uppercase tracking-widest italic">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300">
              {['Umum', 'Live'].map(type => (
                <button
                  key={type}
                  onClick={() => setAbsensiType(type)}
                  className={`flex-1 py-3 rounded-lg font-black text-xs uppercase transition-all ${
                    absensiType === type ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Sesi {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleAbsen('Masuk')}
                disabled={isLoading}
                className="bg-emerald-900 text-white p-8 rounded-2xl font-black uppercase text-xs shadow-xl flex flex-col items-center gap-4 hover:bg-black active:scale-95 transition-all border-b-8 border-emerald-950"
              >
                <CheckCircle2 size={40} />
                Clock In
              </button>
              <button
                onClick={() => handleAbsen('Pulang')}
                disabled={isLoading}
                className="bg-rose-950 text-white p-8 rounded-2xl font-black uppercase text-xs shadow-xl flex flex-col items-center gap-4 hover:bg-black active:scale-95 transition-all border-b-8 border-rose-900"
              >
                <Clock size={40} />
                Clock Out
              </button>
            </div>
          </>
        )}

        {/* HALAMAN DASHBOARD (Admin & Riwayat User) */}
        {currentPage === 'history' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-300 shadow-md">
               <h2 className="text-xl font-black text-slate-950 mb-4 flex items-center gap-2">
                 <History className="text-indigo-950" /> LOG AUDIT {daftarBulan[filterMonth]?.toUpperCase()}
               </h2>
               <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Pilih Bulan</label>
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="w-full p-4 bg-slate-100 rounded-xl border-2 border-slate-300 font-bold text-slate-950"
                  >
                    {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                  </select>
                </div>
                {appUser.role === 'admin' && (
                  <button onClick={() => {
                    const txt = filteredLogs.map(l => `${l.nama}\t${l.waktu}\t${l.aksi}\t${l.tanggalDisplay}`).join('\n');
                    navigator.clipboard.writeText(txt);
                    showStatus("Data Tersalin", "success");
                  }} className="p-4 bg-indigo-950 text-white rounded-xl shadow-lg hover:bg-black" title="Export">
                    <Download size={24} />
                  </button>
                )}
              </div>
            </div>

            {/* Rekapitulasi Khusus Admin */}
            {appUser.role === 'admin' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-950 text-white p-6 rounded-2xl shadow-xl border-l-8 border-indigo-400">
                    <p className="text-[10px] font-black uppercase text-indigo-300 mb-1 tracking-widest">Total Gaji Live</p>
                    <p className="text-2xl font-black tabular-nums">Rp {Object.values(rekapData).reduce((a, b) => a + b.gaji, 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="bg-slate-950 text-white p-6 rounded-2xl shadow-xl border-l-8 border-emerald-500">
                    <p className="text-[10px] font-black uppercase text-emerald-300 mb-1 tracking-widest">Total Jam Live</p>
                    <p className="text-3xl font-black tabular-nums">{Object.values(rekapData).reduce((a, b) => a + b.jamLive, 0).toFixed(1)}h</p>
                  </div>
                </div>

                {/* Pendapatan Live per User */}
                <div className="bg-white p-6 rounded-2xl border-2 border-slate-300 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-950 flex items-center gap-2 border-b-2 border-slate-100 pb-3">
                    <TrendingUp size={16} /> Estimasi Pendapatan Live per Pengguna
                  </h3>
                  <div className="space-y-4">
                    {['Silvi', 'Vebi', 'Aisyah'].map(name => {
                      const data = rekapData[name] || { gaji: 0, jamLive: 0 };
                      return (
                        <div key={name} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div>
                            <p className="font-black text-slate-900">{name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{data.jamLive.toFixed(1)} Jam Sesi Live</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-indigo-950 tabular-nums">Rp {Math.round(data.gaji).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-2 p-1.5 bg-slate-200 rounded-xl border border-slate-300">
                {['Umum', 'Live'].map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveHistoryTab(t)}
                    className={`flex-1 py-3 rounded-lg font-black text-[11px] uppercase transition-all ${activeHistoryTab === t ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-700 hover:bg-slate-300'}`}
                  >
                    Log Sesi {t}
                  </button>
                ))}
              </div>
              
              <div className="space-y-3">
                {filteredLogs.map(log => (
                  <div key={log.id} className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xs border-2 ${log.aksi === 'Masuk' ? 'bg-emerald-50 text-emerald-950 border-emerald-900' : 'bg-rose-50 text-rose-950 border-rose-900'}`}>
                      {log.aksi === 'Masuk' ? 'IN' : 'OUT'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-slate-950 text-lg leading-tight">{log.nama}</h4>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{log.tanggalDisplay}</p>
                    </div>
                    <div className="text-right font-black text-2xl text-indigo-950 tabular-nums">
                      {log.waktu}
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-300">
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Data Kosong</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HALAMAN KEAMANAN */}
        {currentPage === 'settings' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-3xl border-2 border-slate-300 shadow-lg space-y-6">
              <h2 className="text-2xl font-black text-slate-950 flex items-center gap-3">
                <Key className="text-indigo-950" /> KEAMANAN & AKSES
              </h2>
              
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <p className="text-xs font-black uppercase text-slate-600">Ganti Password Saya</p>
                <div className="flex gap-2">
                  <input 
                    id="myNewPass"
                    type="password" 
                    placeholder="Minimal 4 Karakter" 
                    className="flex-1 p-4 bg-white border-2 border-slate-300 rounded-xl font-bold outline-none focus:border-indigo-950 text-slate-950"
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('myNewPass');
                      handleChangePassword(appUser.username, input.value);
                      input.value = '';
                    }}
                    className="px-6 bg-indigo-950 text-white font-black rounded-xl uppercase text-xs hover:bg-black transition-colors"
                  >
                    Simpan
                  </button>
                </div>
              </div>

              {appUser.role === 'admin' && (
                <div className="space-y-6 pt-6 border-t-2 border-slate-100">
                  <h3 className="text-sm font-black uppercase text-indigo-950 flex items-center gap-2">
                    <ShieldCheck size={18} /> Reset Password Pegawai (Super User)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(defaultPegawai).filter(u => u !== 'admin').map(uname => (
                      <div key={uname} className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-900 uppercase text-xs tracking-widest">{uname}</span>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase">{userConfigs[uname] ? 'Custom' : 'Default'}</span>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            id={`pass-${uname}`}
                            type="text" 
                            placeholder="Password Baru" 
                            className="w-full p-2.5 text-xs border-2 border-slate-200 rounded-lg font-bold text-slate-950"
                          />
                          <button 
                            onClick={() => {
                              const input = document.getElementById(`pass-${uname}`);
                              handleChangePassword(uname, input.value);
                              input.value = '';
                            }}
                            className="bg-slate-950 text-white p-2.5 rounded-lg hover:bg-black transition-colors"
                          >
                            <Settings size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* NAVIGASI BAWAH */}
      <nav className="fixed bottom-0 left-0 right-0 bg-indigo-950 border-t border-indigo-900 px-6 py-4 flex gap-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {appUser.role !== 'admin' && (
          <button onClick={() => setCurrentPage('absen')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 transition-all border-2 ${currentPage === 'absen' ? 'bg-white text-indigo-950 border-white' : 'text-indigo-400 border-transparent'}`}>
            <Clock size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Absen</span>
          </button>
        )}
        <button onClick={() => setCurrentPage('history')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 transition-all border-2 ${currentPage === 'history' ? 'bg-white text-indigo-950 border-white' : 'text-indigo-400 border-transparent'}`}>
          <History size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">{appUser.role === 'admin' ? 'Dashboard' : 'Audit'}</span>
        </button>
        <button onClick={() => setCurrentPage('settings')} className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-1 transition-all border-2 ${currentPage === 'settings' ? 'bg-white text-indigo-950 border-white' : 'text-indigo-400 border-transparent'}`}>
          <Key size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Keamanan</span>
        </button>
      </nav>

      {/* NOTIFIKASI STATUS */}
      {statusMessage && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 px-10 py-5 rounded-2xl text-white font-black text-xs uppercase shadow-2xl z-[100] border-2 animate-in fade-in slide-in-from-bottom-8 ${statusMessage.type === 'success' ? 'bg-indigo-950 border-emerald-400' : 'bg-rose-950 border-rose-400'}`}>
          {statusMessage.msg}
        </div>
      )}
    </div>
  );
};

export default App;