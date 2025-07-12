// js/app.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, query, where, Timestamp, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Elemen DOM ---
const logoutButton = document.getElementById('logout-button');
const sidebar = document.getElementById('sidebar');
const hamburgerButton = document.getElementById('hamburger-button');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
const userEmailDropdown = document.getElementById('user-email-dropdown');
const logoutLinkDropdown = document.getElementById('logout-link-dropdown');
const kasSaatIniEl = document.getElementById('kas-saat-ini');
const pinjamanAktifEl = document.getElementById('pinjaman-aktif');
const pemasukanBulanIniEl = document.getElementById('pemasukan-bulan-ini');
const nasabahAktifEl = document.getElementById('nasabah-aktif');

// Elemen Modal Deposito
const addDepositBtn = document.getElementById('add-deposit-btn');
const addDepositModal = document.getElementById('add-deposit-modal');
const cancelDepositBtn = document.getElementById('cancel-deposit-btn');
const addDepositForm = document.getElementById('add-deposit-form');

const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

// --- Logika Modal Deposito ---
addDepositBtn.addEventListener('click', () => addDepositModal.classList.remove('hidden'));
cancelDepositBtn.addEventListener('click', () => addDepositModal.classList.add('hidden'));
addDepositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('deposit-amount').value);
    const description = document.getElementById('deposit-description').value;
    if (isNaN(amount) || amount <= 0) {
        alert("Jumlah deposit tidak valid.");
        return;
    }
    try {
        await addDoc(collection(db, 'transactions'), {
            tipe: 'Deposito',
            jumlah: amount,
            keterangan: description,
            tanggalTransaksi: serverTimestamp()
        });
        alert("Deposit berhasil ditambahkan!");
        addDepositForm.reset();
        addDepositModal.classList.add('hidden');
    } catch (error) {
        console.error("Gagal menambahkan deposit:", error);
        alert("Gagal menambahkan deposit.");
    }
});

const loadDashboardData = () => {
    const setLoading = (el) => el.textContent = 'Memuat...';
    setLoading(kasSaatIniEl); setLoading(pinjamanAktifEl); setLoading(pemasukanBulanIniEl); setLoading(nasabahAktifEl);

    // Kalkulasi Kas Saat Ini
    onSnapshot(collection(db, 'transactions'), (snapshot) => {
        let totalPinjamanBaru = 0, totalAngsuran = 0, totalDeposito = 0;
        snapshot.forEach(doc => {
            const trx = doc.data();
            if (trx.tipe === 'Pinjaman Baru') totalPinjamanBaru += trx.jumlah;
            else if (trx.tipe === 'Angsuran') totalAngsuran += trx.jumlah;
            else if (trx.tipe === 'Deposito') totalDeposito += trx.jumlah;
        });
        const kasSaatIni = totalDeposito + totalAngsuran - totalPinjamanBaru;
        kasSaatIniEl.textContent = formatRupiah(kasSaatIni);
    });

    // Kalkulasi Pinjaman & Nasabah Aktif
    onSnapshot(query(collection(db, 'loans'), where('status', '==', 'Aktif')), (snapshot) => {
        let totalPinjamanAktif = 0;
        const activeCustomerIds = new Set();
        snapshot.forEach(doc => {
            const loan = doc.data();
            totalPinjamanAktif += loan.sisaTagihan;
            activeCustomerIds.add(loan.customerId);
        });
        pinjamanAktifEl.textContent = formatRupiah(totalPinjamanAktif);
        nasabahAktifEl.textContent = activeCustomerIds.size;
    });

    // Kalkulasi Pemasukan Bulan Ini
    const now = new Date(), startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1), endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthlyIncomeQuery = query(collection(db, 'transactions'), where('tipe', '==', 'Angsuran'), where('tanggalTransaksi', '>=', Timestamp.fromDate(startOfMonth)), where('tanggalTransaksi', '<=', Timestamp.fromDate(endOfMonth)));
    onSnapshot(monthlyIncomeQuery, (snapshot) => {
        let totalPemasukanBulanIni = 0;
        snapshot.forEach(doc => { totalPemasukanBulanIni += doc.data().jumlah; });
        pemasukanBulanIniEl.textContent = formatRupiah(totalPemasukanBulanIni);
    });
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadDashboardData();
    } else { window.location.href = 'login.html'; }
});

const handleLogout = (e) => { if (e) e.preventDefault(); signOut(auth).catch((error) => console.error("Error saat logout:", error)); };
logoutButton.addEventListener('click', handleLogout);
logoutLinkDropdown.addEventListener('click', handleLogout);
userMenuButton.addEventListener('click', () => userMenu.classList.toggle('hidden'));
window.addEventListener('click', (e) => { if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) { userMenu.classList.add('hidden'); } });
const toggleSidebar = () => { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); };
hamburgerButton.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
