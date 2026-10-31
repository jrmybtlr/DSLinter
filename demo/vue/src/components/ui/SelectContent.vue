<script setup lang="ts">
import { SelectContent as Primitive, SelectPortal } from 'reka-ui';
</script>
<template><SelectPortal><Primitive v-bind="$attrs"><slot/></Primitive></SelectPortal></template>
