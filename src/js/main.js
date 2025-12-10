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

// --- KONFIGURASI FIREBASE (GANTI DENGAN PUNYA ANDA) ---
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
let unsubscribe = null; // Untuk cleanup listener

// --- DATA AWAL ---
const initialCarData = [
  {
    id: "avanza-001",
    name: "Toyota Avanza",
    price: 500000,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/2021_Toyota_Avanza_1.5_G_W101_%2820230528%29.jpg/1200px-2021_Toyota_Avanza_1.5_G_W101_%2820230528%29.jpg",
    isReady: true,
  },
  {
    id: "crv-002",
    name: "Honda CRV",
    price: 850000,
    image: "https://upload.wikimedia.org/wikipedia/commons/2/23/2017_Honda_CR-V_1.5_Turbo_RW1_%2820180227%29.jpg",
    isReady: false,
  },
  {
    id: "xpander-003",
    name: "Mitsubishi Xpander",
    price: 600000,
    image: "https://upload.wikimedia.org/wikipedia/commons/5/52/2019_Mitsubishi_Xpander_Ultimate_NC1W_%2820190708%29.jpg",
    isReady: true,
  },
  {
    id: "fortuner-004",
    name: "Toyota Fortuner",
    price: 1200000,
    image: "https://img.cintamobil.com/2020/10/14/E7uK71l4/toyota-fortuner-trd-sportivo-2020-0082.jpg",
    isReady: true,
  },
];

// --- HELPER FUNCTIONS ---
const formatRupiah = (angka) => {
  return "Rp" + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const showToast = (message, type = "success") => {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    style: {
      background: type === "success" ? "#10B981" : "#EF4444",
    },
  }).showToast();
};

// --- CORE FUNCTIONS ---

