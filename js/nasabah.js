// js/nasabah.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, getDocs, doc, getDoc, updateDoc, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Elemen DOM ---
const logoutButton = document.getElementById('logout-button');
const sidebar = document.getElementById('sidebar');
const hamburgerButton = document.getElementById('hamburger-button');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const customerTableBody = document.getElementById('customer-table-body');
const userMenuButton = document.getElementById('user-menu-button');
const userMenu = document.getElementById('user-menu');
const userEmailDropdown = document.getElementById('user-email-dropdown');
const logoutLinkDropdown = document.getElementById('logout-link-dropdown');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');

// --- Elemen Modal Tambah/Edit ---
const customerModal = document.getElementById('customer-modal');
const modalTitle = document.getElementById('modal-title');
const addCustomerBtn = document.getElementById('add-customer-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const customerForm = document.getElementById('customer-form');

// --- Elemen Modal Hapus ---
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// --- State Management ---
let editMode = false;
let currentCustomerId = null;
let customerIdToDelete = null;
let allCustomersData = [];

// --- Fungsi Utilitas ---
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
const formatDate = (date) => {
    if (!date || date.getTime() === new Date(0).getTime()) return '-';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

// --- Logika Modal ---
const openModalForAdd = () => {
    editMode = false;
    currentCustomerId = null;
    modalTitle.textContent = 'Tambah Nasabah Baru';
    customerForm.reset();
    customerModal.classList.remove('hidden');
};

const openModalForEdit = async (id) => {
    editMode = true;
    currentCustomerId = id;
    modalTitle.textContent = 'Edit Data Nasabah';
    try {
        const customerRef = doc(db, 'customers', id);
        const docSnap = await getDoc(customerRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('customer-name').value = data.nama;
            document.getElementById('customer-phone').value = data.telepon;
            document.getElementById('customer-address').value = data.alamat;
            customerModal.classList.remove('hidden');
        }
    } catch (error) { console.error("Gagal mengambil data untuk diedit:", error); }
};

const closeModal = () => {
    customerModal.classList.add('hidden');
    customerForm.reset();
};

addCustomerBtn.addEventListener('click', openModalForAdd);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

const openDeleteModal = (id) => {
    customerIdToDelete = id;
    deleteConfirmModal.classList.remove('hidden');
};
const closeDeleteModal = () => {
    customerIdToDelete = null;
    deleteConfirmModal.classList.add('hidden');
};
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
confirmDeleteBtn.addEventListener('click', async () => {
    if (!customerIdToDelete) return;
    const deleteButton = confirmDeleteBtn;
    deleteButton.disabled = true;
    deleteButton.textContent = "Menghapus...";
    try {
        const customerRef = doc(db, 'customers', customerIdToDelete);
        await updateDoc(customerRef, { status: 'Dihapus' });
    } catch (error) {
        console.error("Gagal menghapus nasabah:", error);
        alert("Gagal menghapus nasabah.");
    } finally {
        deleteButton.disabled = false;
        deleteButton.textContent = "Ya, Hapus";
        closeDeleteModal();
    }
});

customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan...';
    const customerData = {
        nama: document.getElementById('customer-name').value,
        telepon: document.getElementById('customer-phone').value,
        alamat: document.getElementById('customer-address').value,
    };
    try {
        if (editMode) {
            const customerRef = doc(db, 'customers', currentCustomerId);
            await updateDoc(customerRef, customerData);
        } else {
            await addDoc(collection(db, 'customers'), { ...customerData, status: 'Aktif', dibuatPada: serverTimestamp() });
        }
        closeModal();
    } catch (error) {
        console.error("Error menyimpan data nasabah: ", error);
        alert("Gagal menyimpan data.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Simpan';
    }
});

// --- Logika Tampilan (Filter, Sort, Render) ---
const renderCustomerTable = (customersToRender) => {
    if (customersToRender.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">Nasabah tidak ditemukan.</td></tr>`;
        return;
    }
    customerTableBody.innerHTML = '';
    customersToRender.forEach(customer => {
        let rowClass = 'bg-white'; // Default putih (lunas)
        if (customer.paymentStatus === 'paid') {
            rowClass = 'bg-green-100'; // Hijau
        } else if (customer.paymentStatus === 'due') {
            rowClass = 'bg-red-100'; // Merah
        } else if (customer.paymentStatus === 'new_loan') {
            rowClass = 'bg-yellow-100'; // Kuning
        }

        const row = `
            <tr class="${rowClass} hover:bg-gray-200">
                <td class="px-6 py-4">
                    <div class="font-semibold text-gray-900">${customer.nama}</div>
                    <div class="text-sm text-gray-500">${customer.alamat}</div>
                </td>
                <td class="px-6 py-4 text-gray-700 font-medium">${customer.loanCountText}</td>
                <td class="px-6 py-4 text-gray-700">${formatDate(customer.displayLoanDate)}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatRupiah(customer.totalPokokPinjaman)}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatRupiah(customer.totalSisaTagihan)}</td>
                <td class="px-6 py-4 text-gray-700">${customer.installmentText}</td>
                <td class="px-6 py-4 text-sm space-x-2">
                    <a href="detail-nasabah.html?id=${customer.id}" class="font-medium text-indigo-600 hover:text-indigo-900">Detail</a>
                    <button data-id="${customer.id}" class="btn-edit font-medium text-blue-600 hover:text-blue-900">Edit</button>
                    <button data-id="${customer.id}" class="btn-delete font-medium text-red-600 hover:text-red-900">Hapus</button>
                </td>
            </tr>`;
        customerTableBody.innerHTML += row;
    });
};

const updateDisplay = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = sortSelect.value;

    let filteredData = allCustomersData.filter(customer =>
        customer.nama.toLowerCase().includes(searchTerm)
    );

    // Sorting logic
    switch (sortValue) {
        case 'alamat-asc':
            filteredData.sort((a, b) => a.alamat.localeCompare(b.alamat));
            break;
        case 'pinjaman-desc':
            filteredData.sort((a, b) => b.totalPokokPinjaman - a.totalPokokPinjaman);
            break;
        case 'tanggal-desc':
            filteredData.sort((a, b) => b.displayLoanDate - a.displayLoanDate);
            break;
        default:
            filteredData.sort((a, b) => a.nama.localeCompare(b.nama));
            break;
    }

    renderCustomerTable(filteredData);
};

