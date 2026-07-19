// ========================================================
// 1. استدعاء وتهيئة قاعدة بيانات Firebase
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCi53RaZ7FsNJZUIRPCCVnXqGAfwpYt0NA",
    authDomain: "jsjsheh-481ad.firebaseapp.com",
    projectId: "jsjsheh-481ad",
    storageBucket: "jsjsheh-481ad.firebasestorage.app",
    messagingSenderId: "364314986023",
    appId: "1:364314986023:web:3717d5663cf288cd07f002",
    measurementId: "G-5XV7FT2FX3"
};

// تشغيل Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const defaultSettings = {
    siteName: "موقع الخصومات",
    logo: "https://cdn-icons-png.flaticon.com/512/3170/3170733.png"
};

function readLocalCache(key, fallback = []) {
    try {
        if(typeof localStorage === "undefined") return fallback;
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function writeLocalCache(key, value) {
    try {
        if(typeof localStorage !== "undefined") {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (error) {
        console.warn("Cache write skipped:", key);
    }
}

// ========================================================
// 2. إعدادات التلجرام
// ========================================================
const TELEGRAM_BOT_TOKEN = "8529273467:AAHZUXN4FW7pQaOLyTaImqmr2tp5c3ORUfo";
const TELEGRAM_CHAT_ID = "7821966897";

// ========================================================
// 3. المتغيرات الأساسية وعناصر HTML
// ========================================================
let menuData = []; // أصبحت فارغة وسيتم ملؤها من فايربيس
let cart = []; // مصفوفة السلة
let currentFilter = "الكل"; // القسم الافتراضي
let categories = ["الكل"]; // سيتم تحديثها من فايربيس
let menuUnsubscribe = null;

// تعريف عناصر الـ HTML
const categoryList = document.getElementById('category-list');
const menuContainer = document.getElementById('menu-container');
const cartModal = document.getElementById('cart-modal');
const cartBtnFloat = document.getElementById('cart-btn');
const siteTitle = document.getElementById('site-title');
const siteLogo = document.getElementById('site-logo-img');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const themeLabel = document.getElementById('theme-label');

function applyTheme(theme) {
    const activeTheme = theme === "day" ? "day" : "night";
    document.documentElement.dataset.theme = activeTheme;
    localStorage.setItem("siteTheme", activeTheme);

    if(themeIcon && themeLabel) {
        themeIcon.className = activeTheme === "day" ? "fa-solid fa-sun" : "fa-solid fa-moon";
        themeLabel.innerText = activeTheme === "day" ? "نهاري" : "ليلي";
    }
}

window.toggleSiteTheme = function() {
    const currentTheme = document.documentElement.dataset.theme || "night";
    const nextTheme = currentTheme === "night" ? "day" : "night";
    themeToggle?.classList.add("switching");
    applyTheme(nextTheme);
    setTimeout(() => themeToggle?.classList.remove("switching"), 500);
}

themeToggle?.addEventListener("click", window.toggleSiteTheme);

async function loadSiteSettings() {
    const savedLocal = JSON.parse(localStorage.getItem("siteSettings") || "{}");
    let settings = { ...defaultSettings, ...savedLocal };

    applySiteSettings(settings);

    try {
        const settingsSnap = await getDoc(doc(db, "settings", "general"));
        if(settingsSnap.exists()) {
            settings = { ...settings, ...settingsSnap.data() };
            localStorage.setItem("siteSettings", JSON.stringify(settings));
        }
    } catch (error) {
        console.error("Settings load error:", error);
    }

    applySiteSettings(settings);
}

function applySiteSettings(settings) {
    siteTitle.innerText = settings.siteName;
    document.title = settings.siteName;
    siteLogo.src = settings.logo;
}

// ========================================================
// 4. جلب البيانات من Firebase
// ========================================================
function sortMenuData(items) {
    return items.sort((a, b) => {
        const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
        const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
        if(aOrder !== bOrder) return aOrder - bOrder;
        return String(a.title || "").localeCompare(String(b.title || ""), "ar");
    });
}

function applyMenuData(items) {
    menuData = sortMenuData([...items]);
    categories = ["الكل", ...new Set(menuData.map(item => item.category))];
    renderCategories();
    renderMenu();
}

async function fetchMenuData() {
    const cachedMenu = readLocalCache("menuItemsCache", []);

    if(cachedMenu.length > 0) {
        applyMenuData(cachedMenu);
    } else {
        menuContainer.innerHTML = "<p style='text-align:center;'>جاري تحميل المنيو...</p>";
    }

    if(menuUnsubscribe) return;

    menuUnsubscribe = onSnapshot(collection(db, "menuItems"), (querySnapshot) => {
        const freshMenu = [];
        querySnapshot.forEach((docSnap) => {
            freshMenu.push({ id: docSnap.id, ...docSnap.data() });
        });

        writeLocalCache("menuItemsCache", freshMenu);
        applyMenuData(freshMenu);
    }, (error) => {
        console.error("حدث خطأ أثناء جلب البيانات: ", error);
        if(cachedMenu.length === 0) {
            menuContainer.innerHTML = "<p style='text-align:center;'>عذراً، حدث خطأ في تحميل المنيو.</p>";
        }
    });

    setTimeout(async () => {
        if(menuData.length > 0) return;
        try {
            const querySnapshot = await getDocs(collection(db, "menuItems"));
            const fallbackMenu = [];
            querySnapshot.forEach((docSnap) => {
                fallbackMenu.push({ id: docSnap.id, ...docSnap.data() });
            });
            writeLocalCache("menuItemsCache", fallbackMenu);
            applyMenuData(fallbackMenu);
        } catch (error) {
            console.error("Menu fallback error:", error);
        }
    }, 1800);
}

// ========================================================
// 5. دوال عرض الموقع
// ========================================================

// دالة توليد أزرار الأقسام
function renderCategories() {
    categoryList.innerHTML = "";
    categories.forEach(cat => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = `cat-btn ${currentFilter === cat ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => {
            currentFilter = cat;
            renderCategories();
            renderMenu();
        };
        li.appendChild(btn);
        categoryList.appendChild(li);
    });
}

// دالة عرض الوجبات
function renderMenu() {
    menuContainer.innerHTML = "";
    const filteredData = currentFilter === "الكل" ? menuData : menuData.filter(item => item.category === currentFilter);

    filteredData.forEach(item => {
        menuContainer.innerHTML += `
            <div class="menu-card">
                <img src="${item.img}" alt="${item.title}" loading="lazy">
                <div class="item-info">
                    <h3>${item.title}</h3>
                    <p>${item.desc}</p>
                    <div class="price-row">
                        <span class="price">${Number(item.price).toLocaleString()} د.ع</span>
                        <button class="add-btn" onclick="addToCart('${item.id}')"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}

// ========================================================
// 6. نظام سلة المشتريات
// ========================================================

// جعل الدوال متاحة عالمياً (window) لكي تعمل مع أزرار HTML بسبب استخدام نظام الـ module
window.addToCart = function(id) {
    const product = menuData.find(item => item.id === id);
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) existingItem.quantity++;
    else cart.push({ ...product, quantity: 1 });

    updateCartUI();
    
    // تأثير اهتزاز خفيف لزر السلة
    cartBtnFloat.style.transform = "translateX(-50%) scale(1.05)";
    setTimeout(() => cartBtnFloat.style.transform = "translateX(-50%) scale(1)", 200);
}

window.updateQuantity = function(id, change) {
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        cart[itemIndex].quantity += change;
        if (cart[itemIndex].quantity <= 0) cart.splice(itemIndex, 1);
    }
    updateCartUI();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

    // تحديث الأرقام
    document.getElementById('cart-count').innerText = totalItems;
    document.getElementById('cart-total-float').innerText = `${totalPrice.toLocaleString()} د.ع`;
    document.getElementById('total-price').innerText = `${totalPrice.toLocaleString()} د.ع`;

    // إظهار أو إخفاء الزر العائم للسلة
    if (cart.length > 0) cartBtnFloat.classList.add('visible');
    else {
        cartBtnFloat.classList.remove('visible');
        cartModal.classList.remove('show'); // إغلاق النافذة لو فرغت السلة
    }

    // تحديث نافذة السلة من الداخل
    const cartItemsContainer = document.getElementById('cart-items');
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">سلة الطلبات فارغة حالياً 🛒</p>';
        return;
    }

    cartItemsContainer.innerHTML = "";
    cart.forEach(item => {
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <span class="cart-item-price">${(Number(item.price) * item.quantity).toLocaleString()} د.ع</span>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                </div>
            </div>
        `;
    });
}

// دالة فتح وإغلاق السلة
window.toggleCart = function() {
    if (cart.length > 0) cartModal.classList.toggle('show');
}
// إغلاق السلة عند الضغط في المساحة الرمادية
cartModal.addEventListener('click', (e) => {
    if (e.target === cartModal) cartModal.classList.remove('show');
});

// ========================================================
// 7. نظام إرسال الفاتورة عبر تلجرام
// ========================================================
window.sendOrderTelegram = async function() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();

    if (!name || !phone) {
        alert("يرجى إدخال الاسم ورقم الهاتف لتأكيد الطلب.");
        return;
    }

    if (cart.length === 0) return;

    let total = 0;
    const orderedItems = cart.map(item => {
        total += (Number(item.price) * item.quantity);
        return {
            id: item.id,
            title: item.title,
            desc: item.desc,
            category: item.category,
            price: Number(item.price),
            quantity: item.quantity,
            img: item.img
        };
    });

    // تجهيز بيانات الطلب وتحويلها لرابط مشفر
    const orderData = {
        customer: name,
        phone: phone,
        items: orderedItems,
        total: total,
        siteLink: window.location.href.split('?')[0],
        status: "new",
        createdAt: new Date().toISOString()
    };

    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(orderData))));
    const viewLink = window.location.href.split('?')[0] + "?order=" + encodedData;

    // تجهيز الرسالة للبوت - تم التعديل إلى HTML لتفادي أخطاء التنسيق
    let message = `🔔 <b>طلب جديد من المتجر!</b>\n\n`;
    message += `👤 الاسم: ${name}\n`;
    message += `📞 الهاتف: ${phone}\n`;
    message += `💰 الإجمالي: ${total.toLocaleString()} د.ع\n\n`;
    message += `🔗 <a href="${viewLink}">اضغط هنا لعرض تفاصيل الطلب بالكامل</a>`;

    const checkoutBtn = document.querySelector('.checkout-btn');
    const originalText = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = 'جاري الإرسال... <i class="fa-solid fa-spinner fa-spin"></i>';
    checkoutBtn.disabled = true;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML", // تم تغيير التنسيق هنا لحل مشكلة الإرسال المتقطعة
            disable_web_page_preview: true
        })
    })
    .then(response => response.json())
    .then(data => {
        if(data.ok) {
            alert("تم إرسال طلبك بنجاح! شكراً لك.");
            cart = [];
            document.getElementById('cust-name').value = '';
            document.getElementById('cust-phone').value = '';
            updateCartUI();
            cartModal.classList.remove('show');
        } else {
            alert("حدث خطأ أثناء الإرسال. الرجاء المحاولة لاحقاً.");
        }
    })
    .catch(error => {
        alert("تأكد من اتصالك بالإنترنت.");
    })
    .finally(() => {
        checkoutBtn.innerHTML = originalText;
        checkoutBtn.disabled = false;
    });
}

// ========================================================
// 8. نظام استقبال وعرض الطلب (عند الضغط على الرابط من التلجرام)
// ========================================================
function checkIncomingOrder() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderRaw = urlParams.get('order');
    
    if (orderRaw) {
        try {
            const decodedData = JSON.parse(decodeURIComponent(escape(atob(orderRaw))));
            
            let msg = `📋 **تفاصيل الطلب المستلم**\n\n`;
            msg += `👤 اسم الزبون: ${decodedData.customer}\n`;
            msg += `📞 رقم الهاتف: ${decodedData.phone}\n\n`;
            msg += `🛍️ **المنتجات المطلوبة:**\n`;
            
            decodedData.items.forEach(i => {
                msg += `- ${i.title} (الكمية: ${i.qty})\n`;
            });
            
            msg += `\n💰 المجموع الكلي: ${decodedData.total.toLocaleString()} د.ع`;
            
            alert(msg);
            
            // إزالة الكود من الرابط بعد فتحه حتى لا يظهر مرة أخرى عند التحديث
            window.history.replaceState({}, document.title, window.location.pathname);
            
        } catch(e) {
            alert("عذراً، رابط الطلب غير صالح أو تالف.");
        }
    }
}

// تشغيل الموقع: جلب البيانات أولاً ثم عرضها
window.sendOrderTelegram = async function() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();

    if (!name || !phone) {
        alert("يرجى إدخال الاسم ورقم الهاتف لتأكيد الطلب.");
        return;
    }

    if (cart.length === 0) return;

    let total = 0;
    const orderedItems = cart.map(item => {
        total += (Number(item.price) * item.quantity);
        return {
            id: item.id,
            title: item.title,
            desc: item.desc,
            category: item.category,
            price: Number(item.price),
            quantity: item.quantity,
            img: item.img
        };
    });

    const orderData = {
        customer: name,
        phone: phone,
        items: orderedItems,
        total: total,
        siteLink: window.location.href.split('?')[0],
        status: "new",
        createdAt: new Date().toISOString()
    };

    const checkoutBtn = document.querySelector('.checkout-btn');
    const originalText = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = 'جاري إرسال الطلب... <i class="fa-solid fa-spinner fa-spin"></i>';
    checkoutBtn.disabled = true;

    try {
        const orderRef = await addDoc(collection(db, "orders"), orderData);
        const devicesSnapshot = await getDocs(collection(db, "notificationDevices"));
        const recipients = [];
        devicesSnapshot.forEach((deviceDoc) => {
            const token = deviceDoc.data().token || deviceDoc.id;
            if(token) recipients.push(token);
        });
        fetch("/api/pushy/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: orderRef.id, recipients, ...orderData })
        }).catch(error => console.error("Push notification error:", error));
        alert("تم إرسال طلبك بنجاح، سيظهر الطلب لدى الإدارة.");
        cart = [];
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        updateCartUI();
        cartModal.classList.remove('show');
    } catch (error) {
        console.error("Order save error:", error);
        alert("حدث خطأ أثناء إرسال الطلب. الرجاء المحاولة لاحقاً.");
    } finally {
        checkoutBtn.innerHTML = originalText;
        checkoutBtn.disabled = false;
    }
}

applyTheme(localStorage.getItem("siteTheme") || "night");
loadSiteSettings();
fetchMenuData();
updateCartUI();
checkIncomingOrder();
