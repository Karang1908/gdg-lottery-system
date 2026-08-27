(function () {
  'use strict';

  const BRAND = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
  const TWO_PI = Math.PI * 2;

  function normalizeAngle(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  class LotteryWheel {
    constructor({ canvas, empty, tooltip }) {
      this.canvas = canvas;
      if (window.innerWidth <= 700) {
        canvas.width = 720;
        canvas.height = 720;
      }
      this.ctx = canvas.getContext('2d');
      this.empty = empty;
      this.tooltip = tooltip;
      this.entries = [];
      this.rotation = -Math.PI / 2;
      this.spinning = false;
      this.tooltipTimer = null;
      this.palette = this.readPalette();
      this.mark = new Image();
      this.markReady = false;
      this.mark.onload = () => {
        this.markReady = true;
        this.draw();
      };
      this.mark.src = '/assets/gdg-mark.png';

      canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
      canvas.addEventListener('pointerdown', (event) => {
        this.onPointerMove(event);
        if (matchMedia('(pointer: coarse)').matches) {
          clearTimeout(this.tooltipTimer);
          this.tooltipTimer = setTimeout(() => this.hideTooltip(), 2200);
        }
      });
      canvas.addEventListener('pointerleave', () => this.hideTooltip());
      canvas.addEventListener('pointercancel', () => this.hideTooltip());
      window.addEventListener('themechange', () => {
        this.palette = this.readPalette();
        this.draw();
      });
      this.draw();
    }

    readPalette() {
      const styles = getComputedStyle(document.documentElement);
      const value = (name, fallback) =>
        (styles.getPropertyValue(name) || fallback).trim();
      return {
        rim: value('--wheel-rim', '#ffffff'),
        ink: value('--wheel-ink', '#202124'),
        muted: value('--surface-3', '#f1f3f4'),
        mutedInk: value('--text-3', '#80868b'),
        hubBorder: value('--border', '#dadce0'),
      };
    }

    setEntries(entries) {
      const previousCount = this.entries.length;
      this.entries = Array.isArray(entries) ? entries : [];
      if (!this.spinning && previousCount !== this.entries.length) {
        const segment = this.entries.length ? TWO_PI / this.entries.length : 0;
        this.rotation = -Math.PI / 2 - segment / 2;
      }
      this.canvas.setAttribute(
        'aria-label',
        this.entries.length
          ? `Lottery wheel with ${this.entries.length} entrants. Hover or use the entrant list to identify dense slices.`
          : 'The lottery wheel is waiting for entrants.'
      );
      this.draw();
    }

    colorFor(index, count) {
      if (count > 1 && index === count - 1 && count % 4 === 1) return BRAND[1];
      return BRAND[index % BRAND.length];
    }

    fitText(text, maxWidth) {
      if (this.ctx.measureText(text).width <= maxWidth) return text;
      const first = String(text).split(/\s+/)[0] || text;
      if (this.ctx.measureText(first).width <= maxWidth) return first;
      let clipped = first;
      while (
        clipped.length > 1 &&
        this.ctx.measureText(`${clipped}…`).width > maxWidth
      ) {
        clipped = clipped.slice(0, -1);
      }
      return `${clipped}…`;
    }

    draw() {
      const { ctx, canvas, entries } = this;
      const size = canvas.width;
      const center = size / 2;
      const radius = size / 2 - 18;
      ctx.clearRect(0, 0, size, size);

      const hasEntries = entries.length > 0;
      canvas.classList.toggle('hidden', !hasEntries);
      this.empty?.classList.toggle('hidden', hasEntries);
      if (!hasEntries) return;

      const count = entries.length;
      const segment = TWO_PI / count;
      const hub = Math.max(76, radius * 0.17);
      const labelRadius = radius * 0.64;
      const arcWidth = (TWO_PI * labelRadius) / count;
      const fullLabels = count <= 48;
      const initials = count > 48 && count <= 180;
      const fontSize = fullLabels
        ? Math.max(11, Math.min(35, arcWidth * 0.55))
        : Math.max(8, Math.min(12, arcWidth * 0.7));

      for (let index = 0; index < count; index += 1) {
        const entry = entries[index];
        const start = this.rotation + index * segment;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, start, start + segment);
        ctx.closePath();
        ctx.fillStyle = entry.selected
          ? this.palette.muted
          : this.colorFor(index, count);
        ctx.fill();
        ctx.strokeStyle = this.palette.rim;
        ctx.lineWidth = count > 120 ? 1.5 : count > 64 ? 2.25 : 4;
        ctx.stroke();

        if (!fullLabels && !initials) continue;
        const middle = start + segment / 2;
        let label = entry.name;
        if (initials) {
          label = String(entry.name || '')
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join('')
            .toUpperCase();
        }

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(middle);
        const angle = normalizeAngle(middle);
        const flipped = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;
        if (flipped) ctx.rotate(Math.PI);
        ctx.font = `700 ${fontSize}px 'Google Sans', system-ui, sans-serif`;
        ctx.textAlign = flipped ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = entry.selected ? this.palette.mutedInk : this.palette.ink;
        const available = radius - hub - 58;
        const fitted = fullLabels ? this.fitText(label, available) : label;
        ctx.fillText(fitted, flipped ? -(radius - 26) : radius - 26, 0);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(center, center, hub, 0, TWO_PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = this.palette.hubBorder;
      ctx.lineWidth = 6;
      ctx.stroke();

      if (this.markReady) {
        const markSize = hub * 1.25;
        ctx.drawImage(
          this.mark,
          center - markSize / 2,
          center - markSize / 2,
          markSize,
          markSize
        );
      }
    }

    onPointerMove(event) {
      if (!this.entries.length || this.spinning || !this.tooltip) {
        this.hideTooltip();
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      const center = this.canvas.width / 2;
      const radius = this.canvas.width / 2 - 18;
      const distance = Math.hypot(x - center, y - center);
      if (distance < radius * 0.2 || distance > radius) {
        this.hideTooltip();
        return;
      }
      const segment = TWO_PI / this.entries.length;
      const angle = Math.atan2(y - center, x - center);
      const index = Math.floor(normalizeAngle(angle - this.rotation) / segment);
      const entry = this.entries[index];
      if (!entry) return this.hideTooltip();
      this.tooltip.textContent = `${entry.name}${entry.selected ? ' · already selected' : ' · eligible'}`;
      this.tooltip.style.left = `${Math.min(window.innerWidth - 270, event.clientX + 14)}px`;
      this.tooltip.style.top = `${Math.max(12, event.clientY - 42)}px`;
      this.tooltip.classList.remove('hidden');
    }

    hideTooltip() {
      this.tooltip?.classList.add('hidden');
    }

    async spinTo(index) {
      if (this.spinning || index < 0 || index >= this.entries.length) return;
      const count = this.entries.length;
      const segment = TWO_PI / count;
      const from = this.rotation;
      let target = -Math.PI / 2 - (index + 0.5) * segment;
      while (target <= from) target += TWO_PI;
      target += TWO_PI * 6;
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const coarsePointer = matchMedia('(pointer: coarse)').matches;
      const duration = reducedMotion ? 700 : coarsePointer ? 4200 : 5200;
      const start = performance.now();
      let lastPaint = 0;
      this.spinning = true;
      this.hideTooltip();

      await new Promise((resolve) => {
        const frame = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          if (
            coarsePointer &&
            !reducedMotion &&
            progress < 1 &&
            now - lastPaint < 32
          ) {
            requestAnimationFrame(frame);
            return;
          }
          lastPaint = now;
          const eased =
            progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          this.rotation = from + (target - from) * eased;
          this.draw();
          if (progress < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });

      this.rotation = normalizeAngle(this.rotation);
      this.spinning = false;
      this.draw();
    }
  }

  window.LotteryWheel = LotteryWheel;
})();
