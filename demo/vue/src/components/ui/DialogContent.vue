<script setup lang="ts">
import { DialogContent as Primitive, DialogPortal } from 'reka-ui';
</script>
<template><DialogPortal><Primitive v-bind="$attrs"><slot/></Primitive></DialogPortal></template>
