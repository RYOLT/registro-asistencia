  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries



  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
      apiKey: "AIzaSyA3GvpcnNtW0iZo52HAaos0EtDOZBevLr4",
      authDomain: "asistencias-appweb.firebaseapp.com",
      projectId: "asistencias-appweb",
      storageBucket: "asistencias-appweb.appspot.com",
      messagingSenderId: "410467564295",
      appId: "1:410467564295:web:faaf4335d31071e84a63a2",
      measurementId: "G-PT0XKLN9W6"
    };


  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

  const auth = getAuth(app);
  const db = getFirestore(app);

  export { auth, db};
