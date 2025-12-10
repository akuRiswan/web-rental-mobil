// --- IMPORT FIREBASE DARI CDN ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  addDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB4d-uAVULH9g6GxvEhnwTAWCyJQ3qph54",
  authDomain: "syifa-rental-mobil.firebaseapp.com",
  projectId: "syifa-rental-mobil",
  storageBucket: "syifa-rental-mobil.firebasestorage.app",
  messagingSenderId: "442768584632",
  appId: "1:442768584632:web:45785787a75eb35f60294d",
  measurementId: "G-5Q1HBNBF42",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- STATE MANAGEMENT ---
let currentUser = null;
let allCars = [];
let unsubscribe = null;

// --- DATA AWAL ---
const initialCarData = [
  {
    name: "Toyota Avanza",
    price: 500000,
    image: "https://i.pinimg.com/1200x/55/c5/ef/55c5efd374577570c0587d2cefbb385d.jpg",
    isReady: true,
  },
  {
    name: "Honda CRV",
    price: 850000,
    image: "https://i.pinimg.com/736x/b5/96/02/b5960217718f6c6b13cfd434f3f37139.jpg",
    isReady: false,
  },
];

// --- HELPER FUNCTIONS ---
const formatRupiah = (angka) => "Rp" + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const showToast = (message, type = "success") => {
  if (typeof Toastify === "function") {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "bottom",
      position: "right",
      style: { background: type === "success" ? "#10B981" : "#EF4444" },
    }).showToast();
  } else {
    alert(message);
  }
};

// --- CORE FUNCTIONS (CRUD & RENDER) ---

