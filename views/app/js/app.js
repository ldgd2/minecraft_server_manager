/* ============================================
   MC Manager - Application JavaScript
   ============================================ */

const API_URL = "/api";
const AUTH_URL = "/auth";

// ============================================
// Core Application
// ============================================
window.app = {
    systemInfo: null,
    versions: [],

    initLog: () => { console.log("DEBUG: app.js loaded, views:", window.views); },

    checkAuth: () => {
        const token = localStorage.getItem("token");
        if (!token && window.location.pathname !== "/login") {
            window.location.href = "/login";
        }
        // Init global managers if authenticated
        if (token && window.views && window.views.downloads) {
            views.downloads.init();
        }
    },

    login: async () => {
        const username = document.getElementById("login-user").value.trim();
        const password = document.getElementById("login-pass").value.trim();
        
        try {
            const res = await fetch(`${AUTH_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            
            if (!res.ok) throw new Error("Invalid credentials");
            
            const data = await res.json();
            localStorage.setItem("token", data.access_token);
            window.location.href = "/";
        } catch (e) {
            views.toast.show(e.message, "error");
        }
    },

    logout: () => {
        localStorage.removeItem("token");
        window.location.href = "/login";
    },

    authorizedFetch: async (endpoint, options = {}) => {
        const token = localStorage.getItem("token");
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            ...options.headers
        };

        if (options.body instanceof FormData) {
            delete headers["Content-Type"];
        }

        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        
        if (res.status === 401) {
            app.logout();
            throw new Error("Session expired");
        }
        
        return res;
    },

    loadSystemInfo: async () => {
        try {
            const res = await app.authorizedFetch("/system/info");
            if (res.ok) {
                app.systemInfo = await res.json();
            }
        } catch (e) {
            console.error("Failed to load system info:", e);
        }
        return app.systemInfo;
    },

    loadVersions: async () => {
        try {
            const res = await app.authorizedFetch("/versions");
            if (res.ok) {
                app.versions = await res.json();
            }
        } catch (e) {
            console.error("Failed to load versions:", e);
        }
        return app.versions;
    }
};

// ============================================
// Views Controller
// ============================================
window.views = {
    // Toast Notifications
    toast: {
        show: (message, type = "success") => {
            let container = document.getElementById("toast-container");
            if (!container) {
                // Create toast container if not exists
                container = document.createElement("div");
                container.id = "toast-container";
                container.className = "fixed bottom-4 right-4 z-[9999] flex flex-col gap-2";
                document.body.appendChild(container);
            }

            const iconMap = {
                success: 'ph-check-circle',
                error: 'ph-x-circle',
                warning: 'ph-warning',
                info: 'ph-info'
            };
            
            const colorMap = {
                success: 'bg-green-600',
                error: 'bg-red-600',
                warning: 'bg-yellow-600',
                info: 'bg-blue-600'
            };

            const toast = document.createElement("div");
            toast.className = `flex items-center gap-3 px-4 py-3 ${colorMap[type] || colorMap.info} text-white rounded-lg shadow-lg animate-slide-up min-w-[280px]`;
            toast.innerHTML = `
                <i class="ph ${iconMap[type] || iconMap.info} text-xl"></i>
                <span class="flex-1">${message}</span>
                <button class="opacity-70 hover:opacity-100" onclick="this.parentElement.remove()">
                    <i class="ph ph-x"></i>
                </button>
            `;
            
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    },

    // Modal Controller
    modals: {
        open: (id) => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove("hidden");
                if (id === "create-server-modal") {
                    views.wizard.init();
                }
            }
        },
        close: (id) => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add("hidden");
            }
        }
    },

    // Download Manager
    downloads: {
        active: false,
        timer: null,
        
        init: () => {
            // Start polling if not started
            if (!views.downloads.active) {
                views.downloads.active = true;
                views.downloads.poll();
            }
        },

        poll: async () => {
             try {
                 const res = await app.authorizedFetch("/versions/downloads/active");
                 if (!res.ok) return;
                 const tasks = await res.json();
                 views.downloads.render(tasks);
                 
                 // If active tasks exist, keep polling. If empty, maybe slow down or stop?
                 // For now, always poll every 1s if keeping connection alive is cheap
                 if (Object.keys(tasks).length > 0) {
                     views.downloads.timer = setTimeout(views.downloads.poll, 1000);
                     document.getElementById("download-manager").classList.remove("hidden");
                 } else {
                     views.downloads.timer = setTimeout(views.downloads.poll, 3000); // Slow poll when idle
                     // Don't auto-hide immediately, user might want to see history?
                     // For now, auto-hide if empty
                     document.getElementById("download-manager").classList.add("hidden");
                 }
             } catch (e) {
                 console.error("Poll error", e);
             }
        },
        
        toggle: () => {
            document.getElementById("download-manager").classList.toggle("hidden");
        },

        render: (tasks) => {
            const container = document.getElementById("download-list");
            if (!container) return;
            
            container.innerHTML = Object.entries(tasks).map(([id, task]) => {
                const percent = task.progress || 0;
                let statusColor = "var(--accent)";
                if (task.status === "completed") statusColor = "var(--success)";
                if (task.status === "error") statusColor = "var(--danger)";
                
                // Auto-ack completed tasks after a delay? Or provide a close button?
                // For now, simpler: user sees it. completed ones stay until page refresh or manual ack logic (not yet imp).
                
                return `
                <div class="download-item">
                    <div class="download-meta">
                        <div class="download-icon">
                            <img src="/source/png/${task.loader.toLowerCase()}.png" class="png-icon png-icon--xs" onerror="this.src='/source/png/version.png'">
                        </div>
                        <div class="download-info">
                            <span class="download-title">${task.loader} ${task.version}</span>
                            <span class="download-status">${task.status} - ${percent}%</span>
                        </div>
                        ${task.status === 'completed' || task.status === 'error' ? 
                            `<button class="icon-btn icon-btn--xs" onclick="views.downloads.ack('${id}')"><img src="/source/png/logout.png" style="width:12px;transform:rotate(45deg)"></button>` 
                            : ''}
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar ${task.status}" style="width: ${percent}%; background: ${statusColor}"></div>
                    </div>
                </div>
                `;
            }).join('');
        },
        
        ack: async (id) => {
            await app.authorizedFetch(`/versions/downloads/${id}/ack`, { method: "POST" });
            // remove from UI immediately to feel responsive
            // poll will sync next second
        }
    },

    // Dashboard View
    dashboard: {
        charts: {},

        init: async () => {
            await Promise.all([
                views.dashboard.loadServers(),
                views.dashboard.loadSystemInfo(),
                views.dashboard.initCharts()
            ]);
            
            // Refresh every 3 seconds for better responsiveness
            if(views.dashboard.refreshInterval) clearInterval(views.dashboard.refreshInterval);
            views.dashboard.refreshInterval = setInterval(() => {
                if(document.hidden) return;
                views.dashboard.loadSystemInfo();
                views.dashboard.loadServers(); // Add this
            }, 3000);
        },

        loadServers: async () => {
            try {
                const res = await app.authorizedFetch("/servers/");
                const servers = await res.json();
                
                // Helper to safely update text content
                const setText = (id, text) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = text;
                };

                const onlineCount = servers.filter(s => s.status === "ONLINE").length;
                const offlineCount = servers.filter(s => s.status === "OFFLINE").length;

                // Update Summary Widgets (Only if present)
                if (document.getElementById("total-servers")) {
                    const setText = (id, text) => {
                        const el = document.getElementById(id);
                        if (el) el.textContent = text;
                    };
                    
                    setText("total-servers", servers.length);
                    setText("online-servers", onlineCount);
                    setText("offline-servers", offlineCount);
                    
                    const totalPlayers = servers.reduce((acc, s) => acc + (s.current_players || 0), 0);
                    setText("total-players", totalPlayers);
                }

                // Update grid
                const container = document.getElementById("server-grid");
                if (container) {
                    if (servers.length === 0) {
                        container.innerHTML = `
                            <div class="empty-card" style="grid-column: 1 / -1;">
                                <div class="empty-card-icon">
                                    <img src="/source/png/server.png" class="png-icon png-icon--xl">
                                </div>
                                <h3 class="empty-card-title">No Servers Yet</h3>
                                <p class="empty-card-description">Create your first Minecraft server to get started.</p>
                                <button class="btn btn-primary" onclick="views.modals.open('create-server-modal')">
                                    <ion-icon name="add-outline"></ion-icon>
                                    Create Server
                                </button>
                            </div>
                        `;
                    } else {
                        container.innerHTML = servers.slice(0, 6).map(server => views.dashboard.renderServerCard(server)).join('');
                    }
                }

                // Update chart
                views.dashboard.updateStatusChart(onlineCount, offlineCount);
                
            } catch (e) {
                console.error("Failed to load servers:", e);
            }
        },

        renderServerCard: (server) => {
            let statusClass = "server-card--offline";
            let statusIcon = "offline";
            if (server.status === "ONLINE") { statusClass = "server-card--online"; statusIcon = "online"; }
            else if (server.status === "STARTING") { statusClass = "server-card--starting"; statusIcon = "wait"; }
            else if (server.status === "STOPPING") { statusClass = "server-card--stopping"; statusIcon = "wait"; }

            const modLoader = server.mod_loader || "VANILLA";
            
            return `
                <div class="server-card ${statusClass}" onclick="window.location.href='/server/${server.name}'">
                    <div class="server-card-header">
                        <div class="server-card-status">
                            <img src="/source/png/${statusIcon}.png" class="png-icon png-icon--sm">
                        </div>
                        <h3 class="server-card-title">${server.name}</h3>
                        <span class="status-badge status-${server.status.toLowerCase()}">${server.status}</span>
                    </div>
                    
                    <div class="server-card-body">
                        <div class="server-card-info">
                            <div class="info-row">
                                <img src="/source/png/version.png" class="png-icon png-icon--xs">
                                <span>${server.version}</span>
                            </div>
                            <div class="info-row">
                                <img src="/source/png/${modLoader.toLowerCase()}.png" class="png-icon png-icon--xs">
                                <span>${modLoader}</span>
                            </div>
                            <div class="info-row">
                                <img src="/source/png/player.png" class="png-icon png-icon--xs">
                                <span>${server.current_players || 0}/${server.max_players || 20}</span>
                            </div>
                        </div>
                        
                        <div class="server-card-resources">
                            <div class="resource-mini">
                                <img src="/source/png/cpu.png" class="png-icon png-icon--xs">
                                <div class="resource-mini-bar">
                                    <div class="resource-mini-progress" style="--progress: ${server.cpu_usage || 0}%"></div>
                                </div>
                                <span>${server.cpu_cores || 1} cores</span>
                            </div>
                            <div class="resource-mini">
                                <img src="/source/png/ram.png" class="png-icon png-icon--xs">
                                <div class="resource-mini-bar">
                                    <div class="resource-mini-progress" style="--progress: ${(server.ram_usage || 0) / (server.ram_mb || 2048) * 100}%"></div>
                                </div>
                                <span>${server.ram_mb || 2048}MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        loadSystemInfo: async () => {
            const info = await app.loadSystemInfo();
            
            // Check service status
            try {
                const srvRes = await app.authorizedFetch("/system/service/status");
                if (srvRes.ok) {
                    const srv = await srvRes.json();
                    const badge = document.getElementById("service-status-badge");
                    if(badge) {
                        const isRunning = srv.enabled; 
                        const color = isRunning ? "var(--success)" : "var(--danger)";
                        const text = isRunning ? "Service Active" : "Service Inactive";
                        
                        badge.innerHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; display: inline-block; margin-right: 0.5rem;"></div>${text}`;
                        badge.style.color = isRunning ? "var(--success)" : "var(--text-muted)";
                        badge.style.borderColor = isRunning ? "rgba(16, 185, 129, 0.2)" : "var(--border-color)";
                    }
                }
            } catch(e) {}

            if (!info) return;

            // Update CPU
            const cpuPercent = info.cpu_percent || 0;
            document.getElementById("cpu-usage").textContent = `${cpuPercent.toFixed(1)}%`;
            document.getElementById("cpu-bar").style.setProperty("--progress", `${cpuPercent}%`);

            // Update RAM
            const ramUsed = (info.ram_used_mb / 1024).toFixed(1);
            const ramTotal = (info.ram_total_mb / 1024).toFixed(1);
            const ramPercent = (info.ram_used_mb / info.ram_total_mb) * 100;
            document.getElementById("ram-usage").textContent = `${ramUsed} / ${ramTotal} GB`;
            document.getElementById("ram-bar").style.setProperty("--progress", `${ramPercent}%`);

            // Update Disk
            const diskUsed = (info.disk_used_mb / 1024).toFixed(1);
            const diskTotal = (info.disk_total_mb / 1024).toFixed(1);
            const diskPercent = (info.disk_used_mb / info.disk_total_mb) * 100;
            document.getElementById("disk-usage").textContent = `${diskUsed} / ${diskTotal} GB`;
            document.getElementById("disk-bar").style.setProperty("--progress", `${diskPercent}%`);

            // Update resource chart
            views.dashboard.updateResourceChart(cpuPercent, ramPercent);
        },

        initCharts: async () => {
            // Server Status Donut Chart
            const statusCtx = document.getElementById("server-status-chart");
            if (statusCtx) {
                views.dashboard.charts.status = new Chart(statusCtx, {
                    type: "doughnut",
                    data: {
                        labels: ["Online", "Offline"],
                        datasets: [{
                            data: [0, 0],
                            backgroundColor: ["#10b981", "#ef4444"],
                            borderWidth: 0,
                            cutout: "70%"
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: { color: "#9ca3af", padding: 20 }
                            }
                        }
                    }
                });
            }

            // Resource History Line Chart
            const resourceCtx = document.getElementById("resource-history-chart");
            if (resourceCtx) {
                const labels = Array.from({ length: 10 }, (_, i) => `${10 - i}m ago`);
                views.dashboard.charts.resource = new Chart(resourceCtx, {
                    type: "line",
                    data: {
                        labels,
                        datasets: [
                            {
                                label: "CPU %",
                                data: Array(10).fill(0),
                                borderColor: "#3b82f6",
                                backgroundColor: "rgba(59, 130, 246, 0.1)",
                                fill: true,
                                tension: 0.4
                            },
                            {
                                label: "RAM %",
                                data: Array(10).fill(0),
                                borderColor: "#8b5cf6",
                                backgroundColor: "rgba(139, 92, 246, 0.1)",
                                fill: true,
                                tension: 0.4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                grid: { color: "rgba(255,255,255,0.05)" },
                                ticks: { color: "#6b7280" }
                            },
                            y: {
                                min: 0,
                                max: 100,
                                grid: { color: "rgba(255,255,255,0.05)" },
                                ticks: { color: "#6b7280" }
                            }
                        },
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: { color: "#9ca3af", padding: 20 }
                            }
                        }
                    }
                });
            }
        },

        updateStatusChart: (online, offline) => {
            if (views.dashboard.charts.status) {
                views.dashboard.charts.status.data.datasets[0].data = [online, offline];
                views.dashboard.charts.status.update();
            }
        },

        updateResourceChart: (cpu, ram) => {
            if (views.dashboard.charts.resource) {
                const chart = views.dashboard.charts.resource;
                chart.data.datasets[0].data.push(cpu);
                chart.data.datasets[0].data.shift();
                chart.data.datasets[1].data.push(ram);
                chart.data.datasets[1].data.shift();
                chart.update("none");
            }
        }
    },

    // Audit View
    audit: {
        page: 1,
        pageSize: 50,
        totalPages: 1,
        searchTimer: null,
        
        init: async () => {
             // Delay slightly to ensure sidebar rendered if any
             await views.audit.loadServersForFilter();
             await views.audit.loadLogs();
        },
        
        loadServersForFilter: async () => {
             try {
                const res = await app.authorizedFetch("/servers/");
                if (!res.ok) return;
                const servers = await res.json();
                const select = document.getElementById("filter-server");
                if(select) {
                    select.innerHTML = '<option value="">Todos</option>' + 
                        servers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
                }
             } catch(e) { console.error(e); }
        },
        
        loadLogs: async () => {
             const server = document.getElementById("filter-server")?.value || "";
             const user = document.getElementById("filter-user")?.value || "";
             const action = document.getElementById("filter-action")?.value || "";
             const search = document.getElementById("audit-search")?.value || "";
             
             const params = new URLSearchParams({
                 page: views.audit.page,
                 limit: views.audit.pageSize
             });
             
             if(server) params.append("server", server);
             if(user) params.append("user", user);
             if(action) params.append("action", action);
             if(search) params.append("search", search);
             
             try {
                 const res = await app.authorizedFetch(`/audit/logs?${params.toString()}`);
                 if (!res.ok) throw new Error("Failed to load audit logs");
                 const data = await res.json();
                 
                 views.audit.totalPages = data.pages;
                 views.audit.render(data.items);
                 views.audit.updateFooter(data.total, data.page);
             } catch (e) {
                 console.error(e);
                 views.toast.show("Error loading audit logs", "error");
             }
        },
        
        render: (items) => {
            const tbody = document.getElementById("audit-logs-body");
            if (!tbody) return;
            
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: rgba(255,255,255,0.5);">No hay registros encontrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = items.map(log => {
                const badgeClass = `badge-${log.action.toLowerCase()}`;
                const date = new Date(log.timestamp).toLocaleString();
                
                return `
                <tr>
                    <td>${date}</td>
                    <td>${log.username || '-'}</td>
                    <td>${log.ip_address || '-'}</td>
                    <td><span class="badge ${badgeClass}">${log.action}</span></td>
                    <td class="truncate max-w-xs" title="${log.details}">${log.details || ''}</td>
                </tr>
                `;
            }).join('');
        },
        
        updateFooter: (total, page) => {
             const start = (page - 1) * views.audit.pageSize + 1;
             const end = Math.min(start + views.audit.pageSize - 1, total);
             const info = document.getElementById("audit-info");
             if(info) info.textContent = `Mostrando ${total === 0 ? 0 : start} - ${end} de ${total} registros`;
             
             const prev = document.getElementById("prev-page");
             const next = document.getElementById("next-page");
             if(prev) prev.disabled = page <= 1;
             if(next) next.disabled = page >= views.audit.totalPages;
        },
        
        prevPage: () => {
            if (views.audit.page > 1) {
                views.audit.page--;
                views.audit.loadLogs();
            }
        },
        
        nextPage: () => {
            if (views.audit.page < views.audit.totalPages) {
                views.audit.page++;
                views.audit.loadLogs();
            }
        },
        
        resetFilters: () => {
            if(document.getElementById("filter-server")) document.getElementById("filter-server").value = "";
            if(document.getElementById("filter-user")) document.getElementById("filter-user").value = "";
            if(document.getElementById("filter-action")) document.getElementById("filter-action").value = "";
            if(document.getElementById("audit-search")) document.getElementById("audit-search").value = "";
            views.audit.page = 1;
            views.audit.loadLogs();
        },
        
        debounceSearch: () => {
            clearTimeout(views.audit.searchTimer);
            views.audit.searchTimer = setTimeout(() => {
                views.audit.page = 1;
                views.audit.loadLogs();
            }, 500);
        }
    },

    // Servers View
    servers: {
        allServers: [],
        deleteTarget: null,

        init: async () => {
            await views.servers.loadServers();
            
            // Poll for updates
            if(views.servers.refreshInterval) clearInterval(views.servers.refreshInterval);
            views.servers.refreshInterval = setInterval(() => {
                if(document.hidden) return;
                views.servers.loadServers();
            }, 3000);
        },

        loadServers: async () => {
            try {
                const res = await app.authorizedFetch("/servers/");
                views.servers.allServers = await res.json();
                views.servers.render();
                views.servers.updateStats();
            } catch (e) {
                console.error("Failed to load servers:", e);
            }
        },

        render: () => {
            const servers = views.servers.getFilteredServers();
            const container = document.getElementById("server-list-container");
            // const emptyState = document.getElementById("empty-state"); // Might need to re-add empty state logic later
            
            if (!container) return;

            if (servers.length === 0) {
                 container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay servidores.</div>';
            } else {
                container.innerHTML = servers.map(s => views.servers.renderRow(s)).join('');
            }
        },

        renderRow: (server) => {
            let statusColor = "text-gray-400";
            if (server.status === "ONLINE") statusColor = "text-green-500";
            else if (server.status === "STARTING") statusColor = "text-yellow-500";
            else if (server.status === "STOPPING") statusColor = "text-red-400";

            const modLoader = server.mod_loader || "VANILLA";
            const cpuPercent = (server.cpu_usage || 0).toFixed(1);
            const ramVal = (server.ram_usage || 0).toFixed(0);
            
            // Format memory: if > 1024 MB show GB
            const ramDisplay = ramVal > 1024 ? `${(ramVal/1024).toFixed(1)} GB` : `${ramVal} MB`;
            const diskDisplay = `${server.disk_usage || 0} MB`; // Placeholder logic

            // Check if this row is selected (stored in state or similar? For now simple onclick)
            const isSelected = views.servers.selectedServer === server.name ? 'selected' : '';

            return `
                <div class="tm-row ${isSelected}" onclick="views.servers.select('${server.name}')" ondblclick="window.location.href='/server/${server.name}'">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-8 h-8 flex items-center justify-center bg-white/5 rounded">
                             <img src="/source/png/${modLoader.toLowerCase()}.png" class="w-5 h-5" onerror="this.src='/source/png/version.png'">
                        </div>
                        <div class="flex flex-col truncate">
                            <span class="font-medium">${server.name}</span>
                            <span class="text-xs text-secondary opacity-60">${server.version}</span>
                        </div>
                    </div>
                    <span class="${statusColor} font-medium text-xs">${server.status}</span>
                    <span class="text-xs">${cpuPercent}%</span>
                    <span class="text-xs">${ramDisplay}</span>
                    <span class="text-xs">${diskDisplay}</span>
                </div>
            `;
        },

        selectedServer: null,

        select: (name) => {
            views.servers.selectedServer = name;
            // Rerender to show selection highlight
            views.servers.render();
            
            // Show action buttons
            const btnEnd = document.getElementById('btn-end-task');
            if(btnEnd) {
                 btnEnd.classList.remove('hidden');
                 // Update onclick to stop this specific server
                 btnEnd.onclick = () => views.servers.toggle(name, 'ONLINE'); // Default to stop? Logic needs check
            }
        },

        getFilteredServers: () => {
            const statusFilter = document.getElementById("filter-status")?.value || "all";
            const loaderFilter = document.getElementById("filter-loader")?.value || "all";

            return views.servers.allServers.filter(s => {
                if (statusFilter !== "all" && s.status !== statusFilter) return false;
                if (loaderFilter !== "all" && (s.mod_loader || "VANILLA") !== loaderFilter) return false;
                return true;
            });
        },

        filter: () => {
            views.servers.render();
        },

        updateStats: () => {
            const servers = views.servers.allServers;
            const online = servers.filter(s => s.status === "ONLINE").length;
            const totalCpu = servers.reduce((acc, s) => acc + (s.cpu_cores || 1), 0);
            const totalRam = servers.reduce((acc, s) => acc + (s.ram_mb || 2048), 0);

            const el = (id, val) => {
                const elem = document.getElementById(id);
                if (elem) elem.textContent = val;
            };

            el("stats-total", servers.length);
            el("stats-online", online);
            el("stats-cpu", totalCpu.toFixed(1));
            el("stats-ram", `${(totalRam / 1024).toFixed(1)} GB`);
        },

        toggle: async (name, currentStatus) => {
            // Don't allow actions during transitions
            if (currentStatus === "STARTING" || currentStatus === "STOPPING") {
                views.toast.show("Please wait for the current operation to complete", "warning");
                return;
            }
            
            const action = (currentStatus === "ONLINE" || currentStatus === "STARTING") ? "stop" : "start";
            try {
                await app.authorizedFetch(`/servers/${name}/control/${action}`, { method: "POST" });
                views.toast.show(`Server ${action === 'start' ? 'starting' : 'stopping'}...`, "success");
                setTimeout(() => views.servers.loadServers(), 1000);
            } catch (e) {
                views.toast.show(`Failed to ${action} server`, "error");
            }
        },

        edit: (name) => {
            const server = views.servers.allServers.find(s => s.name === name);
            if (!server) return;

            document.getElementById("edit-server-original-name").value = server.name;
            document.getElementById("edit-server-name").value = server.name;
            document.getElementById("edit-server-port").value = server.port;
            document.getElementById("edit-server-max-players").value = server.max_players || 20;
            document.getElementById("edit-server-cpu").value = server.cpu_cores || 1;
            document.getElementById("edit-server-ram").value = server.ram_mb || 2048;
            document.getElementById("edit-server-disk").value = server.disk_mb || 2048;
            document.getElementById("edit-server-motd").value = server.motd || "A Minecraft Server";
            document.getElementById("edit-server-online-mode").checked = server.online_mode || false;

            views.modals.open("edit-server-modal");
        },

        saveEdit: async () => {
            const originalName = document.getElementById("edit-server-original-name").value;
            const data = {
                name: document.getElementById("edit-server-name").value,
                port: parseInt(document.getElementById("edit-server-port").value),
                max_players: parseInt(document.getElementById("edit-server-max-players").value),
                cpu_cores: parseFloat(document.getElementById("edit-server-cpu").value),
                ram_mb: parseInt(document.getElementById("edit-server-ram").value),
                disk_mb: parseInt(document.getElementById("edit-server-disk").value),
                motd: document.getElementById("edit-server-motd").value,
                online_mode: document.getElementById("edit-server-online-mode").checked
            };

            try {
                await app.authorizedFetch(`/servers/${originalName}`, {
                    method: "PATCH",
                    body: JSON.stringify(data)
                });
                views.toast.show("Server updated successfully", "success");
                views.modals.close("edit-server-modal");
                views.servers.loadServers();
            } catch (e) {
                views.toast.show("Failed to update server", "error");
            }
        },

        confirmDelete: (name) => {
            views.servers.deleteTarget = name;
            document.getElementById("delete-server-name").textContent = name;
            views.modals.open("delete-confirm-modal");
        },

        delete: async () => {
            if (!views.servers.deleteTarget) return;

            try {
                await app.authorizedFetch(`/servers/${views.servers.deleteTarget}`, { method: "DELETE" });
                views.toast.show("Server deleted successfully", "success");
                views.modals.close("delete-confirm-modal");
                views.servers.loadServers();
            } catch (e) {
                views.toast.show("Failed to delete server", "error");
            }
        },

        exportServer: async (name) => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`/api/servers/${name}/export`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error("Export failed");
                
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${name}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                views.toast.show(`Server '${name}' exported successfully`, "success");
            } catch (e) {
                views.toast.show("Failed to export server", "error");
            }
        },

        openImportModal: () => {
            views.modals.open("import-server-modal");
        },

        importServer: async () => {
            const fileInput = document.getElementById("import-server-file");
            if (!fileInput.files || fileInput.files.length === 0) {
                views.toast.show("Please select a ZIP file", "error");
                return;
            }

            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append("file", file);

            try {
                const token = localStorage.getItem("token");
                const res = await fetch("/api/servers/import", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` },
                    body: formData
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.detail || "Import failed");
                }

                const result = await res.json();
                views.toast.show(result.message, "success");
                views.modals.close("import-server-modal");
                fileInput.value = "";  // Reset file input
                views.servers.loadServers();
            } catch (e) {
                views.toast.show(e.message || "Failed to import server", "error");
            }
        }
    },

    // Server Creation Wizard
    wizard: {
        currentStep: 1,
        maxSteps: 3,

        init: async () => {
            views.wizard.currentStep = 1;
            views.wizard.updateUI();
            
            // Load system info
            const info = await app.loadSystemInfo();
            if (info) {
                document.getElementById("system-os").textContent = info.os || "Unknown";
                document.getElementById("cpu-available").textContent = `${info.cpu_count || '-'} cores`;
                document.getElementById("ram-available").textContent = `${((info.ram_available_mb || 0) / 1024).toFixed(1)} GB`;
                document.getElementById("disk-available").textContent = `${((info.disk_available_mb || 0) / 1024).toFixed(1)} GB`;

                // Set slider max values
                const cpuSlider = document.getElementById("wizard-cpu");
                const ramSlider = document.getElementById("wizard-ram");
                const diskSlider = document.getElementById("wizard-disk");

                if (cpuSlider) cpuSlider.max = info.cpu_count || 8;
                if (ramSlider) ramSlider.max = info.ram_available_mb || 16384;
                if (diskSlider) diskSlider.max = info.disk_available_mb || 102400;
            }

            // Load versions
            await views.wizard.loadVersions();

            // Setup sliders
            views.wizard.setupSliders();

            // Setup mod loader selection
            views.wizard.setupModLoaders();
        },

        loadVersions: async () => {
            try {
                // Fetch all installed versions
                const res = await app.authorizedFetch("/versions");
                if (res.ok) {
                    app.versions = await res.json();
                    views.wizard.updateVersionSelect();
                }
            } catch (e) {
                console.error("Failed to load versions for wizard", e);
            }
        },
        
        updateVersionSelect: () => {
             const select = document.getElementById("wizard-version");
             if (!select) return;
             
             // Get currently selected loader
             const selectedLoader = document.querySelector('.mod-loader-option.active input')?.value || 'VANILLA';
             
             // Filter versions
             const relevantVersions = app.versions.filter(v => v.loader_type === selectedLoader);
             
             if (relevantVersions.length > 0) {
                 select.innerHTML = relevantVersions.map(v => 
                     `<option value="${v.mc_version}">${v.mc_version} (${v.loader_version || 'Latest'})</option>`
                 ).join('');
             } else {
                 select.innerHTML = '<option disabled selected>No installed versions found</option>';
             }
        },

        setupSliders: () => {
            const sliders = [
                { id: "wizard-cpu", valueId: "wizard-cpu-value" },
                { id: "wizard-ram", valueId: "wizard-ram-value" },
                { id: "wizard-disk", valueId: "wizard-disk-value" }
            ];

            sliders.forEach(({ id, valueId }) => {
                const slider = document.getElementById(id);
                const valueEl = document.getElementById(valueId);
                if (slider && valueEl) {
                    slider.addEventListener("input", () => {
                        valueEl.textContent = slider.value;
                    });
                }
            });
        },

        setupModLoaders: () => {
            document.querySelectorAll(".mod-loader-option").forEach(option => {
                option.addEventListener("click", () => {
                    document.querySelectorAll(".mod-loader-option").forEach(o => o.classList.remove("active"));
                    option.classList.add("active");
                    option.querySelector("input").checked = true;
                    
                    // Trigger version update when loader changes
                    views.wizard.updateVersionSelect();
                });
            });
        },

        next: () => {
            if (views.wizard.currentStep < views.wizard.maxSteps) {
                views.wizard.currentStep++;
                views.wizard.updateUI();
                
                if (views.wizard.currentStep === 3) {
                    views.wizard.populateReview();
                }
            }
        },

        prev: () => {
            if (views.wizard.currentStep > 1) {
                views.wizard.currentStep--;
                views.wizard.updateUI();
            }
        },

        updateUI: () => {
            const step = views.wizard.currentStep;

            // Update step indicators
            document.querySelectorAll(".wizard-step").forEach((el, i) => {
                el.classList.remove("active", "completed");
                if (i + 1 === step) el.classList.add("active");
                if (i + 1 < step) el.classList.add("completed");
            });

            // Update panels
            document.querySelectorAll(".wizard-panel").forEach((el, i) => {
                el.classList.toggle("active", i + 1 === step);
            });

            // Update buttons
            const prevBtn = document.getElementById("wizard-prev");
            const nextBtn = document.getElementById("wizard-next");
            const createBtn = document.getElementById("wizard-create");

            if (prevBtn) prevBtn.disabled = step === 1;
            if (nextBtn) nextBtn.classList.toggle("hidden", step === views.wizard.maxSteps);
            if (createBtn) createBtn.classList.toggle("hidden", step !== views.wizard.maxSteps);
        },

        populateReview: () => {
            const selectedLoader = document.querySelector('.mod-loader-option.active input')?.value || 'VANILLA';
            
            document.getElementById("review-name").textContent = document.getElementById("wizard-name").value || '-';
            document.getElementById("review-version").textContent = document.getElementById("wizard-version").value || '-';
            document.getElementById("review-loader").textContent = selectedLoader;
            document.getElementById("review-port").textContent = document.getElementById("wizard-port").value || '-';
            document.getElementById("review-players").textContent = document.getElementById("wizard-max-players").value || '-';
            document.getElementById("review-cpu").textContent = `${document.getElementById("wizard-cpu").value} cores`;
            document.getElementById("review-ram").textContent = `${document.getElementById("wizard-ram").value} MB`;
            document.getElementById("review-disk").textContent = `${document.getElementById("wizard-disk").value} MB`;
        },

        create: async () => {
            const selectedLoader = document.querySelector('.mod-loader-option.active input')?.value || 'VANILLA';
            
            const data = {
                name: document.getElementById("wizard-name").value,
                version: document.getElementById("wizard-version").value,
                mod_loader: selectedLoader,
                port: parseInt(document.getElementById("wizard-port").value),
                max_players: parseInt(document.getElementById("wizard-max-players").value),
                cpu_cores: parseFloat(document.getElementById("wizard-cpu").value),
                ram_mb: parseInt(document.getElementById("wizard-ram").value),
                disk_mb: parseInt(document.getElementById("wizard-disk").value),
                online_mode: false
            };

            try {
                const res = await app.authorizedFetch("/servers/", {
                    method: "POST",
                    body: JSON.stringify(data)
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || "Failed to create server");
                }

                views.toast.show("Server created successfully!", "success");
                views.modals.close("create-server-modal");
                
                // Refresh appropriate view
                if (typeof views.dashboard !== 'undefined' && views.dashboard.loadServers) {
                    views.dashboard.loadServers();
                }
                if (typeof views.servers !== 'undefined' && views.servers.loadServers) {
                    views.servers.loadServers();
                }
            } catch (e) {
                views.toast.show(e.message, "error");
            }
        }
    },

    // Charts helpers
    charts: {
        setTimeframe: (range) => {
            document.querySelectorAll(".chart-time-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.range === range);
            });
            // TODO: Reload chart data for timeframe
        }
    },

    // Server Detail View
    server: {
        currentName: null,
        consoleSocket: null,

        init: (name) => {
            views.server.currentName = name;
            views.server.connectConsole();
            views.server.loadFiles();
            views.server.loadMods();
            views.server.loadSettings();
            // Don't init players yet - wait for tab to be shown
        },

        copyAddress: () => {
             const addr = document.getElementById("server-address-display").textContent;
             if(addr && addr !== "Loading address...") {
                 navigator.clipboard.writeText(addr);
                 views.toast.show("Address copied!", "success");
             }
        },
        
        loadSettings: async () => {
             try {
                const res = await app.authorizedFetch(`/servers/`); // Better to get specific server, but loadServers cached it?
                // Actually server_detail page should load the server details to populate settings.
                // The API /server/{name} template receives server_name, but we need data.
                // We should fetch server details here.
                const serverRes = await app.authorizedFetch(`/servers/`); 
                const servers = await serverRes.json();
                const server = servers.find(s => s.name === views.server.currentName);
                
                if (server) {
                    const host = window.location.hostname;
                    const addrDisplay = document.getElementById("server-address-display");
                    if (addrDisplay) addrDisplay.textContent = `${host}:${server.port}`;

                    if(document.getElementById("setting-max-players")) document.getElementById("setting-max-players").value = server.max_players;
                    if(document.getElementById("setting-motd")) document.getElementById("setting-motd").value = server.motd;
                    if(document.getElementById("setting-online-mode")) document.getElementById("setting-online-mode").checked = server.online_mode;
                    
                    // Show/Hide Paper Plugins Tab
                    const paperTabBtn = document.getElementById("tab-btn-paper");
                    if (paperTabBtn) {
                        if (server.mod_loader === "PAPER") {
                            paperTabBtn.style.display = "flex";
                        } else {
                            paperTabBtn.style.display = "none";
                        }
                    }
                }
             } catch(e) { console.error("Error loading settings", e); }
        },

        control: async (action) => {
            try {
                await app.authorizedFetch(`/servers/${views.server.currentName}/control/${action}`, { method: "POST" });
                views.toast.show(`Action '${action}' executed`, "success");
            } catch (e) {
                views.toast.show(`Failed to ${action} server`, "error");
            }
        },

        showTab: (tab) => {
            document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
            document.getElementById(`tab-${tab}`)?.classList.remove("hidden");

            document.querySelectorAll(".tab-btn").forEach(el => {
                el.classList.toggle("active", el.textContent.toLowerCase().includes(tab));
            });

            // Initialize or cleanup PlayerManager based on tab
            if (tab === 'players') {
                // Initialize PlayerManager when players tab is shown
                views.players.init(views.server.currentName);
            } else {
                // Cleanup PlayerManager when switching away from players tab
                views.players.cleanup();
            }
        },

        connectConsole: () => {
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            views.server.consoleSocket = new WebSocket(`${protocol}://${location.host}/api/servers/${views.server.currentName}/console`);
            
            const term = document.getElementById("console-output");
            if (term) {
                term.innerHTML = "";
                views.server.consoleSocket.onmessage = (event) => {
                    term.innerText += event.data;
                    term.scrollTop = term.scrollHeight;
                };
            }
        },

        sendCommand: async () => {
            const input = document.getElementById("console-input");
            const cmd = input?.value;
            if (!cmd) return;

            try {
                await app.authorizedFetch(`/servers/${views.server.currentName}/command`, {
                    method: "POST",
                    body: JSON.stringify({ command: cmd })
                });
                input.value = "";
            } catch (e) {
                views.toast.show("Failed to send command", "error");
            }
        },

        searchMods: async () => {
            const query = document.getElementById("mod-search")?.value;
            if (!query) return;

            try {
                const res = await app.authorizedFetch("/mods/search", {
                    method: "POST",
                    body: JSON.stringify({ query, version: "1.20.1" })
                });
                const mods = await res.json();
                
                document.getElementById("mod-results").innerHTML = mods.map(mod => `
                    <div class="mod-item">
                        <span>${mod.title}</span>
                        <button class="btn btn-success btn-sm" onclick="views.server.installMod('${mod.project_id}')">
                            Install
                        </button>
                    </div>
                `).join('');
            } catch (e) {
                views.toast.show("Failed to search mods", "error");
            }
        },

        uploadFile: async () => {
            const input = document.getElementById("file-upload");
            const file = input?.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("file", file);

            try {
                await app.authorizedFetch(`/files/${views.server.currentName}/upload`, {
                    method: "POST",
                    body: formData
                });
                views.toast.show("File uploaded successfully", "success");
                views.server.loadFiles();
            } catch (e) {
                views.toast.show("Failed to upload file", "error");
            }
        },

        loadFiles: async () => {
            try {
                const res = await app.authorizedFetch(`/files/${views.server.currentName}`);
                const files = await res.json();
                const container = document.getElementById("file-list");
                if (container) {
                    container.innerHTML = files.map(f => `
                        <div class="mod-item">
                            <div class="flex-row" style="gap: 0.75rem">
                                <img src="/source/png/file.png" onerror="this.src='/source/png/folder.png'" class="png-icon png-icon--sm">
                                <span>${f.name}</span>
                            </div>
                            <div class="flex-row" style="gap: 1rem">
                                <span class="text-muted">${(f.size / 1024).toFixed(1)} KB</span>
                                <button class="icon-btn icon-btn--primary" onclick="views.server.editFile('${f.name}')" title="Edit">
                                    <img src="/source/png/config.png" class="png-icon png-icon--xs">
                                </button>
                                <button class="icon-btn icon-btn--danger" onclick="views.server.deleteFile('${f.name}')" title="Delete">
                                    <img src="/source/png/logout.png" class="png-icon png-icon--xs" style="transform: rotate(90deg)">
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (e) {
                console.log("Error loading files:", e);
            }
        },
        
        // --- File Editing ---
        currentEditFile: null,
        
        editFile: async (filename) => {
            views.server.currentEditFile = filename;
            try {
                // Ensure modal exists (injected or present)
                // We'll update textarea
                const res = await app.authorizedFetch(`/files/${views.server.currentName}/content?path=${encodeURIComponent(filename)}`);
                if (!res.ok) throw new Error("Failed to load file");
                
                const data = await res.json();
                document.getElementById("editor-filename").textContent = filename;
                document.getElementById("editor-content").value = data.content;
                
                views.modals.open("file-editor-modal");
            } catch (e) {
                 views.toast.show(e.message || "Cannot edit this file", "error");
            }
        },
        
        saveFile: async () => {
             const content = document.getElementById("editor-content").value;
             try {
                 await app.authorizedFetch(`/files/${views.server.currentName}/save`, {
                     method: "POST",
                     body: JSON.stringify({ path: views.server.currentEditFile, content })
                 });
                 views.toast.show("File saved successfully", "success");
                 views.modals.close("file-editor-modal");
             } catch (e) {
                 views.toast.show("Failed to save file", "error");
             }
        },

        deleteFile: async (filename) => {
            // Placeholder: Delete logic not requested yet but good to have signature
            if(!confirm(`Delete ${filename}?`)) return;
            // TODO: call delete endpoint
            views.toast.show("Delete not implemented", "info");
        },

        // --- Mod Management ---
        searchMods: async () => {
            const query = document.getElementById("mod-search").value;
            if (!query) return;
            
            // Need server info to know version/loader
            const container = document.getElementById("mod-results");
            container.innerHTML = '<div class="loading-spinner"></div>';
            
            try {
                // Fetch server details first if not cached (simulated here since we lack direct access to server obj in this view)
                // We'll rely on global constants or fetch:
                const serverRes = await app.authorizedFetch("/servers/");
                const servers = await serverRes.json();
                const server = servers.find(s => s.name === views.server.currentName);
                
                if (!server) throw new Error("Server info not found");

                // Note: authorizedFetch prepends /api, so we just need /servers/...
                const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/search`, {
                     method: "POST",
                     body: JSON.stringify({ 
                         query, 
                         version: server.version, 
                         loader: server.mod_loader 
                     })
                });

                if (!res.ok) throw new Error("Search request failed");
                const mods = await res.json();
                
                if (!Array.isArray(mods)) {
                     // If backend returned error dict
                     if (mods.detail) throw new Error(mods.detail);
                     throw new Error("Invalid response from server");
                }
                
                if (mods.length === 0) {
                    container.innerHTML = '<p class="text-muted">No mods found.</p>';
                    return;
                }
                
                container.innerHTML = mods.map(mod => `
                    <div class="mod-card">
                        <div class="mod-card-header">
                            <img src="${mod.icon_url || '/source/png/component.png'}" class="mod-icon">
                            <div class="mod-info">
                                <div class="mod-name" title="${mod.title}">${mod.title}</div>
                                <div class="mod-meta">by ${mod.author} • ${(mod.downloads/1000).toFixed(1)}k dls</div>
                            </div>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.5rem 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${mod.description}</p>
                        <div class="mod-actions">
                            <button class="btn btn-sm btn-success" onclick="views.server.installMod('${mod.project_id}')">
                                Install
                            </button>
                        </div>
                    </div>
                `).join('');
                
            } catch (e) {
                console.error(e);
                views.toast.show(e.message || "Search failed", "error");
                container.innerHTML = '<p class="text-danger">Search failed</p>';
            }
        },

        installMod: async (projectId) => {
            try {
                // Need server info again... ideally stored in views.server.data
                const serverRes = await app.authorizedFetch("/servers/");
                const servers = await serverRes.json();
                const server = servers.find(s => s.name === views.server.currentName);

                if (!confirm(`Install mod to ${server.name}?`)) return;

                views.toast.show("Installing mod...", "info");
                
                 // Note: authorizedFetch prepends /api
                 const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/install`, {
                    method: "POST",
                    body: JSON.stringify({
                        project_id: projectId,
                        version: server.version,
                        loader: server.mod_loader
                    })
                });
                
                if (!res.ok) throw new Error("Installation failed");
                views.toast.show("Mod installed!", "success");
                views.server.loadMods();
            } catch (e) {
                views.toast.show("Error installing mod", "error");
            }
        },

        loadMods: async () => {
            const container = document.getElementById("mod-list");
            if (!container) return;
            
            container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
            
            try {
                const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/`);
                if (!res.ok) throw new Error("Failed to load mods");
                const mods = await res.json();
                
                if (mods.length === 0) {
                    container.innerHTML = `
                        <div class="empty-card" style="grid-column: 1 / -1;">
                             <img src="/source/png/component.png" class="icon-img icon-img--lg" style="opacity: 0.5; margin-bottom: 1rem;">
                             <h3>No Mods Installed</h3>
                             <p class="text-muted">Upload .jar or .zip files to get started.</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = mods.map(mod => `
                    <div class="mod-card">
                        <div class="mod-card-header">
                            <div class="mod-icon">
                                <img src="/source/png/java.png" onerror="this.src='/source/png/component.png'" class="png-icon png-icon--sm">
                            </div>
                            <div class="mod-info">
                                <div class="mod-name" title="${mod.name}">${mod.name}</div>
                                <div class="mod-meta">
                                    <span>${(mod.size / (1024*1024)).toFixed(2)} MB</span>
                                    <span>•</span>
                                    <span>Jar</span>
                                </div>
                            </div>
                        </div>
                        <div class="mod-actions">
                            <button class="icon-btn icon-btn--danger" onclick="views.server.deleteMod('${mod.filename}')" title="Delete">
                                <img src="/source/png/logout.png" class="png-icon png-icon--xs" style="transform: rotate(90deg)">
                            </button>
                        </div>
                    </div>
                `).join('');
                
            } catch (e) {
                container.innerHTML = `<p class="text-danger">Error loading mods: ${e.message}</p>`;
            }
        },

        uploadMod: async (input) => {
            const files = input.files;
            if (!files || files.length === 0) return;
            await views.server.processUploads(files);
            input.value = ''; // Reset
        },

        handleDrop: async (event) => {
            event.preventDefault();
            event.currentTarget.classList.remove('drag-over');
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                await views.server.processUploads(files);
            }
        },

        processUploads: async (files) => {
            let successCount = 0;
            views.toast.show(`Uploading ${files.length} file(s)...`, "info");
            
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append("file", files[i]);
                
                try {
                    const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/upload`, {
                        method: "POST",
                        body: formData
                    });
                    if (res.ok) successCount++;
                } catch (e) {
                    console.error(e);
                }
            }
            
            if (successCount > 0) {
                views.toast.show(`Successfully uploaded ${successCount} mod(s)`, "success");
                views.server.loadMods();
            } else {
                views.toast.show("Upload failed", "error");
            }
        },

        deleteMod: async (filename) => {
            if (!confirm(`Delete ${filename}?`)) return;
            
            try {
                await app.authorizedFetch(`/servers/${views.server.currentName}/mods/${filename}`, {
                    method: "DELETE"
                });
                views.toast.show("Mod deleted", "success");
                views.server.loadMods();
            } catch (e) {
                views.toast.show("Failed to delete mod", "error");
            }
        },

        saveSettings: async () => {
             const data = {
                max_players: parseInt(document.getElementById("setting-max-players").value),
                motd: document.getElementById("setting-motd").value,
                online_mode: document.getElementById("setting-online-mode").checked
            };

            try {
                await app.authorizedFetch(`/servers/${views.server.currentName}`, {
                    method: "PATCH",
                    body: JSON.stringify(data)
                });
                views.toast.show("Settings saved successfully", "success");
            } catch (e) {
                views.toast.show("Failed to save settings", "error");
            }
        }
    },

    // Creator (legacy support)
    creator: {
        create: async () => {
            const name = document.getElementById("create-name")?.value;
            const ram = parseInt(document.getElementById("create-ram")?.value);
            const port = parseInt(document.getElementById("create-port")?.value);
            const version = document.getElementById("create-version")?.value;

            try {
                await app.authorizedFetch("/servers/", {
                    method: "POST",
                    body: JSON.stringify({ name, version, ram_mb: ram, port, online_mode: false })
                });
                views.toast.show("Server created!", "success");
                views.dashboard.loadServers();
            } catch (e) {
                views.toast.show("Failed to create server", "error");
            }
        }
    },

    // Worlds View
    worlds: {
        allWorlds: [],
        selectedWorld: null,

        init: async () => {
            await views.worlds.load();
            await views.worlds.loadVersions();
        },

        load: async () => {
            try {
                const res = await app.authorizedFetch("/worlds/");
                views.worlds.allWorlds = await res.json();
                views.worlds.render();
                views.worlds.updateStats();
            } catch (e) {
                console.error("Failed to load worlds:", e);
            }
        },

        render: () => {
            const worlds = views.worlds.allWorlds;
            const container = document.getElementById("worlds-grid");
            const emptyState = document.getElementById("empty-state");

            if (worlds.length === 0) {
                container?.classList.add("hidden");
                emptyState?.classList.remove("hidden");
            } else {
                container?.classList.remove("hidden");
                emptyState?.classList.add("hidden");
                if (container) {
                    container.innerHTML = worlds.map(w => views.worlds.renderCard(w)).join('');
                }
            }
        },

        renderCard: (world) => {
            return `
                <div class="server-card" data-world="${world.id}">
                    <div class="server-card-header">
                        <div class="server-card-status">
                            <img src="/source/png/worlds.png" class="icon-img icon-img--sm">
                        </div>
                        <h3 class="server-card-title">${world.name}</h3>
                        <div class="server-card-actions">
                            <button class="icon-btn icon-btn--danger" onclick="event.stopPropagation(); views.worlds.delete(${world.id})" title="Delete">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </div>
                    
                    <div class="server-card-body">
                        <div class="server-card-info">
                            <div class="info-row">
                                <img src="/source/png/version.png" class="icon-img icon-img--xs">
                                <span>Created: ${world.original_version || 'Unknown'}</span>
                            </div>
                            <div class="info-row">
                                <img src="/source/png/version.png" class="icon-img icon-img--xs">
                                <span>Last used: ${world.last_used_version || 'Unknown'}</span>
                            </div>
                            <div class="info-row">
                                <img src="/source/png/disk.png" class="icon-img icon-img--xs">
                                <span>${world.size_mb || 0} MB</span>
                            </div>
                            ${world.seed ? `
                            <div class="info-row">
                                <ion-icon name="key-outline"></ion-icon>
                                <span>Seed: ${world.seed}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="server-card-footer">
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); views.worlds.openAssign(${world.id}, '${world.name}')">
                            <ion-icon name="copy-outline"></ion-icon>
                            Assign to Servers
                        </button>
                    </div>
                </div>
            `;
        },

        updateStats: () => {
            const worlds = views.worlds.allWorlds;
            const totalSize = worlds.reduce((acc, w) => acc + (w.size_mb || 0), 0);

            const el = (id, val) => {
                const elem = document.getElementById(id);
                if (elem) elem.textContent = val;
            };

            el("total-worlds", worlds.length);
            el("total-size", `${(totalSize / 1024).toFixed(2)} GB`);
        },

        loadVersions: async () => {
            try {
                const res = await app.authorizedFetch("/versions");
                if (res.ok) {
                    const versions = await res.json();
                    const select = document.getElementById("world-version");
                    if (select) {
                        select.innerHTML = versions.map(v =>
                            `<option value="${v.name}">${v.name}</option>`
                        ).join('');
                    }
                }
            } catch (e) {
                console.error("Failed to load versions:", e);
            }
        },

        upload: async () => {
            const name = document.getElementById("world-name")?.value;
            const seed = document.getElementById("world-seed")?.value;
            const version = document.getElementById("world-version")?.value;
            const fileInput = document.getElementById("world-file");
            const file = fileInput?.files[0];

            if (!name || !file) {
                views.toast.show("Name and file are required", "error");
                return;
            }

            const formData = new FormData();
            formData.append("file", file);

            try {
                await app.authorizedFetch(`/worlds/?name=${encodeURIComponent(name)}&seed=${encodeURIComponent(seed || '')}&original_version=${encodeURIComponent(version || '')}`, {
                    method: "POST",
                    body: formData
                });
                views.toast.show("World uploaded successfully!", "success");
                views.modals.close("upload-world-modal");
                views.worlds.load();
            } catch (e) {
                views.toast.show("Failed to upload world", "error");
            }
        },

        openAssign: async (worldId, worldName) => {
            views.worlds.selectedWorld = worldId;
            document.getElementById("assign-world-name").textContent = worldName;

            // Load servers
            try {
                const res = await app.authorizedFetch("/servers/");
                const servers = await res.json();
                const select = document.getElementById("assign-world-server");
                select.innerHTML = servers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
                views.modals.open("assign-world-modal");
            } catch (e) {
                views.toast.show("Failed to load servers", "error");
            }
        },

        assign: async () => {
             const serverName = document.getElementById("assign-world-server").value;
             if (!serverName || !views.worlds.selectedWorld) return;

             try {
                 await app.authorizedFetch(`/servers/${serverName}/worlds/assign`, {
                     method: "POST",
                     body: JSON.stringify({ world_id: views.worlds.selectedWorld })
                 });
                 views.toast.show("World assigned successfully!", "success");
                 views.modals.close("assign-world-modal");
             } catch (e) {
                 views.toast.show(e.message || "Failed to assign world", "error");
             }
        }
    },

    // Mod Store / Loader View
    modloader: {
        currentServer: null,
        loaderType: null,
        mcVersion: null,

        init: async (serverName, loader, version) => {
            views.modloader.currentServer = serverName;
            views.modloader.loaderType = loader;
            views.modloader.mcVersion = version;
            
            // Load initial data (Featured mods)
            views.modloader.loadFeatured();
            views.modloader.loadInstalled();
        },

        goBack: () => {
             // Simple reload to reset state relative to server selector
             window.location.reload(); 
        },

        showTab: (tabId) => {
             document.querySelectorAll('.store-sidebar .nav-item').forEach(el => {
                 el.classList.remove('active');
                 if(el.getAttribute('onclick')?.includes(tabId)) el.classList.add('active');
             });
             
             document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
             document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        },

        search: async (query) => {
             if(!query) return;
             const container = document.getElementById("search-results");
             container.innerHTML = '<div class="col-span-full text-center"><div class="loading-spinner"></div> Searching...</div>';

             try {
                // Determine source based on loader
                // Using existing /mods/search endpoint or creating new one?
                // app.js has views.server.searchMods which uses /servers/{name}/mods/search
                // Let's use that one as it likely handles auth/context correctly
                const res = await app.authorizedFetch(`/servers/${views.modloader.currentServer}/mods/search`, {
                     method: "POST",
                     body: JSON.stringify({ 
                         query, 
                         version: views.modloader.mcVersion, 
                         loader: views.modloader.loaderType 
                     })
                });
                
                if (!res.ok) throw new Error("Search failed");
                const mods = await res.json();
                
                if(mods.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center text-gray-500">No results found.</div>';
                    return;
                }

                container.innerHTML = mods.map(mod => views.modloader.renderModCard(mod)).join('');
                
             } catch(e) {
                 container.innerHTML = '<div class="col-span-full text-center text-red-500">Search error.</div>';
             }
        },

        loadFeatured: async () => {
             // Mock featured for now, or fetch "popular"
             // Since we don't have a "popular" endpoint specific, let's search for "generic" useful mods
             // or leave it as "Use search to find mods" for MVP if no featured endpoint.
             // We'll search for "jei" or "items" as specific examples if possible, or just clear it.
             const container = document.getElementById("featured-mods");
             if(!container) return;
             
             container.innerHTML = '<p class="col-span-full text-gray-500">Use search to find mods for your version.</p>';
             // Ideally we'd have a `fetchPopular` endpoint.
        },

        loadInstalled: async () => {
             const container = document.getElementById("installed-mods");
             if(!container) return;
             
             try {
                 const res = await app.authorizedFetch(`/servers/${views.modloader.currentServer}/mods/`);
                 const mods = await res.json(); // returns array of file objects usually
                 
                 if(mods.length === 0) {
                     container.innerHTML = '<div class="col-span-full text-center text-gray-500">No installed mods.</div>';
                 } else {
                     container.innerHTML = mods.map(mod => `
                        <div class="mod-card relative">
                            <div class="flex items-center gap-4 mb-2">
                                <div class="mod-icon bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <i class="ph ph-puzzle-piece text-2xl"></i>
                                </div>
                                <div class="overflow-hidden">
                                     <h3 class="font-medium truncate" title="${mod.name}">${mod.name}</h3>
                                     <p class="text-xs text-secondary">${(mod.size/1024/1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-auto">
                                <button class="win-btn win-btn-danger flex-1 text-xs" onclick="views.modloader.confirmUninstall('${mod.filename}')">Uninstall</button>
                            </div>
                        </div>
                     `).join('');
                 }
             } catch(e) {
                 console.error(e);
             }
        },

        renderModCard: (mod) => {
             // mod object structure depends on backend. Based on views.server logic:
             // { title, author, description, icon_url, project_id, downloads }
             return `
                <div class="mod-card" onclick="views.modloader.openDetail('${mod.project_id}')">
                    <div class="flex items-center gap-4 mb-2">
                        <img src="${mod.icon_url || ''}" class="mod-icon" onerror="this.src='/source/png/component.png'">
                        <div>
                             <h3 class="font-medium line-clamp-1" title="${mod.title}">${mod.title}</h3>
                             <p class="text-xs text-secondary">by ${mod.author}</p>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 line-clamp-3 mb-4 flex-1">${mod.description}</p>
                    <div class="flex justify-between items-center text-xs text-secondary mt-auto">
                         <span><i class="ph ph-download-simple"></i> ${(mod.downloads/1000).toFixed(0)}k</span>
                         <!-- We pass JSON string in attribute to avoid re-fetching details if we want -->
                         <button class="win-btn win-btn-primary py-1 px-3 text-xs" onclick="event.stopPropagation(); views.modloader.install('${mod.project_id}')">Get</button>
                    </div>
                </div>
             `;
        },

        openDetail: async (projectId) => {
             // Ideally we have full details in memory or fetch them.
             // For now, let's assume we need to fetch specific details or just show what we have.
             // Implementing "fetch details" requires endpoint.
             // We can use the open modal logic.
             // Let's implement a quick fetch if needed, or just show loading state.
             
             const modal = document.getElementById("mod-detail-modal");
             modal.classList.remove("hidden");
             
             // Reset
             document.getElementById("detail-title").textContent = "Loading...";
             document.getElementById("detail-description").textContent = "";
             document.getElementById("detail-icon").src = "";
             
             try {
                  const res = await app.authorizedFetch(`/mods/${projectId}`); // endpoint?
                  // Use search again with specific ID or just let the user rely on the card click passing data?
                  // Storing data in a temporary cache (map) when rendering cards is better.
                  // For simplicity, let's just assume we clicked a card and pass data to openDetailObject if possible
                  // But previous code passed only ID.
                  
                  // New approach: Pass ID, but since we don't have "get mod by id" endpoint verified, 
                  // we might fail. Let's try to pass the object references in memory later.
                  // For now, we'll just close it or show "Details not available in preview".
                  
                  document.getElementById("detail-title").textContent = "Mod Details";
                  document.getElementById("detail-description").textContent = `Project ID: ${projectId}. (Detail fetch not implemented)`;
                  
                  // Setup Install Button
                  const btn = document.getElementById("detail-action-btn");
                  btn.onclick = () => views.modloader.install(projectId);
             } catch(e) {
                 
             }
        },

        install: async (projectId) => {
             views.toast.show("Installing...", "info");
             try {
                 const res = await app.authorizedFetch(`/servers/${views.modloader.currentServer}/mods/install`, {
                    method: "POST",
                    body: JSON.stringify({
                        project_id: projectId,
                         version: views.modloader.mcVersion, 
                         loader: views.modloader.loaderType
                    })
                });
                if(!res.ok) throw new Error("Failed");
                views.toast.show("Installed successfully", "success");
                views.modloader.loadInstalled();
             } catch(e) {
                 views.toast.show("Install failed", "error");
             }
        },

        confirmUninstall: async (filename) => {
             if(confirm(`Uninstall ${filename}?`)) {
                 try {
                     await app.authorizedFetch(`/servers/${views.modloader.currentServer}/mods/${filename}`, { method: "DELETE" });
                     views.toast.show("Uninstalled", "success");
                     views.modloader.loadInstalled();
                 } catch(e) {
                     views.toast.show("Failed to uninstall", "error");
                 }
             }
        },

        handleUpload: async (files) => {
             if(files.length === 0) return;
             
             const queue = document.getElementById("upload-queue");
             for(let file of files) {
                  const item = document.createElement('div');
                  item.className = "flex justify-between items-center p-3 bg-white/5 rounded";
                  item.innerHTML = `<span>${file.name}</span> <span class="text-xs text-yellow-500">Uploading...</span>`;
                  queue.appendChild(item);
                  
                  try {
                      const formData = new FormData();
                      formData.append("file", file);
                      // Use generic file upload endpoint to /mods/ or /plugins/ folder depending on logic
                      // Or dedicated endpoint. Existing app.js used `/servers/.../mods/upload`
                      const res = await app.authorizedFetch(`/servers/${views.modloader.currentServer}/mods/upload`, {
                          method: "POST",
                          body: formData
                      });
                      
                      if(res.ok) {
                          item.innerHTML = `<span>${file.name}</span> <span class="text-xs text-green-500">Done</span>`;
                      } else {
                          throw new Error();
                      }
                  } catch(e) {
                      item.innerHTML = `<span>${file.name}</span> <span class="text-xs text-red-500">Failed</span>`;
                  }
             }
             
             views.modloader.loadInstalled();
        },
        
        handleDrop: (event) => {
             event.preventDefault();
             views.modloader.handleUpload(event.dataTransfer.files);
        }
    },



    // Player Management with Smart Updates
    players: {
        currentServer: null,
        updateInterval: null,
        
        init: (serverName) => {
            views.players.currentServer = serverName;
            views.players.load();
            
            if (views.players.updateInterval) clearInterval(views.players.updateInterval);
            views.players.updateInterval = setInterval(() => {
                views.players.load();
            }, 3000);

            // Event Delegation for Player Actions
            const playersTab = document.getElementById('tab-players');
            if (playersTab && !playersTab.dataset.listenersAttached) {
                playersTab.addEventListener('click', views.players.handleTabClick);
                
                // Close dropdowns when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.player-dropdown')) {
                        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                            menu.classList.remove('show');
                        });
                    }
                });
                
                playersTab.dataset.listenersAttached = "true";
            }
        },

        cleanup: () => {
            if (views.players.updateInterval) {
                clearInterval(views.players.updateInterval);
                views.players.updateInterval = null;
            }
        },

        handleTabClick: (e) => {
            // Dropdown Buttons
            const btn = e.target.closest('.dropdown-btn');
            if (btn) {
                e.stopPropagation();
                const dropdownId = btn.dataset.dropdown;
                const dropdown = document.getElementById(dropdownId);
                
                // Close others
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                     if (menu.id !== dropdownId) menu.classList.remove('show');
                });
                
                dropdown?.classList.toggle('show');
                return;
            }
            
            // Action Buttons (if we had any direct ones, but most are in dropdown or onclick)
        },

        load: async () => {
            if (!views.players.currentServer) return;

            try {
                // Fetch both players and server info (for status)
                const [playersRes, serverRes] = await Promise.all([
                    app.authorizedFetch(`/servers/${views.players.currentServer}/players`),
                    app.authorizedFetch(`/servers/`) // we filter client-side to find ours, or fetch specific if endpoint existed
                ]);

                if (!playersRes.ok) return;
                const data = await playersRes.json();
                
                let isOnline = false;
                if (serverRes.ok) {
                    const servers = await serverRes.json();
                    const current = servers.find(s => s.name === views.players.currentServer);
                    if (current) isOnline = (current.status === "ONLINE");
                }

                views.players.updateVisibility(isOnline);
                
                if (isOnline) {
                    views.players.updateOnlinePlayers(data.online_players || []);
                } else {
                    views.players.updateOnlinePlayers([]); // Clear if offline
                }
                
                views.players.updateBannedUsers(data.banned_users || []);
                views.players.updateBannedIPs(data.banned_ips || []);
                views.players.updateRecentActivity(data.recent_activity || []);
                
            } catch (e) {
                console.error('Failed to load players:', e);
            }
        },

        updateVisibility: (isOnline) => {
            const onlineSection = document.getElementById("players-section-online");
            if (onlineSection) {
                if (isOnline) {
                    onlineSection.classList.remove("hidden");
                    onlineSection.style.display = "block"; // Ensure display
                } else {
                    onlineSection.classList.add("hidden");
                    onlineSection.style.display = "none";
                }
            }
        },

        // === Smart Component Updates ===
        
        smartUpdate: (containerId, newData, getKeyFunc, renderFunc) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Handle Empty State
            if (newData.length === 0) {
                 if (!container.querySelector('.empty-player-state')) {
                     let title = "No Players";
                     let msg = "List is empty";
                     let icon = "user.png";
                     
                     if (containerId.includes('online')) {
                         title = "No Players Online";
                         msg = "Waiting for players to join...";
                         icon = "user.png";
                     } else if (containerId.includes('users')) {
                         title = "No Banned Users";
                         msg = "No users have been banned";
                         icon = "ban-outline";
                     } else if (containerId.includes('ips')) {
                         title = "No Banned IPs";
                         msg = "No IP addresses have been banned";
                         icon = "banip.png";
                     } else if (containerId.includes('recent')) {
                         title = "No Recent Activity";
                         msg = "No events logged recently";
                         icon = "time-outline";
                     }

                     const iconHtml = icon.includes('.') 
                        ? `<img src="/source/png/${icon}" class="icon-img" onerror="this.src='/source/png/part.png'">`
                        : `<ion-icon name="${icon}" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></ion-icon>`;

                     container.innerHTML = `
                        <div class="empty-player-state">
                            ${iconHtml}
                            <h4>${title}</h4>
                            <p>${msg}</p>
                        </div>
                     `;
                 }
                 return;
            }

            // Remove empty state/loading state
            const emptyState = container.querySelector('.empty-player-state, .loading-state');
            if (emptyState) emptyState.remove();

            // 1. Map existing elements
            const existingMap = new Map();
            Array.from(container.children).forEach(el => {
                const key = el.getAttribute('data-key');
                if (key) existingMap.set(key, el);
            });

            // 2. Remove items not in new data
            const newKeys = new Set(newData.map(d => getKeyFunc(d)));
            existingMap.forEach((el, key) => {
                if (!newKeys.has(key)) el.remove();
            });

            // 3. Update/Insert
            newData.forEach((item, index) => {
                const key = getKeyFunc(item);
                let el = existingMap.get(key);
                const newHtml = renderFunc(item, index);
                const newDataJson = JSON.stringify(item); // Simple equality check

                if (el) {
                    // Check if content changed
                    if (el.getAttribute('data-json') !== newDataJson) {
                         const temp = document.createElement('div');
                         temp.innerHTML = newHtml.trim();
                         const newEl = temp.firstChild;
                         newEl.setAttribute('data-key', key);
                         newEl.setAttribute('data-json', newDataJson);
                         el.replaceWith(newEl);
                         el = newEl;
                    }
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = newHtml.trim();
                    el = temp.firstChild;
                    el.setAttribute('data-key', key);
                    el.setAttribute('data-json', newDataJson);
                }
                
                // 4. Ensure Order
                const currentChild = container.children[index];
                if (currentChild !== el) {
                    if (currentChild) {
                        container.insertBefore(el, currentChild);
                    } else {
                        container.appendChild(el);
                    }
                }
            });
        },

        updateOnlinePlayers: (newPlayers) => {
            const countBadge = document.querySelector('#players-section-online .player-count');
            if (countBadge) countBadge.textContent = newPlayers.length;

            views.players.smartUpdate(
                'online-players-list', 
                newPlayers, 
                (p) => p.username,
                views.players.renderPlayer
            );
        },

        updateBannedUsers: (newBanned) => {
            const countBadge = document.querySelector('#players-section-banned .player-count');
            if (countBadge) countBadge.textContent = newBanned.length;
            
            views.players.bannedCache = newBanned || []; // Cache for editing

            views.players.smartUpdate(
                'banned-users-list', 
                newBanned, 
                (b) => b.name || b.username, // Use name property if available from file, fallback username
                views.players.renderBannedUser
            );
        },

        updateBannedIPs: (newBannedIPs) => {
            const countBadge = document.querySelector('#players-section-ips .player-count');
            if (countBadge) countBadge.textContent = newBannedIPs.length;

            views.players.smartUpdate(
                'banned-ips-list', 
                newBannedIPs, 
                (b) => b.ip,
                views.players.renderBannedIP
            );
        },

        updateRecentActivity: (newRecents) => {
            views.players.smartUpdate(
                'recent-activity-list', 
                newRecents, 
                (r) => `${r.type}-${r.user}-${r.timestamp}`,
                views.players.renderRecentActivity
            );
        },

        getInitials: (name) => {
            if (!name) return '?';
            const parts = name.split(/[_\s]/);
            if (parts.length > 1) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        },

        // === Render Functions ===
        
        renderPlayer: (player, index) => {
            const initials = views.players.getInitials(player.username);
            const safeUsername = player.username.replace(/[^a-zA-Z0-9]/g, '');
            const dropdownId = `dropdown-${safeUsername}-${index}`;
            
            return `
                <div class="player-item" data-player="${player.username}">
                    <div class="player-avatar">${initials}</div>
                    <div class="player-info">
                        <div class="player-name">${player.username}</div>
                        <div class="player-meta">
                            <div class="player-meta-item">
                                <img src="/source/png/network.png" class="icon-img icon-img--xs">
                                <span>${player.ip || 'Unknown'}</span>
                            </div>
                            ${player.uuid ? `
                                <div class="player-meta-separator"></div>
                                <div class="player-meta-item">
                                    <ion-icon name="finger-print-outline" style="font-size: 0.9rem;"></ion-icon>
                                    <span title="${player.uuid}">${player.uuid.substring(0, 8)}...</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="player-actions">
                        <div class="player-dropdown">
                            <button class="dropdown-btn" data-dropdown="${dropdownId}">
                                <span>Actions</span>
                                <ion-icon name="chevron-down-outline" style="font-size: 1rem;"></ion-icon>
                            </button>
                            <div class="dropdown-menu" id="${dropdownId}">
                                <button class="dropdown-item" onclick="views.players.kickPlayer('${player.username}')">
                                    <ion-icon name="log-out-outline"></ion-icon>
                                    <span>Kick</span>
                                </button>
                                <button class="dropdown-item" onclick="views.players.opPlayer('${player.username}')">
                                    <ion-icon name="shield-checkmark-outline"></ion-icon>
                                    <span>Grant Operator</span>
                                </button>
                                <button class="dropdown-item" onclick="views.players.deopPlayer('${player.username}')">
                                    <ion-icon name="shield-outline"></ion-icon>
                                    <span>Revoke Operator</span>
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item dropdown-item--danger" onclick="views.players.banPlayer('${player.username}', 'username')">
                                    <ion-icon name="person-remove-outline"></ion-icon>
                                    <span>Ban Username</span>
                                </button>
                                <button class="dropdown-item dropdown-item--danger" onclick="views.players.banPlayer('${player.username}', 'ip')">
                                    <ion-icon name="globe-outline"></ion-icon>
                                    <span>Ban IP</span>
                                </button>
                                <button class="dropdown-item dropdown-item--danger" onclick="views.players.banPlayer('${player.username}', 'both')">
                                    <ion-icon name="alert-circle-outline"></ion-icon>
                                    <span>Ban Both</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderBannedUser: (ban, index) => {
            const username = ban.name || ban.username;
            const expires = ban.expires || 'Forever';
            const reason = ban.reason || 'No reason provided';
            
            return `
                <div class="banned-item" data-banned="${username}">
                    <div class="checkbox-wrapper" style="margin-right: 1rem;">
                        <input type="checkbox" class="ban-checkbox" value="${username}" data-type="user">
                    </div>
                    <div class="banned-info">
                        <div class="ban-icon">
                            <ion-icon name="ban-outline" style="font-size: 1.25rem;"></ion-icon>
                        </div>
                        <div class="banned-details">
                            <div class="banned-name">${username}</div>
                            <div class="banned-reason" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                                <span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">Exp: ${expires}</span>
                                <span class="text-muted" style="font-size: 0.85rem;">${reason}</span>
                            </div>
                        </div>
                    </div>
                    <div class="banned-actions" style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="btn-icon" onclick="views.players.openBanDetails('${username}', 'edit')" title="Edit Ban">
                            <ion-icon name="create-outline"></ion-icon>
                        </button>
                        <button class="btn-icon text-danger" onclick="views.players.unbanUser('${username}')" title="Unban">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </div>
            `;
        },

        renderBannedIP: (ban, index) => {
            const displayName = ban.name ? `${ban.name} - ${ban.ip}` : ban.ip;
            return `
                <div class="banned-item" data-banned-ip="${ban.ip}">
                    <div class="checkbox-wrapper" style="margin-right: 1rem;">
                        <input type="checkbox" class="ban-checkbox" value="${ban.ip}" data-type="ip">
                    </div>
                    <div class="banned-info">
                        <div class="ban-icon">
                            <img src="/source/png/network.png" class="icon-img icon-img--sm">
                        </div>
                        <div class="banned-details">
                            <div class="banned-name">${displayName}</div>
                            <div class="banned-reason">Banned ${ban.timestamp ? new Date(ban.timestamp).toLocaleDateString() : 'recently'}</div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderRecentActivity: (item, index) => {
             let icon = 'alert-circle-outline';
             let color = 'var(--text-muted)';
             let action = 'Unknown Action';
             let isImage = false;
             
             if (item.type === 'kick') { icon = 'log-out-outline'; color = '#eab308'; action = 'Kicked'; } // warning
             else if (item.type === 'ban') { icon = 'ban-outline'; color = '#ef4444'; action = 'Banned User'; } // danger
             else if (item.type === 'ban-ip') { icon = 'globe-outline'; color = '#ef4444'; action = 'Banned IP'; }
             else if (item.type === 'unban') { icon = 'checkmark-circle-outline'; color = '#10b981'; action = 'Unbanned User'; } // success
             else if (item.type === 'unban-ip') { icon = 'checkmark-circle-outline'; color = '#10b981'; action = 'Unbanned IP'; }
             else if (item.type === 'join') { isImage = true; icon = 'user.png'; action = 'Joined'; }
             else if (item.type === 'leave') { isImage = true; icon = 'logout.png'; action = 'Left'; }
             
             const timeStr = new Date(item.timestamp).toLocaleTimeString();
             const iconHtml = isImage 
                ? `<img src="/source/png/${icon}" class="icon-img icon-img--sm">` 
                : `<ion-icon name="${icon}" style="font-size: 1.25rem; color: ${color};"></ion-icon>`;

             return `
                <div class="banned-item" style="cursor: default;">
                    <div class="banned-info">
                        <div class="ban-icon">
                            ${iconHtml}
                        </div>
                        <div class="banned-details">
                            <div class="banned-name" style="display: flex; align-items: center; gap: 0.5rem;">
                                ${item.user}
                                <span style="font-weight: normal; font-size: 0.8em; color: var(--text-muted); opacity: 0.8;">${action}</span>
                            </div>
                            <div class="banned-reason">
                                ${item.reason ? `${item.reason} • ` : ''} ${timeStr}
                            </div>
                        </div>
                    </div>
                </div>
             `;
        },

        kickPlayer: async (username) => {
            if (!confirm(`Kick ${username} from the server?`)) return;

            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/kick`, {
                    method: 'POST'
                });

                if (!res.ok) throw new Error('Failed to kick player');
                
                views.toast.show(`${username} has been kicked`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to kick ${username}`, 'error');
            }
        },

        banPlayer: async (username, mode) => {
            if (mode === 'username') {
                views.players.openBanDetails(username, 'create');
                return;
            }
            
            const modeText = mode === 'both' ? 'username and IP' : mode;
            if (!confirm(`Ban ${username} by ${modeText}?`)) return;

            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/ban`, {
                    method: 'POST',
                    body: JSON.stringify({ mode: mode })
                });

                if (!res.ok) throw new Error('Failed to ban player');
                
                views.toast.show(`${username} has been banned`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to ban ${username}`, 'error');
            }
        },

        openBanDetails: (username, mode) => {
            document.getElementById('ban-username').value = username;
            document.getElementById('ban-display-username').value = username;
            document.getElementById('ban-mode').value = mode;
            document.getElementById('ban-details-title').textContent = mode === 'edit' ? 'Edit Ban' : 'Ban Player';
            
            if (mode === 'edit') {
                // Pre-fill
                const cached = (views.players.bannedCache || []).find(b => (b.name || b.username) === username);
                if (cached) {
                    document.getElementById('ban-reason').value = cached.reason || '';
                    // Parsing expires is hard, stick to setting NEW duration if they change it.
                    document.getElementById('ban-duration-amount').value = '';
                    document.getElementById('ban-duration-unit').value = 'forever'; 
                }
            } else {
                // Clear
                document.getElementById('ban-reason').value = '';
                document.getElementById('ban-duration-amount').value = '';
                document.getElementById('ban-duration-unit').value = 'forever';
            }
            
            views.modals.open('ban-details-modal');
        },

        submitBanDetails: async () => {
            const username = document.getElementById('ban-username').value;
            const mode = document.getElementById('ban-mode').value;
            const reason = document.getElementById('ban-reason').value || "Banned by admin";
            const amount = document.getElementById('ban-duration-amount').value;
            const unit = document.getElementById('ban-duration-unit').value;
            
            let expires = "forever";
            if (unit !== 'forever' && amount > 0) {
                 const now = new Date();
                 let added = 0;
                 if (unit === 'seconds') added = amount * 1000;
                 if (unit === 'minutes') added = amount * 60 * 1000;
                 if (unit === 'hours') added = amount * 60 * 60 * 1000;
                 if (unit === 'days') added = amount * 24 * 60 * 60 * 1000;
                 if (unit === 'weeks') added = amount * 7 * 24 * 60 * 60 * 1000;
                 if (unit === 'months') added = amount * 30 * 24 * 60 * 60 * 1000;
                 
                 const expDate = new Date(now.getTime() + added);
                 
                 // Format: YYYY-MM-DD HH:MM:SS Z
                 const pad = n => n < 10 ? '0'+n : n;
                 const yyyy = expDate.getFullYear();
                 const mm = pad(expDate.getMonth()+1);
                 const dd = pad(expDate.getDate());
                 const hh = pad(expDate.getHours());
                 const min = pad(expDate.getMinutes());
                 const ss = pad(expDate.getSeconds());
                 const off = -expDate.getTimezoneOffset();
                 const offH = pad(Math.floor(Math.abs(off)/60));
                 const offM = pad(Math.abs(off)%60);
                 const sign = off >= 0 ? '+' : '-';
                 
                 expires = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} ${sign}${offH}${offM}`; 
            }
            
            try {
                let url, method, body;
                if (mode === 'create') {
                    url = `/servers/${views.players.currentServer}/players/${username}/ban`;
                    method = 'POST';
                    body = { mode: 'username', reason, expires };
                } else {
                    url = `/servers/${views.players.currentServer}/banned-players/${username}`;
                    method = 'PUT';
                    body = { reason, expires };
                }
                
                const res = await app.authorizedFetch(url, {
                    method: method,
                    body: JSON.stringify(body)
                });

                if (!res.ok) throw new Error('Action failed');
                
                views.modals.close('ban-details-modal');
                views.toast.show(`Ban ${mode === 'edit' ? 'updated' : 'created'} for ${username}`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to ${mode} ban for ${username}`, 'error');
            }
        },

        unbanUser: async (username) => {
            if (!confirm(`Unban ${username}?`)) return;

            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/unban`, {
                    method: 'POST'
                });

                if (!res.ok) throw new Error('Failed to unban user');
                
                views.toast.show(`${username} has been unbanned`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to unban ${username}`, 'error');
            }
        },

        unbanIP: async (ip) => {
            if (!confirm(`Unban IP ${ip}?`)) return;
            await views.players._performUnbanIP(ip);
        },
        
        _performUnbanUser: async (username) => {
            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/unban`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to unban user');
                views.toast.show(`${username} has been unbanned`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to unban ${username}`, 'error');
            }
        },

        _performUnbanIP: async (ip) => {
            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/ip/${ip}/unban`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to unban IP');
                views.toast.show(`IP ${ip} has been unbanned`, 'success');
                views.players.load(); 
            } catch (e) {
                views.toast.show(`Failed to unban IP ${ip}`, 'error');
            }
        },
        
        // === Bulk Actions ===
        openBanModal: (type) => {
            views.players.banType = type; // 'user' or 'ip'
            document.getElementById('bulk-ban-title').textContent = type === 'user' ? 'Ban Users' : 'Ban IPs';
            
            // Get currently online players from the DOM (or keeping a cache would be better, but DOM is source of truth here)
            const list = document.getElementById('ban-candidates-list');
            list.innerHTML = '<div class="loading-spinner"></div>';
            
            views.modals.open('bulk-ban-modal');
            
            // Re-fetch to be sure? Or just use current data? simpler to re-fetch players via API
            // But we can just grab from the current list data
            app.authorizedFetch(`/servers/${views.players.currentServer}/players`).then(async res => {
                const data = await res.json();
                const players = data.online_players || [];
                
                if (players.length === 0) {
                    list.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No online players to ban.</p>';
                    return;
                }
                
                list.innerHTML = players.map(p => `
                    <label class="check-item">
                        <input type="checkbox" name="ban_candidate" value="${p.username}">
                        <div class="check-item-content">
                            <span class="check-item-title">${p.username}</span>
                            <span class="check-item-subtitle">${p.ip || 'Unknown IP'}</span>
                        </div>
                    </label>
                `).join('');
            });
        },
        
        executeBan: async () => {
             const checkboxes = document.querySelectorAll('input[name="ban_candidate"]:checked');
             const reason = document.getElementById('bulk-ban-reason').value || "Banned by admin";
             
             if (checkboxes.length === 0) {
                 views.toast.show("No players selected", "warning");
                 return;
             }
             
             const type = views.players.banType; // 'user' or 'ip'
             const mode = type === 'user' ? 'username' : 'ip';
             const targets = Array.from(checkboxes).map(cb => cb.value);
             
             views.modals.close('bulk-ban-modal');
             views.toast.show(`Banning ${targets.length} players...`, "info");
             
             for (const username of targets) {
                 try {
                     await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/ban`, {
                        method: 'POST',
                        body: JSON.stringify({ mode: mode, reason: reason })
                     });
                 } catch (e) {
                     console.error(`Failed to ban ${username}`, e);
                 }
             }
             
             views.toast.show("Ban operations completed", "success");
             views.players.load();
        },
        
        unbanSelected: async (type) => {
            const listId = type === 'user' ? 'banned-users-list' : 'banned-ips-list';
            const container = document.getElementById(listId);
            const checkboxes = container.querySelectorAll('.ban-checkbox:checked');
            
            if (checkboxes.length === 0) {
                views.toast.show("No items selected to unban", "warning");
                return;
            }
            
            if (!confirm(`Unban ${checkboxes.length} selected items?`)) return;
            
            const targets = Array.from(checkboxes).map(cb => cb.value);
            views.toast.show(`Unbanning ${targets.length} items...`, "info");
            
            for (const target of targets) {
                if (type === 'user') {
                    await views.players._performUnbanUser(target);
                } else {
                    await views.players._performUnbanIP(target);
                }
            }
            
             views.toast.show("Unban operations completed", "success");
        },

        opPlayer: async (username) => {
            if (!confirm(`Grant Operator privileges to ${username}?`)) return;
            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/op`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to op player');
                views.toast.show(`${username} is now an operator`, 'success');
            } catch (e) {
                views.toast.show(`Failed to op ${username}`, 'error');
            }
        },

        deopPlayer: async (username) => {
            if (!confirm(`Revoke Operator privileges from ${username}?`)) return;
            try {
                const res = await app.authorizedFetch(`/servers/${views.players.currentServer}/players/${username}/deop`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to deop player');
                views.toast.show(`${username} is no longer an operator`, 'success');
            } catch (e) {
                views.toast.show(`Failed to deop ${username}`, 'error');
            }
        }
    }
};


// ============================================
// Paper Plugins Controller
// ============================================
views.paper = {
    init: () => {
        // Called when tab is shown if needed
    },
    
    search: async () => {
        const query = document.getElementById("plugin-search-query")?.value;
        const sort = document.getElementById("plugin-sort-filter")?.value || "estrellas";
        const container = document.getElementById("plugin-results-grid");
        if (!container) return;
        
        // If sorting by Stars/Recent etc but no query, handle as empty query search
        // User provided logic suggests we can just pass sort as part of the query logic or separate?
        // My implementation in paper_mod_server.py handles sort mapping.
        // My integration in mod_service.py ignores 'sort' param passed here currently?
        // Wait, mod_service.py hardcoded "estrellas" or "buscar" based on query presence.
        // I need to update mod_service.py to accept sort if I want sorting to work fully, 
        // OR I pass the sort param in the query/payload and handle it.
        // Current mod_service implementation: sort_type = "buscar" if query else "estrellas"
        // It doesn't look at a 'sort' field in payload.
        // Let's rely on query for now. If user wants specific sort without query, they might need to type something?
        // Actually, for "Top Rated" (estrellas) with empty query, mod_service will use "estrellas".
        // If I want "Recent Downloads" with empty query, I need to pass that info.
        // But mod_service.py interface search_mods(query, version, loader) doesn't have sort.
        // I'll stick to basic search for now.
        
        container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><span>Searching Hangar...</span></div>';
        
        try {
             const serverRes = await app.authorizedFetch("/servers/");
             const servers = await serverRes.json();
             const server = servers.find(s => s.name === views.server.currentName);
             if(!server) throw new Error("Server not found");
             
             // We pass query. If query is empty, mod_service uses 'estrellas'.
             // TODO: Enhance backend to support sort param.
             
             const payload = {
                 query: query || "", 
                 version: server.version, 
                 loader: "PAPER"
             };
             
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/search`, {
                 method: "POST",
                 body: JSON.stringify(payload)
             });
             
             if (!res.ok) throw new Error("Search failed");
             const results = await res.json();
             
             views.paper.render(results);
             
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${e.message}</p></div>`;
        }
    },
    
    render: (results) => {
        const container = document.getElementById("plugin-results-grid");
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="search-outline" class="empty-icon"></ion-icon>
                    <h3>No plugins found</h3>
                    <p>Try a different search query.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = results.map(p => `
            <div class="plugin-card">
                <div class="plugin-header">
                    <div>
                        <div class="plugin-title">${p.title}</div>
                        <div class="plugin-author">by ${p.author}</div>
                    </div>
                </div>
                <div class="plugin-desc">${p.description || 'No description'}</div>
                <div class="plugin-footer">
                    <div class="plugin-meta">
                         <span class="badge" style="background: var(--bg-dark); color: var(--text-muted);">${p.loader || 'Plugin'}</span>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="views.paper.install('${p.project_id}')">
                        <ion-icon name="download-outline"></ion-icon>
                        Install
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    install: async (url) => {
        if (!confirm("Install this plugin?")) return;
        
        try {
             views.toast.show("Installing plugin...", "info");
             
             const serverRes = await app.authorizedFetch("/servers/");
             const servers = await serverRes.json();
             const server = servers.find(s => s.name === views.server.currentName);
             
             const payload = {
                 project_id: url,
                 version: server.version,
                 loader: "PAPER"
             };
             
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/install`, {
                 method: "POST",
                 body: JSON.stringify(payload)
             });
             
             if (!res.ok) {
                 const err = await res.json();
                 throw new Error(err.detail || "Install failed");
             }
             
             views.toast.show("Plugin installed successfully!", "success");
             
             // Refresh installed list if visible
             views.paper.loadInstalled();
        } catch (e) {
            views.toast.show(e.message || "Failed to install plugin", "error");
        }
    },
    
    // --- New Methods ---
    
    switchTab: (tabId) => {
        // Update Buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab-btn-${tabId}`)?.classList.add('active');
        
        // Update Content
        ['search', 'installed'].forEach(id => {
            const el = document.getElementById(`tab-content-${id}`);
            if (id === tabId) {
                el?.classList.remove('hidden');
            } else {
                el?.classList.add('hidden');
            }
        });
        
        if (tabId === 'installed') {
            views.paper.loadInstalled();
        }
    },
    
    loadInstalled: async () => {
        const tbody = document.getElementById("installed-plugins-list");
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
        
        try {
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods?loader=PAPER`);
             if (!res.ok) throw new Error("Failed to load plugins");
             const plugins = await res.json();
             views.paper.renderInstalled(plugins);
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${e.message}</td></tr>`;
        }
    },
    
    renderInstalled: (plugins) => {
        const tbody = document.getElementById("installed-plugins-list");
        if (!tbody) return;
        
        if (plugins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No plugins installed.</td></tr>';
            return;
        }
        
        tbody.innerHTML = plugins.map(p => `
            <tr>
                <td><input type="checkbox" class="plugin-select" value="${p.filename}"></td>
                <td>
                    <div style="font-weight: 500; color: var(--text);">${p.name_only}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${p.filename}</div>
                </td>
                <td>${p.location}</td>
                <td>${p.size}</td>
                <td>
                    ${p.warning 
                        ? '<span class="badge-warning">Check Required</span>' 
                        : '<span class="badge-normal">Installed</span>'}
                </td>
                <td>
                    <button class="icon-btn icon-btn--danger" onclick="views.paper.deleteOne('${p.filename}')" title="Delete">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    toggleSelectAll: (checkbox) => {
        document.querySelectorAll('.plugin-select').forEach(cb => cb.checked = checkbox.checked);
    },
    
    deleteOne: async (filename) => {
        if (!confirm(`Deep delete plugin: ${filename}?\nThis will remove the JAR and its configuration folder if found.`)) return;
        
        try {
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/${encodeURIComponent(filename)}?loader=PAPER`, {
                 method: "DELETE"
             });
             
             if (!res.ok) throw new Error("Delete failed");
             const data = await res.json();
             
             views.toast.show(data.message || "Deleted", "success");
             views.paper.loadInstalled();
             
        } catch (e) {
            views.toast.show(e.message || "Failed to delete", "error");
        }
    },
    
    deleteSelected: async () => {
        const selected = Array.from(document.querySelectorAll('.plugin-select:checked')).map(cb => cb.value);
        if (selected.length === 0) return;
        
        if (!confirm(`Delete ${selected.length} plugins?\nThis action includes deep cleaning of configuration folders.`)) return;
        
        try {
            const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/`, {
                method: "DELETE",
                body: JSON.stringify({ files: selected, loader: "PAPER" })
            });

            if (!res.ok) throw new Error("Bulk delete failed");
            
            const results = await res.json();
            const successCount = results.filter(r => r.success).length;
            
            views.toast.show(`Deleted ${successCount} of ${selected.length} plugins`, "success");
            views.paper.loadInstalled();
            
        } catch (e) {
            views.toast.show(e.message || "Failed to delete selected", "error");
        }
    }
};

// ============================================
// Generic Mods Controller (Forge/Fabric)
// ============================================
views.mods = {
    currentLoader: null,

    init: async () => {
        // Fetch server info to determine loader
        try {
            const res = await app.authorizedFetch(`/servers/`);
            if (!res.ok) return;
            const servers = await res.json();
            const server = servers.find(s => s.name === views.server.currentName);
            if (server) {
                views.mods.currentLoader = server.mod_loader;
            }
        } catch (e) {
            console.error("Failed to init mods view:", e);
        }
    },

    switchTab: (tabId) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab-btn-${tabId}`)?.classList.add('active');
        
        ['search', 'installed'].forEach(id => {
            const el = document.getElementById(`tab-content-${id}`);
            if (id === tabId) el?.classList.remove('hidden');
            else el?.classList.add('hidden');
        });
        
        if (tabId === 'installed') views.mods.loadInstalled();
    },

    search: async () => {
        const query = document.getElementById("mod-search-query")?.value;
        const container = document.getElementById("mod-results-grid");
        if (!container) return;
        
        container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><span>Searching Modrinth...</span></div>';
        
        try {
            // Ensure loader is set
            if (!views.mods.currentLoader) await views.mods.init();

             const serverRes = await app.authorizedFetch("/servers/");
             const servers = await serverRes.json();
             const server = servers.find(s => s.name === views.server.currentName);
             if(!server) throw new Error("Server not found");
             
             const payload = {
                 query: query || "", 
                 version: server.version, 
                 loader: server.mod_loader // FORGE, FABRIC, etc.
             };
             
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/search`, {
                 method: "POST",
                 body: JSON.stringify(payload)
             });
             
             if (!res.ok) throw new Error("Search failed");
             const results = await res.json();
             
             views.mods.render(results);
             
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${e.message}</p></div>`;
        }
    },

    render: (results) => {
        const container = document.getElementById("mod-results-grid");
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="search-outline" class="empty-icon"></ion-icon>
                    <h3>No mods found</h3>
                    <p>Try a different search query.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = results.map(m => `
            <div class="plugin-card" onclick="window.open('${m.url}', '_blank')">
                <div class="plugin-header">
                    <img src="${m.icon || '/source/png/mod.png'}" class="plugin-icon" onerror="this.src='/source/png/mod.png'">
                    <div>
                        <div class="plugin-title">${m.name}</div>
                        <div class="plugin-author">by ${m.author}</div>
                    </div>
                </div>
                <div class="plugin-desc">${m.description || 'No description'}</div>
                <div class="plugin-footer">
                    <div class="plugin-meta">
                        <span class="badge" style="background: var(--bg-dark); color: var(--text-muted);">${m.loader ? m.loader : 'Mod'}</span>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); views.mods.install('${m.slug}')">
                        <ion-icon name="download-outline"></ion-icon>
                        Install
                    </button>
                </div>
            </div>
        `).join('');
    },

    install: async (slug) => {
        if (!confirm("Install this mod?")) return;
        
        try {
             views.toast.show("Installing mod...", "info");
             
             const serverRes = await app.authorizedFetch("/servers/");
             const servers = await serverRes.json();
             const server = servers.find(s => s.name === views.server.currentName);
             
             const payload = {
                 project_id: slug,
                 version: server.version,
                 loader: server.mod_loader
             };
             
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/install`, {
                 method: "POST",
                 body: JSON.stringify(payload)
             });
             
             if (!res.ok) {
                 const err = await res.json();
                 throw new Error(err.detail || "Install failed");
             }
             
             views.toast.show("Mod installed successfully!", "success");
             // Refresh if installed tab active?
             views.mods.loadInstalled();
        } catch (e) {
            views.toast.show(e.message || "Failed to install mod", "error");
        }
    },

    loadInstalled: async () => {
        const tbody = document.getElementById("installed-mods-list");
        if (!tbody) return;
        
        // Ensure loader is known
        if (!views.mods.currentLoader) await views.mods.init();
        
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
        
        try {
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods?loader=${views.mods.currentLoader}`);
             if (!res.ok) throw new Error("Failed to load mods");
             const mods = await res.json();
             views.mods.renderInstalled(mods);
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error: ${e.message}</td></tr>`;
        }
    },

    renderInstalled: (mods) => {
        const tbody = document.getElementById("installed-mods-list");
        if (!tbody) return;
        
        if (mods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No mods installed.</td></tr>';
            return;
        }
        
        tbody.innerHTML = mods.map(m => `
            <tr>
                <td><input type="checkbox" class="mod-select" value="${m.filename}"></td>
                <td>
                    <div style="font-weight: 500; color: var(--text);">${m.name_only}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${m.filename}</div>
                </td>
                <td>${m.location}</td>
                <td>${m.size}</td>
                <td>
                    <button class="icon-btn icon-btn--danger" onclick="views.mods.deleteOne('${m.filename}')" title="Delete">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    toggleSelectAll: (checkbox) => {
        document.querySelectorAll('.mod-select').forEach(cb => cb.checked = checkbox.checked);
    },

    deleteOne: async (filename) => {
        if (!confirm(`Delete mod: ${filename}?`)) return;
        
        if (!views.mods.currentLoader) await views.mods.init();

        try {
             const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/${encodeURIComponent(filename)}?loader=${views.mods.currentLoader}`, {
                 method: "DELETE"
             });
             
             if (!res.ok) throw new Error("Delete failed");
             
             views.toast.show("Mod deleted", "success");
             views.mods.loadInstalled();
        } catch (e) {
            views.toast.show(e.message || "Failed to delete", "error");
        }
    },

    deleteSelected: async () => {
        const selected = Array.from(document.querySelectorAll('.mod-select:checked')).map(cb => cb.value);
        if (selected.length === 0) return;
        
        if (!confirm(`Delete ${selected.length} mods?`)) return;
        
        if (!views.mods.currentLoader) await views.mods.init();
        
        try {
            const res = await app.authorizedFetch(`/servers/${views.server.currentName}/mods/`, {
                method: "DELETE",
                body: JSON.stringify({ files: selected, loader: views.mods.currentLoader })
            });

            if (!res.ok) throw new Error("Bulk delete failed");
            
            const results = await res.json();
            const successCount = results.filter(r => r.success).length;
            
            views.toast.show(`Deleted ${successCount} of ${selected.length} mods`, "success");
            views.mods.loadInstalled();
            
        } catch (e) {
            views.toast.show(e.message || "Failed to delete selected", "error");
        }
    }
};
