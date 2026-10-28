<script setup lang="ts">
import { ref } from 'vue';
const { label = 'Counter' } = defineProps<{ label?: string }>();
const count = ref(0);
defineSlots<{ default(): unknown; footer(): unknown }>();
</script>
<template><section><button @click="count++">{{ label }}: {{ count }}</button><slot/><footer><slot name="footer"/></footer></section></template>
