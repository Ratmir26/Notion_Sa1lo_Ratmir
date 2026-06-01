const FIREBASE_API_KEY = "AIzaSyBzsOtjtfCGST9ECTvK58ISkNKXWJRz5F8";
const FIREBASE_AUTH_DOMAIN = "school-vote-ecbcd.firebaseapp.com";
const FIREBASE_DATABASE_URL = "https://school-vote-ecbcd-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_PROJECT_ID = "school-vote-ecbcd";
const FIREBASE_STORAGE_BUCKET = "school-vote-ecbcd.firebasestorage.app";
const FIREBASE_MESSAGING_SENDER_ID = "630501523978";
const FIREBASE_APP_ID = "1:630501523978:web:2ab7ff37983f29e86f55f3";

const POLL_ID = 'poll';

firebase.initializeApp({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_DATABASE_URL,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID
});