// 1. Render Kartu Mobil (FIXED - Sekarang re-attach event listeners dengan benar)
const renderCarCards = (cars) => {
  const container = document.getElementById("car-list-container");
  const loading = document.getElementById("loading-indicator");

  if (!container) {
    console.warn("Container not found!");
    return;
  }

  loading.classList.add("hidden");
  container.innerHTML = "";

  console.log("📝 Rendering", cars.length, "cars. User:", currentUser ? "Owner" : "Public");

  if (cars.length === 0) {
    container.innerHTML = `<p class="text-center col-span-3 text-gray-600">Belum ada data mobil. ${
      currentUser ? 'Silakan klik "Reset Data".' : "Hubungi owner untuk menambah data mobil."
    }</p>`;
    return;
  }

  cars.forEach((car) => {
    const statusClass = car.isReady ? "bg-green-500 text-white" : "bg-red-500 text-white";
    const statusText = car.isReady ? "READY" : "BOOKED";
    const buttonClass = car.isReady ? "bg-primary-gold hover:bg-gold-hover" : "bg-gray-400 cursor-not-allowed";
    const buttonText = car.isReady ? "Sewa via WA" : "Tidak Tersedia";

    const waText = `Halo, saya tertarik menyewa ${car.name} seharga ${formatRupiah(car.price)}/hari. Mohon info detail.`;
    const whatsappLink = car.isReady ? `https://wa.me/6281234567890?text=${encodeURIComponent(waText)}` : "#";

    // Card Element
    const cardDiv = document.createElement("div");
    cardDiv.className = "card-car bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col";

    cardDiv.innerHTML = `
      <div class="relative">
          <img src="${car.image}" alt="${car.name}" class="w-full h-48 object-cover">
          <span class="absolute top-3 right-3 text-xs font-bold py-1 px-3 rounded-full ${statusClass} shadow-sm">
              ${statusText}
          </span>
      </div>
      
      <div class="p-6 flex flex-col flex-grow">
          <h3 class="text-2xl font-bold text-black-nav mb-2">${car.name}</h3>
          <p class="text-3xl font-extrabold text-primary-gold mb-4">${formatRupiah(
            car.price
          )}<span class="text-base text-gray-500 font-normal">/hari</span></p>
          
          <div class="mt-auto">
              <a href="${whatsappLink}" target="_blank" 
                 class="w-full inline-block text-center py-3 rounded-lg font-bold transition duration-300 shadow-md ${buttonClass} text-black-nav"
                 ${!car.isReady ? 'onclick="return false;"' : ""}>
                  <i class="fab fa-whatsapp mr-2"></i> ${buttonText}
              </a>
          </div>
      </div>
    `;

    // Owner Controls (jika login)
    if (currentUser) {
      const controlsDiv = document.createElement("div");
      controlsDiv.className = "p-4 border-t border-gray-100 bg-gray-50 space-y-3";
      controlsDiv.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-gray-500 uppercase">Owner Control</span>
          <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer toggle-status" ${car.isReady ? "checked" : ""}>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-gold rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              <span class="ml-3 text-sm font-medium text-gray-900">${car.isReady ? "Ready" : "Booked"}</span>
          </label>
        </div>
        <div class="flex gap-2">
          <button class="btn-edit-car flex-1 bg-blue-500 text-white px-3 py-2 rounded text-xs hover:bg-blue-600 transition">
            <i class="fas fa-edit mr-1"></i> Edit
          </button>
          <button class="btn-delete-car bg-red-500 text-white px-3 py-2 rounded text-xs hover:bg-red-600 transition">
            <i class="fas fa-trash mr-1"></i> Hapus
          </button>
        </div>
      `;

      // Event Listeners untuk Owner Controls
      const toggleStatus = controlsDiv.querySelector(".toggle-status");
      const btnEdit = controlsDiv.querySelector(".btn-edit-car");
      const btnDelete = controlsDiv.querySelector(".btn-delete-car");

      toggleStatus.addEventListener("change", async (e) => {
        const newStatus = e.target.checked;
        console.log("Toggle status for", car.name, "to", newStatus);
        await updateCarStatus(car.id, { isReady: newStatus });
      });

      btnEdit.addEventListener("click", () => {
        console.log("Edit clicked for", car.name);
        openEditModal(car);
      });

      btnDelete.addEventListener("click", () => {
        console.log("Delete clicked for", car.name);
        deleteCar(car.id, car.name);
      });

      cardDiv.appendChild(controlsDiv);
    }

    container.appendChild(cardDiv);
  });

  console.log("✅ Render complete");
};

// 2. Fetch Data Real-time (FIXED)
const listenToCars = () => {
  // Cleanup listener lama jika ada
  if (unsubscribe) {
    console.log("Cleaning up old listener");
    unsubscribe();
  }

  console.log("Setting up new Firestore listener...");
  const q = collection(db, "cars");
  unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const cars = [];
      querySnapshot.forEach((doc) => {
        cars.push({ id: doc.id, ...doc.data() });
      });

      // Sort by name untuk konsistensi tampilan
      cars.sort((a, b) => a.name.localeCompare(b.name));

      allCars = cars;
      console.log("✅ Firestore data received:", cars.length, "cars");
      console.log("Current user:", currentUser ? "Logged in" : "Public view");

      // Render ulang setiap kali ada update
      renderCarCards(allCars);
    },
    (error) => {
      console.error("❌ Error listening to cars:", error);
      showToast("Gagal memuat data: " + error.message, "error");
    }
  );
};

// 3. Update Status atau Data Mobil (FIXED - Sekarang lebih general)
const updateCarStatus = async (id, updates) => {
  try {
    const carRef = doc(db, "cars", id);
    await updateDoc(carRef, updates);
    showToast("Data berhasil diperbarui!", "success");
  } catch (error) {
    console.error("Error updating document: ", error);
    showToast("Gagal update data: " + error.message, "error");
  }
};

// 4. Seeding Data
const seedDatabase = async () => {
  const confirmReset = confirm("Ini akan menghapus/menimpa data di database dengan data default. Lanjutkan?");
  if (!confirmReset) return;

  console.log("🔄 Starting seed process...");

  const batch = writeBatch(db);
  initialCarData.forEach((car) => {
    const docRef = doc(db, "cars", car.id);
    console.log("Adding:", car.name, "with ID:", car.id);
    batch.set(docRef, {
      name: car.name,
      price: car.price,
      image: car.image,
      isReady: car.isReady,
    });
  });

  try {
    await batch.commit();
    console.log("✅ Seed completed successfully!");
    showToast("Database berhasil di-reset! (" + initialCarData.length + " mobil)", "success");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);

    // Tampilkan error yang lebih detail
    if (error.code === "permission-denied") {
      showToast("Gagal: Permission denied. Cek Firebase Rules!", "error");
    } else if (error.code === "unavailable") {
      showToast("Gagal: Firestore tidak tersedia. Cek koneksi internet!", "error");
    } else {
      showToast("Gagal reset db: " + error.message, "error");
    }
  }
};

// 5. NEW: Tambah Mobil Baru
const addNewCar = async (carData) => {
  try {
    await addDoc(collection(db, "cars"), carData);
    showToast("Mobil baru berhasil ditambahkan!", "success");
  } catch (error) {
    console.error("Error adding car:", error);
    showToast("Gagal menambah mobil: " + error.message, "error");
  }
};

// 6. NEW: Hapus Mobil
const deleteCar = async (id, name) => {
  const confirm = window.confirm(`Yakin ingin menghapus ${name}?`);
  if (!confirm) return;

  try {
    await deleteDoc(doc(db, "cars", id));
    showToast("Mobil berhasil dihapus!", "success");
  } catch (error) {
    console.error("Error deleting car:", error);
    showToast("Gagal menghapus mobil: " + error.message, "error");
  }
};

// 7. NEW: Modal untuk Edit Mobil
const openEditModal = (car) => {
  const modalHTML = `
    <div id="edit-modal" class="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-white rounded-xl max-w-md w-full p-8 shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-black-nav">Edit Mobil</h3>
          <button id="close-edit-modal" class="text-gray-400 hover:text-black transition">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form id="edit-car-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Mobil</label>
            <input type="text" id="edit-name" value="${car.name}" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Harga (per hari)</label>
            <input type="number" id="edit-price" value="${car.price}" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">URL Gambar</label>
            <input type="url" id="edit-image" value="${car.image}" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" required>
          </div>
          
          <div class="flex gap-2 pt-4">
            <button type="submit" class="flex-1 bg-primary-gold text-black-nav font-bold py-3 rounded-lg hover:bg-gold-hover transition">
              Simpan Perubahan
            </button>
            <button type="button" id="cancel-edit" class="px-6 bg-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-400 transition">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("edit-modal");
  const form = document.getElementById("edit-car-form");
  const closeBtn = document.getElementById("close-edit-modal");
  const cancelBtn = document.getElementById("cancel-edit");

  const closeModal = () => modal.remove();

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const updates = {
      name: document.getElementById("edit-name").value,
      price: parseInt(document.getElementById("edit-price").value),
      image: document.getElementById("edit-image").value,
    };
    await updateCarStatus(car.id, updates);
    closeModal();
  });
};

// 8. NEW: Modal untuk Tambah Mobil Baru
const openAddCarModal = () => {
  const modalHTML = `
    <div id="add-modal" class="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-white rounded-xl max-w-md w-full p-8 shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-black-nav">Tambah Mobil Baru</h3>
          <button id="close-add-modal" class="text-gray-400 hover:text-black transition">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form id="add-car-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Mobil</label>
            <input type="text" id="add-name" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" placeholder="Toyota Innova" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Harga (per hari)</label>
            <input type="number" id="add-price" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" placeholder="750000" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">URL Gambar</label>
            <input type="url" id="add-image" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none" placeholder="https://..." required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="add-status" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none">
              <option value="true">Ready</option>
              <option value="false">Booked</option>
            </select>
          </div>
          
          <div class="flex gap-2 pt-4">
            <button type="submit" class="flex-1 bg-primary-gold text-black-nav font-bold py-3 rounded-lg hover:bg-gold-hover transition">
              Tambah Mobil
            </button>
            <button type="button" id="cancel-add" class="px-6 bg-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-400 transition">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("add-modal");
  const form = document.getElementById("add-car-form");
  const closeBtn = document.getElementById("close-add-modal");
  const cancelBtn = document.getElementById("cancel-add");

  const closeModal = () => modal.remove();

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newCar = {
      name: document.getElementById("add-name").value,
      price: parseInt(document.getElementById("add-price").value),
      image: document.getElementById("add-image").value,
      isReady: document.getElementById("add-status").value === "true",
    };
    await addNewCar(newCar);
    closeModal();
  });
};

// --- AUTHENTICATION LOGIC ---

const toggleLoginModal = (show) => {
  const modal = document.getElementById("login-modal");
  if (modal) {
    if (show) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    } else {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  }
};

const handleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    toggleLoginModal(false);
    showToast("Login Berhasil! Selamat datang Owner.", "success");
  } catch (error) {
    console.error("Login error:", error);
    showToast("Login Gagal: " + error.message, "error");
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    showToast("Logout Berhasil.", "success");
  } catch (error) {
    showToast("Error logout", "error");
  }
};

// Monitor Status Login
onAuthStateChanged(auth, (user) => {
  console.log("🔐 Auth state changed. User:", user ? user.email : "Not logged in");
  currentUser = user;

  const logoutBtns = [document.getElementById("btn-logout"), document.getElementById("btn-logout-mobile")];
  const seedBtn = document.getElementById("btn-seed-data");
  const addCarBtn = document.getElementById("btn-add-car");
  const loginLink = document.getElementById("btn-show-login");

  if (user) {
    // User logged in
    console.log("👤 Owner logged in");
    logoutBtns.forEach((btn) => {
      if (btn) btn.classList.remove("hidden");
    });
    if (seedBtn) seedBtn.classList.remove("hidden");
    if (addCarBtn) addCarBtn.classList.remove("hidden");
    if (loginLink) {
      loginLink.innerText = `Hi, Owner`;
      loginLink.onclick = (e) => {
        e.preventDefault();
        handleLogout();
      };
    }
  } else {
    // User logged out (public view)
    console.log("👁️ Public view (not logged in)");
    logoutBtns.forEach((btn) => {
      if (btn) btn.classList.add("hidden");
    });
    if (seedBtn) seedBtn.classList.add("hidden");
    if (addCarBtn) addCarBtn.classList.add("hidden");
    if (loginLink) {
      loginLink.innerText = "Owner Login";
      loginLink.onclick = (e) => {
        e.preventDefault();
        toggleLoginModal(true);
      };
    }
  }

  // PENTING: Render ulang cards dengan data yang sudah ada
  // Ini memastikan UI update sesuai status login
  console.log("🔄 Re-rendering cards. Current data:", allCars.length, "cars");
  renderCarCards(allCars);
});

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Loaded, initializing...");

  // Jalankan listener database
  listenToCars();

  // Login Modal Handlers
  const btnShowLogin = document.getElementById("btn-show-login");
  const btnCloseLogin = document.getElementById("btn-close-login");
  const loginForm = document.getElementById("login-form");

  if (btnShowLogin) {
    btnShowLogin.addEventListener("click", (e) => {
      e.preventDefault();
      if (!currentUser) toggleLoginModal(true);
    });
  }

  if (btnCloseLogin) {
    btnCloseLogin.addEventListener("click", (e) => {
      e.preventDefault();
      toggleLoginModal(false);
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Logout Handlers
  const btnLogout = document.getElementById("btn-logout");
  const btnLogoutMobile = document.getElementById("btn-logout-mobile");

  if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Seed Database Handler
  const btnSeedData = document.getElementById("btn-seed-data");
  if (btnSeedData) {
    btnSeedData.addEventListener("click", (e) => {
      e.preventDefault();
      seedDatabase();
    });
  }

  // NEW: Add Car Handler
  const btnAddCar = document.getElementById("btn-add-car");
  if (btnAddCar) {
    btnAddCar.addEventListener("click", (e) => {
      e.preventDefault();
      openAddCarModal();
    });
  }

  // Mobile Menu Toggle
  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener("click", (e) => {
      e.preventDefault();
      mobileMenu.classList.toggle("hidden");
    });
  }
});
