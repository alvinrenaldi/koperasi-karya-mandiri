// js/detail-nasabah.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, serverTimestamp, writeBatch, Timestamp, orderBy, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Modal Pinjaman
const addLoanModal = document.getElementById('add-loan-modal');
const loanModalTitle = document.getElementById('loan-modal-title');
const addLoanBtn = document.getElementById('add-loan-btn');
const addLoanForm = document.getElementById('add-loan-form');
const loanDateInput = document.getElementById('loan-date');
const loanAmountInput = document.getElementById('loan-amount');

// Modal Pembayaran
const addPaymentModal = document.getElementById('add-payment-modal');
const addPaymentBtn = document.getElementById('add-payment-btn');
const addPaymentForm = document.getElementById('add-payment-form');
const paymentModalTitle = document.getElementById('payment-modal-title');
const paymentLoanSelect = document.getElementById('payment-loan-select');
const paymentAmountInput = document.getElementById('payment-amount');
const paymentDateInput = document.getElementById('payment-date');

// Modal Hapus Transaksi
const deleteTrxConfirmModal = document.getElementById('delete-trx-confirm-modal');
const cancelDeleteTrxBtn = document.getElementById('cancel-delete-trx-btn');
const confirmDeleteTrxBtn = document.getElementById('confirm-delete-trx-btn');

// --- State Management ---
let loanEditMode = false;
let currentLoanId = null;
let currentLoanTrxId = null;
let paymentEditMode = false;
let currentPaymentTrxId = null;
let trxToDelete = null;
let loansMap = new Map(); // Cache untuk data pinjaman

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

// PERBAIKAN: Fungsi formatDate dibuat lebih fleksibel
const formatDate = (dateOrTimestamp) => {
    if (!dateOrTimestamp) return '-';
    // Jika objek memiliki metode .toDate(), itu adalah Firestore Timestamp. Jika tidak, anggap itu sudah objek Date.
    const date = dateOrTimestamp.toDate ? dateOrTimestamp.toDate() : dateOrTimestamp;
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
};

const dateToYMD = (date) => date.toISOString().split('T')[0];
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

const getCustomerIdFromURL = () => new URLSearchParams(window.location.search).get('id');
const customerId = getCustomerIdFromURL();

// --- Logika Modal ---
document.querySelectorAll('.btn-cancel-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        addLoanModal.classList.add('hidden');
        addPaymentModal.classList.add('hidden');
    });
});

// --- Logika Pinjaman (Tambah & Edit) ---
const openLoanModal = async (loanId = null, trxId = null) => {
    loanEditMode = !!loanId;
    currentLoanId = loanId;
    currentLoanTrxId = trxId;
    addLoanForm.reset();

    if (loanEditMode) {
        loanModalTitle.textContent = "Edit Data Pinjaman";
        const loanRef = doc(db, 'loans', loanId);
        const loanSnap = await getDoc(loanRef);
        if (loanSnap.exists()) {
            const loan = loanSnap.data();
            loanDateInput.value = dateToYMD(loan.tanggalPinjam.toDate());
            loanAmountInput.value = loan.pokokPinjaman;
            document.getElementById('loan-installments').value = loan.jumlahAngsuran;
            formatCurrencyInput(loanAmountInput);
        }
    } else {
        loanModalTitle.textContent = "Beri Pinjaman Baru";
        loanDateInput.value = dateToYMD(new Date());
    }
    addLoanModal.classList.remove('hidden');
};
addLoanBtn.addEventListener('click', () => openLoanModal());

