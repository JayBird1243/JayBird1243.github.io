// In-App Notifications UI
// Handles bell icon badge and notification modal

(() => {
  // Guard against double-loading
  if (window.NotificationsUI) return;

  // Design Spec Styles for the Modal
  // We inject this to ensure the modal looks correct on all pages, even if they don't have the main design spec CSS loaded.
  const modalStyles = `
    .notif-modal-glass {
      background: rgba(20, 20, 20, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .notif-item-hover:hover {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .text-electric-blue { color: #00BFFF; }
    .text-magenta { color: #FF00FF; }
    .text-lime { color: #32CD32; }
    .font-orbitron { font-family: 'Orbitron', sans-serif; }
    .font-rajdhani { font-family: 'Rajdhani', sans-serif; }
    .font-source-code { font-family: 'Source Code Pro', monospace; }
  `;

  class NotificationsUI {
    constructor() {
      this.unsubscribe = null;
      this.notifications = [];
      this.injectStyles();
    }

    injectStyles() {
      if (!document.getElementById('notifications-ui-styles')) {
        const style = document.createElement('style');
        style.id = 'notifications-ui-styles';
        style.textContent = modalStyles;
        document.head.appendChild(style);
      }
      
      // Ensure fonts are loaded if not already
      if (!document.getElementById('google-fonts-ui')) {
        const link = document.createElement('link');
        link.id = 'google-fonts-ui';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@500;600;700&family=Source+Code+Pro:wght@400;600&display=swap';
        document.head.appendChild(link);
      }
    }

    async initialize(uid) {
      if (!uid || !window.firebase) {
        console.warn('[NotificationsUI] Cannot initialize - missing uid or firebase');
        return;
      }

      // Prefer canonical Firestore module exports (firebase-config.js), and fall back to window.firebase
      // NOTE: some pages may overwrite window.firebase; firebaseModules is more stable.
      const firestoreApi = window.firebaseModules?.firestoreModule || window.firebase;
      const { collection, query, where, orderBy, onSnapshot } = firestoreApi || {};
      
      try {
        if (typeof collection !== 'function' || typeof onSnapshot !== 'function') {
          console.warn('[NotificationsUI] Firestore helpers not available (collection/onSnapshot). Aborting init.');
          return;
        }

        const notificationsRef = collection(window.db, 'users', uid, 'inAppNotifications');
        const q = query(
          notificationsRef,
          where('dismissed', '==', false),
          orderBy('createdAt', 'desc')
        );
        
        this.unsubscribe = onSnapshot(q, (snapshot) => {
          this.notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          this.updateBellIcon();
          
          // If modal is open, re-render content
          const modal = document.getElementById('notifications-modal');
          if (modal && !modal.classList.contains('hidden')) {
            this.renderNotifications(modal);
          }
        });
        
        this.setupModalHandlers();
        
      } catch (error) {
        console.error('[NotificationsUI] Initialization error:', error);
      }
    }

    updateBellIcon() {
      const bellButtons = document.querySelectorAll('.notification-bell-button');
      const count = this.notifications.length;
      
      bellButtons.forEach(button => {
        // Support "dot-only" indicators
        const dot = button.querySelector('.notification-dot');
        if (dot) {
          if (count > 0) dot.classList.remove('hidden');
          else dot.classList.add('hidden');
          return;
        }

        // Standard badge
        const existingBadge = button.querySelector('.notification-badge');
        if (existingBadge) existingBadge.remove();
        
        if (count > 0) {
          const badge = document.createElement('span');
          badge.className = 'notification-badge';
          badge.style.cssText = `
            position: absolute; top: -4px; right: -4px;
            background: #FF00FF; color: white;
            border-radius: 9999px; min-width: 18px; height: 18px;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; padding: 0 4px;
            box-shadow: 0 0 10px rgba(255, 0, 255, 0.4);
            font-family: 'Rajdhani', sans-serif;
          `;
          badge.textContent = count > 99 ? '99+' : count;
          button.style.position = 'relative';
          button.appendChild(badge);
        }
      });
    }

    setupModalHandlers() {
      const bellButtons = document.querySelectorAll('.notification-bell-button');
      bellButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openModal();
        });
      });
    }

    openModal() {
      let modal = document.getElementById('notifications-modal');
      if (!modal) {
        modal = this.createModal();
        document.body.appendChild(modal);
      }
      this.renderNotifications(modal);
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    closeModal() {
      const modal = document.getElementById('notifications-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
      }
    }

    createModal() {
      const modal = document.createElement('div');
      modal.id = 'notifications-modal';
      modal.className = 'fixed inset-0 bg-black/60 hidden items-center justify-center z-50 backdrop-blur-sm p-4';
      
      modal.innerHTML = `
        <div class="notif-modal-glass w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden animate-fade-in-up">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-white/10 relative z-10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-magenta/10 flex items-center justify-center border border-magenta/20">
                <i class="fa-solid fa-bell text-magenta text-sm"></i>
              </div>
              <h2 class="text-xl font-bold text-white font-orbitron tracking-wide">NOTIFICATIONS</h2>
              <span id="notification-count-badge" class="px-2 py-0.5 bg-white/5 text-gray-400 border border-white/10 text-xs font-source-code rounded">0</span>
            </div>
            <button id="close-notifications-modal" class="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          
          <!-- List -->
          <div id="notifications-list-container" class="flex-1 overflow-y-auto p-4 space-y-2 relative z-10 custom-scrollbar">
            <!-- Notifications injected here -->
          </div>
          
          <!-- Footer -->
          <div class="p-4 border-t border-white/10 flex justify-between items-center bg-black/20 relative z-10">
            <button id="dismiss-all-notifications" class="px-4 py-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition text-sm font-rajdhani font-semibold flex items-center gap-2">
              <i class="fa-solid fa-check-double"></i> Dismiss All
            </button>
            <button id="close-notifications-modal-bottom" class="px-6 py-2 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue border border-electric-blue/30 rounded-lg transition text-sm font-rajdhani font-bold tracking-wide">
              CLOSE
            </button>
          </div>

          <!-- Decor -->
          <div class="absolute top-0 right-0 w-64 h-64 bg-magenta/10 rounded-full blur-[60px] pointer-events-none -mr-20 -mt-20"></div>
          <div class="absolute bottom-0 left-0 w-64 h-64 bg-electric-blue/5 rounded-full blur-[60px] pointer-events-none -ml-20 -mb-20"></div>
        </div>
      `;
      
      // Events
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
      
      const closeButtons = modal.querySelectorAll('#close-notifications-modal, #close-notifications-modal-bottom');
      closeButtons.forEach(btn => btn.addEventListener('click', () => this.closeModal()));
      
      const dismissAllBtn = modal.querySelector('#dismiss-all-notifications');
      dismissAllBtn.addEventListener('click', () => this.dismissAll());
      
      return modal;
    }

    renderNotifications(modal) {
      const list = modal.querySelector('#notifications-list-container');
      const countBadge = modal.querySelector('#notification-count-badge');
      
      countBadge.textContent = `${this.notifications.length}`;
      
      if (this.notifications.length === 0) {
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center h-64 text-gray-500">
            <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <i class="fa-solid fa-bell-slash text-2xl"></i>
            </div>
            <p class="text-lg font-rajdhani font-semibold">No new notifications</p>
            <p class="text-xs font-source-code mt-1 opacity-60">SYSTEM STATUS: CLEAR</p>
          </div>
        `;
        return;
      }
      
      list.innerHTML = this.notifications.map(notif => this.createNotificationCard(notif)).join('');
      
      list.querySelectorAll('.dismiss-notification-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card click
          const notifId = btn.dataset.notificationId;
          this.dismissNotification(notifId);
        });
      });
    }

    createNotificationCard(notification) {
      const timeAgo = this.getTimeAgo(notification.createdAt);
      const postCount = notification.postsInvolved?.length || 0;
      // Determine icon based on type (mock logic, can be refined)
      const icon = notification.type === 'alert' ? 'fa-triangle-exclamation text-lime' : 'fa-circle-info text-electric-blue';
      
      return `
        <div class="group relative flex items-start gap-4 p-4 rounded-xl border border-transparent notif-item-hover transition-all cursor-default">
          <div class="mt-1 w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-white/10">
            <i class="fa-solid ${icon} text-xs"></i>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start gap-2">
              <h3 class="text-gray-200 font-rajdhani font-bold text-lg leading-tight group-hover:text-white transition-colors">
                ${this.escapeHtml(notification.notificationTitle || 'Notification')}
              </h3>
              <span class="text-[10px] text-gray-500 font-source-code whitespace-nowrap pt-1">${timeAgo}</span>
            </div>
            
            <p class="text-gray-400 text-sm mt-1 font-inter line-clamp-2">
              ${notification.message ? this.escapeHtml(notification.message) : ''}
            </p>
            
            <div class="flex items-center gap-3 mt-3">
              ${postCount > 0 ? `
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-white/5 text-gray-400 font-source-code border border-white/5">
                  <i class="fa-solid fa-layer-group text-[9px]"></i> ${postCount} Posts
                </span>
              ` : ''}
              ${notification.trackingKey && notification.trackingKey !== 'default' ? `
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-white/5 text-gray-400 font-source-code border border-white/5">
                  <i class="fa-solid fa-tag text-[9px]"></i> ${this.escapeHtml(notification.trackingKey)}
                </span>
              ` : ''}
            </div>
          </div>

          <button class="dismiss-notification-btn absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400 transition" 
                  data-notification-id="${notification.id}"
                  title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }

    async dismissNotification(notificationId) {
      try {
        const firestoreApi = window.firebaseModules?.firestoreModule || window.firebase;
        const { doc, updateDoc, serverTimestamp } = firestoreApi || {};
        const uid = window.firebase?.auth?.currentUser?.uid || window.auth?.currentUser?.uid;
        if (!uid) return;
        if (typeof doc !== 'function' || typeof updateDoc !== 'function') return;
        
        // Optimistic UI update could be added here
        
        const notifRef = doc(window.db, 'users', uid, 'inAppNotifications', notificationId);
        await updateDoc(notifRef, {
          dismissed: true,
          dismissedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('[NotificationsUI] Error dismissing notification:', error);
      }
    }

    async dismissAll() {
      try {
        const firestoreApi = window.firebaseModules?.firestoreModule || window.firebase;
        const { doc, updateDoc, serverTimestamp } = firestoreApi || {};
        const uid = window.firebase?.auth?.currentUser?.uid || window.auth?.currentUser?.uid;
        if (!uid || this.notifications.length === 0) return;
        if (typeof doc !== 'function' || typeof updateDoc !== 'function') return;
        
        const timestamp = serverTimestamp();
        const promises = this.notifications.map(notif => {
          const notifRef = doc(window.db, 'users', uid, 'inAppNotifications', notif.id);
          return updateDoc(notifRef, {
            dismissed: true,
            dismissedAt: timestamp
          });
        });
        
        await Promise.all(promises);
      } catch (error) {
        console.error('[NotificationsUI] Error dismissing all notifications:', error);
      }
    }

    getTimeAgo(timestamp) {
      if (!timestamp) return 'Unknown';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      
      const intervals = {
        y: 31536000,
        mo: 2592000,
        d: 86400,
        h: 3600,
        m: 60,
        s: 1
      };
      
      for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
          return `${interval}${unit} ago`;
        }
      }
      return 'just now';
    }

    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    destroy() {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
      const modal = document.getElementById('notifications-modal');
      if (modal) modal.remove();
      const style = document.getElementById('notifications-ui-styles');
      if (style) style.remove();
    }
  }

  // Export
  window.NotificationsUI = NotificationsUI;
})();
