// js/detail-nasabah.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, serverTimestamp, writeBatch, Timestamp, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Elemen DOM ---
const logoutButton = document.getElementById('logout-button');
const sidebar = document.getElementById('sidebar');
const hamburgerButton = document.getElementById('hamburger-button');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const breadcrumbName = document.getElementById('breadcrumb-customer-name');
const profileInfo = document.getElementById('customer-profile-info');
const summaryTotalPinjaman = document.getElementById('summary-total-pinjaman');
const summarySisaTagihan = document.getElementById('summary-sisa-tagihan');
const transactionHistoryBody = document.getElementById('transaction-history-body');
const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
const userEmailDropdown = document.getElementById('user-email-dropdown');
const logoutLinkDropdown = document.getElementById('logout-link-dropdown');
const addLoanModal = document.getElementById('add-loan-modal');
const addLoanBtn = document.getElementById('add-loan-btn');
const addLoanForm = document.getElementById('add-loan-form');
const addPaymentModal = document.getElementById('add-payment-modal');
const addPaymentBtn = document.getElementById('add-payment-btn');
const addPaymentForm = document.getElementById('add-payment-form');
const paymentLoanSelect = document.getElementById('payment-loan-select');
const loanAmountInput = document.getElementById('loan-amount');
const paymentAmountInput = document.getElementById('payment-amount');

document.querySelectorAll('.btn-cancel-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        addLoanModal.classList.add('hidden');
        addPaymentModal.classList.add('hidden');
    });
});

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatDate = (timestamp) => timestamp ? timestamp.toDate().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
const formatCurrencyInput = (inputElement) => {
    inputElement.addEventListener('keyup', (e) => {
        let value = e.target.value.replace(/[^,\d]/g, '').toString();
        let number_string = value.replace(/[^,\d]/g, '').toString(),
            split = number_string.split(','),
            sisa = split[0].length % 3,
            rupiah = split[0].substr(0, sisa),
            ribuan = split[0].substr(sisa).match(/\d{3}/gi);
        if (ribuan) {
            let separator = sisa ? '.' : '';
            rupiah += separator + ribuan.join('.');
        }
        rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
        e.target.value = rupiah;
    });
};
const parseCurrencyValue = (formattedValue) => {
    if (!formattedValue) return 0;
    return parseInt(formattedValue.replace(/\./g, ''), 10);
};

const getCustomerIdFromURL = () => new URLSearchParams(window.location.search).get('id');
const customerId = getCustomerIdFromURL();

addLoanBtn.addEventListener('click', () => addLoanModal.classList.remove('hidden'));
addPaymentBtn.addEventListener('click', async () => {
    const loansQuery = query(collection(db, 'loans'), where('customerId', '==', customerId), where('status', '==', 'Aktif'));
    try {
        const loanSnapshot = await getDocs(loansQuery);
        paymentLoanSelect.innerHTML = '';
        if (loanSnapshot.empty) { alert("Tidak ada pinjaman aktif yang bisa dibayar."); return; }
        loanSnapshot.forEach(doc => {
            const loan = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `Pinjaman ${formatRupiah(loan.pokokPinjaman)} - ${formatDate(loan.tanggalPinjam)}`;
            paymentLoanSelect.appendChild(option);
        });
        addPaymentModal.classList.remove('hidden');
    } catch (error) { console.error("Error mengambil data pinjaman aktif:", error); alert("Gagal memuat data pinjaman."); }
});

