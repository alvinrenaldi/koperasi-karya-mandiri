// js/transaksi.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, query, where, Timestamp, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatDate = (timestamp) => timestamp ? timestamp.toDate().toLocaleDateString('id-ID') : '-';

let unsubscribe;

const loadAllTransactions = (filters = {}) => {
    if (unsubscribe) unsubscribe();
    let q = query(collection(db, 'transactions'), orderBy('tanggalTransaksi', 'desc'));
    if (filters.startDate) q = query(q, where('tanggalTransaksi', '>=', Timestamp.fromDate(new Date(filters.startDate))));
    if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        q = query(q, where('tanggalTransaksi', '<', Timestamp.fromDate(endDate)));
    }
    if (filters.type && filters.type !== 'Semua') q = query(q, where('tipe', '==', filters.type));

    allTransactionsBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Memuat transaksi...</td></tr>`;
    unsubscribe = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
            allTransactionsBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Tidak ada transaksi.</td></tr>`;
            return;
        }
        allTransactionsBody.innerHTML = '';
        for (const trxDoc of snapshot.docs) {
            const trx = trxDoc.data();
            let detailText = trx.keterangan || '-';
            let rowClass = '', amountClass = '';

            if (trx.tipe === 'Deposito') {
                rowClass = 'bg-blue-50';
                amountClass = 'text-blue-600';
            } else if (trx.tipe === 'Angsuran') {
                rowClass = 'bg-green-50';
                amountClass = 'text-green-600';
            } else if (trx.tipe === 'Pinjaman Baru') {
                rowClass = 'bg-red-50';
                amountClass = 'text-red-600';
            }

            if (trx.customerId) {
                const customerRef = doc(db, 'customers', trx.customerId);
                const customerSnap = await getDoc(customerRef);
                if (customerSnap.exists()) {
                    detailText = `Nasabah: ${customerSnap.data().nama}`;
                }
            }

            const row = `
                <tr class="${rowClass}">
                    <td class="px-6 py-4">${formatDate(trx.tanggalTransaksi)}</td>
                    <td class="px-6 py-4 text-gray-700">${detailText}</td>
                    <td class="px-6 py-4 font-semibold ${amountClass}">${trx.tipe}</td>
                    <td class="px-6 py-4 font-semibold ${amountClass}">${formatRupiah(trx.jumlah)}</td>
                </tr>`;
            allTransactionsBody.innerHTML += row;
        }
    });
};

filterBtn.addEventListener('click', () => loadAllTransactions({ startDate: filterStartDate.value, endDate: filterEndDate.value, type: filterType.value }));
resetBtn.addEventListener('click', () => {
    filterStartDate.value = '';
    filterEndDate.value = '';
    filterType.value = 'Semua';
    loadAllTransactions();
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadAllTransactions();
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
