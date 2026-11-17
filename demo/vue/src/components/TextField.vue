<script setup lang="ts">
const value = defineModel<string>({ default: '' });
defineEmits<{ change: [value: string] }>();
</script>
<template><input aria-label="Example text field" v-model="value" @change="$emit('change', value)"/></template>
