<script setup lang="ts">
defineProps<{ user: { name: string; email: string; roles: string[] } }>();
</script>
<template><section><h2>{{ user.name }}</h2><p>{{ user.email }}</p><p>{{ user.roles.join(', ') }}</p></section></template>
