<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div v-if="open" class="confirm-backdrop" role="presentation" @click.self="$emit('cancel')">
    <section class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <span class="eyebrow">Confirmation</span>
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="confirm-actions">
        <button class="secondary" @click="$emit('cancel')">取消</button>
        <button class="danger-button" @click="$emit('confirm')">{{ confirmLabel || "确认" }}</button>
      </div>
    </section>
  </div>
</template>