const loadCustomers = () => {
    const q = query(collection(db, 'customers'), where('status', '==', 'Aktif'));
    onSnapshot(q, async (snapshot) => {
        customerTableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">Memproses data...</td></tr>`;
        
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const customerPromises = snapshot.docs.map(async (doc) => {
            const customer = doc.data();
            const customerId = doc.id;
            
            const allLoansQuery = query(collection(db, 'loans'), where('customerId', '==', customerId), orderBy('tanggalPinjam', 'desc'));
            const allLoansSnapshot = await getDocs(allLoansQuery);
            const loanCount = allLoansSnapshot.size;
            const loanCountText = loanCount > 0 ? `Ke-${loanCount}` : '-';
            
            const activeLoansQuery = query(collection(db, 'loans'), where('customerId', '==', customerId), where('status', '==', 'Aktif'));
            const activeLoanSnapshot = await getDocs(activeLoansQuery);

            let totalSisaTagihan = 0, totalPokokPinjaman = 0, totalInstallments = 0, paidInstallments = 0;
            let paymentStatus = 'lunas';
            let displayLoanDate = new Date(0); // Tanggal yang akan ditampilkan di tabel

            if (!activeLoanSnapshot.empty) {
                // Tentukan tanggal pinjaman yang relevan (paling lama yang masih aktif)
                let oldestActiveLoanDate = new Date();
                activeLoanSnapshot.forEach(loanDoc => {
                    const loanData = loanDoc.data();
                    totalSisaTagihan += loanData.sisaTagihan;
                    totalPokokPinjaman += loanData.pokokPinjaman;
                    totalInstallments += loanData.jumlahAngsuran;
                    if (loanData.tanggalPinjam.toDate() < oldestActiveLoanDate) {
                        oldestActiveLoanDate = loanData.tanggalPinjam.toDate();
                    }
                });
                displayLoanDate = oldestActiveLoanDate;

                // --- LOGIKA PEWARNAAN BARU ---
                const paymentsTodayQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('tipe', '==', 'Angsuran'), where('tanggalTransaksi', '>=', Timestamp.fromDate(startOfToday)), where('tanggalTransaksi', '<=', Timestamp.fromDate(endOfToday)));
                const paymentTodaySnapshot = await getDocs(paymentsTodayQuery);

                if (!paymentTodaySnapshot.empty) {
                    paymentStatus = 'paid'; // HIJAU: Prioritas utama, sudah bayar hari ini.
                } else {
                    const isNewLoanToday = displayLoanDate >= startOfToday && displayLoanDate <= endOfToday;
                    if (isNewLoanToday) {
                        paymentStatus = 'new_loan'; // KUNING: Pinjaman baru, belum ada kewajiban bayar.
                    } else {
                        paymentStatus = 'due'; // MERAH: Pinjaman lama, sudah jatuh tempo hari ini.
                    }
                }

                const allPaymentsQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('tipe', '==', 'Angsuran'));
                const allPaymentsSnapshot = await getDocs(allPaymentsQuery);
                paidInstallments = allPaymentsSnapshot.size;
            }

            const remainingInstallments = totalInstallments - paidInstallments;
            const installmentText = totalInstallments > 0 ? `${remainingInstallments} dari ${totalInstallments} kali` : '-';
            
            // Menggunakan displayLoanDate untuk sorting dan tampilan
            return { id: customerId, ...customer, totalSisaTagihan, totalPokokPinjaman, installmentText, loanCountText, paymentStatus, displayLoanDate };
        });
        allCustomersData = await Promise.all(customerPromises);
        updateDisplay();
    });
};

// --- Event Listeners ---
searchInput.addEventListener('input', updateDisplay);
sortSelect.addEventListener('change', updateDisplay);

customerTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-edit')) { openModalForEdit(e.target.dataset.id); }
    if (e.target.classList.contains('btn-delete')) { openDeleteModal(e.target.dataset.id); }
});

// --- Auth Guard & Inisialisasi ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailDropdown.textContent = user.email;
        loadCustomers();
    } else {
        window.location.href = 'login.html';
    }
});

// --- Logika Umum ---
const handleLogout = (e) => { if (e) e.preventDefault(); signOut(auth).catch((error) => console.error("Error saat logout:", error)); };
logoutButton.addEventListener('click', handleLogout);
logoutLinkDropdown.addEventListener('click', handleLogout);
userMenuButton.addEventListener('click', () => userMenu.classList.toggle('hidden'));
window.addEventListener('click', (e) => { if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) { userMenu.classList.add('hidden'); } });
const toggleSidebar = () => { sidebar.classList.toggle('-translate-x-full'); sidebarOverlay.classList.toggle('hidden'); };
hamburgerButton.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
