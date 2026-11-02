<script setup lang="ts">
import { TooltipContent as Primitive, TooltipPortal } from 'reka-ui';
</script>
<template><TooltipPortal><Primitive v-bind="$attrs"><slot/></Primitive></TooltipPortal></template>