// 1. RENDER KARTU MOBIL (SECURED VERSION)
const renderCarCards = (cars) => {
  const container = document.getElementById("car-list-container");
  const loading = document.getElementById("loading-indicator");

  if (!container) return;
  if (loading) loading.classList.add("hidden");
  container.innerHTML = "";

  if (cars.length === 0) {
    container.innerHTML = `<p class="text-center col-span-3 text-gray-600">Belum ada data mobil. ${
      currentUser ? 'Silakan klik "Reset Data" atau "Tambah Mobil".' : "Hubungi owner untuk update data."
    }</p>`;
    return;
  }

  cars.forEach((car) => {
    // Logika Tampilan Status & Tombol
    const statusClass = car.isReady ? "bg-green-500 text-white" : "bg-red-500 text-white";
    const statusText = car.isReady ? "READY" : "BOOKED";
    const buttonClass = car.isReady ? "bg-primary-gold hover:bg-gold-hover" : "bg-gray-400 cursor-not-allowed";
    const waText = `Halo, saya tertarik menyewa ${car.name} dengan harga ${formatRupiah(car.price)}/hari.`;
    const whatsappLink = car.isReady ? `https://wa.me/6281234567890?text=${encodeURIComponent(waText)}` : "#";

    // Buat Elemen Kartu
    const cardDiv = document.createElement("div");
    cardDiv.className =
      "card-car bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-2xl";

    // --- SECURITY FIX: MENGGUNAKAN ELEMENT CREATION & TEXTCONTENT ---

    // 1. Siapkan struktur HTML statis (Hanya kerangka, tanpa data user)
    // Kita berikan class khusus (target class) untuk elemen yang akan diisi data nanti
    cardDiv.innerHTML = `
      <div class="relative h-48 overflow-hidden bg-gray-200 group">
          <!-- img src kosongkan dulu -->
          <img class="car-img w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
          <span class="absolute top-3 right-3 text-xs font-bold py-1 px-3 rounded-full ${statusClass} shadow-sm backdrop-blur-sm bg-opacity-90 transition-colors duration-300">${statusText}</span>
      </div>
      <div class="p-6 flex flex-col flex-grow">
          <!-- Text konten kosongkan dulu -->
          <h3 class="car-name text-2xl font-bold text-black-nav mb-2 line-clamp-1"></h3>
          <p class="car-price text-3xl font-extrabold text-primary-gold mb-4"></p>
          <div class="mt-auto">
              <a href="${whatsappLink}" target="_blank" class="w-full inline-block text-center py-3 rounded-lg font-bold transition duration-300 shadow-md ${buttonClass} text-black-nav transform active:scale-95">
                  <i class="fab fa-whatsapp mr-2"></i> ${car.isReady ? "Sewa via WA" : "Tidak Tersedia"}
              </a>
          </div>
      </div>
    `;

    // 2. ISI DATA SECARA AMAN (SECURE INJECTION)

    // Set Gambar (src & alt)
    const imgEl = cardDiv.querySelector(".car-img");
    imgEl.src = car.image; // Aman: Browser menangani escaping URL
    imgEl.alt = car.name; // Aman: Jika ada tanda kutip di nama, tidak akan merusak HTML

    // Set Nama Mobil (textContent) -> Mencegah XSS
    const titleEl = cardDiv.querySelector(".car-name");
    titleEl.textContent = car.name; // Browser menganggap ini text biasa, bukan HTML
    titleEl.title = car.name; // Tooltip saat hover

    // Set Harga (textContent)
    const priceEl = cardDiv.querySelector(".car-price");
    priceEl.textContent = formatRupiah(car.price);

    // Tambahkan span "/hari" secara manual agar aman
    const perDaySpan = document.createElement("span");
    perDaySpan.className = "text-base text-gray-500 font-normal";
    perDaySpan.textContent = "/hari";
    priceEl.appendChild(perDaySpan);

    // --- SELESAI SECURITY FIX ---

    // Konten Tambahan (Kontrol Owner) - Hanya jika login
    // Bagian ini aman menggunakan innerHTML karena strukturnya statis (tombol & input)
    if (currentUser) {
      const controlsContainer = document.createElement("div");
      controlsContainer.className = "p-4 border-t border-gray-100 bg-gray-50 space-y-3 animate-[fadeIn_0.5s_ease-in-out]";

      controlsContainer.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Status Ketersediaan</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer toggle-status" ${car.isReady ? "checked" : ""}>
                    <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-gold rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 shadow-inner"></div>
                </label>
            </div>
            <div class="flex gap-2 pt-2">
                <button class="btn-edit flex-1 bg-blue-600 text-white py-2 rounded text-xs font-semibold hover:bg-blue-700 transition shadow hover:shadow-md flex items-center justify-center gap-1">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete flex-1 bg-red-600 text-white py-2 rounded text-xs font-semibold hover:bg-red-700 transition shadow hover:shadow-md flex items-center justify-center gap-1">
                    <i class="fas fa-trash-alt"></i> Hapus
                </button>
            </div>`;

      cardDiv.appendChild(controlsContainer);

      // Pasang Event Listeners (Hanya untuk Owner)
      const toggle = controlsContainer.querySelector(".toggle-status");
      const btnEdit = controlsContainer.querySelector(".btn-edit");
      const btnDelete = controlsContainer.querySelector(".btn-delete");

      toggle.addEventListener("change", (e) => updateCar(car.id, { isReady: e.target.checked }));
      btnEdit.addEventListener("click", () => openEditModal(car));
      btnDelete.addEventListener("click", () => deleteCar(car.id, car.name));
    }

    container.appendChild(cardDiv);
  });
};

// 2. LISTEN DATA (Real-time Sync dengan Firestore)
const listenToCars = () => {
  if (unsubscribe) unsubscribe();
  const q = collection(db, "cars");

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const cars = [];
      snapshot.forEach((doc) => cars.push({ id: doc.id, ...doc.data() }));
      allCars = cars.sort((a, b) => a.name.localeCompare(b.name));
      renderCarCards(allCars);
    },
    (error) => {
      console.error("Error fetching data:", error);
      showToast("Gagal memuat data realtime: " + error.message, "error");
    }
  );
};

// 3. TAMBAH MOBIL BARU (CREATE)
const addNewCar = async (carData) => {
  try {
    await addDoc(collection(db, "cars"), carData);
    showToast("Mobil berhasil ditambahkan!", "success");
  } catch (error) {
    showToast("Gagal tambah: " + error.message, "error");
  }
};

// 4. UPDATE DATA MOBIL (UPDATE)
const updateCar = async (id, updates) => {
  try {
    await updateDoc(doc(db, "cars", id), updates);
    showToast("Data berhasil diperbarui!", "success");
  } catch (error) {
    showToast("Gagal update: " + error.message, "error");
  }
};

// 5. HAPUS MOBIL (DELETE)
const deleteCar = async (id, name) => {
  if (!confirm(`Yakin ingin menghapus ${name}? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await deleteDoc(doc(db, "cars", id));
    showToast("Mobil berhasil dihapus!", "success");
  } catch (error) {
    showToast("Gagal hapus: " + error.message, "error");
  }
};

// 6. SEED DATA (Reset Database ke Default)
const seedDatabase = async () => {
  if (!confirm("Reset database ke default? Semua data lama akan diganti.")) return;
  const batch = writeBatch(db);
  initialCarData.forEach((car) => {
    const docRef = doc(collection(db, "cars"));
    batch.set(docRef, car);
  });
  try {
    await batch.commit();
    showToast("Database berhasil di-reset!", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
};

// --- FITUR MODAL DINAMIS (Untuk Tambah & Edit) ---

const openFormModal = (title, car = null) => {
  const isEdit = !!car;

  const modalHTML = `
    <div id="dynamic-modal" class="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity opacity-0">
      <div class="bg-white rounded-xl max-w-md w-full p-8 shadow-2xl transform scale-95 transition-all duration-300">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-black-nav border-l-4 border-primary-gold pl-3">${title}</h3>
          <button id="close-dynamic-modal" class="text-gray-400 hover:text-red-500 transition-colors p-1"><i class="fas fa-times text-xl"></i></button>
        </div>
        <form id="car-form" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Nama Mobil</label>
            <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><i class="fas fa-car"></i></span>
                <input type="text" id="inp-name" class="w-full pl-10 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-shadow shadow-sm" placeholder="Contoh: Toyota Avanza" required>
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Harga Sewa (per hari)</label>
            <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold">Rp</span>
                <input type="number" id="inp-price" class="w-full pl-10 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-shadow shadow-sm" placeholder="500000" required>
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">URL Gambar</label>
            <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><i class="fas fa-image"></i></span>
                <input type="url" id="inp-image" class="w-full pl-10 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-shadow shadow-sm" placeholder="https://example.com/image.jpg" required>
            </div>
            <p class="text-xs text-gray-500 mt-1">*Masukkan link gambar langsung (direct link)</p>
          </div>
          <div class="flex gap-3 pt-2">
              <button type="button" id="btn-cancel-modal" class="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition">Batal</button>
              <button type="submit" class="flex-1 bg-black-nav text-white font-bold py-2.5 rounded-lg hover:bg-gray-800 transition shadow-lg transform active:scale-95">
                ${isEdit ? "Simpan Perubahan" : "Tambah Mobil"}
              </button>
          </div>
        </form>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Isi nilai input (Safe way)
  if (car) {
    document.getElementById("inp-name").value = car.name;
    document.getElementById("inp-price").value = car.price;
    document.getElementById("inp-image").value = car.image;
  }

  const modal = document.getElementById("dynamic-modal");
  const modalContent = modal.querySelector("div");

  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    modalContent.classList.remove("scale-95");
    modalContent.classList.add("scale-100");
  });

  const closeBtn = document.getElementById("close-dynamic-modal");
  const cancelBtn = document.getElementById("btn-cancel-modal");

  const closeModal = () => {
    modal.classList.add("opacity-0");
    modalContent.classList.remove("scale-100");
    modalContent.classList.add("scale-95");
    setTimeout(() => modal.remove(), 300);
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  document.getElementById("car-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById("inp-name").value,
      price: parseInt(document.getElementById("inp-price").value),
      image: document.getElementById("inp-image").value,
      isReady: car ? car.isReady : true,
    };

    if (isEdit) await updateCar(car.id, data);
    else await addNewCar(data);

    closeModal();
  });
};

const openAddCarModal = () => openFormModal("Tambah Mobil Baru");
const openEditModal = (car) => openFormModal("Edit Mobil", car);

// --- OTENTIKASI & INISIALISASI ---

const handleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    const loginModal = document.getElementById("login-modal");
    loginModal.classList.add("hidden");
    loginModal.classList.remove("flex");
    showToast("Login Berhasil! Selamat Datang.", "success");
  } catch (e) {
    console.error("Login Error:", e);
    let errorMsg = "Terjadi kesalahan.";
    if (e.code === "auth/invalid-credential") errorMsg = "Email atau password salah.";
    showToast(errorMsg, "error");
  }
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const authElements = [
    document.getElementById("btn-logout"),
    document.getElementById("btn-logout-mobile"),
    document.getElementById("btn-seed-data"),
    document.getElementById("btn-add-car"),
  ];
  const loginLink = document.getElementById("btn-show-login");

  if (user) {
    authElements.forEach((el) => el && el.classList.remove("hidden"));
    if (loginLink) {
      loginLink.innerText = "Hi, Owner";
      loginLink.onclick = (e) => {
        e.preventDefault();
      };
    }
  } else {
    authElements.forEach((el) => el && el.classList.add("hidden"));
    if (loginLink) {
      loginLink.innerText = "Owner Login";
      loginLink.onclick = (e) => {
        e.preventDefault();
        const modal = document.getElementById("login-modal");
        modal.classList.remove("hidden");
        modal.classList.add("flex");
      };
    }
  }
  renderCarCards(allCars);
});

document.addEventListener("DOMContentLoaded", () => {
  listenToCars();

  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const closeLoginBtn = document.getElementById("btn-close-login");
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", () => {
      const modal = document.getElementById("login-modal");
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });
  }

  const logoutAction = () => signOut(auth).then(() => showToast("Logout Berhasil", "success"));
  document.getElementById("btn-logout")?.addEventListener("click", logoutAction);
  document.getElementById("btn-logout-mobile")?.addEventListener("click", logoutAction);

  const btnSeed = document.getElementById("btn-seed-data");
  if (btnSeed) btnSeed.addEventListener("click", seedDatabase);

  const btnAdd = document.getElementById("btn-add-car");
  if (btnAdd) btnAdd.addEventListener("click", openAddCarModal);

  const btnMenu = document.getElementById("mobile-menu-button");
  if (btnMenu) {
    btnMenu.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("mobile-menu").classList.toggle("hidden");
    });
  }
});
