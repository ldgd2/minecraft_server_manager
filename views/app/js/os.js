// --- CONFIGURATION ---
const MAX_WINDOWS = 2;
let openWindows = []; // Array to store IDs of open windows [oldest, ..., newest]

// --- AVAILABLE APPS ---
const AVAILABLE_APPS = [
    { name: 'Servers', url: '/servers', icon: 'ph-hard-drives', color: 'text-blue-500' },
    { name: 'Worlds', url: '/worlds', icon: 'ph-globe-hemisphere-west', color: 'text-green-500' },
    { name: 'Mods', url: '/modloaders', icon: 'ph-puzzle-piece', color: 'text-purple-500' },
    { name: 'Audit', url: '/audit', icon: 'ph-scroll', color: 'text-yellow-500' },
    { name: 'Versions', url: '/versions', icon: 'ph-git-branch', color: 'text-orange-500' },
    { name: 'Settings', url: '/settings', icon: 'ph-gear', color: 'text-slate-300' },
    { name: 'Files', url: '/files', icon: 'ph-folder', color: 'text-yellow-400' }
];

// --- 1. WINDOW COMPONENT SYSTEM (LAYOUT) ---
class WindowComponent {
    constructor({ id, title, iconClass, iconColor, content, x = 80, y = 80, width = 800, height = 500 }) {
        this.id = id;
        this.title = title;
        this.iconClass = iconClass;
        this.iconColor = iconColor || 'text-white';
        this.content = content;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    render() {
        // Se elimina 'flex' del class list inicial para evitar conflictos con 'hidden'
        // Using onclick attributes that map to global functions defined below
        return `
        <div id="${this.id}" class="absolute bg-[#202020] rounded-lg shadow-win-window border border-win-border flex flex-col overflow-hidden z-10 window-transition hidden" 
             style="top: ${this.y}px; left: ${this.x}px; width: ${this.width}px; height: ${this.height}px; min-width: 400px; min-height: 300px;"
             onmousedown="bringToFront('${this.id}')">
            
            <!-- Resize Handles -->
            <div class="resize-handle resize-n" onmousedown="startResize(event, '${this.id}', 'n')"></div>
            <div class="resize-handle resize-s" onmousedown="startResize(event, '${this.id}', 's')"></div>
            <div class="resize-handle resize-e" onmousedown="startResize(event, '${this.id}', 'e')"></div>
            <div class="resize-handle resize-w" onmousedown="startResize(event, '${this.id}', 'w')"></div>
            <div class="resize-handle resize-nw" onmousedown="startResize(event, '${this.id}', 'nw')"></div>
            <div class="resize-handle resize-ne" onmousedown="startResize(event, '${this.id}', 'ne')"></div>
            <div class="resize-handle resize-sw" onmousedown="startResize(event, '${this.id}', 'sw')"></div>
            <div class="resize-handle resize-se" onmousedown="startResize(event, '${this.id}', 'se')"></div>
            
            <!-- Layout: Title Bar -->
            <div class="h-10 mica-effect flex justify-between items-center px-4 select-none cursor-default border-b border-black/20 win-titlebar" onmousedown="startDrag(event, '${this.id}')">
                <div class="flex items-center gap-3 text-xs">
                    <i class="ph-fill ${this.iconClass} ${this.iconColor} text-lg"></i>
                    <span class="font-medium tracking-wide text-gray-200">${this.title}</span>
                </div>
                <div class="flex h-full items-center">
                    <button class="w-10 h-full flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-colors" onclick="minimizeWindow('${this.id}')"><i class="ph ph-minus"></i></button>
                    <button class="w-10 h-full flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-colors" onclick="maximizeWindow('${this.id}')"><i class="ph ph-square"></i></button>
                    <button class="w-10 h-full flex items-center justify-center hover:bg-red-600 text-gray-400 hover:text-white transition-colors rounded-tr-lg" onclick="closeWindow('${this.id}')"><i class="ph ph-x"></i></button>
                </div>
            </div>
            
            <!-- Turn off default navigation bar for Browser since it has its own, or keep consistent? User said "in each window". Let's add it for generic apps. -->
            <div class="h-10 bg-[#2b2b2b] flex items-center px-4 gap-4 border-b border-black/20 ${this.id === 'browserWindow' ? 'hidden' : ''}">
                <div class="flex gap-2 text-gray-400">
                    <button class="p-1 hover:bg-white/10 rounded transition-colors" onclick="navBack('${this.id}')"><i class="ph ph-arrow-left"></i></button>
                    <button class="p-1 hover:bg-white/10 rounded transition-colors" onclick="navForward('${this.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="p-1 hover:bg-white/10 rounded transition-colors" onclick="navReload('${this.id}')"><i class="ph ph-arrow-clockwise"></i></button>
                </div>
                 <!-- Breadcrumbs or simple title mirroring could go here -->
            </div>

            <!-- Layout: Content Area with scroll -->
            <div class="flex-1 bg-[#191919] relative overflow-auto flex flex-col win-content">
                ${this.content}
            </div>
        </div>
        `;
    }
}

// --- NAVIGATION FUNCTIONS ---
function navBack(winId) {
    const iframe = document.querySelector(`#${winId} iframe`);
    if(iframe && iframe.contentWindow) {
        iframe.contentWindow.history.back();
    }
}

function navForward(winId) {
    const iframe = document.querySelector(`#${winId} iframe`);
    if(iframe && iframe.contentWindow) {
        iframe.contentWindow.history.forward();
    }
}

function navReload(winId) {
    const iframe = document.querySelector(`#${winId} iframe`);
    if(iframe && iframe.contentWindow) {
        iframe.contentWindow.location.reload();
    }
}

// --- INITIALIZATION ---
// Create the legacy browser window component automatically on load (so it's ready in DOM)
document.addEventListener('DOMContentLoaded', () => {
    const browserContent = `
        <!-- Address Bar -->
        <div class="h-12 bg-[#2b2b2b] flex items-center px-4 gap-4 border-b border-black">
            <div class="flex gap-2 text-gray-400">
                <i class="ph ph-arrow-left hover:text-white cursor-pointer"></i>
                <i class="ph ph-arrow-right hover:text-white cursor-pointer"></i>
                <i class="ph ph-arrow-clockwise hover:text-white cursor-pointer"></i>
            </div>
            <div class="flex-1 bg-[#202020] rounded-full px-4 py-1.5 text-sm text-gray-300 flex items-center gap-2 border border-transparent focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <i class="ph ph-lock-key text-green-500 text-xs"></i>
                <span>https://nexus-ui.com</span>
            </div>
        </div>
        <!-- Content -->
        <div class="flex-1 bg-white relative">
            <iframe src="about:blank" class="w-full h-full border-none pointer-events-none opacity-50"></iframe>
            <div class="absolute inset-0 flex items-center justify-center flex-col text-slate-800">
                <h2 class="text-3xl font-bold mb-2">Nexus Web</h2>
                <p>Navegador Simulado</p>
            </div>
        </div>
    `;

    const browser = new WindowComponent({
        id: 'browserWindow',
        title: 'Nexus Browser',
        iconClass: 'ph-globe',
        iconColor: 'text-emerald-400',
        content: browserContent,
        x: 120, y: 50,
        width: 900, height: 600
    });

    const container = document.getElementById('windows-container');
    if(container) {
        // Append instead of overwrite to be safe if multiple static things exist eventually
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = browser.render();
        container.appendChild(tempDiv.firstElementChild);
    }
});

// --- LOGIN LOGIC ---
function showLogin() {
    const lockScreen = document.getElementById('lock-screen');
    const loginScreen = document.getElementById('login-screen');
    
    // Animate lock screen out
    lockScreen.style.transform = 'translateY(-100%)';
    lockScreen.style.opacity = '0';
    
    // Show login screen
    document.body.classList.add('login-mode');
    loginScreen.classList.remove('hidden');
    setTimeout(() => {
        loginScreen.classList.remove('opacity-0');
    }, 50);
    
    // Focus password
    setTimeout(() => {
        document.getElementById('password-input').focus();
    }, 500);
}

async function attemptLogin() {
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    
    // Remove toLowerCase() to support case-sensitive usernames if needed, 
    // or keep it if your system requires lowercase. safely: trim() is good.
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    const message = document.getElementById('login-message');
    const inputContainer = passwordInput.parentElement;

    // Clear previous errors
    message.textContent = '';
    
    console.log("DEBUG: Attempting login with:", username);

    try {
        const res = await fetch('/auth/login', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        console.log("DEBUG: Login response status:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("DEBUG: Login failed response:", errorText);
            throw new Error(`Error ${res.status}: ${errorText || 'Usuario o contraseña incorrectos'}`);
        }
        
        const data = await res.json();
        console.log("DEBUG: Login successful, token received");
        
        // Success
        localStorage.setItem("token", data.access_token);
        
        const loginScreen = document.getElementById('login-screen');
        loginScreen.style.opacity = '0';
        
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            document.body.classList.remove('login-mode');
            document.getElementById('desktop').classList.remove('hidden');
            document.getElementById('desktop').classList.add('animate-fade-in');
            
            // Reset lock screen for next time (optional)
            document.getElementById('lock-screen').classList.add('hidden');
        }, 500);

    } catch (e) {
        // Fail
        console.error("DEBUG: Login error catch:", e);
        message.textContent = 'Usuario o contraseña incorrectos.'; 
        inputContainer.classList.add('animate-shake');
        usernameInput.parentElement.classList.add('animate-shake');
        
        document.getElementById('password-input').value = '';
        
        setTimeout(() => {
            inputContainer.classList.remove('animate-shake');
            usernameInput.parentElement.classList.remove('animate-shake');
        }, 500);
    }
}


