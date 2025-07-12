// js/transaksi.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, query, where, Timestamp, orderBy, doc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Elemen DOM ---
const logoutButton = document.getElementById('logout-button');
const sidebar = document.getElementById('sidebar');
const hamburgerButton = document.getElementById('hamburger-button');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const allTransactionsBody = document.getElementById('all-transactions-body');
const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
const userEmailDropdown = document.getElementById('user-email-dropdown');
const logoutLinkDropdown = document.getElementById('logout-link-dropdown');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');
const filterType = document.getElementById('filter-type');
const filterBtn = document.getElementById('filter-btn');
const resetBtn = document.getElementById('reset-btn');

// Elemen Panel Ringkasan Baru
const totalMasukEl = document.getElementById('total-masuk');
const totalKeluarEl = document.getElementById('total-keluar');

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatDate = (timestamp) => timestamp ? timestamp.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

let unsubscribe;
let customersMap = new Map(); // Cache untuk data nasabah agar lebih cepat

// Fungsi untuk mengambil semua data nasabah dan menyimpannya di map
const fetchAllCustomers = async () => {
    try {
        const customersCollection = collection(db, 'customers');
        const customerSnapshot = await getDocs(customersCollection);
        customersMap.clear(); // Bersihkan cache sebelum diisi ulang
        customerSnapshot.forEach(doc => {
            customersMap.set(doc.id, doc.data());
        });
        console.log("Cache data nasabah berhasil diperbarui.");
    } catch (error) {
        console.error("Gagal mengambil data nasabah:", error);
    }
};

const loadAllTransactions = (filters = {}) => {
    if (unsubscribe) {
        unsubscribe(); // Hentikan listener sebelumnya untuk mencegah tumpang tindih
    }

    let q = query(collection(db, 'transactions'), orderBy('tanggalTransaksi', 'desc'));
    if (filters.startDate) q = query(q, where('tanggalTransaksi', '>=', Timestamp.fromDate(new Date(filters.startDate))));
    if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        q = query(q, where('tanggalTransaksi', '<', Timestamp.fromDate(endDate)));
    }
    if (filters.type && filters.type !== 'Semua') q = query(q, where('tipe', '==', filters.type));

    allTransactionsBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Memuat transaksi...</td></tr>`;
    totalMasukEl.textContent = 'Memuat...';
    totalKeluarEl.textContent = 'Memuat...';

    unsubscribe = onSnapshot(q, (snapshot) => {
        let totalMasuk = 0;
        let totalKeluar = 0;
        let rowsHtml = ''; // Kumpulkan semua baris HTML di sini

        if (snapshot.empty) {
            allTransactionsBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Tidak ada transaksi yang cocok dengan filter.</td></tr>`;
            totalMasukEl.textContent = formatRupiah(0);
            totalKeluarEl.textContent = formatRupiah(0);
            return;
        }

        // Loop melalui data tanpa await untuk kecepatan
        snapshot.forEach(trxDoc => {
            const trx = trxDoc.data();
            let detailText = trx.keterangan || '-';
            let rowClass = '', amountClass = '';

            if (trx.tipe === 'Deposito' || trx.tipe === 'Angsuran') {
                totalMasuk += trx.jumlah;
                amountClass = 'text-green-600';
                rowClass = trx.tipe === 'Deposito' ? 'bg-blue-50' : 'bg-green-50';
            } else if (trx.tipe === 'Pinjaman Baru' || trx.tipe === 'Operasional') {
                totalKeluar += trx.jumlah;
                amountClass = 'text-red-600';
                rowClass = trx.tipe === 'Operasional' ? 'bg-yellow-50' : 'bg-red-50';
            }

            // Ambil nama nasabah dari cache, bukan dari database (lebih cepat)
            if (trx.customerId && customersMap.has(trx.customerId)) {
                detailText = `Nasabah: ${customersMap.get(trx.customerId).nama}`;
            }

            rowsHtml += `
                <tr class="${rowClass}">
                    <td class="px-6 py-4">${formatDate(trx.tanggalTransaksi)}</td>
                    <td class="px-6 py-4 text-gray-700">${detailText}</td>
                    <td class="px-6 py-4 font-semibold ${amountClass}">${trx.tipe}</td>
                    <td class="px-6 py-4 font-semibold ${amountClass}">${formatRupiah(trx.jumlah)}</td>
                </tr>`;
        });

        // Update DOM sekali saja setelah semua data diproses
        allTransactionsBody.innerHTML = rowsHtml;
        totalMasukEl.textContent = formatRupiah(totalMasuk);
        totalKeluarEl.textContent = formatRupiah(totalKeluar);
    });
};

filterBtn.addEventListener('click', () => loadAllTransactions({ startDate: filterStartDate.value, endDate: filterEndDate.value, type: filterType.value }));
resetBtn.addEventListener('click', () => {
    filterStartDate.value = '';
    filterEndDate.value = '';
    filterType.value = 'Semua';
    loadAllTransactions();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        await fetchAllCustomers(); // Tunggu data nasabah selesai diambil sekali saja
        loadAllTransactions(); // Baru muat data transaksi
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
