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
const nasabahAktifEl = document.getElementById('nasabah-aktif');
const totalModalEl = document.getElementById('total-modal');
const totalKeuntunganEl = document.getElementById('total-keuntungan');
const targetHarianEl = document.getElementById('target-harian');
const pemasukanHariIniEl = document.getElementById('pemasukan-hari-ini');

// Elemen Modal Deposito
const addDepositBtn = document.getElementById('add-deposit-btn');
const addDepositModal = document.getElementById('add-deposit-modal');
const cancelDepositBtn = document.getElementById('cancel-deposit-btn');
const addDepositForm = document.getElementById('add-deposit-form');
const depositAmountInput = document.getElementById('deposit-amount');

// Elemen Modal Pengeluaran
const addExpenseBtn = document.getElementById('add-expense-btn');
const addExpenseModal = document.getElementById('add-expense-modal');
const cancelExpenseBtn = document.getElementById('cancel-expense-btn');
const addExpenseForm = document.getElementById('add-expense-form');
const expenseAmountInput = document.getElementById('expense-amount');

// Elemen Aksi Mobile
const mobileActionsButton = document.getElementById('mobile-actions-button');
const mobileActionsMenu = document.getElementById('mobile-actions-menu');
const addDepositLinkMobile = document.getElementById('add-deposit-link-mobile');
const addExpenseLinkMobile = document.getElementById('add-expense-link-mobile');

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatCurrencyInput = (inputElement) => {
    inputElement.addEventListener('keyup', (e) => {
        let value = e.target.value.replace(/[^,\d]/g, '').toString();
        let number_string = value.replace(/[^,\d]/g, '').toString(),
            split = number_string.split(','),
            sisa = split[0].length % 3,
            rupiah = split[0].substr(0, sisa),
            ribuan = split[0].substr(sisa).match(/\d{3}/gi);
        if (ribuan) { let separator = sisa ? '.' : ''; rupiah += separator + ribuan.join('.'); }
        rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
        e.target.value = rupiah;
    });
};
const parseCurrencyValue = (formattedValue) => {
    if (!formattedValue) return 0;
    return parseInt(formattedValue.replace(/\./g, ''), 10);
};

// --- Logika Modal ---
const openDepositModal = () => addDepositModal.classList.remove('hidden');
const closeDepositModal = () => addDepositModal.classList.add('hidden');
const openExpenseModal = () => addExpenseModal.classList.remove('hidden');
const closeExpenseModal = () => addExpenseModal.classList.add('hidden');

addDepositBtn.addEventListener('click', openDepositModal);
addDepositLinkMobile.addEventListener('click', openDepositModal);
cancelDepositBtn.addEventListener('click', closeDepositModal);

addExpenseBtn.addEventListener('click', openExpenseModal);
addExpenseLinkMobile.addEventListener('click', openExpenseModal);
cancelExpenseBtn.addEventListener('click', closeExpenseModal);

addDepositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseCurrencyValue(depositAmountInput.value);
    const description = document.getElementById('deposit-description').value;
    if (isNaN(amount) || amount <= 0) { alert("Jumlah deposit tidak valid."); return; }
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = "Menyimpan...";
    try {
        await addDoc(collection(db, 'transactions'), { tipe: 'Deposito', jumlah: amount, keterangan: description, tanggalTransaksi: serverTimestamp() });
        alert("Deposit berhasil ditambahkan!");
        addDepositForm.reset();
        closeDepositModal();
    } catch (error) {
        console.error("Gagal menambahkan deposit:", error);
        alert("Gagal menambahkan deposit.");
    } finally {
        submitButton.disabled = false; submitButton.textContent = "Simpan Deposit";
    }
});

addExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseCurrencyValue(expenseAmountInput.value);
    const description = document.getElementById('expense-description').value;
    if (isNaN(amount) || amount <= 0) { alert("Jumlah pengeluaran tidak valid."); return; }
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = "Menyimpan...";
    try {
        await addDoc(collection(db, 'transactions'), { tipe: 'Operasional', jumlah: amount, keterangan: description, tanggalTransaksi: serverTimestamp() });
        alert("Pengeluaran berhasil dicatat!");
        addExpenseForm.reset();
        closeExpenseModal();
    } catch (error) {
        console.error("Gagal mencatat pengeluaran:", error);
        alert("Gagal mencatat pengeluaran.");
    } finally {
        submitButton.disabled = false; submitButton.textContent = "Simpan Pengeluaran";
    }
});