function handleEnter(e) {
    if (e.key === 'Enter') {
        attemptLogin();
    }
}

function lockSystem() {
     window.location.reload(); // Simple reload to simulate logout
}


// --- RELOJ ---
function updateClock() {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    
    const timeString = now.toLocaleTimeString([], timeOptions);
    const dateString = now.toLocaleDateString('es-ES', dateOptions); // Forzar español
    
    // Update Taskbar Clock
    const clockTime = document.getElementById('clock-time');
    const clockDate = document.getElementById('clock-date');
    
    if(clockTime) clockTime.textContent = timeString;
    if(clockDate) clockDate.textContent = now.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Update Lock Screen Clock
    const lockTime = document.getElementById('lock-time');
    const lockDate = document.getElementById('lock-date');
    
    if(lockTime) lockTime.textContent = timeString;
    if(lockDate) lockDate.textContent = dateString;
}
setInterval(updateClock, 1000);
updateClock();

// --- WINDOW MANAGEMENT ---
let zIndexCounter = 50;

function bringToFront(id) {
    zIndexCounter++;
    const win = document.getElementById(id);
    if(win) {
        win.style.zIndex = zIndexCounter;
        
        // Update LRU: move id to end of array
        const idx = openWindows.indexOf(id);
        if (idx > -1) {
            openWindows.splice(idx, 1);
            openWindows.push(id);
        }
    }
}

