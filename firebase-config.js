/* ============================================================
   Firebase Configuration
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyBkN3SIKqsLDYH3Zl2m4Xgx9DFVcHKPxa4",
  authDomain: "tenis-cafe-menu.firebaseapp.com",
  projectId: "tenis-cafe-menu",
  storageBucket: "tenis-cafe-menu.firebasestorage.app",
  messagingSenderId: "577046340647",
  appId: "1:577046340647:web:7a92745aed3ae629d35a02"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