const loadDashboardData = () => {
    const setLoading = (el) => el.textContent = 'Memuat...';
    setLoading(kasSaatIniEl); setLoading(pinjamanAktifEl); setLoading(nasabahAktifEl); setLoading(totalModalEl); setLoading(totalKeuntunganEl); setLoading(targetHarianEl); setLoading(pemasukanHariIniEl);

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    onSnapshot(collection(db, 'transactions'), (snapshot) => {
        let totalPinjamanBaru = 0, totalAngsuran = 0, totalModal = 0, pemasukanHariIni = 0, totalOperasional = 0;
        snapshot.forEach(doc => {
            const trx = doc.data();
            const trxDate = trx.tanggalTransaksi.toDate();
            if (trx.tipe === 'Pinjaman Baru') {
                totalPinjamanBaru += trx.jumlah;
            } else if (trx.tipe === 'Angsuran') {
                totalAngsuran += trx.jumlah;
                if (trxDate >= startOfToday && trxDate <= endOfToday) {
                    pemasukanHariIni += trx.jumlah;
                }
            } else if (trx.tipe === 'Deposito') {
                totalModal += trx.jumlah;
            } else if (trx.tipe === 'Operasional') {
                totalOperasional += trx.jumlah;
            }
        });
        const kasSaatIni = totalModal + totalAngsuran - totalPinjamanBaru - totalOperasional;
        totalModalEl.textContent = formatRupiah(totalModal);
        kasSaatIniEl.textContent = formatRupiah(kasSaatIni);
        pemasukanHariIniEl.textContent = formatRupiah(pemasukanHariIni);

        const keuntunganNominal = kasSaatIni - totalModal;
        let keuntunganPersen = 0;
        if (totalModal > 0) {
            keuntunganPersen = (keuntunganNominal / totalModal) * 100;
        }
        totalKeuntunganEl.textContent = `${formatRupiah(keuntunganNominal)} (${keuntunganPersen.toFixed(1)}%)`;
        totalKeuntunganEl.classList.remove('text-green-700', 'text-red-700');
        totalKeuntunganEl.classList.add(keuntunganNominal < 0 ? 'text-red-700' : 'text-green-700');
    });

    onSnapshot(query(collection(db, 'loans'), where('status', '==', 'Aktif')), (snapshot) => {
        let totalSisaTagihan = 0, targetHarian = 0;
        const activeCustomerIds = new Set();
        snapshot.forEach(doc => {
            const loan = doc.data();
            totalSisaTagihan += loan.sisaTagihan;
            if (loan.jumlahAngsuran > 0) {
                targetHarian += loan.totalTagihan / loan.jumlahAngsuran;
            }
            activeCustomerIds.add(loan.customerId);
        });
        pinjamanAktifEl.textContent = formatRupiah(totalSisaTagihan);
        targetHarianEl.textContent = formatRupiah(targetHarian);
        nasabahAktifEl.textContent = activeCustomerIds.size;
    });
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadDashboardData();
        formatCurrencyInput(depositAmountInput);
        formatCurrencyInput(expenseAmountInput);
    } else { window.location.href = 'login.html'; }
});

const handleLogout = (e) => { if (e) e.preventDefault(); signOut(auth).catch((error) => console.error("Error saat logout:", error)); };
logoutButton.addEventListener('click', handleLogout);
logoutLinkDropdown.addEventListener('click', handleLogout);
userMenuButton.addEventListener('click', () => userMenu.classList.toggle('hidden'));
mobileActionsButton.addEventListener('click', () => mobileActionsMenu.classList.toggle('hidden'));
window.addEventListener('click', (e) => {
    if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) { userMenu.classList.add('hidden'); }
    if (!mobileActionsButton.contains(e.target) && !mobileActionsMenu.contains(e.target)) { mobileActionsMenu.classList.add('hidden'); }
});
const toggleSidebar = () => { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); };
hamburgerButton.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
