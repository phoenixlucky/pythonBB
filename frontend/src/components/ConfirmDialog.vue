<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;

function focusDialog() {
  void nextTick(() => dialogRef.value?.querySelector<HTMLButtonElement>("button")?.focus());
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("cancel");
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(dialogRef.value?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || []);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(() => props.open, (open) => { if (open) focusDialog(); });
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (props.open) focusDialog();
});
onUnmounted(() => { returnFocus?.focus(); });
</script>

<template>
  <div v-if="open" class="confirm-backdrop" role="presentation" @click.self="$emit('cancel')" @keydown="handleKeydown">
    <section ref="dialogRef" class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
      <span class="eyebrow">Confirmation</span>
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="confirm-actions">
        <button class="secondary" @click="emit('cancel')">取消</button>
        <button class="danger-button" @click="emit('confirm')">{{ confirmLabel || "确认" }}</button>
      </div>
    </section>
  </div>
</template>