function manageWindowLimit(newId) {
    // If window is already open, just bring to front (handled in openWindow)
    if (openWindows.includes(newId)) {
        return true;
    }

    // If limit reached, close oldest
    if (openWindows.length >= MAX_WINDOWS) {
        const oldestId = openWindows[0]; // First element is oldest
        closeWindow(oldestId);
        // closeWindow will remove it from array, but let's be safe and let openWindow add the new one
    }
    return true;
}

function createOrGetWindow(app) {
    const winId = `app-window-${app.name}`;
    let win = document.getElementById(winId);

    if (!win) {
        const iframeContent = `<iframe src="${app.url}" class="w-full h-full border-none" style="background: transparent;"></iframe>`;
        // Normalize icon class: remove 'ph-fill' if present as we add it or handle it in component
        // The component expects full class string basically
        const iconClass = `ph-fill ${app.icon}`;
        
        const component = new WindowComponent({
            id: winId,
            title: app.name,
            iconClass: app.icon, // Passing just the icon name part usually, let's fix in render if needed or pass full
            // Actually existing AVAILABLE_APPS has 'ph-hard-drives'.
            // The template uses <i class="ph-fill ${app.icon} ..."> so passing just name is fine if logic aligns.
            // Let's adjust to be safe:
            iconClass: `ph-fill ${app.icon}`,
            iconColor: app.color,
            content: iframeContent,
            x: 100 + (openWindows.length * 30), // Cascade slightly
            y: 50 + (openWindows.length * 30)
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = component.render();
        win = tempDiv.firstElementChild;
        document.getElementById('windows-container').appendChild(win);
    }
    return winId;
}

function openWindow(id) {
    manageWindowLimit(id);

    const win = document.getElementById(id);
    if(!win) return;
    
    // Add to openWindows if not present
    if (!openWindows.includes(id)) {
        openWindows.push(id);
        createTaskbarIndicator(id);
    }

    // CORRECCIÓN PRINCIPAL:
    // IMPORTANT: Remove hidden class first
    win.classList.remove('hidden'); 
    // Then apply display flex
    win.style.display = 'flex';
    
    setTimeout(() => {
        win.classList.remove('minimized');
        win.classList.add('animate-pop-up');
    }, 10);
    
    bringToFront(id);
    
    if(id === 'browserWindow') {
        const ind = document.getElementById('browserIndicator');
        if(ind) ind.classList.remove('hidden');
    }
}

function closeWindow(id) {
    const win = document.getElementById(id);
    if(!win) return;
    
    win.classList.add('minimized');
    setTimeout(() => {
        win.style.display = 'none';
        win.classList.add('hidden'); // Fix: Ensure hidden class is added back
        win.classList.remove('minimized'); // Reset state for next open
    }, 200);

    // Remove from openWindows
    const idx = openWindows.indexOf(id);
    if (idx > -1) {
        openWindows.splice(idx, 1);
    }
    
    removeTaskbarIndicator(id);

    if(id === 'browserWindow') {
        const ind = document.getElementById('browserIndicator');
        if(ind) ind.classList.add('hidden');
    }
}

function minimizeWindow(id) {
    const win = document.getElementById(id);
    if(win) win.classList.toggle('minimized');
}

function maximizeWindow(id) {
    const win = document.getElementById(id);
    if(win) win.classList.toggle('maximized');
}

function toggleWindow(id) {
    const win = document.getElementById(id);
    if(!win) {
        // Special case for apps not yet created/in-dom if we just call openWindow without launchApp
        // But for toggle it usually implies existence. 
        // For browser it exists.
        return; 
    }
    
    if (win.classList.contains('hidden') || win.classList.contains('minimized')) {
        openWindow(id);
    } else {
        minimizeWindow(id);
    }
}

// --- APP LAUNCHER ---
function launchApp(appName) {
    const app = AVAILABLE_APPS.find(a => a.name === appName);
    if(app) {
        const winId = createOrGetWindow(app);
        openWindow(winId);
        
        // Close start menu
        const menu = document.getElementById('start-menu');
        if (!menu.classList.contains('hidden')) {
             toggleStartMenu();
        }
    }
}

function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if(!query) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    
    const filtered = AVAILABLE_APPS.filter(app => app.name.toLowerCase().includes(query.toLowerCase()));
    
    if(filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="p-4 text-xs text-gray-400 text-center">No se encontraron resultados</div>';
        return;
    }

    filtered.forEach(app => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors';
        item.onclick = () => launchApp(app.name);
        item.innerHTML = `
            <div class="${app.color}"><i class="ph-fill ${app.icon} text-2xl"></i></div>
            <span class="text-sm font-medium">${app.name}</span>
        `;
        resultsContainer.appendChild(item);
    });
}