// --- Logika Pembayaran (Tambah & Edit) ---
const openPaymentModal = async (trxId = null) => {
    paymentEditMode = !!trxId;
    currentPaymentTrxId = trxId;
    addPaymentForm.reset();

    paymentLoanSelect.innerHTML = '';
    
    if (paymentEditMode) {
        paymentModalTitle.textContent = "Edit Catatan Pembayaran";
        const trxRef = doc(db, 'transactions', trxId);
        const trxSnap = await getDoc(trxRef);
        if (trxSnap.exists()) {
            const trx = trxSnap.data();
            const loanData = loansMap.get(trx.loanId);
            if (loanData) {
                const option = document.createElement('option');
                option.value = trx.loanId;
                option.textContent = `Pinjaman ${formatRupiah(loanData.pokokPinjaman)} - ${formatDate(loanData.tanggalPinjam)}`;
                paymentLoanSelect.appendChild(option);
            }
            paymentAmountInput.value = trx.jumlah;
            formatCurrencyInput(paymentAmountInput);
            paymentDateInput.value = dateToYMD(trx.tanggalTransaksi.toDate());
            paymentLoanSelect.value = trx.loanId;
            paymentLoanSelect.disabled = true;
        }
    } else {
        paymentModalTitle.textContent = "Catat Pembayaran Angsuran";
        paymentDateInput.value = dateToYMD(new Date());
        paymentLoanSelect.disabled = false;
        
        let hasActiveLoan = false;
        loansMap.forEach((loan, loanId) => {
            if (loan.status === 'Aktif') {
                const option = document.createElement('option');
                option.value = loanId;
                option.textContent = `Pinjaman ${formatRupiah(loan.pokokPinjaman)} - ${formatDate(loan.tanggalPinjam)}`;
                paymentLoanSelect.appendChild(option);
                hasActiveLoan = true;
            }
        });

        if (!hasActiveLoan) {
            alert("Tidak ada pinjaman aktif yang bisa dibayar.");
            return;
        }
    }
    addPaymentModal.classList.remove('hidden');
};
addPaymentBtn.addEventListener('click', () => openPaymentModal());

// --- Logika Hapus Transaksi ---
cancelDeleteTrxBtn.addEventListener('click', () => deleteTrxConfirmModal.classList.add('hidden'));
const openDeleteTrxModal = (trxId, loanId, amount, type) => {
    trxToDelete = { trxId, loanId, amount, type };
    deleteTrxConfirmModal.classList.remove('hidden');
};
confirmDeleteTrxBtn.addEventListener('click', async () => {
    if (!trxToDelete) return;

    const { trxId, loanId, amount, type } = trxToDelete;
    const batch = writeBatch(db);
    const trxRef = doc(db, 'transactions', trxId);

    try {
        if (type === 'Angsuran') {
            const loanRef = doc(db, 'loans', loanId);
            const loanSnap = await getDoc(loanRef);
            if (loanSnap.exists()) {
                const newSisaTagihan = loanSnap.data().sisaTagihan + amount;
                batch.update(loanRef, { sisaTagihan: newSisaTagihan, status: 'Aktif' });
            }
        } else if (type === 'Pinjaman Baru') {
            const loanRef = doc(db, 'loans', loanId);
            const paymentsQuery = query(collection(db, 'transactions'), where('loanId', '==', loanId), where('tipe', '==', 'Angsuran'));
            const paymentSnapshot = await getDocs(paymentsQuery);
            paymentSnapshot.forEach(paymentDoc => batch.delete(paymentDoc.ref));
            batch.delete(loanRef);
        }
        batch.delete(trxRef);
        await batch.commit();
        alert("Catatan transaksi berhasil dihapus.");
    } catch (error) {
        console.error("Gagal menghapus transaksi:", error);
        alert("Gagal menghapus transaksi.");
    } finally {
        deleteTrxConfirmModal.classList.add('hidden');
        trxToDelete = null;
    }
});

// --- Event Delegation untuk Riwayat Transaksi ---
transactionHistoryBody.addEventListener('click', (e) => {
    const target = e.target;
    const trxId = target.dataset.id;
    const loanId = target.dataset.loanid;
    const amount = parseInt(target.dataset.amount, 10);
    const type = target.dataset.type;

    if (target.classList.contains('btn-edit-trx')) {
        if (type === 'Angsuran') openPaymentModal(trxId);
        else if (type === 'Pinjaman Baru') openLoanModal(loanId, trxId);
    }
    if (target.classList.contains('btn-delete-trx')) {
        openDeleteTrxModal(trxId, loanId, amount, type);
    }
});

