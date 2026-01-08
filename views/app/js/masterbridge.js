/**
 * MasterBridge Control Module
 * Handles all interactions with the MasterBridge mod API
 */

if (typeof views === 'undefined') {
    window.views = {};
}

views.masterbridge = {
    currentServer: null,
    refreshInterval: null,

    init: function(serverName) {
        this.currentServer = serverName;
        this.loadPlayers();
        this.refreshStatus();
        this.refreshActiveEvents();
        
        // Auto-refresh every 5 seconds
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            this.refreshStatus();
            this.refreshActiveEvents();
        }, 5000);
    },

    cleanup: function() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    async loadPlayers() {
        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/players`);
            if (!res.ok) return;
            
            const data = await res.json();
            const players = data.online_players || [];

            // Populate all player dropdowns
            const dropdowns = [
                'cinematic-player',
                'paranoia-player',
                'special-event-player'
            ];

            dropdowns.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;

                // Preserve "all" option for cinematic-player
                const hasAllOption = select.querySelector('option[value="all"]');
                select.innerHTML = hasAllOption ? '<option value="all">Todos los jugadores</option>' : '<option value="">Seleccionar jugador...</option>';

                players.forEach(player => {
                    const option = document.createElement('option');
                    option.value = player.name  || player.username;
                    option.textContent = player.name || player.username;
                    select.appendChild(option);
                });
            });
        } catch (e) {
            console.error('Error loading players:', e);
        }
    },

    async refreshStatus() {
        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/server-status`);
            const container = document.getElementById('mb-server-status');
            if (!container) return;

            if (!res.ok) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: rgba(239, 68, 68, 0.8); padding: 20px;">
                        <i class="ph ph-warning-circle" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                        MasterBridge no disponible
                    </div>
                `;
                return;
            }

            const data = await res.json();
            
            container.innerHTML = `
                <div style="background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 4px;">Jugadores Online</div>
                    <div style="font-size: 24px; font-weight: 600; color: #60cdff;">${data.online_players}/${data.max_players}</div>
                </div>
                <div style="background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 4px;">MSPT (Milisegundos por Tick)</div>
                    <div style="font-size: 24px; font-weight: 600; color: ${data.mspt < 50 ? '#22c55e' : '#ef4444'};">${data.mspt.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 4px;">Versión</div>
                    <div style="font-size: 18px; font-weight: 500; color: #fff;">${data.version}</div>
                </div>
               <div style="background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 4px;">MOTD</div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.8);">${data.motd || 'N/A'}</div>
                </div>
            `;
        } catch (e) {
            console.error('Error refreshing status:', e);
        }
    },

    async refreshActiveEvents() {
        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/active-events`);
            const container = document.getElementById('mb-active-events');
            if (!container) return;

            if (!res.ok) {
                container.innerHTML = `
                    <div style="text-align: center; color: rgba(239, 68, 68, 0.8); padding: 20px;">
                        <i class="ph ph-warning-circle" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                        No se pudo cargar eventos activos
                    </div>
                `;
                return;
            }

            const data = await res.json();
            
            const waveEvents = Object.entries(data.wave_events || {});
            const cinematics = Object.entries(data.cinematics || {});
            const hasSpecialEvent = data.special_event_active;

            if (waveEvents.length === 0 && cinematics.length === 0 && !hasSpecialEvent) {
                container.innerHTML = `
                    <div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">
                        <i class="ph ph-check-circle" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                        No hay eventos activos
                    </div>
                `;
                return;
            }

            let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

            waveEvents.forEach(([uuid, event]) => {
                html += `
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <i class="ph ph-siren" style="color: #ef4444; font-size: 18px;"></i>
                            <strong style="color: #ef4444;">${event.type}</strong>
                        </div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.7);">
                            Mobs restantes: ${event.remaining_mobs} | Estado: ${event.is_eliminated ? 'Eliminado' : 'Activo'}
                        </div>
                    </div>
                `;
            });

            cinematics.forEach(([uuid, active]) => {
                if (active) {
                    html += `
                        <div style="background: rgba(59, 130, 246, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="ph ph-film-slate" style="color: #3b82f6; font-size: 18px;"></i>
                                <strong style="color: #3b82f6;">Cinemática Activa</strong>
                            </div>
                        </div>
                    `;
                }
            });

            if (hasSpecialEvent) {
                html += `
                    <div style="background: rgba(168, 85, 247, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.3);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="ph ph-trophy" style="color: #a855f7; font-size: 18px;"></i>
                            <strong style="color: #a855f7;">Evento Especial Activo</strong>
                        </div>
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;
        } catch (e) {
            console.error('Error refreshing active events:', e);
        }
    },

    async triggerCinematic() {
        const type = document.getElementById('cinematic-type').value;
        const target = document.getElementById('cinematic-player').value;
        const difficulty = parseInt(document.getElementById('cinematic-difficulty').value);

        if (!type) {
            app.notify('Por favor selecciona un tipo de cinemática', 'error');
            return;
        }

        if (!target || target === '') {
            app.notify('Por favor selecciona un jugador', 'error');
            return;
        }

        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/cinematics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, target, difficulty })
            });

            if (res.ok) {
                app.notify(`Cinemática "${type}" activada para "${target}"`, 'success');
                this.refreshActiveEvents();
            } else {
                const error = await res.json();
                app.notify(error.detail || 'Error al activar cinemática', 'error');
            }
        } catch (e) {
            app.notify('Error de conexión', 'error');
        }
    },

    async triggerParanoia() {
        const target = document.getElementById('paranoia-player').value;
        const duration = parseInt(document.getElementById('paranoia-duration').value);

        if (!target) {
            app.notify('Por favor selecciona un jugador', 'error');
            return;
        }

        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/paranoia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, duration })
            });

            if (res.ok) {
                app.notify(`Paranoia activada en "${target}" por ${duration} segundos`, 'success');
            } else {
                const error = await res.json();
                app.notify(error.detail || 'Error al activar paranoia', 'error');
            }
        } catch (e) {
            app.notify('Error de conexión', 'error');
        }
    },

    async triggerSpecialEvent() {
        const type = document.getElementById('special-event-type').value;
        const target = document.getElementById('special-event-player').value;

        if (!type) {
            app.notify('Por favor selecciona un tipo de evento', 'error');
            return;
        }

        if (!target) {
            app.notify('Por favor selecciona un jugador', 'error');
            return;
        }

        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/special-events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, target })
            });

            if (res.ok) {
                app.notify(`Evento especial "${type}" activado para "${target}"`, 'success');
                this.refreshActiveEvents();
            } else {
                const error = await res.json();
                app.notify(error.detail || 'Error al activar evento especial', 'error');
            }
        } catch (e) {
            app.notify('Error de conexión', 'error');
        }
    },

    async downloadResourcePack() {
        try {
            const res = await app.authorizedFetch(`/servers/${this.currentServer}/masterbridge/resource-pack`);
            
            if (!res.ok) {
                app.notify('Resource pack no disponible', 'error');
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentServer}_pack.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            app.notify('Resource pack descargado', 'success');
        } catch (e) {
            app.notify('Error al descargar resource pack', 'error');
        }
    }
};
