import React, { useState, useEffect, useMemo } from 'react';
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
import { /* ... icons ... */ } from 'lucide-react';

const App = () => {
  // States tetap sama...
  const [supabaseReady, setSupabaseReady] = useState(false);
  // ... states lainnya

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
      }
    };
    checkSupabase();
  }, []);

  // Load initial data & setup realtime
  useEffect(() => {
    if (!supabaseReady) return;

    const loadData = async () => {
      try {
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
        setLogs(logs);

        // Load announcement
        const announcement = await getAnnouncement();
        setAnnouncement(announcement.text || '');

        // Load admin logs
        const adminLogs = await getAdminLogs();
        setAdminLogs(adminLogs);

        console.log('✅ All data loaded!');
      } catch (err) {
        console.error('❌ Error loading data:', err);
      }
    };

    loadData();

    // Setup realtime subscriptions
    const absensiChannel = subscribeToAbsensiLogs(async () => {
      const logs = await getAbsensiLogs();
      setLogs(logs);
    });

    const settingsChannel = subscribeToSettings(async () => {
      const announcement = await getAnnouncement();
      setAnnouncement(announcement.text || '');
    });

    const adminLogsChannel = subscribeToAdminLogs(async () => {
      const adminLogs = await getAdminLogs();
      setAdminLogs(adminLogs);
    });

    return () => {
      supabase.removeChannel(absensiChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(adminLogsChannel);
    };
  }, [supabaseReady]);

  // Handle Login - check Supabase
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
          nama: username.charAt(0).toUpperCase() + username.slice(1), 
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
      console.error('Login error:', err);
      showStatus("Error saat login, coba lagi", "error");
    }
  };

  // Handle Absen - save to Supabase
  const handleAbsen = async (action, note = "") => {
    if (isLoading || !supabaseReady) return;

    // ... validasi waktu tetap sama ...

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
      showAlert("Sudah Terdaftar", `Sistem mencatat Anda sudah melakukan ${action} ${absensiType} hari ini pada ${duplicate.waktu}.`, 'info');
      setIsLoading(false);
      return;
    }

    // Check Masuk before Pulang
    if (action === 'Pulang') {
      const hasMasuk = logs.find(l => 
        l.nama === appUser.nama && 
        l.tipe === absensiType && 
        l.aksi === 'Masuk' && 
        new Date(l.timestamp).toLocaleDateString('id-ID') === todayStr
      );
      
      if (!hasMasuk) {
        showAlert("Belum Absen Masuk", `Anda harus absen Masuk terlebih dahulu sebelum absen Pulang.`, 'warning');
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

      showStatus(`${action} ${absensiType} Berhasil Terkirim`, "success");
      setReasonText("");
      setShowReasonModal(null);
    } catch (e) {
      console.error("Absen save error:", e);
      showAlert("Gagal Menyimpan", "Koneksi ke server terputus. Periksa internet Anda.", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  // Update Password - save to Supabase
  const updatePassword = async (targetUsername = null, targetPass = null) => {
    const isSelf = !targetUsername;
    const finalUsername = isSelf ? appUser.username : targetUsername;
    const finalPass = isSelf ? newPass : targetPass;

    // Validasi tetap sama...
    if (!finalPass || finalPass.trim() === "" || finalPass.length < 4) {
      showAlert("Gagal Memperbarui", "Password minimal harus 4 karakter.", "error");
      return;
    }

    setIsLoading(true);

    try {
      await setUserConfig(finalUsername, finalPass);

      // Log admin activity
      if (!isSelf) {
        await addAdminLog(appUser.nama, `Reset password user: ${finalUsername}`);
      }

      // Success messages tetap sama...
      if (isSelf) {
        showAlert("Password Berhasil Diperbarui! ✓", `Password Anda telah berhasil diubah.`, "success");
        setNewPass("");
      } else {
        showAlert("Reset Password Berhasil! ✓", `Password untuk ${finalUsername} telah berhasil direset.`, "success");
        setResetPassTarget({ username: '', password: '' });
      }

    } catch (error) {
      console.error("Password update error:", error);
      showAlert("Gagal Memperbarui Password", "Terjadi kesalahan saat memperbarui password.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Save Announcement - save to Supabase
  const saveAnnouncement = async () => {
    if (!announcement || announcement.trim() === "") {
      showAlert("Pengumuman Kosong", "Silakan tulis pengumuman terlebih dahulu.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      await setAnnouncement(announcement.trim(), appUser.nama);
      await addAdminLog(appUser.nama, `Memperbarui pengumuman`);
      showStatus("Pengumuman berhasil diperbarui", "success");
    } catch (e) {
      console.error("Announcement save error:", e);
      showAlert("Gagal Menyimpan", "Tidak dapat menyimpan pengumuman.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Announcement
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

  // ... rest of component tetap sama, hanya ganti firebaseReady dengan supabaseReady
  
  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-24 md:pb-0`}>
      
      {/* Loading state */}
      {!supabaseReady && !appUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-lg">
          <div className="text-center">
            {/* ... loading UI tetap sama ... */}
          </div>
        </div>
      )}

      {/* ... rest of JSX tetap sama ... */}
    </div>
  );
};

export default App;