// --- Memuat Data Utama ---
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

    const loansQuery = query(collection(db, 'loans'), where('customerId', '==', id));
    onSnapshot(loansQuery, (snapshot) => {
        let totalTagihan = 0, totalSisaTagihan = 0;
        loansMap.clear();
        snapshot.forEach(doc => {
            const loan = doc.data();
            loansMap.set(doc.id, { ...loan, tanggalPinjam: loan.tanggalPinjam.toDate() }); // Simpan sebagai Date object
            totalTagihan += loan.totalTagihan;
            if(loan.status === 'Aktif') totalSisaTagihan += loan.sisaTagihan;
        });
        summaryTotalPinjaman.textContent = formatRupiah(totalTagihan);
        summarySisaTagihan.textContent = formatRupiah(totalSisaTagihan);

        if (totalSisaTagihan > 0) {
            addLoanBtn.disabled = true;
            addLoanBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
            addLoanBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        } else {
            addLoanBtn.disabled = false;
            addLoanBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            addLoanBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }
    });

    const transactionsQuery = query(collection(db, 'transactions'), where('customerId', '==', id), orderBy('tanggalTransaksi', 'desc'));
    onSnapshot(transactionsQuery, (snapshot) => {
        transactionHistoryBody.innerHTML = snapshot.empty ? `<tr><td colspan="5" class="p-6 text-center text-gray-500">Belum ada riwayat transaksi.</td></tr>` : '';
        snapshot.forEach(doc => {
            const trx = doc.data();
            const trxId = doc.id;
            let keteranganDinamis = trx.keterangan || '-';

            if (trx.tipe === 'Angsuran' && loansMap.has(trx.loanId)) {
                const relatedLoan = loansMap.get(trx.loanId);
                keteranganDinamis = `Pembayaran angsuran ${formatDate(relatedLoan.tanggalPinjam)}`;
            }

            const actionButtons = `
                <td class="px-6 py-4 text-sm space-x-2">
                    <button data-id="${trxId}" data-loanid="${trx.loanId}" data-type="${trx.tipe}" class="btn-edit-trx font-medium text-blue-600 hover:text-blue-900">Edit</button>
                    <button data-id="${trxId}" data-loanid="${trx.loanId}" data-amount="${trx.jumlah}" data-type="${trx.tipe}" class="btn-delete-trx font-medium text-red-600 hover:text-red-900">Hapus</button>
                </td>
            `;
            const rowClass = trx.tipe === 'Pinjaman Baru' ? 'bg-red-50' : (trx.tipe === 'Angsuran' ? 'bg-green-50' : 'bg-blue-50');
            transactionHistoryBody.innerHTML += `<tr class="${rowClass}"><td class="px-6 py-4">${formatDate(trx.tanggalTransaksi)}</td><td class="px-6 py-4 font-medium">${trx.tipe}</td><td class="px-6 py-4">${formatRupiah(trx.jumlah)}</td><td class="px-6 py-4 text-sm text-gray-600">${keteranganDinamis}</td>${actionButtons}</tr>`;
        });
    });
};

// --- Logika Form Submit ---
addLoanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pokokPinjaman = parseCurrencyValue(loanAmountInput.value);
    const loanDateString = loanDateInput.value;
    if (!loanDateString) { alert("Silakan pilih tanggal pinjaman."); return; }
    const transactionDate = Timestamp.fromDate(new Date(loanDateString));
    const interestRate = parseInt(document.getElementById('loan-interest-rate').value) / 100;
    const angsuran = parseInt(document.getElementById('loan-installments').value);
    const bunga = pokokPinjaman * interestRate;
    const totalTagihan = pokokPinjaman + bunga;
    
    const batch = writeBatch(db);

    if (loanEditMode) {
        const loanRef = doc(db, 'loans', currentLoanId);
        const trxRef = doc(db, 'transactions', currentLoanTrxId);
        const loanSnap = await getDoc(loanRef);
        if(!loanSnap.exists()) throw new Error("Pinjaman tidak ditemukan!");
        const sudahDibayar = loanSnap.data().totalTagihan - loanSnap.data().sisaTagihan;
        const newSisaTagihan = totalTagihan - sudahDibayar;
        batch.update(loanRef, { pokokPinjaman, bunga, totalTagihan, sisaTagihan: newSisaTagihan, jumlahAngsuran: angsuran, tanggalPinjam: transactionDate });
        batch.update(trxRef, { jumlah: pokokPinjaman, keterangan: `Pinjaman Pokok ${formatRupiah(pokokPinjaman)} + Bunga ${formatRupiah(bunga)}`, tanggalTransaksi: transactionDate });
        try { await batch.commit(); alert("Pinjaman berhasil diperbarui!"); } 
        catch (error) { console.error("Error memperbarui pinjaman: ", error); alert("Gagal memperbarui pinjaman."); }
    } else {
        const loanRef = doc(collection(db, 'loans'));
        batch.set(loanRef, { customerId, pokokPinjaman, bunga, totalTagihan, sisaTagihan: totalTagihan, jumlahAngsuran: angsuran, status: 'Aktif', tanggalPinjam: transactionDate });
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, { customerId, loanId: loanRef.id, jumlah: pokokPinjaman, tipe: 'Pinjaman Baru', keterangan: `Pinjaman Pokok ${formatRupiah(pokokPinjaman)} + Bunga ${formatRupiah(bunga)}`, tanggalTransaksi: transactionDate });
        try { await batch.commit(); alert("Pinjaman baru berhasil ditambahkan!"); } 
        catch (error) { console.error("Error menambah pinjaman: ", error); alert("Gagal menambah pinjaman."); }
    }
    addLoanForm.reset();
    addLoanModal.classList.add('hidden');
});

addPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jumlahBaru = parseCurrencyValue(paymentAmountInput.value);
    const selectedLoanId = paymentLoanSelect.value;
    const paymentDateString = paymentDateInput.value;
    if (!selectedLoanId || !paymentDateString) { alert("Data tidak lengkap."); return; }
    const transactionDate = Timestamp.fromDate(new Date(paymentDateString));
    const batch = writeBatch(db);
    const loanRef = doc(db, 'loans', selectedLoanId);
    const relatedLoan = loansMap.get(selectedLoanId);
    const keteranganDinamis = `Pembayaran angsuran ${formatDate(relatedLoan.tanggalPinjam)}`;

    try {
        if (paymentEditMode) {
            const trxRef = doc(db, 'transactions', currentPaymentTrxId);
            const trxSnap = await getDoc(trxRef);
            const loanSnap = await getDoc(loanRef);
            if (!trxSnap.exists() || !loanSnap.exists()) throw new Error("Data tidak ditemukan!");
            const jumlahLama = trxSnap.data().jumlah;
            const selisih = jumlahBaru - jumlahLama;
            const sisaTagihanBaru = loanSnap.data().sisaTagihan - selisih;
            batch.update(loanRef, { sisaTagihan: sisaTagihanBaru, status: sisaTagihanBaru <= 0 ? 'Lunas' : 'Aktif' });
            batch.update(trxRef, { jumlah: jumlahBaru, tanggalTransaksi: transactionDate, keterangan: keteranganDinamis });
            await batch.commit();
            alert("Pembayaran berhasil diperbarui!");
        } else {
            const loanSnap = await getDoc(loanRef);
            if(!loanSnap.exists()) throw new Error("Pinjaman tidak ditemukan!");
            const sisaTagihanBaru = loanSnap.data().sisaTagihan - jumlahBaru;
            batch.update(loanRef, { sisaTagihan: sisaTagihanBaru, status: sisaTagihanBaru <= 0 ? 'Lunas' : 'Aktif' });
            const trxRef = doc(collection(db, 'transactions'));
            batch.set(trxRef, { customerId, loanId: selectedLoanId, jumlah: jumlahBaru, tipe: 'Angsuran', keterangan: keteranganDinamis, tanggalTransaksi: transactionDate });
            await batch.commit();
            alert("Pembayaran berhasil dicatat!");
        }
        addPaymentForm.reset();
        addPaymentModal.classList.add('hidden');
    } catch (error) { console.error("Error menyimpan pembayaran: ", error); alert("Gagal menyimpan pembayaran."); }
});

// --- Inisialisasi dan Auth Guard ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadCustomerData(customerId);
        formatCurrencyInput(loanAmountInput);
        formatCurrencyInput(paymentAmountInput);
    } else { window.location.href = 'login.html'; }
});

// --- Logika Umum (Logout, Sidebar) ---
const handleLogout = (e) => { if (e) e.preventDefault(); signOut(auth).catch((error) => console.error("Error saat logout:", error)); };
logoutButton.addEventListener('click', handleLogout);
logoutLinkDropdown.addEventListener('click', handleLogout);
userMenuButton.addEventListener('click', () => userMenu.classList.toggle('hidden'));
window.addEventListener('click', (e) => { if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) { userMenu.classList.add('hidden'); } });
const toggleSidebar = () => { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); };
hamburgerButton.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
