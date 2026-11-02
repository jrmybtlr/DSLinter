<script setup lang="ts">
import { SelectItem as Primitive, SelectItemText } from 'reka-ui';
</script>
<template><Primitive v-bind="$attrs"><SelectItemText><slot/></SelectItemText></Primitive></template>