const loadCustomerData = (id) => {
    if (!id) { window.location.href = 'nasabah.html'; return; }
    const customerRef = doc(db, 'customers', id);
    getDoc(customerRef).then(docSnap => {
        if (docSnap.exists()) {
            const customer = docSnap.data();
            breadcrumbName.textContent = customer.nama;
            profileInfo.innerHTML = `<p><strong>Nama:</strong> ${customer.nama}</p><p><strong>Telepon:</strong> ${customer.telepon}</p><p><strong>Alamat:</strong> ${customer.alamat}</p>`;
        } else { alert("Data nasabah tidak ditemukan."); }
    });
    const transactionsQuery = query(collection(db, 'transactions'), where('customerId', '==', id), orderBy('tanggalTransaksi', 'desc'));
    onSnapshot(transactionsQuery, (snapshot) => {
        transactionHistoryBody.innerHTML = snapshot.empty ? `<tr><td colspan="4" class="p-6 text-center text-gray-500">Belum ada riwayat transaksi.</td></tr>` : '';
        snapshot.forEach(doc => {
            const trx = doc.data();
            const rowClass = trx.tipe === 'Pinjaman Baru' ? 'bg-red-50' : 'bg-green-50';
            transactionHistoryBody.innerHTML += `<tr class="${rowClass}"><td class="px-6 py-4">${formatDate(trx.tanggalTransaksi)}</td><td class="px-6 py-4 font-medium">${trx.tipe}</td><td class="px-6 py-4">${formatRupiah(trx.jumlah)}</td><td class="px-6 py-4 text-sm text-gray-600">${trx.keterangan || '-'}</td></tr>`;
        });
    });
    const loansQuery = query(collection(db, 'loans'), where('customerId', '==', id));
    onSnapshot(loansQuery, (snapshot) => {
        let totalTagihan = 0, totalSisaTagihan = 0;
        snapshot.forEach(doc => {
            const loan = doc.data();
            totalTagihan += loan.totalTagihan;
            if(loan.status === 'Aktif') totalSisaTagihan += loan.sisaTagihan;
        });
        summaryTotalPinjaman.textContent = formatRupiah(totalTagihan);
        summarySisaTagihan.textContent = formatRupiah(totalSisaTagihan);
    });
};

addLoanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pokokPinjaman = parseCurrencyValue(loanAmountInput.value);
    const interestRate = parseInt(document.getElementById('loan-interest-rate').value) / 100;
    const angsuran = parseInt(document.getElementById('loan-installments').value);
    const bunga = pokokPinjaman * interestRate;
    const totalTagihan = pokokPinjaman + bunga;
    const batch = writeBatch(db);
    const loanRef = doc(collection(db, 'loans'));
    batch.set(loanRef, { customerId, pokokPinjaman, bunga, totalTagihan, sisaTagihan: totalTagihan, jumlahAngsuran: angsuran, status: 'Aktif', tanggalPinjam: serverTimestamp() });
    const transactionRef = doc(collection(db, 'transactions'));
    batch.set(transactionRef, { customerId, loanId: loanRef.id, jumlah: pokokPinjaman, tipe: 'Pinjaman Baru', keterangan: `Pinjaman Pokok ${formatRupiah(pokokPinjaman)} + Bunga ${formatRupiah(bunga)}`, tanggalTransaksi: serverTimestamp() });
    try {
        await batch.commit();
        alert("Pinjaman baru berhasil ditambahkan!");
        addLoanForm.reset();
        addLoanModal.classList.add('hidden');
    } catch (error) { console.error("Error menambah pinjaman: ", error); alert("Gagal menambah pinjaman."); }
});

addPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jumlah = parseCurrencyValue(paymentAmountInput.value);
    const selectedLoanId = paymentLoanSelect.value;
    if (!selectedLoanId) { alert("Silakan pilih pinjaman yang akan dibayar."); return; }
    const batch = writeBatch(db);
    const loanRef = doc(db, 'loans', selectedLoanId);
    try {
        const loanDoc = await getDoc(loanRef);
        if(!loanDoc.exists()) throw new Error("Pinjaman tidak ditemukan!");
        const currentSisa = loanDoc.data().sisaTagihan;
        const sisaTagihanBaru = currentSisa - jumlah;
        batch.update(loanRef, { sisaTagihan: sisaTagihanBaru, status: sisaTagihanBaru <= 0 ? 'Lunas' : 'Aktif' });
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, { customerId, loanId: selectedLoanId, jumlah, tipe: 'Angsuran', keterangan: `Pembayaran angsuran`, tanggalTransaksi: serverTimestamp() });
        await batch.commit();
        alert("Pembayaran berhasil dicatat!");
        addPaymentForm.reset();
        addPaymentModal.classList.add('hidden');
    } catch (error) { console.error("Error mencatat pembayaran: ", error); alert("Gagal mencatat pembayaran."); }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadCustomerData(customerId);
        // Terapkan format ke semua input uang di halaman ini
        formatCurrencyInput(loanAmountInput);
        formatCurrencyInput(paymentAmountInput);
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