// --- TASKBAR MANAGEMENT ---
function createTaskbarIndicator(winId) {
    const taskbarApps = document.getElementById('taskbar-apps');
    if (!taskbarApps) return;

    // Check if button already exists
    const btnId = `taskbar-btn-${winId}`;
    if (document.getElementById(btnId)) return;

    const appName = winId.replace('app-window-', '').replace('browserWindow', 'Navegador');
    // Find app config for icon
    const appConfig = AVAILABLE_APPS.find(a => `app-window-${a.name}` === winId);
    
// --- START MENU EXTENDED ---
function toggleAllApps(showAll) {
    const allAppsView = document.getElementById('start-view-all');
    
    if (showAll) {
        allAppsView.classList.remove('translate-x-full');
        populateAllApps();
    } else {
        allAppsView.classList.add('translate-x-full');
    }
}

function populateAllApps() {
    const list = document.getElementById('all-apps-list');
    if (list.childElementCount > 0) return; // Already populated
    
    const sorted = [...AVAILABLE_APPS].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(app => {
        // Derive bg color from text color (e.g. text-blue-500 -> bg-blue-500)
        // Special case for Files (yellow-400)
        let bgClass = app.color.replace('text-', 'bg-');
        let iconTxtClass = 'text-white';
        
        if (app.name === 'Files') {
            bgClass = 'bg-yellow-400';
            iconTxtClass = 'text-black';
        }
        
        const item = document.createElement('button');
        item.className = 'w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer transition-colors group text-left';
        item.onclick = () => launchApp(app.name);
        item.innerHTML = `
            <div class="w-8 h-8 ${bgClass} rounded flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <i class="ph-fill ${app.icon} ${iconTxtClass} text-lg"></i>
            </div>
            <span class="text-xs font-medium text-gray-200">${app.name}</span>
        `;
        list.appendChild(item);
    });
}
    let iconClass = 'ph-browsers';
    let colorClass = 'text-blue-400';
    
    if (appConfig) {
        iconClass = appConfig.icon;
        colorClass = appConfig.color;
    } else if (winId === 'browserWindow') {
        iconClass = 'ph-globe';
        colorClass = 'text-emerald-400';
    }

    const btn = document.createElement('button');
    btn.id = btnId;
    btn.className = `h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 relative animate-pop-up`;
    btn.onclick = () => toggleWindow(winId);
    btn.title = appName;
    
    btn.innerHTML = `
        <i class="ph-fill ${iconClass} text-xl ${colorClass}"></i>
        <div class="absolute bottom-1 w-1.5 h-1 bg-gray-400 rounded-full"></div>
    `;
    
    taskbarApps.appendChild(btn);
}

