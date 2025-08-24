// js/detail-nasabah.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, serverTimestamp, writeBatch, Timestamp, orderBy, getDocs, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const summaryTabungan = document.getElementById('summary-tabungan');
const withdrawSavingsBtn = document.getElementById('withdraw-savings-btn');

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

// Modal Pencairan Tabungan
const withdrawConfirmModal = document.getElementById('withdraw-confirm-modal');
const cancelWithdrawBtn = document.getElementById('cancel-withdraw-btn');
const confirmWithdrawBtn = document.getElementById('confirm-withdraw-btn');
const withdrawAmountText = document.getElementById('withdraw-amount-text');

// --- State Management ---
let currentCustomerData = null;
let loanEditMode = false;
let currentLoanId = null;
let currentLoanTrxId = null;
let paymentEditMode = false;
let currentPaymentTrxId = null;
let trxToDelete = null;
let loansMap = new Map();

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

const formatDate = (dateOrTimestamp) => {
    if (!dateOrTimestamp) return '-';
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
cancelWithdrawBtn.addEventListener('click', () => withdrawConfirmModal.classList.add('hidden'));

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
        alert("Mengedit pembayaran tidak diizinkan untuk versi ini karena kompleksitas alur tabungan. Silakan hapus dan buat ulang jika ada kesalahan.");
        return;
    }

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
    
    addPaymentModal.classList.remove('hidden');
};
addPaymentBtn.addEventListener('click', () => openPaymentModal());

// --- Logika Pencairan Tabungan ---
withdrawSavingsBtn.addEventListener('click', () => {
    if (!currentCustomerData || !currentCustomerData.tabungan || currentCustomerData.tabungan <= 0) {
        alert("Nasabah tidak memiliki saldo tabungan untuk dicairkan.");
        return;
    }
    withdrawAmountText.textContent = formatRupiah(currentCustomerData.tabungan);
    withdrawConfirmModal.classList.remove('hidden');
});

