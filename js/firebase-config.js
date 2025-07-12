// js/firebase-config.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAv45Z58eODvm4eUNMPqgKMBh2uYW59wJ8",
  authDomain: "koperasi-karya-mandiri.firebaseapp.com",
  projectId: "koperasi-karya-mandiri",
  storageBucket: "koperasi-karya-mandiri.appspot.com", // Saya perbaiki .firebasestorage. menjadi .appspot.
  messagingSenderId: "54592502610",
  appId: "1:54592502610:web:f20b2645e5a2f75927d88b",
  measurementId: "G-EMM8DFVRBJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Export a function to get the user ID
const getUserId = () => {
    return auth.currentUser?.uid;
};

// Export the services to be used in other files
export { app, auth, db, getUserId };
