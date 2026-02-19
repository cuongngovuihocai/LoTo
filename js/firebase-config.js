// Import thư viện Firebase từ CDN (đặt trong file html)
// Đây là file cấu hình
const firebaseConfig = {
  apiKey: "AIzaSyBbCNIYJfJHjk-TN4nwOqBJo-Bw2S1xGdo",
  authDomain: "loto-1c092.firebaseapp.com",
  databaseURL: "https://loto-1c092-default-rtdb.firebaseio.com",
  projectId: "loto-1c092",
  storageBucket: "loto-1c092.firebasestorage.app",
  messagingSenderId: "630799092827",
  appId: "1:630799092827:web:31130dafbdb6bf43a8c37e"
};

// Khởi tạo (Initialize)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();