function removeTaskbarIndicator(winId) {
    const btnId = `taskbar-btn-${winId}`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.remove();
    }
}

function toggleStartMenu() {
    const menu = document.getElementById('start-menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
        const input = document.getElementById('start-search-input');
        if(input) input.focus();
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
}

// --- DRAG AND DROP ---
let isDragging = false;
let currentWindow = null;
let offset = { x: 0, y: 0 };

function startDrag(e, id) {
    if(e.target.closest('button')) return; // No drag if clicking buttons

    isDragging = true;
    currentWindow = document.getElementById(id);
    
    bringToFront(id);

    // Get mouse offset relative to window
    const rect = currentWindow.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;

    // Remove maximized class if dragging
    if(currentWindow.classList.contains('maximized')) {
        currentWindow.classList.remove('maximized');
    }
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentWindow) return;
    e.preventDefault();

    const x = e.clientX - offset.x;
    const y = e.clientY - offset.y;

    currentWindow.style.left = `${x}px`;
    currentWindow.style.top = `${y}px`;
    currentWindow.style.transform = 'none'; // Disable transition transform during drag
});

document.addEventListener('mouseup', (e) => {
    // Handle snap on drag end
    if (isDragging && currentWindow && snapZone) {
        applySnap(currentWindow.id, snapZone);
        hideSnapPreview();
    }
    
    // Handle resize end
    if (isResizing && resizeWindow) {
        resizeWindow = null;
        isResizing = false;
        resizeDir = null;
        document.body.style.cursor = '';
    }
    
    isDragging = false;
    currentWindow = null;
    snapZone = null;
});

// Close start menu when clicking Desktop
document.body.addEventListener('click', (e) => {
    const startMenu = document.getElementById('start-menu');
    const startBtn = document.querySelector('button[onclick="toggleStartMenu()"]');
    
    // Safety check if elements exist
    if(startMenu && startBtn) {
        if(!startMenu.contains(e.target) && !startBtn.contains(e.target) && !document.getElementById('lock-screen').contains(e.target)) {
             if(!document.getElementById('desktop').classList.contains('hidden') && !startMenu.classList.contains('hidden')) {
                 toggleStartMenu();
             }
        }
    }
});

