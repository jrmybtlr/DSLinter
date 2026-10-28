<script setup lang="ts">
import { PopoverContent as Primitive, PopoverPortal } from 'reka-ui';
</script>
<template><PopoverPortal><Primitive v-bind="$attrs"><slot/></Primitive></PopoverPortal></template>
