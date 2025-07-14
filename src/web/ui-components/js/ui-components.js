/**
 * Agentic RevOps UI Components Library
 * Modern, accessible, and reusable components
 */

class UIComponents {
  constructor() {
    this.initTheme();
    this.initAccessibility();
    this.initAnimations();
  }

  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  // Accessibility Features
  initAccessibility() {
    // Skip to main content link
    this.createSkipLink();
    
    // Keyboard navigation enhancements
    this.enhanceKeyboardNav();
    
    // ARIA live regions for notifications
    this.createLiveRegions();
  }

  createSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 btn btn-primary';
    skipLink.textContent = 'Skip to main content';
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  enhanceKeyboardNav() {
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + T: Toggle theme
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        this.toggleTheme();
      }
      
      // Escape: Close modals
      if (e.key === 'Escape') {
        this.closeActiveModal();
      }
    });
  }

  createLiveRegions() {
    // Polite announcements
    const politeRegion = document.createElement('div');
    politeRegion.id = 'aria-live-polite';
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.className = 'sr-only';
    document.body.appendChild(politeRegion);
    
    // Assertive announcements
    const assertiveRegion = document.createElement('div');
    assertiveRegion.id = 'aria-live-assertive';
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.className = 'sr-only';
    document.body.appendChild(assertiveRegion);
  }

  announce(message, priority = 'polite') {
    const region = document.getElementById(`aria-live-${priority}`);
    if (region) {
      region.textContent = message;
      setTimeout(() => { region.textContent = ''; }, 3000);
    }
  }

  // Animation Management
  initAnimations() {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!prefersReducedMotion) {
      this.enableSmoothScrolling();
      this.addScrollAnimations();
    }
  }

  enableSmoothScrolling() {
    document.documentElement.style.scrollBehavior = 'smooth';
  }

  addScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -10% 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });
  }

  // Modal Management
  createModal(options = {}) {
    const {
      title = '',
      content = '',
      size = 'medium',
      actions = [],
      onClose = null
    } = options;
    
    const modalId = `modal-${Date.now()}`;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = `${modalId}-backdrop`;
    
    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;
    modal.id = modalId;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${modalId}-title`);
    
    modal.innerHTML = `
      <div class="modal-header">
        <h3 id="${modalId}-title" class="modal-title">${title}</h3>
        <button class="btn btn-ghost btn-icon" onclick="uiComponents.closeModal('${modalId}')" aria-label="Close modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      ${actions.length > 0 ? `
        <div class="modal-footer">
          ${actions.map(action => `
            <button class="btn ${action.class || 'btn-secondary'}" onclick="${action.onclick}">
              ${action.icon ? `<i class="${action.icon}"></i>` : ''}
              ${action.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;
    
    backdrop.addEventListener('click', () => this.closeModal(modalId));
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    // Focus management
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    if (firstFocusable) {
      firstFocusable.focus();
    }
    
    // Trap focus
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });
    
    this.announce('Dialog opened');
    
    return modalId;
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById(`${modalId}-backdrop`);
    
    if (modal && backdrop) {
      modal.style.animation = 'modal-disappear 200ms forwards';
      backdrop.style.animation = 'fade-out 200ms forwards';
      
      setTimeout(() => {
        modal.remove();
        backdrop.remove();
      }, 200);
      
      this.announce('Dialog closed');
    }
  }

  closeActiveModal() {
    const activeModal = document.querySelector('.modal');
    if (activeModal) {
      this.closeModal(activeModal.id);
    }
  }

  // Notification System
  showNotification(options = {}) {
    const {
      title = '',
      message = '',
      type = 'info',
      duration = 5000,
      actions = []
    } = options;
    
    const notificationId = `notification-${Date.now()}`;
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.id = notificationId;
    notification.setAttribute('role', 'alert');
    
    const icon = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    notification.innerHTML = `
      <div class="notification-header">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <i class="fas ${icon}" style="color: var(--${type}-600); font-size: 1.25rem;"></i>
          <div>
            ${title ? `<div class="notification-title">${title}</div>` : ''}
            <div style="color: var(--gray-600); font-size: var(--text-sm);">${message}</div>
          </div>
        </div>
        <button class="notification-close" onclick="uiComponents.closeNotification('${notificationId}')" aria-label="Close notification">
          <i class="fas fa-times"></i>
        </button>
      </div>
      ${actions.length > 0 ? `
        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3); margin-left: 2.5rem;">
          ${actions.map(action => `
            <button class="btn btn-sm ${action.class || 'btn-secondary'}" onclick="${action.onclick}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.closeNotification(notificationId), duration);
    }
    
    // Announce to screen readers
    this.announce(`${type}: ${message}`, type === 'error' ? 'assertive' : 'polite');
    
    return notificationId;
  }

  closeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
      notification.style.animation = 'notification-slide-out 200ms forwards';
      setTimeout(() => notification.remove(), 200);
    }
  }

  // Loading States
  showLoading(targetElement, options = {}) {
    const {
      type = 'spinner',
      message = 'Loading...',
      overlay = true
    } = options;
    
    const loadingId = `loading-${Date.now()}`;
    const loadingElement = document.createElement('div');
    loadingElement.id = loadingId;
    loadingElement.className = 'loading-container';
    
    if (type === 'spinner') {
      loadingElement.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          ${message ? `<p style="margin-top: var(--space-3); color: var(--gray-600);">${message}</p>` : ''}
        </div>
      `;
    } else if (type === 'skeleton') {
      loadingElement.innerHTML = `
        <div class="skeleton" style="height: 100%; min-height: 200px;"></div>
      `;
    }
    
    if (overlay) {
      loadingElement.style.cssText = `
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(2px);
        z-index: 10;
      `;
      targetElement.style.position = 'relative';
    }
    
    targetElement.appendChild(loadingElement);
    targetElement.setAttribute('aria-busy', 'true');
    
    return loadingId;
  }

  hideLoading(loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
      const parent = loadingElement.parentElement;
      loadingElement.remove();
      parent.removeAttribute('aria-busy');
    }
  }

  // Form Validation
  validateForm(formElement) {
    const errors = [];
    const inputs = formElement.querySelectorAll('[required], [pattern], [type="email"], [type="url"]');
    
    inputs.forEach(input => {
      const value = input.value.trim();
      const label = input.labels?.[0]?.textContent || input.name || 'Field';
      
      // Required validation
      if (input.hasAttribute('required') && !value) {
        errors.push({ field: input, message: `${label} is required` });
      }
      
      // Pattern validation
      if (input.hasAttribute('pattern') && value) {
        const pattern = new RegExp(input.getAttribute('pattern'));
        if (!pattern.test(value)) {
          errors.push({ field: input, message: `${label} format is invalid` });
        }
      }
      
      // Email validation
      if (input.type === 'email' && value) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          errors.push({ field: input, message: `Please enter a valid email address` });
        }
      }
      
      // URL validation
      if (input.type === 'url' && value) {
        try {
          new URL(value);
        } catch {
          errors.push({ field: input, message: `Please enter a valid URL` });
        }
      }
    });
    
    // Display errors
    this.clearFormErrors(formElement);
    errors.forEach(error => {
      this.showFieldError(error.field, error.message);
    });
    
    return errors.length === 0;
  }

  showFieldError(field, message) {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `${field.id}-error`);
    
    const errorElement = document.createElement('div');
    errorElement.id = `${field.id}-error`;
    errorElement.className = 'form-error';
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    
    field.parentElement.appendChild(errorElement);
  }

  clearFormErrors(formElement) {
    formElement.querySelectorAll('.error').forEach(field => {
      field.classList.remove('error');
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    });
    
    formElement.querySelectorAll('.form-error').forEach(error => {
      error.remove();
    });
  }

  // Utility Functions
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  formatCurrency(amount, currency = 'USD', locale = 'en-US') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date, options = {}) {
    const defaults = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaults, ...options }).format(new Date(date));
  }

  formatRelativeTime(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return this.formatDate(date);
  }
}

// Initialize UI Components
const uiComponents = new UIComponents();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}