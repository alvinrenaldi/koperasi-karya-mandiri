// js/nasabah.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Memuat dan Menampilkan Daftar Nasabah ---
const renderCustomerTable = (customersToRender) => {
    if (customersToRender.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Nasabah tidak ditemukan.</td></tr>`;
        return;
    }
    customerTableBody.innerHTML = '';
    customersToRender.forEach(customer => {
        const row = `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="font-semibold text-gray-900">${customer.nama}</div>
                    <div class="text-sm text-gray-500">${customer.alamat}</div>
                </td>
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

const loadCustomers = () => {
    const q = query(collection(db, 'customers'), where('status', '==', 'Aktif'));
    onSnapshot(q, async (snapshot) => {
        customerTableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Memproses data...</td></tr>`;
        const customerPromises = snapshot.docs.map(async (doc) => {
            const customer = doc.data();
            const customerId = doc.id;
            let totalSisaTagihan = 0;
            let totalInstallments = 0;
            let paidInstallments = 0;

            const loansQuery = query(collection(db, 'loans'), where('customerId', '==', customerId), where('status', '==', 'Aktif'));
            const loanSnapshot = await getDocs(loansQuery);
            
            // Hitung total angsuran yang harus dibayar dari semua pinjaman aktif
            loanSnapshot.forEach(loanDoc => {
                const loanData = loanDoc.data();
                totalSisaTagihan += loanData.sisaTagihan;
                totalInstallments += loanData.jumlahAngsuran;
            });

            // Hitung total angsuran yang sudah dibayar
            if (!loanSnapshot.empty) {
                const paymentsQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('tipe', '==', 'Angsuran'));
                const paymentSnapshot = await getDocs(paymentsQuery);
                paidInstallments = paymentSnapshot.size;
            }

            const remainingInstallments = totalInstallments - paidInstallments;
            const installmentText = totalInstallments > 0 ? `${remainingInstallments} dari ${totalInstallments} kali` : '-';
            
            return { id: customerId, ...customer, totalSisaTagihan, installmentText };
        });
        allCustomersData = await Promise.all(customerPromises);
        renderCustomerTable(allCustomersData);
        searchInput.dispatchEvent(new Event('input'));
    });
};

// --- Logika Pencarian ---
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm === '') {
        renderCustomerTable(allCustomersData);
    } else {
        const filteredCustomers = allCustomersData.filter(customer =>
            customer.nama.toLowerCase().includes(searchTerm)
        );
        renderCustomerTable(filteredCustomers);
    }
});

// --- Event Delegation ---
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
