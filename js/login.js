// js/login.js

// Import fungsi yang kita butuhkan dari Firebase SDK
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Cek Status Login Pengguna ---
// Fungsi ini akan berjalan setiap kali status otentikasi berubah.
// Jika pengguna sudah login, langsung arahkan ke halaman dashboard (index.html).
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Pengguna sudah login:", user.uid);
        window.location.href = 'index.html';
    } else {
        console.log("Pengguna belum login.");
    }
});


// --- Logika untuk Form Login ---

// Dapatkan elemen-elemen dari HTML
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');

// Tambahkan event listener ke form saat disubmit
loginForm.addEventListener('submit', (e) => {
    // Mencegah form dari refresh halaman
    e.preventDefault();

    // Dapatkan nilai email dan password dari input
    const email = loginEmail.value;
    const password = loginPassword.value; // <-- PERBAIKAN DI SINI

    // Validasi sederhana
    if (!email || !password) {
        loginMessage.textContent = 'Email dan password tidak boleh kosong.';
        return;
    }

    // Ubah teks tombol untuk memberi feedback ke pengguna
    loginButton.textContent = 'Memproses...';
    loginButton.disabled = true;
    loginMessage.textContent = ''; // Kosongkan pesan error sebelumnya

    // Proses login menggunakan Firebase Auth
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Jika berhasil login
            const user = userCredential.user;
            console.log("Login berhasil!", user);
            // Halaman akan otomatis redirect karena ada onAuthStateChanged di atas
        })
        .catch((error) => {
            // Jika terjadi error
            console.error("Error saat login:", error.code, error.message);
            
            // Berikan pesan error yang lebih ramah ke pengguna
            let errorMessage = "Terjadi kesalahan. Silakan coba lagi.";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "Pengguna dengan email ini tidak ditemukan.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = "Password yang Anda masukkan salah.";
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = "Email atau password salah.";
            }
            
            loginMessage.textContent = errorMessage;
        })
        .finally(() => {
            // Kembalikan tombol ke keadaan semula
            loginButton.textContent = 'Masuk';
            loginButton.disabled = false;
        });
});
