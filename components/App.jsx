import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download,
  AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp,
  Sun, Moon, Megaphone, Activity, Users, Video, Calendar,
  Thermometer, Info, ChevronRight, LayoutDashboard, XCircle,
  AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save,
  RefreshCw, Trash2, Eye, Inbox
} from 'lucide-react';

// NOTE: Import dari library eksternal diasumsikan sudah tersedia di environment Anda
// Jika menjalankan secara mandiri, pastikan ../lib/supabase.js sudah terkonfigurasi
import { 
  supabase, 
  getUserConfig, 
  setUserConfig,
  getAbsensiLogs,
  addAbsensiLog,
  getAnnouncement,
  setAnnouncement,
  getAdminLogs,
  addAdminLog,
  subscribeToAbsensiLogs,
  subscribeToSettings,
  subscribeToAdminLogs
} from '../lib/supabase';

const App = () => {
  // ============================================
  // STATES
  // ============================================
  const [appUser, setAppUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [currentPage, setCurrentPage] = useState('absen');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [absensiType, setAbsensiType] = useState('Umum');
  const [logs, setLogs] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [userConfigs, setUserConfigs] = useState({});
  const [announcement, setAnnouncementState] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'error' });
  const [isLoading, setIsLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [supabaseReady, setSupabaseReady] = useState(false);
  
  const [showReasonModal, setShowReasonModal] = useState(null); 
  const [reasonText, setReasonText] = useState("");
  const [newPass, setNewPass] = useState("");
  const [resetPassTarget, setResetPassTarget] = useState({ username: '', password: '' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('avi-absensi-darkmode');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // ============================================
  // CONSTANTS
  // ============================================
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

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avi-absensi-darkmode', JSON.stringify(darkMode));
      if (darkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { data, error } = await supabase.from('settings').select('key').limit(1);
        if (error) throw error;
        setSupabaseReady(true);
      } catch (err) {
        setSupabaseReady(false);
        setTimeout(checkSupabase, 2000);
      }
    };
    checkSupabase();
  }, []);

  useEffect(() => {
    if (!supabaseReady) return;
  
    const loadData = async () => {
      try {
        const allUsernames = [...daftarPegawai.map(p => p.id), 'admin'];
        const configPromises = allUsernames.map(u => getUserConfig(u));
        const configs = await Promise.all(configPromises);
        const configMap = {};
        configs.forEach((cfg, i) => { if (cfg) configMap[allUsernames[i]] = cfg; });
        setUserConfigs(configMap);
  
        setLogs(await getAbsensiLogs() || []);
        setAnnouncementState((await getAnnouncement())?.text || '');
        setAdminLogs(await getAdminLogs() || []);
      } catch (err) {
        console.error(err);
      }
    };
  
    loadData();
  
    const absensiChannel = subscribeToAbsensiLogs(async () => {
      setLogs(await getAbsensiLogs() || []);
    });
  
    const settingsChannel = subscribeToSettings(async () => {
      setAnnouncementState((await getAnnouncement())?.text || '');
    });
  
    const adminChannel = subscribeToAdminLogs(async () => {
      setAdminLogs(await getAdminLogs() || []);
    });
  
    return () => {
      supabase.removeChannel(absensiChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(adminChannel);
    };
  }, [supabaseReady]);  

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ============================================
  // HANDLERS & HELPERS
  // ============================================

  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertModal({ show: true, title, message, type });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = loginInput.username.toLowerCase().trim();
    const password = loginInput.password;

    if (!username || !password) {
      showStatus("Username dan password harus diisi", "error");
      return;
    }

    try {
      const savedConfig = await getUserConfig(username);
      const correctPass = savedConfig ? savedConfig.password : defaultCredentials[username]?.pass;

      if (defaultCredentials[username] && password === correctPass) {
        const userData = { 
          nama: username === 'admin' ? 'Administrator' : daftarPegawai.find(p => p.id === username)?.nama || username, 
          role: defaultCredentials[username].role || 'pegawai',
          username: username
        };
        setAppUser(userData);
        setCurrentPage(userData.role === 'admin' ? 'history' : 'absen');
        setLoginInput({ username: '', password: '' });
      } else {
        showStatus("Akses Ditolak: Periksa Username/Password", "error");
      }
    } catch (err) {
      showStatus("Error saat login, coba lagi", "error");
    }
  };

  const handleAbsen = async (action, note = "") => {
    if (isLoading || !supabaseReady) return;
    setIsLoading(true);

    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');
    
    // Check duplicate
    const duplicate = logs.find(l => 
      l.nama === appUser.nama && 
      l.tipe === absensiType && 
      l.aksi === action && 
      new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
    );

    if (duplicate) {
      showAlert("Sudah Terdaftar", `Anda sudah melakukan ${action} ${absensiType} hari ini.`, 'info');
      setIsLoading(false);
      return;
    }
    if (action === 'Pulang') {
      const hasMasuk = logs.some(l =>
        l.nama === appUser.nama &&
        l.tipe === absensiType &&
        l.aksi === 'Masuk' &&
        new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
      );
    
      if (!hasMasuk) {
        showAlert("Tidak Valid", "Anda belum Clock In hari ini.", "info");
        setIsLoading(false);
        return;
      }
    }
    

    try {
      await addAbsensiLog({
        nama: appUser.nama,
        tipe: absensiType,
        aksi: action,
        keterangan: note || "-",
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggal_display: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulan_index: now.getMonth(),
        timestamp: Date.now()
      });

      showStatus(`${action} ${absensiType} Berhasil`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      showAlert("Gagal Menyimpan", "Koneksi terputus.", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  const updatePassword = async (targetUsername = null, targetPass = null) => {
    const isSelf = !targetUsername;
    const finalUsername = isSelf ? appUser.username : targetUsername;
    const finalPass = isSelf ? newPass : targetPass;

    if (!finalPass || finalPass.trim().length < 4) {
      showAlert("Gagal", "Password minimal 4 karakter.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await setUserConfig(finalUsername, finalPass);
      if (!isSelf) await addAdminLog(appUser.nama, `Reset password user: ${finalUsername}`);
      showAlert("Berhasil", "Password telah diperbarui.", "success");
      setNewPass("");
      setResetPassTarget({ username: '', password: '' });
    } catch (error) {
      showAlert("Gagal", "Terjadi kesalahan server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const filtered = logs.filter(l => l.bulan_index === parseInt(filterMonth));
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
          if (log.aksi === 'Masuk') { 
            userSummary[log.nama].statusHariIni = 'Hadir'; 
            userSummary[log.nama].clockIn = log.waktu; 
          }
          if (log.aksi === 'Pulang') userSummary[log.nama].clockOut = log.waktu;
          if (['Izin', 'Sakit'].includes(log.aksi)) {
            userSummary[log.nama].statusHariIni = log.aksi;
            userSummary[log.nama].keteranganHariIni = log.keterangan;
          }
        }
      }

      if (log.tipe === 'Live' && log.aksi === 'Masuk') {
        const pair = logs.find(l => 
          l.nama === log.nama && l.tipe === 'Live' && l.aksi === 'Pulang' && 
          new Date(l.timestamp).toLocaleDateString('id-ID') === logDateStr && 
          l.timestamp > log.timestamp
        );
        if (pair) {
          const diff = (pair.timestamp - log.timestamp) / (1000 * 60 * 60);
          userSummary[log.nama].jamLive += diff;
          userSummary[log.nama].gajiLive += diff * UPAH_PER_JAM;
        }
      }
    });

    return userSummary;
  }, [logs, filterMonth, appUser]);

  const hasLiveAccess = useMemo(() => {
    if (!appUser) return false;
    const p = daftarPegawai.find(x => x.nama === appUser.nama);
    return p?.akses.includes('Live') || false;
  }, [appUser]);

  // ============================================
  // RENDER COMPONENTS
  // ============================================

  if (!appUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${darkMode ? 'bg-zinc-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-8 rounded-3xl shadow-2xl ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
          <div className="text-center mb-8">
            <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">AVI ABSENSI</h1>
            <p className="text-sm opacity-50">Silakan login untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase ml-1 opacity-50">Username</label>
              <input 
                type="text" 
                className={`w-full mt-1 p-4 rounded-2xl border-2 outline-none transition-all ${darkMode ? 'bg-zinc-800 border-zinc-700 focus:border-orange-500' : 'bg-slate-50 border-slate-100 focus:border-orange-500'}`}
                value={loginInput.username}
                onChange={e => setLoginInput({...loginInput, username: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase ml-1 opacity-50">Password</label>
              <input 
                type="password" 
                className={`w-full mt-1 p-4 rounded-2xl border-2 outline-none transition-all ${darkMode ? 'bg-zinc-800 border-zinc-700 focus:border-orange-500' : 'bg-slate-50 border-slate-100 focus:border-orange-500'}`}
                value={loginInput.password}
                onChange={e => setLoginInput({...loginInput, password: e.target.value})}
              />
            </div>
            <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold p-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-95">
              Masuk Sekarang
            </button>
          </form>

          <button onClick={() => setDarkMode(!darkMode)} className="mt-8 w-full flex items-center justify-center gap-2 text-xs font-bold opacity-40">
            {darkMode ? <Sun size={14}/> : <Moon size={14}/>} {darkMode ? 'MODE TERANG' : 'MODE GELAP'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* NAVBAR */}
      <nav className={`sticky top-0 z-40 backdrop-blur-md border-b ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-slate-100'}`}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Activity className="text-white" size={20} />
            </div>
            <div className="hidden sm:block">
              <h2 className="font-black text-lg leading-tight">AVI HUB</h2>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{appUser.role}</p>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl">
            {appUser.role !== 'admin' && (
              <button 
                onClick={() => setCurrentPage('absen')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === 'absen' ? 'bg-white dark:bg-zinc-700 shadow-sm text-orange-500' : 'opacity-50'}`}
              >
                ABSEN
              </button>
            )}
            <button 
              onClick={() => setCurrentPage('history')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === 'history' ? 'bg-white dark:bg-zinc-700 shadow-sm text-orange-500' : 'opacity-50'}`}
            >
              RIWAYAT
            </button>
            {appUser.role === 'admin' && (
              <button 
                onClick={() => setCurrentPage('settings')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === 'settings' ? 'bg-white dark:bg-zinc-700 shadow-sm text-orange-500' : 'opacity-50'}`}
              >
                SETTINGS
              </button>
            )}
          </div>

          <button onClick={() => setShowLogoutConfirm(true)} className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="max-w-6xl mx-auto p-6">
        {currentPage === 'absen' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* ANNOUNCEMENT */}
            {announcement && (
              <div className="bg-orange-500 text-white p-6 rounded-3xl shadow-xl shadow-orange-500/20 relative overflow-hidden group">
                <Megaphone size={80} className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2 text-xs font-black uppercase tracking-widest opacity-80">
                    <Info size={14} /> Informasi Penting
                  </div>
                  <p className="font-bold text-lg leading-relaxed">{announcement}</p>
                </div>
              </div>
            )}

            {/* CLOCK */}
            <div className={`p-10 rounded-[40px] text-center border shadow-2xl relative overflow-hidden ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-50'}`}>
              <div className="relative z-10">
                <h3 className="text-6xl sm:text-7xl font-black tracking-tighter tabular-nums mb-2">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  <span className="text-2xl opacity-20 ml-2">{currentTime.toLocaleTimeString('id-ID', { second: '2-digit' })}</span>
                </h3>
                <p className="text-sm font-bold opacity-40 uppercase tracking-[0.3em]">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className={`p-8 rounded-[40px] border shadow-xl ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-50'}`}>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl mb-8">
                <button 
                  onClick={() => setAbsensiType('Umum')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${absensiType === 'Umum' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'opacity-40'}`}
                >
                  UMUM
                </button>
                {hasLiveAccess && (
                  <button 
                    onClick={() => setAbsensiType('Live')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${absensiType === 'Live' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'opacity-40'}`}
                  >
                    LIVE SESSION
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isLoading}
                  onClick={() => handleAbsen('Masuk')}
                  className="group relative bg-emerald-500 hover:bg-emerald-600 p-8 rounded-3xl text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95 overflow-hidden"
                >
                  <CheckCircle2 size={100} className="absolute -left-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform" />
                  <div className="relative z-10 flex flex-col items-center">
                    <CheckCircle2 size={32} className="mb-2" />
                    <span className="font-black text-xs uppercase tracking-widest">Clock In</span>
                  </div>
                </button>
                <button 
                  disabled={isLoading}
                  onClick={() => handleAbsen('Pulang')}
                  className="group relative bg-rose-500 hover:bg-rose-600 p-8 rounded-3xl text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95 overflow-hidden"
                >
                  <Clock size={100} className="absolute -left-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform" />
                  <div className="relative z-10 flex flex-col items-center">
                    <Clock size={32} className="mb-2" />
                    <span className="font-black text-xs uppercase tracking-widest">Clock Out</span>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <button 
                  onClick={() => setShowReasonModal('Izin')}
                  className={`p-4 rounded-2xl border-2 font-bold text-xs uppercase transition-all ${darkMode ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  Izin
                </button>
                <button 
                  onClick={() => setShowReasonModal('Sakit')}
                  className={`p-4 rounded-2xl border-2 font-bold text-xs uppercase transition-all ${darkMode ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  Sakit
                </button>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800">
              <h2 className="text-xl font-black">Laporan Kehadiran</h2>
              <div className="flex gap-2">
                <select 
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className={`p-3 rounded-xl border-2 font-bold text-sm outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-100'}`}
                >
                  {daftarBulan.map((b, i) => <option key={i} value={i}>{b}</option>)}
                </select>
                {appUser.role === 'admin' && (
                  <button className="bg-orange-500 text-white p-3 rounded-xl shadow-lg shadow-orange-500/20">
                    <Download size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(stats).map(([nama, data]) => (
                <div key={nama} className={`p-6 rounded-[32px] border shadow-sm ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-black">
                        {nama.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black leading-tight">{nama}</h4>
                        <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                          data.statusHariIni === 'Hadir' ? 'bg-emerald-500/10 text-emerald-500' :
                          data.statusHariIni === 'Belum Absen' ? 'bg-slate-500/10 text-slate-500' : 'bg-orange-500/10 text-orange-500'
                        }`}>
                          {data.statusHariIni}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold opacity-40 uppercase">Gaji Live</p>
                      <p className="font-black text-orange-500">Rp {data.gajiLive.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-6">
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl text-center">
                      <p className="text-[10px] font-bold opacity-40">Hadir</p>
                      <p className="font-black text-lg">{data.hadir}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl text-center">
                      <p className="text-[10px] font-bold opacity-40">Izin</p>
                      <p className="font-black text-lg">{data.izin}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl text-center">
                      <p className="text-[10px] font-bold opacity-40">Sakit</p>
                      <p className="font-black text-lg">{data.sakit}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl text-center">
                      <p className="text-[10px] font-bold opacity-40">Jam</p>
                      <p className="font-black text-lg">{data.jamLive.toFixed(1)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.logs.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border dark:border-zinc-800/50 text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.aksi === 'Masuk' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span className="font-bold opacity-50">{log.waktu}</span>
                          <span className="font-black">{log.aksi} {log.tipe}</span>
                        </div>
                        <span className="opacity-40 font-bold italic">{new Date(log.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className={`p-8 rounded-[40px] border shadow-xl ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-3 mb-6">
                <Megaphone className="text-orange-500" />
                <h3 className="text-lg font-black italic tracking-tight">KONTROL PENGUMUMAN</h3>
              </div>
              <textarea 
                value={announcement}
                onChange={e => setAnnouncementState(e.target.value)}
                placeholder="Tulis pengumuman di sini..."
                className={`w-full p-6 rounded-3xl border-2 h-32 outline-none transition-all resize-none font-bold ${darkMode ? 'bg-zinc-800 border-zinc-700 focus:border-orange-500' : 'bg-slate-50 border-slate-100 focus:border-orange-500'}`}
              />
              <div className="flex gap-3 mt-4">
                <button 
                onClick={async () => {
                await setAnnouncement(announcement, appUser.nama);
                await addAdminLog(appUser.nama, "Update pengumuman");
                showStatus("Pengumuman diperbarui", "success");
              }}
                  className="flex-1 bg-orange-500 text-white font-black p-4 rounded-2xl shadow-lg active:scale-95"
                >
                  Publish Info
                </button>
                <button 
                  onClick={async () => {
                    await setAnnouncement("", appUser.nama);
                    await addAdminLog(appUser.nama, "Hapus pengumuman");
                    setAnnouncementState("");
                    showStatus("Pengumuman dihapus", "success");
                  }}

                  className="p-4 rounded-2xl border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 font-black"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className={`p-8 rounded-[40px] border shadow-xl ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-3 mb-6">
                <Key className="text-orange-500" />
                <h3 className="text-lg font-black italic tracking-tight">MANAGEMENT AKSES</h3>
              </div>
              <div className="space-y-3">
                {daftarPegawai.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-xl flex items-center justify-center font-black">
                        {p.nama.charAt(0)}
                      </div>
                      <span className="font-bold">{p.nama}</span>
                    </div>
                    <button 
                      onClick={() => setResetPassTarget({ username: p.id, password: '' })}
                      className="text-[10px] font-black uppercase text-orange-500 px-4 py-2 bg-orange-500/10 rounded-xl hover:bg-orange-500/20"
                    >
                      Reset Password
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: RESET PASSWORD */}
      {resetPassTarget.username && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/20">
          <div className={`w-full max-w-sm p-8 rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
            <h3 className="text-lg font-black mb-4">Reset Password {resetPassTarget.username}</h3>
            <input 
              type="text" 
              placeholder="Password baru..."
              className={`w-full p-4 rounded-2xl border-2 mb-4 outline-none font-bold ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-100'}`}
              onChange={e => setResetPassTarget({...resetPassTarget, password: e.target.value})}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setResetPassTarget({ username: '', password: '' })}
                className="flex-1 p-4 rounded-2xl font-bold opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={() => updatePassword(resetPassTarget.username, resetPassTarget.password)}
                className="flex-1 bg-orange-500 text-white font-black p-4 rounded-2xl shadow-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40">
          <div className={`w-full max-w-sm p-8 rounded-[40px] text-center shadow-2xl animate-in fade-in zoom-in-90 ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
            <div className="bg-rose-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
              <LogOut size={40} />
            </div>
            <h3 className="text-xl font-black mb-2">Yakin Ingin Keluar?</h3>
            <p className="text-sm opacity-50 mb-8 font-bold">Anda perlu login kembali untuk mengakses sistem absensi.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 p-4 rounded-2xl font-bold opacity-50">Stay</button>
              <button onClick={() => setAppUser(null)} className="flex-1 bg-rose-500 text-white font-black p-4 rounded-2xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all">Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS TOAST */}
      {statusMessage && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 ${
          statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm tracking-tight">{statusMessage.msg}</span>
        </div>
      )}

      {/* MODAL: REASON (IZIN/SAKIT) */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
          <div className={`w-full max-w-md p-8 rounded-[40px] shadow-2xl ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/10 p-3 rounded-2xl text-orange-500">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-black italic">FORM {showReasonModal.toUpperCase()}</h3>
            </div>
            <p className="text-sm font-bold opacity-40 mb-4">Mohon berikan alasan singkat mengapa Anda mengajukan {showReasonModal}.</p>
            <textarea 
              autoFocus
              className={`w-full p-6 rounded-3xl border-2 h-32 outline-none font-bold transition-all mb-6 ${darkMode ? 'bg-zinc-800 border-zinc-700 focus:border-orange-500' : 'bg-slate-50 border-slate-100 focus:border-orange-500'}`}
              placeholder="Contoh: Mengantar orang tua ke rumah sakit..."
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowReasonModal(null)} className="flex-1 p-4 rounded-2xl font-bold opacity-40 uppercase text-xs">Batal</button>
              <button 
                onClick={() => handleAbsen(showReasonModal, reasonText)}
                className="flex-1 bg-orange-500 text-white font-black p-4 rounded-2xl shadow-lg shadow-orange-500/20 text-xs uppercase"
              >
                Kirim Laporan
              </button>
            </div>
          </div>
        </div>
      )}
      {alertModal.show && (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
    <div className={`w-full max-w-sm p-8 rounded-[32px] shadow-2xl ${
      darkMode ? 'bg-zinc-900' : 'bg-white'
    }`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto ${
        alertModal.type === 'success'
          ? 'bg-emerald-500/10 text-emerald-500'
          : alertModal.type === 'info'
          ? 'bg-orange-500/10 text-orange-500'
          : 'bg-rose-500/10 text-rose-500'
      }`}>
        {alertModal.type === 'success'
          ? <CheckCircle2 size={32}/>
          : alertModal.type === 'info'
          ? <Info size={32}/>
          : <AlertTriangle size={32}/>}
      </div>

      <h3 className="text-lg font-black text-center mb-2">
        {alertModal.title}
      </h3>
      <p className="text-sm text-center opacity-60 font-bold mb-6">
        {alertModal.message}
      </p>

      <button
        onClick={() => setAlertModal({ ...alertModal, show: false })}
        className="w-full bg-orange-500 text-white font-black p-4 rounded-2xl"
      >
        OK
      </button>
    </div>
  </div>
)}
    </div>
  );
};

export default App;