// ============================================
// RESIZE FUNCTIONALITY
// ============================================
let isResizing = false;
let resizeWindow = null;
let resizeDir = null;
let resizeStart = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 };

function startResize(e, id, dir) {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    resizeDir = dir;
    resizeWindow = document.getElementById(id);
    
    bringToFront(id);
    
    const rect = resizeWindow.getBoundingClientRect();
    resizeStart = {
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
    };
    
    // Set cursor
    const cursors = {
        'n': 'ns-resize', 's': 'ns-resize',
        'e': 'ew-resize', 'w': 'ew-resize',
        'nw': 'nwse-resize', 'se': 'nwse-resize',
        'ne': 'nesw-resize', 'sw': 'nesw-resize'
    };
    document.body.style.cursor = cursors[dir] || 'default';
}

document.addEventListener('mousemove', (e) => {
    // Handle resize
    if (isResizing && resizeWindow) {
        e.preventDefault();
        
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newLeft = resizeStart.left;
        let newTop = resizeStart.top;
        
        // Calculate new dimensions based on direction
        if (resizeDir.includes('e')) newWidth = Math.max(400, resizeStart.width + dx);
        if (resizeDir.includes('w')) {
            newWidth = Math.max(400, resizeStart.width - dx);
            newLeft = resizeStart.left + (resizeStart.width - newWidth);
        }
        if (resizeDir.includes('s')) newHeight = Math.max(300, resizeStart.height + dy);
        if (resizeDir.includes('n')) {
            newHeight = Math.max(300, resizeStart.height - dy);
            newTop = resizeStart.top + (resizeStart.height - newHeight);
        }
        
        resizeWindow.style.width = `${newWidth}px`;
        resizeWindow.style.height = `${newHeight}px`;
        resizeWindow.style.left = `${newLeft}px`;
        resizeWindow.style.top = `${newTop}px`;
        
        // Remove maximized state when resizing
        resizeWindow.classList.remove('maximized');
        return;
    }
    
    // Handle drag with snap detection
    if (isDragging && currentWindow) {
        const x = e.clientX - offset.x;
        const y = e.clientY - offset.y;

        currentWindow.style.left = `${x}px`;
        currentWindow.style.top = `${y}px`;
        currentWindow.style.transform = 'none';
        
        // Detect snap zones
        detectSnapZone(e.clientX, e.clientY);
    }
});

// ============================================
// SNAP ZONES (Windows 11 Style)
// ============================================
let snapZone = null;
const SNAP_THRESHOLD = 20; // pixels from edge to trigger snap

function detectSnapZone(mouseX, mouseY) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    
    const rect = desktop.getBoundingClientRect();
    const screenW = rect.width;
    const screenH = rect.height - 48; // Subtract taskbar height
    
    let zone = null;
    
    // Edge detection
    const nearTop = mouseY < SNAP_THRESHOLD;
    const nearBottom = mouseY > screenH - SNAP_THRESHOLD;
    const nearLeft = mouseX < SNAP_THRESHOLD;
    const nearRight = mouseX > screenW - SNAP_THRESHOLD;
    
    // Corner snaps (quarter screen)
    if (nearTop && nearLeft) zone = 'top-left';
    else if (nearTop && nearRight) zone = 'top-right';
    else if (nearBottom && nearLeft) zone = 'bottom-left';
    else if (nearBottom && nearRight) zone = 'bottom-right';
    // Edge snaps
    else if (nearTop) zone = 'maximize';
    else if (nearLeft) zone = 'left';
    else if (nearRight) zone = 'right';
    
    snapZone = zone;
    
    if (zone) {
        showSnapPreview(zone, screenW, screenH);
    } else {
        hideSnapPreview();
    }
}