confirmWithdrawBtn.addEventListener('click', async () => {
    if (!currentCustomerData || !customerId) return;
    const amountToWithdraw = currentCustomerData.tabungan;
    if (amountToWithdraw <= 0) return;
    const batch = writeBatch(db);
    const customerRef = doc(db, 'customers', customerId);
    const transactionRef = doc(collection(db, 'transactions'));
    batch.update(customerRef, { tabungan: 0 });
    batch.set(transactionRef, {
        customerId: customerId,
        tipe: 'Pencairan Tabungan',
        jumlah: amountToWithdraw,
        keterangan: `Pencairan tabungan ${currentCustomerData.nama}`,
        tanggalTransaksi: serverTimestamp()
    });
    try {
        await batch.commit();
        alert("Tabungan berhasil dicairkan!");
    } catch (error) {
        console.error("Gagal mencairkan tabungan:", error);
        alert("Terjadi kesalahan saat mencairkan tabungan.");
    } finally {
        withdrawConfirmModal.classList.add('hidden');
    }
});

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
    const customerRef = doc(db, 'customers', customerId);

    try {
        if (type === 'Angsuran') {
            const trxSnap = await getDoc(trxRef);
            if (trxSnap.exists() && trxSnap.data().keterangan.includes("(Masuk ke Tabungan)")) {
                batch.update(customerRef, { tabungan: increment(-amount) });
            } else {
                const loanRef = doc(db, 'loans', loanId);
                const loanSnap = await getDoc(loanRef);
                if (loanSnap.exists()) {
                    const newSisaTagihan = loanSnap.data().sisaTagihan + amount;
                    batch.update(loanRef, { sisaTagihan: newSisaTagihan, status: 'Aktif' });
                }
            }
        } else if (type === 'Pinjaman Baru') {
            const loanRef = doc(db, 'loans', loanId);
            const paymentsQuery = query(collection(db, 'transactions'), where('loanId', '==', loanId), where('tipe', '==', 'Angsuran'));
            const paymentSnapshot = await getDocs(paymentsQuery);
            if (!paymentSnapshot.empty && paymentSnapshot.docs[0].data().keterangan.includes("(Masuk ke Tabungan)")) {
                const firstPaymentAmount = paymentSnapshot.docs[0].data().jumlah;
                batch.update(customerRef, { tabungan: increment(-firstPaymentAmount) });
            }
            paymentSnapshot.forEach(paymentDoc => batch.delete(paymentDoc.ref));
            batch.delete(loanRef);
        } else if (type === 'Pencairan Tabungan') {
            batch.update(customerRef, { tabungan: increment(amount) });
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

// --- Event Delegation ---
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

const loadCustomerData = (id) => {
    if (!id) { window.location.href = 'nasabah.html'; return; }
    
    const customerRef = doc(db, 'customers', id);
    onSnapshot(customerRef, (docSnap) => {
        if (docSnap.exists()) {
            const customer = docSnap.data();
            currentCustomerData = customer;
            breadcrumbName.textContent = customer.nama;
            profileInfo.innerHTML = `<p><strong>Nama:</strong> ${customer.nama}</p><p><strong>Telepon:</strong> ${customer.telepon}</p><p><strong>Alamat:</strong> ${customer.alamat}</p>`;
            summaryTabungan.textContent = formatRupiah(customer.tabungan || 0);
        } else { 
            alert("Data nasabah tidak ditemukan."); 
            window.location.href = 'nasabah.html';
        }
    });

    const loansQuery = query(collection(db, 'loans'), where('customerId', '==', id));
    onSnapshot(loansQuery, (snapshot) => {
        loansMap.clear();
        let totalTagihan = 0, totalSisaTagihan = 0;
        snapshot.forEach(doc => {
            const loan = doc.data();
            loansMap.set(doc.id, { ...loan, tanggalPinjam: loan.tanggalPinjam.toDate() });
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
        transactionHistoryBody.innerHTML = ''; // Kosongkan tabel dulu
        
        if (snapshot.empty) {
            transactionHistoryBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">Belum ada riwayat transaksi.</td></tr>`;
            return;
        }

        // 1. Kumpulkan semua data transaksi ke dalam array
        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        // 2. Cari ID pinjaman terbaru dari nasabah ini
        let latestLoanId = null;
        let latestLoanDate = new Date(0);
        loansMap.forEach((loan, loanId) => {
            if (loan.tanggalPinjam > latestLoanDate) {
                latestLoanDate = loan.tanggalPinjam;
                latestLoanId = loanId;
            }
        });

        // 3. Lakukan pengurutan kustom di JavaScript
        transactions.sort((a, b) => {
            const dateA = a.tanggalTransaksi.toDate();
            const dateB = b.tanggalTransaksi.toDate();

            // Urutan utama tetap berdasarkan tanggal (terbaru di atas)
            if (dateA.toDateString() !== dateB.toDateString()) {
                return dateB - dateA;
            }

            // Jika tanggalnya sama, terapkan logika prioritas
            const getPriority = (trx) => {
                if (trx.tipe === 'Angsuran' && trx.loanId === latestLoanId) return 1; // Pembayaran pinjaman baru
                if (trx.tipe === 'Pinjaman Baru') return 2; // Pinjaman baru
                if (trx.tipe === 'Angsuran' && trx.loanId !== latestLoanId) return 3; // Pembayaran pinjaman lama
                return 4; // Lainnya
            };

            const priorityA = getPriority(a);
            const priorityB = getPriority(b);

            // Jika prioritas sama, urutkan berdasarkan timestamp akurat (terbaru di atas)
            if (priorityA === priorityB) {
                return dateB - dateA;
            }

            return priorityA - priorityB; // Urutkan berdasarkan prioritas (angka kecil lebih dulu)
        });

        // 4. Tampilkan data yang sudah diurutkan
        transactions.forEach(trx => {
            let keteranganDinamis = trx.keterangan || '-';
            if (trx.tipe === 'Angsuran' && loansMap.has(trx.loanId) && !keteranganDinamis.includes('Tabungan')) {
                const relatedLoan = loansMap.get(trx.loanId);
                keteranganDinamis = `Pembayaran angsuran untuk pinjaman ${formatDate(relatedLoan?.tanggalPinjam)}`;
            }
            const actionButtons = `
                <td class="px-6 py-4 text-sm space-x-2">
                    <button data-id="${trx.id}" data-loanid="${trx.loanId}" data-type="${trx.tipe}" class="btn-edit-trx font-medium text-blue-600 hover:text-blue-900">Edit</button>
                    <button data-id="${trx.id}" data-loanid="${trx.loanId}" data-amount="${trx.jumlah}" data-type="${trx.tipe}" class="btn-delete-trx font-medium text-red-600 hover:text-red-900">Hapus</button>
                </td>
            `;
            const rowClass = trx.tipe === 'Pinjaman Baru' ? 'bg-red-50' : (trx.tipe === 'Angsuran' ? 'bg-green-50' : (trx.tipe === 'Pencairan Tabungan' ? 'bg-yellow-50' : 'bg-blue-50'));
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

// ========================================================================
// === [LOGIKA UTAMA] FUNGSI PENCATATAN PEMBAYARAN DIUBAH TOTAL ===
// ========================================================================
addPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const jumlahBayar = parseCurrencyValue(paymentAmountInput.value);
    const selectedLoanId = paymentLoanSelect.value;
    const paymentDateString = paymentDateInput.value;

    if (!selectedLoanId || !paymentDateString || jumlahBayar <= 0) {
        alert("Data tidak lengkap atau jumlah pembayaran tidak valid.");
        return;
    }
    const transactionDate = Timestamp.fromDate(new Date(paymentDateString));
    const batch = writeBatch(db);
    const loanRef = doc(db, 'loans', selectedLoanId);
    const customerRef = doc(db, 'customers', customerId);

    try {
        const loanSnap = await getDoc(loanRef);
        if (!loanSnap.exists()) throw new Error("Data pinjaman tidak ditemukan!");

        // PERBAIKAN: Selalu kurangi sisa tagihan tidak peduli apapun kondisinya
        const sisaTagihanSaatIni = loanSnap.data().sisaTagihan;
        const sisaTagihanBaru = sisaTagihanSaatIni - jumlahBayar;
        batch.update(loanRef, { sisaTagihan: sisaTagihanBaru, status: sisaTagihanBaru <= 0 ? 'Lunas' : 'Aktif' });
        
        const paymentsQuery = query(collection(db, 'transactions'), where('loanId', '==', selectedLoanId), where('tipe', '==', 'Angsuran'));
        const priorPaymentsSnapshot = await getDocs(paymentsQuery);

        let keteranganTransaksi;
        let pesanSukses;

        if (priorPaymentsSnapshot.empty) {
            // Ini adalah pembayaran pertama, masuk ke tabungan
            batch.update(customerRef, { tabungan: increment(jumlahBayar) });
            keteranganTransaksi = `Angsuran Pertama (Masuk ke Tabungan)`;
            pesanSukses = "Pembayaran pertama berhasil disimpan sebagai tabungan dan telah mengurangi sisa tagihan!";
        } else {
            // Ini adalah pembayaran selanjutnya
            keteranganTransaksi = `Pembayaran angsuran ke-${priorPaymentsSnapshot.size + 1}`;
            pesanSukses = "Pembayaran berhasil dicatat!";
        }
        
        // Catat transaksi angsuran
        const trxRef = doc(collection(db, 'transactions'));
        batch.set(trxRef, { 
            customerId, 
            loanId: selectedLoanId, 
            jumlah: jumlahBayar, 
            tipe: 'Angsuran', 
            keterangan: keteranganTransaksi, 
            tanggalTransaksi: transactionDate 
        });
        
        await batch.commit();
        alert(pesanSukses);

        addPaymentForm.reset();
        addPaymentModal.classList.add('hidden');

    } catch (error) {
        console.error("Error menyimpan pembayaran: ", error);
        alert("Gagal menyimpan pembayaran.");
    }
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