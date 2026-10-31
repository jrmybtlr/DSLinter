<script setup lang="ts">
import { usePage, Link } from '@inertiajs/vue3';
const page = usePage<{ auth: { user: { name: string } } }>();
</script>
<template><p>{{ page.props.auth.user.name }}</p><Link href="/profile">Profile</Link></template>