function showSnapPreview(zone, screenW, screenH) {
    let preview = document.getElementById('snap-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'snap-preview';
        preview.className = 'snap-preview';
        document.getElementById('desktop').appendChild(preview);
    }
    
    // Calculate preview position based on zone
    const positions = {
        'left': { left: 0, top: 0, width: screenW / 2, height: screenH },
        'right': { left: screenW / 2, top: 0, width: screenW / 2, height: screenH },
        'maximize': { left: 0, top: 0, width: screenW, height: screenH },
        'top-left': { left: 0, top: 0, width: screenW / 2, height: screenH / 2 },
        'top-right': { left: screenW / 2, top: 0, width: screenW / 2, height: screenH / 2 },
        'bottom-left': { left: 0, top: screenH / 2, width: screenW / 2, height: screenH / 2 },
        'bottom-right': { left: screenW / 2, top: screenH / 2, width: screenW / 2, height: screenH / 2 }
    };
    
    const pos = positions[zone];
    if (pos) {
        preview.style.left = `${pos.left}px`;
        preview.style.top = `${pos.top}px`;
        preview.style.width = `${pos.width}px`;
        preview.style.height = `${pos.height}px`;
        preview.classList.add('visible');
    }
}

function hideSnapPreview() {
    const preview = document.getElementById('snap-preview');
    if (preview) {
        preview.classList.remove('visible');
    }
}

function applySnap(winId, zone) {
    const win = document.getElementById(winId);
    const desktop = document.getElementById('desktop');
    if (!win || !desktop) return;
    
    const rect = desktop.getBoundingClientRect();
    const screenW = rect.width;
    const screenH = rect.height - 48;
    
    // Store original position for restore
    if (!win.dataset.preSnapLeft) {
        win.dataset.preSnapLeft = win.style.left;
        win.dataset.preSnapTop = win.style.top;
        win.dataset.preSnapWidth = win.style.width;
        win.dataset.preSnapHeight = win.style.height;
    }
    
    const positions = {
        'left': { left: 0, top: 0, width: screenW / 2, height: screenH },
        'right': { left: screenW / 2, top: 0, width: screenW / 2, height: screenH },
        'maximize': { left: 0, top: 0, width: screenW, height: screenH },
        'top-left': { left: 0, top: 0, width: screenW / 2, height: screenH / 2 },
        'top-right': { left: screenW / 2, top: 0, width: screenW / 2, height: screenH / 2 },
        'bottom-left': { left: 0, top: screenH / 2, width: screenW / 2, height: screenH / 2 },
        'bottom-right': { left: screenW / 2, top: screenH / 2, width: screenW / 2, height: screenH / 2 }
    };
    
    const pos = positions[zone];
    if (pos) {
        win.style.transition = 'all 0.15s ease';
        win.style.left = `${pos.left}px`;
        win.style.top = `${pos.top}px`;
        win.style.width = `${pos.width}px`;
        win.style.height = `${pos.height}px`;
        win.style.borderRadius = zone === 'maximize' ? '0' : '8px';
        
        if (zone === 'maximize') {
            win.classList.add('maximized');
        }
        
        setTimeout(() => {
            win.style.transition = '';
        }, 150);
    }
}

// Override maximize to toggle between snapped and restored
const originalMaximize = maximizeWindow;
maximizeWindow = function(id) {
    const win = document.getElementById(id);
    if (!win) return;
    
    if (win.classList.contains('maximized') || win.dataset.preSnapLeft) {
        // Restore
        if (win.dataset.preSnapLeft) {
            win.style.transition = 'all 0.15s ease';
            win.style.left = win.dataset.preSnapLeft;
            win.style.top = win.dataset.preSnapTop;
            win.style.width = win.dataset.preSnapWidth;
            win.style.height = win.dataset.preSnapHeight;
            win.style.borderRadius = '8px';
            
            delete win.dataset.preSnapLeft;
            delete win.dataset.preSnapTop;
            delete win.dataset.preSnapWidth;
            delete win.dataset.preSnapHeight;
            
            setTimeout(() => {
                win.style.transition = '';
            }, 150);
        }
        win.classList.remove('maximized');
    } else {
        // Maximize
        const desktop = document.getElementById('desktop');
        const rect = desktop.getBoundingClientRect();
        applySnap(id, 'maximize');
    }
};
