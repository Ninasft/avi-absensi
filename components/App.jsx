import React, { useState, useEffect, useMemo } from 'react';
import { 
  supabase, 
  loginUser, // <--- TAMBAHKAN INI
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
import {
  Clock, CheckCircle2, LogOut, History, Wallet, Cloud, Download,
  AlertTriangle, Settings, Key, User, ShieldCheck, TrendingUp,
  Sun, Moon, Megaphone, Activity, Users, Video, Calendar,
  Thermometer, Info, ChevronRight, LayoutDashboard, XCircle,
  AlertCircle, FileText, Lock, MessageSquare, ListFilter, Save,
  RefreshCw, Trash2, Eye, Inbox
} from 'lucide-react';

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
  const [announcement, setAnnouncement] = useState("");
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

  // Persist dark mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avi-absensi-darkmode', JSON.stringify(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  // Favicon & Title
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
      link.rel = 'icon';
      link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%23f97316%22/><text y=%22.9em%22 font-size=%2270%22 font-weight=%22bold%22 font-family=%22Arial%22 fill=%22white%22 x=%2250%%22 text-anchor=%22middle%22>A</text></svg>`;
      if (!document.querySelector("link[rel~='icon']")) {
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  }, []);

  // Check Supabase connection
  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { data, error } = await supabase.from('settings').select('key').limit(1);
        if (error) throw error;
        console.log('✅ Supabase connected!');
        setSupabaseReady(true);
      } catch (err) {
        console.error('❌ Supabase connection failed:', err);
        setSupabaseReady(false);
        setTimeout(checkSupabase, 2000);
      }
    };
    checkSupabase();
  }, []);

  // Load data & setup realtime
  useEffect(() => {
    if (!supabaseReady) return;

    const loadData = async () => {
      try {
        console.log('📡 Loading data from Supabase...');

        // Load user configs
        const allUsernames = [...daftarPegawai.map(p => p.id), 'admin'];
        const configPromises = allUsernames.map(u => getUserConfig(u));
        const configs = await Promise.all(configPromises);
        
        const configMap = {};
        configs.forEach((cfg, i) => {
          if (cfg) configMap[allUsernames[i]] = cfg;
        });
        setUserConfigs(configMap);

        // Load logs
        const logs = await getAbsensiLogs();
        setLogs(logs || []);

        // Load announcement
        const announcementData = await getAnnouncement();
        setAnnouncement(announcementData?.text || '');

        // Load admin logs
        const adminLogs = await getAdminLogs();
        setAdminLogs(adminLogs || []);

        console.log('✅ All data loaded successfully!');
      } catch (err) {
        console.error('❌ Error loading data:', err);
      }
    };

    loadData();

    // Setup realtime subscriptions
    const absensiChannel = subscribeToAbsensiLogs(async () => {
      console.log('🔄 Absensi logs updated');
      const logs = await getAbsensiLogs();
      setLogs(logs || []);
    });

    const settingsChannel = subscribeToSettings(async () => {
      console.log('🔄 Settings updated');
      const announcementData = await getAnnouncement();
      setAnnouncement(announcementData?.text || '');
    });

    const adminLogsChannel = subscribeToAdminLogs(async () => {
      console.log('🔄 Admin logs updated');
      const adminLogs = await getAdminLogs();
      setAdminLogs(adminLogs || []);
    });

    return () => {
      console.log('🔌 Cleaning up subscriptions...');
      supabase.removeChannel(absensiChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(adminLogsChannel);
    };
  }, [supabaseReady]);

  useEffect(() => {
    const savedUser = localStorage.getItem('absensi_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setAppUser(parsedUser);
      
      // Set default tab sesuai izin
      if (!parsedUser.bisa_umum && parsedUser.bisa_live) {
        setAbsensiType('Live');
      }
    }
  }, []);
  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const showStatus = (msg, type) => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertModal({ show: true, title, message, type });
  };

  // ============================================
  // HANDLERS
  // ============================================
  const handleAbsen = async (action, note = "-") => {
    setIsLoading(true);
    try {
      const now = new Date();
      const logData = {
        nama: appUser.nama, // Ambil dari database
        tipe: absensiType, // Penting: Umum atau Live
        aksi: action,
        keterangan: note,
        waktu: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggal_display: now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        bulan_index: now.getMonth(),
        timestamp: now.getTime()
      };
  
      await addAbsensiLog(logData);
      showStatus(`Berhasil ${action} (${absensiType})`, "success");
      
      // Tutup modal alasan jika ada
      setShowReasonModal(null);
      setReasonText("");
    } catch (err) {
      showAlert("Gagal Absen", "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
  
    try {
      // Memanggil loginUser yang sudah kita buat di lib/supabase.js
      const user = await loginUser(loginInput.username, loginInput.password);
  
      if (user) {
        // User sekarang berisi: username, nama, role, bisa_umum, bisa_live
        setAppUser(user);
        
        // Simpan ke browser agar tidak perlu login ulang saat refresh
        localStorage.setItem('absensi_user', JSON.stringify(user));
        
        // Jika user HANYA bisa Live, otomatis arahkan tipe absen ke Live
        if (!user.bisa_umum && user.bisa_live) {
          setAbsensiType('Live');
        }
  
        showStatus(`Selamat datang, ${user.nama}!`, "success");
      } else {
        showAlert("Login Gagal", "Username atau password salah.", "error");
      }
    } catch (err) {
      console.error("Auth error:", err);
      showAlert("Error", "Gagal menghubungkan ke server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (targetUsername = null, targetPass = null) => {
    const isSelf = !targetUsername;
    const finalUsername = isSelf ? appUser.username : targetUsername;
    const finalPass = isSelf ? newPass : targetPass;

    if (!finalUsername) {
      showAlert("Gagal Memperbarui", "Silakan pilih pegawai terlebih dahulu.", "error");
      return;
    }

    if (!finalPass || finalPass.trim() === "") {
      showAlert("Gagal Memperbarui", "Password tidak boleh kosong.", "error");
      return;
    }

    if (finalPass.length < 4) {
      showAlert("Gagal Memperbarui", "Password minimal harus 4 karakter untuk keamanan.", "error");
      return;
    }

    setIsLoading(true);

    try {
      await setUserConfig(finalUsername, finalPass);

      if (!isSelf) {
        await addAdminLog(appUser.nama, `Reset password user: ${finalUsername}`);
      }

      if (isSelf) {
        showAlert("Password Berhasil Diperbarui! ✓", `Password Anda telah berhasil diubah. Silakan gunakan password baru untuk login berikutnya.`, "success");
        setNewPass("");
      } else {
        showAlert("Reset Password Berhasil! ✓", `Password untuk ${finalUsername} telah berhasil direset. User dapat login dengan password baru.`, "success");
        setResetPassTarget({ username: '', password: '' });
      }

    } catch (error) {
      console.error("Password update error:", error);
      
      let errorMessage = "Terjadi kesalahan saat memperbarui password. ";
      
      if (error.code === 'permission-denied') {
        errorMessage += "Anda tidak memiliki izin untuk melakukan aksi ini.";
      } else if (error.code === 'unavailable') {
        errorMessage += "Koneksi ke server terputus. Periksa koneksi internet Anda.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Silakan coba lagi dalam beberapa saat.";
      }

      showAlert("Gagal Memperbarui Password", errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnnouncement = async () => {
    if (!announcement || announcement.trim() === "") {
      showAlert("Pengumuman Kosong", "Silakan tulis pengumuman terlebih dahulu atau hapus pengumuman lama.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      await setAnnouncement(announcement.trim(), appUser.nama);
      await addAdminLog(appUser.nama, `Memperbarui pengumuman`);
      showStatus("Pengumuman berhasil diperbarui", "success");
    } catch (e) {
      console.error("Announcement save error:", e);
      showAlert("Gagal Menyimpan", "Tidak dapat menyimpan pengumuman. Periksa koneksi Anda.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const clearAnnouncement = async () => {
    setIsLoading(true);
    try {
      await setAnnouncement("", appUser.nama);
      await addAdminLog(appUser.nama, `Menghapus pengumuman`);
      setAnnouncement("");
      showStatus("Pengumuman berhasil dihapus", "success");
    } catch (e) {
      console.error("Announcement clear error:", e);
      showAlert("Gagal Menghapus", "Tidak dapat menghapus pengumuman.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setAppUser(null);
    setShowLogoutConfirm(false);
    setCurrentPage('absen');
    showStatus("Berhasil keluar dari sistem", "success");
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
          if (log.aksi === 'Pulang') { 
            userSummary[log.nama].clockOut = log.waktu; 
          }
          if (log.aksi === 'Izin' || log.aksi === 'Sakit') {
            userSummary[log.nama].statusHariIni = log.aksi;
            userSummary[log.nama].keteranganHariIni = log.keterangan;
          }
        }
      }

      if (log.tipe === 'Live' && log.aksi === 'Masuk') {
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
    });

    return userSummary;
  }, [logs, filterMonth, appUser]);

  const totalGajiLiveSemua = Object.values(stats).reduce((a, b) => a + b.gajiLive, 0);

  const hasLiveAccess = useMemo(() => {
    if (!appUser) return false;
    const pegawai = daftarPegawai.find(p => p.nama === appUser.nama);
    return pegawai?.akses.includes('Live') || false;
  }, [appUser]);

  const todayStatus = useMemo(() => {
    if (!appUser) return { hasClockIn: false, hasClockOut: false };
    
    const today = new Date().toLocaleDateString('id-ID');
    
    // PERBAIKAN: Tambahkan filter log.tipe === absensiType
    const userLogsToday = logs.filter(log => 
      log.nama === appUser?.nama && 
      log.tipe === absensiType && // Memisahkan pengecekan antara Umum dan Live
      new Date(log.timestamp).toLocaleDateString('id-ID') === today
    );

    const hasClockIn = userLogsToday.some(log => log.aksi === 'Masuk');
    const hasClockOut = userLogsToday.some(log => log.aksi === 'Pulang');

    return { hasClockIn, hasClockOut };
    
    // PENTING: Tambahkan absensiType di dalam array ini agar status dihitung ulang saat pindah tab
  }, [logs, appUser, absensiType]);
  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-24 md:pb-0`}>
      
      {/* SUPABASE LOADING STATE */}
      {!supabaseReady && !appUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-lg">
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-4xl mx-auto mb-6 shadow-xl shadow-orange-500/20 animate-pulse">A</div>
            <h2 className="text-2xl font-black text-white mb-2">Memuat Sistem...</h2>
            <p className="text-sm text-white/60">Menghubungkan ke database</p>
            <div className="mt-6 flex gap-2 justify-center">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`sticky top-0 z-40 w-full px-4 md:px-8 py-4 shadow-lg flex items-center justify-between border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-950 text-white border-transparent'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 transform hover:scale-110 transition-transform">
             <div className="text-white font-black text-xl w-6 h-6 flex items-center justify-center">A</div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-black uppercase tracking-tight leading-none">AVI-ABSENSI <span className="text-[10px] text-orange-400 font-bold ml-1">PRO</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest hidden md:block">Avicenna Ultimate Management</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${supabaseReady ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                <span className="text-[8px] font-bold uppercase tracking-wider">{supabaseReady ? 'Online' : 'Offline'}</span>
              </div>
            </div>
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
            <button onClick={handleLogout} className="p-2.5 bg-rose-500 rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
              <LogOut size={20} className="text-white" />
            </button>
          </div>
        )}
      </header>

      {/* LOGIN MODAL */}
      {!appUser && supabaseReady && (
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
          {announcement && announcement.trim() !== "" && currentPage === 'absen' && (
             <div className="bg-orange-500 text-white p-6 rounded-[2rem] shadow-xl shadow-orange-500/20 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                <div className="p-3 bg-white/20 rounded-xl"><Megaphone size={24} /></div>
                <div className="flex-1">
                   <p className="text-[10px] font-black uppercase opacity-60">Pesan Admin</p>
                   <p className="font-bold text-sm md:text-base">{announcement}</p>
                </div>
             </div>
          )}

          {/* PAGE: ABSENSI (PEGAWAI ONLY) */}
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

{/* TAB SESI (SUDAH DISESUAIKAN DENGAN USER_CONFIGS) */}
{(appUser?.bisa_umum || appUser?.bisa_live) && (
  <div className={`flex p-2 rounded-[2.5rem] border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
    
    {/* Tombol Umum muncul jika diizinkan */}
    {appUser?.bisa_umum && (
      <button 
        onClick={() => setAbsensiType('Umum')} 
        className={`flex-1 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${absensiType === 'Umum' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500'}`}
      >
        Sesi Umum
      </button>
    )}

    {/* Tombol Live muncul jika diizinkan */}
    {appUser?.bisa_live && (
      <button 
        onClick={() => setAbsensiType('Live')} 
        className={`flex-1 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all ${absensiType === 'Live' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500'}`}
      >
        Sesi Live
      </button>
    )}
    
  </div>
)}

              <div className="grid grid-cols-2 gap-4">
                {/* Tombol Masuk */}
                <button 
                  onClick={() => handleAbsen('Masuk')} 
                  disabled={isLoading || todayStatus.hasClockIn} 
                  className={`h-40 rounded-[3rem] font-black uppercase text-[10px] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-300 ${todayStatus.hasClockIn ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 text-white'}`}
                >
                  {isLoading ? <RefreshCw size={32} className="animate-spin" /> : <CheckCircle2 size={32} />} 
                  {todayStatus.hasClockIn ? 'Sudah Masuk' : 'Clock In'}
                </button>

                {/* Tombol Pulang */}
                <button 
                  onClick={() => handleAbsen('Pulang')} 
                  // Tombol hanya akan mati jika:
                  // 1. Sedang loading
                  // 2. BELUM klik Masuk di sesi ini
                  // 3. SUDAH klik Pulang di sesi ini
                  disabled={isLoading || !todayStatus.hasClockIn || todayStatus.hasClockOut} 
                  className={`h-40 rounded-[3rem] font-black uppercase text-[10px] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all ${
                    (!todayStatus.hasClockIn || todayStatus.hasClockOut)
                      ? 'bg-slate-200 text-slate-400' 
                      : 'bg-rose-600 text-white shadow-xl shadow-rose-500/20'
                  }`}
                >
                  <LogOut size={32} />
                  <span>{todayStatus.hasClockOut ? 'Sudah Pulang' : 'Clock Out'}</span>
                </button>
              </div>
              
              {absensiType === 'Umum' && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setShowReasonModal('Izin')} disabled={isLoading} className="py-6 bg-amber-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                    <FileText size={18} /> Izin
                  </button>
                  <button onClick={() => setShowReasonModal('Sakit')} disabled={isLoading} className="py-6 bg-blue-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                    <Thermometer size={18} /> Sakit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PAGE: LOG SAYA (PEGAWAI ONLY) */}
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
                  { label: 'Hadir', val: stats[appUser.nama]?.hadir || 0, color: 'bg-emerald-500', show: true },
                  { label: 'Izin', val: stats[appUser.nama]?.izin || 0, color: 'bg-amber-500', show: true },
                  { label: 'Sakit', val: stats[appUser.nama]?.sakit || 0, color: 'bg-blue-500', show: true },
                  { label: 'Gaji Live', val: `Rp ${(stats[appUser.nama]?.gajiLive || 0).toLocaleString('id-ID')}`, color: 'bg-indigo-600', show: hasLiveAccess }
                ].filter(st => st.show).map((st, i) => (
                  <div key={i} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-2 p-5 rounded-3xl shadow-sm`}>
                    <p className="text-[9px] font-black uppercase opacity-40 mb-1">{st.label}</p>
                    <p className={`text-xl font-black ${st.label === 'Gaji Live' ? 'text-indigo-500' : ''}`}>{st.val}</p>
                  </div>
                ))}
              </div>

              {(!stats[appUser.nama]?.logs || stats[appUser.nama].logs.length === 0) ? (
                <div className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-2 p-12 rounded-[3rem] text-center`}>
                  <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Inbox size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black mb-2">Belum Ada Riwayat</h3>
                  <p className="text-sm opacity-60">Anda belum melakukan absensi di bulan {daftarBulan[filterMonth]}.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats[appUser.nama].logs.map((log, i) => (
                    <div key={i} className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-2 p-6 rounded-[2rem] flex items-center justify-between group`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.aksi === 'Masuk' ? 'bg-emerald-500/10 text-emerald-600' : log.aksi === 'Pulang' ? 'bg-rose-500/10 text-rose-600' : 'bg-orange-500/10 text-orange-600'}`}>
                          {log.aksi === 'Masuk' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black opacity-40 uppercase">{log.tanggal_display}</p>
                          <h4 className="font-black text-sm uppercase">{log.tipe} - {log.aksi}</h4>
                          {log.keterangan !== "-" && <p className="text-[10px] italic font-bold opacity-60">"{log.keterangan}"</p>}
                        </div>
                      </div>
                      <p className="text-xl font-black tabular-nums">{log.waktu}</p>
                    </div>
                  ))}
                </div>
              )}
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
                       <input 
                         type="password" 
                         value={newPass} 
                         onChange={e => setNewPass(e.target.value)} 
                         className={`flex-1 p-4 rounded-2xl border-2 outline-none transition-all font-bold ${darkMode ? 'bg-slate-800 border-slate-700 focus:border-orange-500' : 'bg-slate-50 border-slate-200 focus:border-orange-500'}`} 
                         placeholder="Password baru (min. 4 karakter)..." 
                         disabled={isLoading}
                       />
                       <button 
                         onClick={() => updatePassword()} 
                         className="px-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                         disabled={isLoading || !newPass}
                       >
                         {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ADMIN ONLY CONTROLS */}
              {appUser.role === 'admin' && (
                <div className="space-y-8">
                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-orange-500"><Megaphone size={28} /> Pengumuman Admin</h2>
                    <textarea 
                      value={announcement} 
                      onChange={e => setAnnouncement(e.target.value)} 
                      className={`w-full h-32 p-4 rounded-2xl border-2 outline-none font-bold resize-none mb-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} 
                      placeholder="Tulis pengumuman hari ini..." 
                      disabled={isLoading}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={clearAnnouncement} 
                        className="py-5 bg-slate-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        disabled={isLoading || !announcement}
                      >
                        {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />} Hapus
                      </button>
                      <button 
                        onClick={saveAnnouncement} 
                        className="py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        disabled={isLoading}
                      >
                        {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Simpan
                      </button>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-orange-500"><Lock size={28} /> Super User Reset</h2>
                    <div className="space-y-4">
                       <select 
                         value={resetPassTarget.username} 
                         onChange={e => setResetPassTarget({...resetPassTarget, username: e.target.value})} 
                         className={`w-full p-4 rounded-2xl border-2 outline-none font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                         disabled={isLoading}
                       >
                          <option value="">Pilih Pegawai...</option>
                          {daftarPegawai.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                       </select>
                       <input 
                         type="text" 
                         value={resetPassTarget.password} 
                         onChange={e => setResetPassTarget({...resetPassTarget, password: e.target.value})} 
                         className={`w-full p-4 rounded-2xl border-2 outline-none font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} 
                         placeholder="Password Baru (min. 4 karakter)..." 
                         disabled={isLoading}
                       />
                       <button 
                         onClick={() => updatePassword(resetPassTarget.username, resetPassTarget.password)} 
                         className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                         disabled={isLoading || !resetPassTarget.username || !resetPassTarget.password}
                       >
                         {isLoading ? <><RefreshCw size={18} className="animate-spin" /> Memproses...</> : 'Reset Password User'}
                       </button>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <h2 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 text-slate-400"><History size={28} /> Log Aktivitas Admin</h2>
                    {adminLogs.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                          <Inbox size={32} className="text-slate-400" />
                        </div>
                        <p className="text-sm opacity-60">Belum ada aktivitas admin tercatat</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                         {adminLogs.map((al, i) => (
                           <div key={i} className="p-4 border-l-4 border-orange-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-xl">
                              <p className="text-[10px] font-black uppercase opacity-40">{al.waktu}</p>
                              <p className="font-bold text-xs">{al.aksi}</p>
                              <p className="text-[10px] font-bold text-indigo-500">Oleh: {al.admin}</p>
                           </div>
                         ))}
                      </div>
                    )}
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
                  {allUsersFromDB.filter(p => p.bisa_umum).map(p => {
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
                               <span className="font-black text-lg">{s.jamLive?.toFixed(1) || '0.0'} Jam</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                               <span className="text-xs font-bold opacity-70">Pendapatan</span>
                               <span className="font-black text-lg">Rp {(s.gajiLive || 0).toLocaleString('id-ID')}</span>
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

      {/* MODAL: LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
           <div className={`w-full max-w-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} border-4 rounded-[3rem] p-8 md:p-10 shadow-2xl text-center`}>
              <div className="w-20 h-20 mx-auto mb-6 bg-rose-100 dark:bg-rose-900/20 text-rose-600 rounded-[1.5rem] flex items-center justify-center">
                 <LogOut size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">Keluar Sistem?</h3>
              <p className="text-sm opacity-60 mb-8">Anda yakin ingin keluar dari sistem absensi?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowLogoutConfirm(false)} className="py-4 rounded-2xl font-black uppercase text-[10px] border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Batal</button>
                <button onClick={confirmLogout} className="py-4 rounded-2xl font-black uppercase text-[10px] text-white bg-rose-500 hover:bg-rose-600 transition-all">Ya, Keluar</button>
              </div>
           </div>
        </div>
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
              <textarea 
                value={reasonText} 
                onChange={e => setReasonText(e.target.value)} 
                className={`w-full h-32 p-4 rounded-2xl border-2 outline-none font-bold resize-none mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} 
                placeholder={`Misal: Pergi ke dokter atau urusan keluarga...`} 
                disabled={isLoading}
              />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setShowReasonModal(null); setReasonText(""); }} className="py-4 rounded-2xl font-black uppercase text-[10px] border-2 border-slate-200 dark:border-slate-700" disabled={isLoading}>Batal</button>
                <button onClick={() => handleAbsen(showReasonModal, reasonText)} disabled={!reasonText.trim() || isLoading} className={`py-4 rounded-2xl font-black uppercase text-[10px] text-white ${showReasonModal === 'Izin' ? 'bg-amber-500' : 'bg-blue-500'} disabled:opacity-50 flex items-center justify-center gap-2`}>
                  {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Kirim Data'}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* GLOBAL MODAL ALERT */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
           <div className={`w-full max-w-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'} border-4 rounded-[3rem] p-10 shadow-2xl text-center`}>
              <div className={`w-20 h-20 mx-auto mb-6 rounded-[1.5rem] flex items-center justify-center ${
                alertModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                alertModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                alertModal.type === 'info' ? 'bg-blue-100 text-blue-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                 {alertModal.type === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
              </div>
              <h3 className="text-2xl font-black mb-2">{alertModal.title}</h3>
              <p className="text-sm opacity-60 mb-8 leading-relaxed">{alertModal.message}</p>
              <button 
                onClick={() => setAlertModal({ ...alertModal, show: false })} 
                className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all text-white ${
                  alertModal.type === 'success' ? 'bg-emerald-500' : 
                  alertModal.type === 'warning' ? 'bg-amber-500' :
                  alertModal.type === 'info' ? 'bg-blue-500' :
                  'bg-orange-500'
                }`}
              >
                Tutup
              </button>
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
